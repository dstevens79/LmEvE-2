<?php
// Refresh EVE SSO tokens for the current browser session's character and update DB vault.
require_once __DIR__ . '/../../_lib/common.php';
require_once __DIR__ . '/../../_lib/session.php';
api_require_auth();

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

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

$payload = api_read_json();
$sessionUser = api_session_user();

$characterId = isset($payload['characterId']) ? (int)$payload['characterId'] : 0;
if ($characterId <= 0 && $sessionUser && !empty($sessionUser['character_id'])) {
  $characterId = (int)$sessionUser['character_id'];
}
if ($characterId <= 0) {
  api_fail(400, 'characterId required');
}

// If a session exists, ensure the caller is that character (or manual admin).
if ($sessionUser) {
  $sessionAuth = (string)($sessionUser['auth_method'] ?? '');
  $sessionChar = isset($sessionUser['character_id']) ? (int)$sessionUser['character_id'] : 0;
  $sessionRole = (string)($sessionUser['role'] ?? '');
  $isAdmin = in_array($sessionRole, ['super_admin', 'corp_admin'], true);
  if ($sessionAuth === 'esi' && $sessionChar > 0 && $sessionChar !== $characterId && !$isAdmin) {
    api_fail(403, 'Session character mismatch');
  }
}

try {
  $db = api_connect($payload);
  $dbCfg = api_get_db_config($payload);
  api_select_db($db, (string)($dbCfg['database'] ?? 'lmeve2'));

  $refreshToken = isset($payload['refreshToken']) ? trim((string)$payload['refreshToken']) : '';
  if ($refreshToken === '') {
    $stmt = $db->prepare('SELECT refresh_token FROM users WHERE character_id=? LIMIT 1');
    if (!$stmt) api_fail(500, 'DB prepare failed', ['error' => $db->error]);
    $stmt->bind_param('i', $characterId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    $refreshToken = trim((string)($row['refresh_token'] ?? ''));
  }
  if ($refreshToken === '') {
    api_fail(400, 'No refresh token available for character');
  }

  $esiCfg = api_get_esi_config($payload);
  $clientId = (string)($esiCfg['clientId'] ?? '');
  $clientSecret = (string)($esiCfg['clientSecret'] ?? '');
  if ($clientId === '' || $clientSecret === '') {
    api_fail(400, 'ESI is not configured');
  }
  $basic = base64_encode($clientId . ':' . $clientSecret);

  $tokenUrl = 'https://login.eveonline.com/v2/oauth/token';
  list($resp, $status, $err) = http_post_form($tokenUrl, ["Authorization: Basic $basic"], [
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
  $accessToken = (string)$tokenData['access_token'];
  $newRefresh = isset($tokenData['refresh_token']) ? (string)$tokenData['refresh_token'] : $refreshToken;
  $expiresIn = (int)($tokenData['expires_in'] ?? 0);
  $expiresAt = (new DateTimeImmutable('+' . max($expiresIn, 0) . ' seconds'))->format('Y-m-d H:i:s');

  $stmt = @$db->prepare('UPDATE users SET access_token=?, refresh_token=?, token_expiry=?, updated_date=NOW() WHERE character_id=?');
  if (!$stmt) { api_fail(200, 'DB prepare failed', ['error' => $db->error]); }
  $stmt->bind_param('sssi', $accessToken, $newRefresh, $expiresAt, $characterId);
  if (!$stmt->execute()) { api_fail(200, 'DB execute failed', ['error' => $stmt->error]); }
  $stmt->close();

  // Keep browser session alive
  if ($sessionUser) {
    api_session_establish(array_merge($sessionUser, [
      'character_id' => $characterId,
      'auth_method' => $sessionUser['auth_method'] ?? 'esi',
      'has_tokens' => 1,
    ]));
  }

  $db->close();
  api_respond([
    'ok' => true,
    'characterId' => $characterId,
    'expiresAt' => $expiresAt,
    // Do not return raw tokens to the browser in server-vault mode.
  ]);
} catch (Throwable $e) {
  api_fail(500, 'Unhandled error', ['error' => $e->getMessage()]);
}