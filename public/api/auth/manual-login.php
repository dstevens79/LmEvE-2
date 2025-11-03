<?php
// Manual (local) user login against DB. Upgrades plaintext/legacy hashes to bcrypt.
require_once __DIR__ . '/../_lib/common.php';

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
  $stmt = $db->prepare("SELECT id, username, password, role, is_active, character_id, character_name, corporation_id, corporation_name, last_login FROM users WHERE username=? LIMIT 1");
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

  if ($stored !== '' && (strpos($stored, '$2y$') === 0 || strpos($stored, '$2a$') === 0)) {
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

  // Update last_login
  $upd = $db->prepare("UPDATE users SET last_login=NOW() WHERE id=?");
  if ($upd) { $upd->bind_param('i', $row['id']); $upd->execute(); $upd->close(); }

  // Return user object (no password)
  $user = [
    'id' => (int)$row['id'],
    'username' => $row['username'],
    'role' => $row['role'] ?: 'corp_member',
    'character_id' => $row['character_id'] ? (int)$row['character_id'] : null,
    'character_name' => $row['character_name'] ?: null,
    'corporation_id' => $row['corporation_id'] ? (int)$row['corporation_id'] : null,
    'corporation_name' => $row['corporation_name'] ?: null,
    'last_login' => $row['last_login'] ?: null,
  ];
  $db->close();

  api_respond(['ok' => true, 'user' => $user]);
} catch (Throwable $e) {
  api_fail(500, 'Unhandled error', ['error' => $e->getMessage()]);
}
