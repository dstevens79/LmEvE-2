<?php
// EVE SSO OAuth callback: exchange code, verify, store tokens, establish browser session.
require_once __DIR__ . '/../../_lib/common.php';
require_once __DIR__ . '/../../_lib/session.php';

// If invoked by CCP as plain GET (HTTP deployments), handle the exchange server-side
// using server-stored DB/ESI config and then redirect to app root without exposing code/state.
// POST mode remains JSON API for programmatic use.

function http_post_form($url, $headers, $data) {
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

function callback_fail_redirect($message) {
  $q = http_build_query(['auth' => 'error', 'reason' => $message]);
  header('Location: /?' . $q, true, 302);
  exit;
}

// Determine payload based on method
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$payload = $method === 'POST' ? api_read_json() : $_GET;

// Expect minimal OAuth details; DB/ESI config will be loaded from server settings if not provided
if (empty($payload['code'])) {
  if ($method === 'GET') {
    callback_fail_redirect('missing_code');
  }
  api_expect($payload, ['code']);
}

$code = (string)$payload['code'];
$state = isset($payload['state']) ? (string)$payload['state'] : '';

// Validate CSRF state for browser GET callback when start.php stored oauth state.
// POST/programmatic callers may omit prior start.php usage.
$oauthMeta = null;
if ($method === 'GET') {
  api_session_start();
  $storedOauth = $_SESSION[LMEVE_SESSION_OAUTH_KEY] ?? null;
  $hasStoredState = is_array($storedOauth) && !empty($storedOauth['state']);
  if ($hasStoredState) {
    if ($state === '') {
      callback_fail_redirect('missing_state');
    }
    $oauthMeta = api_oauth_consume_state($state);
    if ($oauthMeta === null) {
      callback_fail_redirect('invalid_state');
    }
  } elseif ($state !== '') {
    // No server-stored state (legacy path). Do not invent security from a free-floating state.
    $oauthMeta = null;
  }
}

try {
  $db = api_connect($payload);
  $dbCfg = api_get_db_config($payload);
  api_select_db($db, (string)($dbCfg['database'] ?? 'lmeve2'));

  $esiCfg = api_get_esi_config($payload);
  $clientId = (string)($esiCfg['clientId'] ?? '');
  $clientSecret = (string)($esiCfg['clientSecret'] ?? '');
  $redirectUri = (string)($payload['redirectUri'] ?? ($oauthMeta['redirect_uri'] ?? ($esiCfg['callbackUrl'] ?? '')));
  if ($clientId === '' || $clientSecret === '') {
    if ($method === 'GET') callback_fail_redirect('esi_not_configured');
    api_fail(400, 'ESI is not configured');
  }

  $basic = base64_encode($clientId . ':' . $clientSecret);

  // 1) Exchange code for tokens (web/confidential client)
  $tokenUrl = 'https://login.eveonline.com/v2/oauth/token';
  $tokenBody = [
    'grant_type' => 'authorization_code',
    'code' => $code,
  ];
  if ($redirectUri !== '') {
    $tokenBody['redirect_uri'] = $redirectUri;
  }
  list($resp, $status, $err) = http_post_form($tokenUrl, ["Authorization: Basic $basic"], $tokenBody);
  if ($resp === null || $status < 200 || $status >= 300) {
    if ($method === 'GET') callback_fail_redirect('token_exchange_failed');
    api_fail(200, 'Token exchange failed', ['status' => $status, 'error' => $err, 'body' => $resp]);
  }
  $tokenData = json_decode($resp, true);
  if (!is_array($tokenData) || empty($tokenData['access_token'])) {
    if ($method === 'GET') callback_fail_redirect('invalid_token_response');
    api_fail(200, 'Invalid token response', ['body' => $resp]);
  }
  $accessToken = (string)$tokenData['access_token'];
  $refreshToken = isset($tokenData['refresh_token']) ? (string)$tokenData['refresh_token'] : null;
  $expiresIn = (int)($tokenData['expires_in'] ?? 0);
  $tokenType = $tokenData['token_type'] ?? 'Bearer';
  $expiresAt = (new DateTimeImmutable('+' . max($expiresIn, 0) . ' seconds'))->format('Y-m-d H:i:s');

  // 2) Verify identity via SSO verify endpoint
  $verifyUrl = 'https://login.eveonline.com/oauth/verify';
  list($vbody, $vcode, $verr) = http_get_json($verifyUrl, ['Authorization: Bearer ' . $accessToken]);
  if ($vbody === null || $vcode < 200 || $vcode >= 300) {
    if ($method === 'GET') callback_fail_redirect('sso_verify_failed');
    api_fail(200, 'SSO verify failed', ['status' => $vcode, 'error' => $verr, 'body' => $vbody]);
  }
  $verify = json_decode($vbody, true);
  if (!is_array($verify) || empty($verify['CharacterID'])) {
    if ($method === 'GET') callback_fail_redirect('invalid_verify_response');
    api_fail(200, 'Invalid verify response', ['body' => $vbody]);
  }
  $characterId = (int)$verify['CharacterID'];
  $characterName = (string)$verify['CharacterName'];
  $scopes = (string)($verify['Scopes'] ?? '');

  // 3) Get character -> corporation from ESI
  $charUrl = "https://esi.evetech.net/latest/characters/$characterId/?datasource=tranquility";
  list($cbody, $ccode, $cerr) = http_get_json($charUrl, ['Authorization: Bearer ' . $accessToken]);
  $corpId = 0;
  if ($cbody !== null && $ccode >= 200 && $ccode < 300) {
    $char = json_decode($cbody, true);
    $corpId = (int)($char['corporation_id'] ?? 0);
  }

  // 4) Upsert user record with tokens (server-side vault)
  $stmt = @$db->prepare(
    'INSERT INTO users (username, character_id, character_name, corporation_id, access_token, refresh_token, token_expiry, scopes, auth_method, role, is_active, last_login)
     VALUES (?,?,?,?,?,?,?,?,\'esi\',\'corp_member\',1, NOW())
     ON DUPLICATE KEY UPDATE
       character_name=VALUES(character_name),
       corporation_id=VALUES(corporation_id),
       access_token=VALUES(access_token),
       refresh_token=VALUES(refresh_token),
       token_expiry=VALUES(token_expiry),
       scopes=VALUES(scopes),
       auth_method=\'esi\',
       last_login=NOW()'
  );
  if (!$stmt) {
    if ($method === 'GET') callback_fail_redirect('db_prepare_failed');
    api_fail(200, 'DB prepare failed', ['error' => $db->error]);
  }
  $username = $characterName;
  $refresh = $refreshToken !== null ? (string)$refreshToken : '';
  $stmt->bind_param('sisissss', $username, $characterId, $characterName, $corpId, $accessToken, $refresh, $expiresAt, $scopes);
  if (!$stmt->execute()) {
    if ($method === 'GET') callback_fail_redirect('db_execute_failed');
    api_fail(200, 'DB execute failed', ['error' => $stmt->error]);
  }
  $stmt->close();

  // 5) Load canonical row and establish browser session
  $q = $db->prepare('SELECT id, username, role, auth_method, character_id, character_name, corporation_id, corporation_name, alliance_id, alliance_name, scopes, last_login, session_expiry, is_active, access_token, refresh_token, token_expiry FROM users WHERE character_id=? LIMIT 1');
  if (!$q) {
    if ($method === 'GET') callback_fail_redirect('db_load_failed');
    api_fail(200, 'DB prepare failed', ['error' => $db->error]);
  }
  $q->bind_param('i', $characterId);
  $q->execute();
  $res = $q->get_result();
  $row = $res ? $res->fetch_assoc() : null;
  $q->close();

  if (!$row) {
    if ($method === 'GET') callback_fail_redirect('user_missing');
    api_fail(500, 'User missing after ESI upsert');
  }

  // If an admin/manual session was already active, preserve elevated role on the character link
  // but the browser session becomes the ESI character identity for data access.
  $existingSession = api_session_user();
  $public = api_public_user_from_row($row);
  $public['auth_method'] = 'esi';
  // Keep super_admin role if this character row already has it, else default from row.
  api_touch_user_session($db, (int)$row['id']);
  api_session_establish($public);

  $db->close();

  // For POST (programmatic), return JSON (no tokens)
  if ($method === 'POST') {
    api_respond([
      'ok' => true,
      'session' => true,
      'user' => $public,
      'characterId' => $characterId,
      'characterName' => $characterName,
      'corporationId' => $corpId,
      'scopes' => $scopes,
      'expiresAt' => $expiresAt,
      'tokenType' => $tokenType,
    ]);
  }

  // For GET (CCP redirect), redirect back to the app root without leaking params
  header('Location: /?auth=ok', true, 302);
  exit;
} catch (Throwable $e) {
  if ($method === 'GET') {
    callback_fail_redirect('unhandled');
  }
  api_fail(500, 'Unhandled error', ['error' => $e->getMessage()]);
}