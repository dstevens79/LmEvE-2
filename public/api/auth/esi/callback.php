<?php
// EVE SSO OAuth callback: exchange code, verify, and store tokens in DB users table
require_once __DIR__ . '/../../_lib/common.php';

// If invoked by CCP as plain GET (HTTP deployments), handle the exchange server-side
// using server-stored DB/ESI config and then redirect to app root without exposing code/state.
// POST mode remains JSON API for programmatic use.

function http_post_json($url, $headers, $data) {
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_HTTPHEADER, array_merge(['Content-Type: application/x-www-form-urlencoded'], $headers));
  curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
  $resp = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $err = curl_error($ch);
  curl_close($ch);
  if ($resp === false) return [null, $code, $err];
  return [$resp, $code, null];
}

function http_get_json($url, $headers) {
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
  $resp = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $err = curl_error($ch);
  curl_close($ch);
  if ($resp === false) return [null, $code, $err];
  return [$resp, $code, null];
}

// Determine payload based on method
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$payload = $method === 'POST' ? api_read_json() : $_GET;
// Expect minimal OAuth details; DB/ESI config will be loaded from server settings if not provided
api_expect($payload, ['code']);

$db = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($db, (string)($payload['database'] ?? $dbCfg['database'] ?? 'lmeve2'));

$esiCfg = api_get_esi_config($payload);
$clientId = (string)($esiCfg['clientId'] ?? '');
$clientSecret = (string)($esiCfg['clientSecret'] ?? '');
$code = (string)$payload['code'];
$redirectUri = (string)($payload['redirectUri'] ?? $esiCfg['callbackUrl'] ?? '');

$basic = base64_encode($clientId . ':' . $clientSecret);

// 1) Exchange code for tokens
$tokenUrl = 'https://login.eveonline.com/v2/oauth/token';
list($resp, $status, $err) = http_post_json($tokenUrl, ["Authorization: Basic $basic"], [
  'grant_type' => 'authorization_code',
  'code' => $code,
  'redirect_uri' => $redirectUri,
]);
if ($resp === null || $status < 200 || $status >= 300) {
  api_fail(200, 'Token exchange failed', ['status' => $status, 'error' => $err, 'body' => $resp]);
}
$tokenData = json_decode($resp, true);
if (!is_array($tokenData) || empty($tokenData['access_token'])) {
  api_fail(200, 'Invalid token response', ['body' => $resp]);
}
$accessToken = $tokenData['access_token'];
$refreshToken = $tokenData['refresh_token'] ?? null;
$expiresIn = (int)($tokenData['expires_in'] ?? 0);
$tokenType = $tokenData['token_type'] ?? 'Bearer';
$expiresAt = (new DateTimeImmutable('+'.max($expiresIn,0).' seconds'))->format('Y-m-d H:i:s');

// 2) Verify identity via SSO verify endpoint
$verifyUrl = 'https://login.eveonline.com/oauth/verify';
list($vbody, $vcode, $verr) = http_get_json($verifyUrl, ["Authorization: Bearer $accessToken"]);
if ($vbody === null || $vcode < 200 || $vcode >= 300) {
  api_fail(200, 'SSO verify failed', ['status' => $vcode, 'error' => $verr, 'body' => $vbody]);
}
$verify = json_decode($vbody, true);
if (!is_array($verify) || empty($verify['CharacterID'])) {
  api_fail(200, 'Invalid verify response', ['body' => $vbody]);
}
$characterId = (int)$verify['CharacterID'];
$characterName = (string)$verify['CharacterName'];
$scopes = (string)($verify['Scopes'] ?? '');

// 3) Get character -> corporation from ESI
$charUrl = "https://esi.evetech.net/latest/characters/$characterId/?datasource=tranquility";
list($cbody, $ccode, $cerr) = http_get_json($charUrl, ["Authorization: Bearer $accessToken"]);
if ($cbody === null || $ccode < 200 || $ccode >= 300) {
  api_fail(200, 'ESI character lookup failed', ['status' => $ccode, 'error' => $cerr, 'body' => $cbody]);
}
$char = json_decode($cbody, true);
$corpId = (int)($char['corporation_id'] ?? 0);

// 4) Upsert user record
$stmt = @$db->prepare('INSERT INTO users (username, character_id, character_name, corporation_id, access_token, refresh_token, token_expiry, scopes, auth_method, role, is_active, last_login) VALUES (?,?,?,?,?,?,?,?,\'esi\',\'corp_member\',1, NOW()) ON DUPLICATE KEY UPDATE character_name=VALUES(character_name), corporation_id=VALUES(corporation_id), access_token=VALUES(access_token), refresh_token=VALUES(refresh_token), token_expiry=VALUES(token_expiry), scopes=VALUES(scopes), last_login=NOW()');
if (!$stmt) { api_fail(200, 'DB prepare failed', ['error' => $db->error]); }
$username = $characterName; // For simplicity
$stmt->bind_param('sisisssss', $username, $characterId, $characterName, $corpId, $accessToken, $refreshToken, $expiresAt, $scopes);
if (!$stmt->execute()) { api_fail(200, 'DB execute failed', ['error' => $stmt->error]); }
$stmt->close();

$db->close();

// For POST (programmatic), return JSON as before
if ($method === 'POST') {
  api_respond([
    'ok' => true,
    'characterId' => $characterId,
    'characterName' => $characterName,
    'corporationId' => $corpId,
    'scopes' => $scopes,
    'expiresAt' => $expiresAt,
    'tokenType' => $tokenType
  ]);
}

// For GET (CCP redirect), redirect back to the app root without leaking params
header('Location: /?auth=ok', true, 302);
exit;
