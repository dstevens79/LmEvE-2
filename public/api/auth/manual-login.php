<?php
// Local username/password login.
// 1) Offline/bootstrap accounts first (no MySQL required) — admin + maintenance shortlist
// 2) Database users table when MySQL is configured and reachable

require_once __DIR__ . '/../_lib/common.php';
require_once __DIR__ . '/../_lib/session.php';
require_once __DIR__ . '/../_lib/bootstrap-auth.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

$body = api_read_json();
api_expect($body, ['username','password']);
$username = trim((string)$body['username']);
$password = (string)$body['password'];

// ---- Path 1: offline bootstrap / maintenance accounts (no DB) ----
$bootstrapUser = bootstrap_verify_login($username, $password);
if (is_array($bootstrapUser)) {
  api_session_establish($bootstrapUser);
  api_respond([
    'ok' => true,
    'user' => $bootstrapUser,
    'session' => true,
    'authSource' => 'bootstrap',
  ]);
}

// ---- Path 2: database-backed users (only if DB is reachable) ----
// Soft-connect: never call api_connect()/api_fail here — bootstrap login must
// not die just because MySQL isn't configured yet.
$dbCfg = api_get_db_config([]);
$host = (string)($dbCfg['host'] ?? '');
$user = (string)($dbCfg['username'] ?? '');
$pass = (string)($dbCfg['password'] ?? '');
$port = (int)($dbCfg['port'] ?? 3306);
$database = (string)($dbCfg['database'] ?? 'lmeve2');

if ($host === '' || $user === '') {
  api_fail(401, 'Invalid username or password', [
    'hint' => 'Offline admin uses the maintenance account (default admin / 12345 until changed). Database users require configured MySQL.',
  ]);
}

mysqli_report(MYSQLI_REPORT_OFF);
$mysqli = @mysqli_init();
if (!$mysqli) {
  api_fail(401, 'Invalid username or password', [
    'hint' => 'Offline admin uses the maintenance account (default admin / 12345 until changed).',
  ]);
}
@ini_set('default_socket_timeout', '5');
if (defined('MYSQLI_OPT_CONNECT_TIMEOUT')) { @$mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 5); }
if (defined('MYSQLI_OPT_READ_TIMEOUT')) { @$mysqli->options(MYSQLI_OPT_READ_TIMEOUT, 5); }

$connected = @$mysqli->real_connect($host, $user, $pass, null, $port);
if (!$connected) {
  api_fail(401, 'Invalid username or password', [
    'hint' => 'Offline admin uses the maintenance account (default admin / 12345 until changed). Database is currently unreachable.',
  ]);
}

if (!@$mysqli->select_db($database)) {
  @$mysqli->close();
  api_fail(401, 'Invalid username or password', [
    'hint' => 'Offline admin uses the maintenance account (default admin / 12345 until changed). Configured database was not found.',
  ]);
}

$stmt = $mysqli->prepare("SELECT id, username, password, role, is_active, character_id, character_name, corporation_id, corporation_name, alliance_id, alliance_name, auth_method, scopes, last_login, session_expiry, access_token, refresh_token FROM users WHERE username=? LIMIT 1");
if (!$stmt) {
  @$mysqli->close();
  api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
}
$stmt->bind_param('s', $username);
$stmt->execute();
$res = $stmt->get_result();
$row = $res ? $res->fetch_assoc() : null;
$stmt->close();

if (!$row) {
  @$mysqli->close();
  api_fail(401, 'Invalid username or password');
}
if (!(int)$row['is_active']) {
  @$mysqli->close();
  api_fail(403, 'User account is disabled');
}

$stored = (string)($row['password'] ?? '');
$verified = false;

if ($stored !== '' && (strpos($stored, '$2y$') === 0 || strpos($stored, '$2a$') === 0 || strpos($stored, '$2b$') === 0)) {
  $verified = password_verify($password, $stored);
} else if ($stored !== '') {
  if (hash_equals($stored, $password)) {
    $verified = true;
  } else {
    $sha = hash('sha256', $password);
    $verified = hash_equals($stored, $sha);
  }
  if ($verified) {
    $newHash = password_hash($password, PASSWORD_BCRYPT);
    $up = $mysqli->prepare("UPDATE users SET password=?, updated_date=NOW() WHERE id=?");
    if ($up) {
      $up->bind_param('si', $newHash, $row['id']);
      $up->execute();
      $up->close();
    }
  }
}

if (!$verified) {
  @$mysqli->close();
  api_fail(401, 'Invalid username or password');
}

// Keep offline admin password in sync when DB admin logs in
if (strtolower($username) === LMEVE_BOOTSTRAP_ADMIN_USERNAME) {
  try { bootstrap_set_password($username, $password, 'super_admin'); } catch (Throwable $e) {}
}

$row['auth_method'] = 'manual';
$userId = (int)$row['id'];
if (function_exists('api_touch_user_session')) {
  api_touch_user_session($mysqli, $userId);
} else {
  $touch = $mysqli->prepare("UPDATE users SET last_login=NOW(), updated_date=NOW() WHERE id=?");
  if ($touch) {
    $touch->bind_param('i', $userId);
    $touch->execute();
    $touch->close();
  }
}

$public = api_public_user_from_row($row);
if (empty($public['character_name'])) {
  $public['character_name'] = $public['username'] ?: 'Local Administrator';
}
$public['bootstrap'] = 0;
api_session_establish($public);

@$mysqli->close();
api_respond(['ok' => true, 'user' => $public, 'session' => true, 'authSource' => 'database']);
