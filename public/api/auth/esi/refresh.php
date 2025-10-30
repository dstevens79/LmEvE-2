<?php
// Refresh EVE SSO tokens and update DB
require_once __DIR__ . '/../../_lib/common.php';

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

$payload = api_read_json();
api_expect($payload, ['host','port','username','password','database','clientId','clientSecret','characterId','refreshToken']);

$db = api_connect($payload);
api_select_db($db, (string)$payload['database']);

$clientId = (string)$payload['clientId'];
$clientSecret = (string)$payload['clientSecret'];
$refreshToken = (string)$payload['refreshToken'];
$characterId = (int)$payload['characterId'];
$basic = base64_encode($clientId . ':' . $clientSecret);

$tokenUrl = 'https://login.eveonline.com/v2/oauth/token';
list($resp, $status, $err) = http_post_json($tokenUrl, ["Authorization: Basic $basic"], [
  'grant_type' => 'refresh_token',
  'refresh_token' => $refreshToken,
]);
if ($resp === null || $status < 200 || $status >= 300) {
  api_fail(200, 'Refresh failed', ['status' => $status, 'error' => $err, 'body' => $resp]);
}
$tokenData = json_decode($resp, true);
if (!is_array($tokenData) || empty($tokenData['access_token'])) {
  api_fail(200, 'Invalid token response', ['body' => $resp]);
}
$accessToken = $tokenData['access_token'];
$newRefresh = $tokenData['refresh_token'] ?? $refreshToken;
$expiresIn = (int)($tokenData['expires_in'] ?? 0);
$expiresAt = (new DateTimeImmutable('+'.max($expiresIn,0).' seconds'))->format('Y-m-d H:i:s');

$stmt = @$db->prepare('UPDATE users SET access_token=?, refresh_token=?, token_expiry=?, last_login=NOW() WHERE character_id=?');
if (!$stmt) { api_fail(200, 'DB prepare failed', ['error' => $db->error]); }
$stmt->bind_param('sssi', $accessToken, $newRefresh, $expiresAt, $characterId);
if (!$stmt->execute()) { api_fail(200, 'DB execute failed', ['error' => $stmt->error]); }
$stmt->close();

$db->close();
api_respond(['ok' => true, 'characterId' => $characterId, 'expiresAt' => $expiresAt]);
