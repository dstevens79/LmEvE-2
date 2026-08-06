<?php
// SPA path helper: verify a just-obtained access token and bind a browser session.
// Does not accept spoofable character IDs alone — token must verify with EVE SSO.
require_once __DIR__ . '/../../_lib/common.php';
require_once __DIR__ . '/../../_lib/session.php';
require_once __DIR__ . '/../../_lib/esi-identity.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

$body = api_read_json();
api_expect($body, ['accessToken']);
$accessToken = (string)$body['accessToken'];
$refreshToken = isset($body['refreshToken']) ? (string)$body['refreshToken'] : null;
$expiresIn = isset($body['expiresIn']) ? (int)$body['expiresIn'] : 0;
$scopesFromClient = isset($body['scopes']) && is_array($body['scopes'])
  ? implode(' ', array_map('strval', $body['scopes']))
  : (string)($body['scope'] ?? '');

// Preserve prior session for admin handoff before establishing the new one.
api_session_start();
$existingSession = api_session_user();

list($vbody, $vcode, $verr) = esi_http_get(
  'https://login.eveonline.com/oauth/verify',
  ['Authorization: Bearer ' . $accessToken, 'User-Agent: LMeve-2']
);
if ($vbody === null || $vcode < 200 || $vcode >= 300) {
  api_fail(401, 'SSO verify failed', ['status' => $vcode, 'error' => $verr, 'body' => $vbody]);
}
$verify = json_decode($vbody, true);
if (!is_array($verify) || empty($verify['CharacterID'])) {
  api_fail(401, 'Invalid verify response', ['body' => $vbody]);
}

$characterId = (int)$verify['CharacterID'];
$characterName = (string)($verify['CharacterName'] ?? '');
$scopes = (string)($verify['Scopes'] ?? $scopesFromClient);
$scopeList = esi_parse_scopes($scopes);
$expiresAt = null;
if ($expiresIn > 0) {
  $expiresAt = (new DateTimeImmutable('+' . $expiresIn . ' seconds'))->format('Y-m-d H:i:s');
} elseif (!empty($verify['ExpiresOn'])) {
  try {
    $expiresAt = (new DateTimeImmutable((string)$verify['ExpiresOn']))->format('Y-m-d H:i:s');
  } catch (Throwable $e) {
    $expiresAt = null;
  }
}

$identity = esi_enrich_character_identity($characterId, $accessToken, $scopeList);
$corpId = (int)($identity['corporation_id'] ?? 0);
$corpName = $identity['corporation_name'] !== null ? (string)$identity['corporation_name'] : '';
$allianceId = isset($identity['alliance_id']) && (int)$identity['alliance_id'] > 0
  ? (int)$identity['alliance_id']
  : 0;
$allianceName = $identity['alliance_name'] !== null ? (string)$identity['alliance_name'] : '';

try {
  $db = api_connect($body);
  $dbCfg = api_get_db_config($body);
  api_select_db($db, (string)($dbCfg['database'] ?? 'lmeve2'));

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

  $username = $characterName !== '' ? $characterName : ('char_' . $characterId);
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
       refresh_token=IFNULL(VALUES(refresh_token), refresh_token),
       token_expiry=VALUES(token_expiry),
       scopes=VALUES(scopes),
       auth_method=\'esi\',
       role=VALUES(role),
       last_login=NOW()'
  );
  if (!$stmt) {
    api_fail(500, 'DB prepare failed', ['error' => $db->error]);
  }

  $tokenExpiry = $expiresAt ?? (new DateTimeImmutable('+20 minutes'))->format('Y-m-d H:i:s');
  $refresh = $refreshToken !== null ? (string)$refreshToken : '';
  $stmt->bind_param(
    'sisisissssss',
    $username,
    $characterId,
    $characterName,
    $corpId,
    $corpName,
    $allianceId,
    $allianceName,
    $accessToken,
    $refresh,
    $tokenExpiry,
    $scopes,
    $siteRole
  );
  if (!$stmt->execute()) {
    api_fail(500, 'DB execute failed', ['error' => $stmt->error]);
  }
  $stmt->close();

  if ($corpId > 0) {
    esi_seed_corporation_row($db, $identity, $characterId, $characterName);
  }

  $q = $db->prepare('SELECT id, username, role, auth_method, character_id, character_name, corporation_id, corporation_name, alliance_id, alliance_name, scopes, last_login, session_expiry, is_active, access_token, refresh_token, token_expiry FROM users WHERE character_id=? LIMIT 1');
  if (!$q) {
    api_fail(500, 'DB prepare failed', ['error' => $db->error]);
  }
  $q->bind_param('i', $characterId);
  $q->execute();
  $res = $q->get_result();
  $row = $res ? $res->fetch_assoc() : null;
  $q->close();

  if (!$row) {
    api_fail(500, 'User row missing after ESI establish');
  }

  api_touch_user_session($db, (int)$row['id']);
  $public = api_public_user_from_row($row);
  $public['auth_method'] = 'esi';
  $public['role'] = $siteRole;
  if ($corpName !== '') $public['corporation_name'] = $corpName;
  if ($allianceName !== '') $public['alliance_name'] = $allianceName;
  if ($allianceId > 0) $public['alliance_id'] = $allianceId;

  api_session_establish($public);
  $db->close();

  api_respond([
    'ok' => true,
    'user' => $public,
    'adminHandoff' => is_array($existingSession) && (($existingSession['role'] ?? '') === 'super_admin'),
    'role' => $siteRole,
  ]);
} catch (Throwable $e) {
  api_fail(500, 'Unhandled error', ['error' => $e->getMessage()]);
}
