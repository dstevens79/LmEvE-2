<?php
// EVE SSO OAuth callback: exchange code, verify, enrich identity, store tokens, establish browser session.
require_once __DIR__ . '/../../_lib/common.php';
require_once __DIR__ . '/../../_lib/session.php';
require_once __DIR__ . '/../../_lib/esi-identity.php';

// GET: CCP browser redirect. POST: programmatic JSON.

function http_post_form($url, $headers, $data) {
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
  curl_setopt($ch, CURLOPT_TIMEOUT, 30);
  curl_setopt($ch, CURLOPT_HTTPHEADER, array_merge(['Content-Type: application/x-www-form-urlencoded'], $headers));
  curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
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

function callback_ok_redirect(bool $needsCorpSetup, bool $adminHandoff) {
  $params = ['auth' => 'ok'];
  if ($needsCorpSetup) {
    $params['setup'] = 'corp';
  }
  if ($adminHandoff) {
    $params['handoff'] = 'admin';
  }
  header('Location: /?' . http_build_query($params), true, 302);
  exit;
}

// Capture prior browser session BEFORE OAuth state consume / session regenerate.
// This is the admin -> character handoff signal.
api_session_start();
$existingSession = api_session_user();
$adminHandoff = is_array($existingSession) && (($existingSession['role'] ?? '') === 'super_admin');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$payload = $method === 'POST' ? api_read_json() : $_GET;

if (empty($payload['code'])) {
  if ($method === 'GET') {
    callback_fail_redirect('missing_code');
  }
  api_expect($payload, ['code']);
}

$code = (string)$payload['code'];
$state = isset($payload['state']) ? (string)$payload['state'] : '';

$oauthMeta = null;
if ($method === 'GET') {
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

  list($vbody, $vcode, $verr) = esi_http_get(
    'https://login.eveonline.com/oauth/verify',
    ['Authorization: Bearer ' . $accessToken, 'User-Agent: LMeve-2']
  );
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
  $scopeList = esi_parse_scopes($scopes);

  $identity = esi_enrich_character_identity($characterId, $accessToken, $scopeList);
  $corpId = (int)($identity['corporation_id'] ?? 0);
  $corpName = $identity['corporation_name'] !== null ? (string)$identity['corporation_name'] : null;
  $allianceId = isset($identity['alliance_id']) && (int)$identity['alliance_id'] > 0
    ? (int)$identity['alliance_id']
    : null;
  $allianceName = $identity['alliance_name'] !== null ? (string)$identity['alliance_name'] : null;

  $existingDbRole = null;
  $prev = @$db->prepare('SELECT id, role FROM users WHERE character_id=? LIMIT 1');
  if ($prev) {
    $prev->bind_param('i', $characterId);
    @$prev->execute();
    $prevRes = $prev->get_result();
    $prevRow = $prevRes ? $prevRes->fetch_assoc() : null;
    $prev->close();
    if (is_array($prevRow) && !empty($prevRow['role'])) {
      $existingDbRole = (string)$prevRow['role'];
    }
  }

  $siteRole = esi_resolve_login_role(
    (string)($identity['site_role'] ?? 'corp_member'),
    $existingSession,
    $existingDbRole
  );

  $stmt = @$db->prepare(
    'INSERT INTO users (
        username, character_id, character_name, corporation_id, corporation_name,
        alliance_id, alliance_name, access_token, refresh_token, token_expiry,
        scopes, auth_method, role, is_active, last_login
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,\'esi\',?,1,NOW())
     ON DUPLICATE KEY UPDATE
       character_name=VALUES(character_name),
       corporation_id=VALUES(corporation_id),
       corporation_name=VALUES(corporation_name),
       alliance_id=VALUES(alliance_id),
       alliance_name=VALUES(alliance_name),
       access_token=VALUES(access_token),
       refresh_token=VALUES(refresh_token),
       token_expiry=VALUES(token_expiry),
       scopes=VALUES(scopes),
       auth_method=\'esi\',
       role=VALUES(role),
       last_login=NOW()'
  );
  if (!$stmt) {
    if ($method === 'GET') callback_fail_redirect('db_prepare_failed');
    api_fail(200, 'DB prepare failed', ['error' => $db->error]);
  }

  $username = $characterName;
  $refresh = $refreshToken !== null ? (string)$refreshToken : '';
  $corpNameBind = $corpName ?? '';
  $allianceIdBind = $allianceId ?? 0;
  $allianceNameBind = $allianceName ?? '';

  $stmt->bind_param(
    'sisisissssss',
    $username,
    $characterId,
    $characterName,
    $corpId,
    $corpNameBind,
    $allianceIdBind,
    $allianceNameBind,
    $accessToken,
    $refresh,
    $expiresAt,
    $scopes,
    $siteRole
  );
  if (!$stmt->execute()) {
    if ($method === 'GET') callback_fail_redirect('db_execute_failed');
    api_fail(200, 'DB execute failed', ['error' => $stmt->error]);
  }
  $stmt->close();

  if ($corpId > 0) {
    esi_seed_corporation_row($db, $identity, $characterId, $characterName);
  }

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

  $public = api_public_user_from_row($row);
  $public['auth_method'] = 'esi';
  $public['role'] = $siteRole;
  if ($corpNameBind !== '') {
    $public['corporation_name'] = $corpNameBind;
  }
  if ($allianceNameBind !== '') {
    $public['alliance_name'] = $allianceNameBind;
  }
  if ($allianceIdBind > 0) {
    $public['alliance_id'] = $allianceIdBind;
  }

  api_touch_user_session($db, (int)$row['id']);
  api_session_establish($public);

  $corpCount = esi_count_corporations($db);
  // Admin handoff or first corp seed: send operator to corp setup next.
  $needsCorpSetup = $adminHandoff || $corpCount <= 0;

  $db->close();

  if ($method === 'POST') {
    api_respond([
      'ok' => true,
      'session' => true,
      'user' => $public,
      'characterId' => $characterId,
      'characterName' => $characterName,
      'corporationId' => $corpId,
      'corporationName' => $corpName,
      'allianceId' => $allianceId,
      'allianceName' => $allianceName,
      'role' => $siteRole,
      'adminHandoff' => $adminHandoff,
      'needsCorpSetup' => $needsCorpSetup,
      'scopes' => $scopes,
      'expiresAt' => $expiresAt,
      'tokenType' => $tokenType,
      'eveRoles' => $identity['eve_roles'] ?? [],
    ]);
  }

  callback_ok_redirect($needsCorpSetup, $adminHandoff);
} catch (Throwable $e) {
  if ($method === 'GET') {
    callback_fail_redirect('unhandled');
  }
  api_fail(500, 'Unhandled error', ['error' => $e->getMessage()]);
}
