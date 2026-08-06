<?php
// SPA path helper: verify a just-obtained access token and bind a browser session.
// Does not accept spoofable character IDs alone — token must verify with EVE SSO.
require_once __DIR__ . '/../../_lib/common.php';
require_once __DIR__ . '/../../_lib/session.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

function http_get_json_auth(string $url, string $accessToken): array {
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $accessToken,
    'User-Agent: LMeve/1.0',
  ]);
  $resp = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $err = curl_error($ch);
  curl_close($ch);
  if ($resp === false) return [null, $code, $err];
  return [$resp, $code, null];
}

$body = api_read_json();
api_expect($body, ['accessToken']);
$accessToken = (string)$body['accessToken'];
$refreshToken = isset($body['refreshToken']) ? (string)$body['refreshToken'] : null;
$expiresIn = isset($body['expiresIn']) ? (int)$body['expiresIn'] : 0;
$scopesFromClient = isset($body['scopes']) && is_array($body['scopes'])
  ? implode(' ', array_map('strval', $body['scopes']))
  : (string)($body['scope'] ?? '');

// Verify with EVE SSO
list($vbody, $vcode, $verr) = http_get_json_auth('https://login.eveonline.com/oauth/verify', $accessToken);
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

// Optional corporation lookup (public ESI, no auth required)
$corpId = 0;
$corpName = null;
$charUrl = "https://esi.evetech.net/latest/characters/{$characterId}/?datasource=tranquility";
list($cbody, $ccode,) = http_get_json_auth($charUrl, $accessToken);
if ($cbody !== null && $ccode >= 200 && $ccode < 300) {
  $char = json_decode($cbody, true);
  if (is_array($char)) {
    $corpId = (int)($char['corporation_id'] ?? 0);
  }
}

try {
  $db = api_connect($body);
  $dbCfg = api_get_db_config($body);
  api_select_db($db, (string)($body['database'] ?? $dbCfg['database'] ?? 'lmeve2'));

  $username = $characterName !== '' ? $characterName : ('char_' . $characterId);
  $stmt = @$db->prepare(
    'INSERT INTO users (username, character_id, character_name, corporation_id, access_token, refresh_token, token_expiry, scopes, auth_method, role, is_active, last_login)
     VALUES (?,?,?,?,?,?,?,?,\'esi\',\'corp_member\',1, NOW())
     ON DUPLICATE KEY UPDATE
       character_name=VALUES(character_name),
       corporation_id=VALUES(corporation_id),
       access_token=VALUES(access_token),
       refresh_token=IFNULL(VALUES(refresh_token), refresh_token),
       token_expiry=VALUES(token_expiry),
       scopes=VALUES(scopes),
       last_login=NOW()'
  );
  if (!$stmt) {
    api_fail(500, 'DB prepare failed', ['error' => $db->error]);
  }

  // bind: s i s i s s s s
  $tokenExpiry = $expiresAt ?? (new DateTimeImmutable('+20 minutes'))->format('Y-m-d H:i:s');
  $refresh = $refreshToken !== null ? (string)$refreshToken : '';
  $stmt->bind_param(
    'sisissss',
    $username,
    $characterId,
    $characterName,
    $corpId,
    $accessToken,
    $refresh,
    $tokenExpiry,
    $scopes
  );
  if (!$stmt->execute()) {
    api_fail(500, 'DB execute failed', ['error' => $stmt->error]);
  }
  $stmt->close();

  // Load the row we just upserted
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
  api_session_establish($public);
  $db->close();

  api_respond(['ok' => true, 'user' => $public]);
} catch (Throwable $e) {
  api_fail(500, 'Unhandled error', ['error' => $e->getMessage()]);
}
