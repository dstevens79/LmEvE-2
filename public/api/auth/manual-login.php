<?php
// Manual (local) user login against DB. Upgrades plaintext/legacy hashes to bcrypt.
// Establishes a real browser-bound PHP session for admin bootstrap + local users.
require_once __DIR__ . '/../_lib/common.php';
require_once __DIR__ . '/../_lib/session.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

$body = api_read_json();
api_expect($body, ['username','password']);
$username = trim((string)$body['username']);
$password = (string)$body['password'];

try {
  // Support two distinct use cases:
  // 1. SETUP MODE (Database Test): Admin provides DB credentials via query params
  //    to validate them BEFORE they're saved to server settings.
  //    Used by: DatabaseTabContainer Test Connection flow
  //
  // 2. USER LOGIN MODE: Regular users authenticate after DB is configured.
  //    No query params - server uses its saved DB settings.
  //    Used by: Normal login form via auth-provider
  //
  // api_get_db_config() handles both: prefers query params if present, falls back to server settings
  $db = api_connect($_GET);
  $dbCfg = api_get_db_config($_GET);
  api_select_db($db, (string)($_GET['database'] ?? $dbCfg['database'] ?? 'lmeve2'));

  // Load user by username
  $stmt = $db->prepare("SELECT id, username, password, role, is_active, character_id, character_name, corporation_id, corporation_name, alliance_id, alliance_name, auth_method, scopes, last_login, session_expiry, access_token, refresh_token FROM users WHERE username=? LIMIT 1");
  if (!$stmt) api_fail(500, 'DB prepare failed', ['error' => $db->error]);
  $stmt->bind_param('s', $username);
  $stmt->execute();
  $res = $stmt->get_result();
  $row = $res ? $res->fetch_assoc() : null;
  $stmt->close();

  if (!$row) {
    api_fail(401, 'Invalid username or password');
  }
  if (!(int)$row['is_active']) {
    api_fail(403, 'User account is disabled');
  }

  $stored = (string)($row['password'] ?? '');
  $verified = false;

  if ($stored !== '' && (strpos($stored, '$2y$') === 0 || strpos($stored, '$2a$') === 0 || strpos($stored, '$2b$') === 0)) {
    // Bcrypt hash
    $verified = password_verify($password, $stored);
  } else if ($stored !== '') {
    // Legacy/plain fallback (or SHA2). Try direct equality and SHA2.
    if (hash_equals($stored, $password)) {
      $verified = true;
    } else {
      $sha = hash('sha256', $password);
      $verified = hash_equals($stored, $sha);
    }
    // If verified via legacy, upgrade to bcrypt
    if ($verified) {
      $newHash = password_hash($password, PASSWORD_BCRYPT);
      $up = $db->prepare("UPDATE users SET password=?, updated_date=NOW() WHERE id=?");
      if ($up) {
        $up->bind_param('si', $newHash, $row['id']);
        $up->execute();
        $up->close();
      }
    }
  } else {
    // No password stored - explicit fail
    api_fail(401, 'Invalid username or password');
  }

  if (!$verified) {
    api_fail(401, 'Invalid username or password');
  }

  // Manual login should remain a local/admin session identity.
  // Do not silently reclassify as ESI just because character fields exist.
  if (empty($row['auth_method']) || $row['auth_method'] === 'esi') {
    // Keep DB auth_method if already manual; if a row was ESI-only with password somehow, still mark session manual.
  }
  $row['auth_method'] = 'manual';

  $userId = (int)$row['id'];
  api_touch_user_session($db, $userId);

  $public = api_public_user_from_row($row);
  // Local admin bootstrap accounts often have no character portrait fields.
  if (empty($public['character_name'])) {
    $public['character_name'] = $public['username'] ?: 'Local Administrator';
  }
  api_session_establish($public);

  $db->close();
  api_respond(['ok' => true, 'user' => $public, 'session' => true]);
} catch (Throwable $e) {
  api_fail(500, 'Unhandled error', ['error' => $e->getMessage()]);
}