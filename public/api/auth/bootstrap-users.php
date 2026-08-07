<?php
// Manage offline/bootstrap maintenance accounts (independent of MySQL).
// GET  -> list public bootstrap users (admin)
// POST -> create/update offline user password (admin)
//
// The built-in "admin" account always exists and cannot be deleted.
// Password changes for admin are written here so local login keeps working
// even when the database is down or not configured yet.

require_once __DIR__ . '/../_lib/common.php';
require_once __DIR__ . '/../_lib/bootstrap-auth.php';

api_require_admin();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'GET') {
  api_respond([
    'ok' => true,
    'users' => bootstrap_list_public_users(),
  ]);
}

if ($method !== 'POST') {
  api_fail(405, 'Method not allowed');
}

$body = api_read_json();
$action = strtolower(trim((string)($body['action'] ?? 'upsert')));
$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');
$role = trim((string)($body['role'] ?? ''));

if ($username === '') {
  api_fail(400, 'username required');
}

// Only super_admin may manage other super_admins / create accounts
$actor = api_current_user();
$actorRole = (string)($actor['role'] ?? '');
if ($actorRole !== 'super_admin' && strtolower($username) !== strtolower((string)($actor['username'] ?? ''))) {
  api_fail(403, 'Only super_admin can manage other maintenance accounts');
}

if ($action === 'set_password' || $action === 'upsert') {
  if ($password === '') {
    api_fail(400, 'password required');
  }
  // Non-super-admin can only change own password and cannot escalate role
  if ($actorRole !== 'super_admin') {
    $role = null;
  } elseif ($role === '') {
    $role = null;
  }

  if (strtolower($username) === LMEVE_BOOTSTRAP_ADMIN_USERNAME) {
    $ok = bootstrap_set_password($username, $password, 'super_admin');
  } else {
    $ok = bootstrap_upsert_user($username, $password, $role ?: 'corp_member', true);
  }

  if (!$ok) {
    api_fail(500, 'Failed to persist offline account (storage not writable?)');
  }

  // Best-effort: keep MySQL users.admin password in sync when DB is up.
  // Soft-connect only — never api_connect()/api_fail (those exit the request).
  if (strtolower($username) === LMEVE_BOOTSTRAP_ADMIN_USERNAME) {
    $dbCfg = api_get_db_config([]);
    $host = (string)($dbCfg['host'] ?? '');
    $dbUser = (string)($dbCfg['username'] ?? '');
    $dbPass = (string)($dbCfg['password'] ?? '');
    $port = (int)($dbCfg['port'] ?? 3306);
    $database = (string)($dbCfg['database'] ?? 'lmeve2');
    if ($host !== '' && $dbUser !== '') {
      mysqli_report(MYSQLI_REPORT_OFF);
      $mysqli = @mysqli_init();
      if ($mysqli) {
        @ini_set('default_socket_timeout', '3');
        if (defined('MYSQLI_OPT_CONNECT_TIMEOUT')) { @$mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 3); }
        $ok = @$mysqli->real_connect($host, $dbUser, $dbPass, null, $port);
        if ($ok && @$mysqli->select_db($database)) {
          $hash = password_hash($password, PASSWORD_BCRYPT);
          $stmt = $mysqli->prepare("UPDATE users SET password=?, role='super_admin', auth_method='manual', is_active=1, updated_date=NOW() WHERE username='admin' LIMIT 1");
          if ($stmt) {
            $stmt->bind_param('s', $hash);
            $stmt->execute();
            $affected = $stmt->affected_rows;
            $stmt->close();
            if ($affected === 0) {
              $check = @$mysqli->query("SELECT id FROM users WHERE username='admin' LIMIT 1");
              $exists = $check && $check->num_rows > 0;
              if ($check) $check->close();
              if (!$exists) {
                $ins = $mysqli->prepare("INSERT INTO users (username, password, role, auth_method, is_active, created_date, updated_date) VALUES ('admin', ?, 'super_admin', 'manual', 1, NOW(), NOW())");
                if ($ins) {
                  $ins->bind_param('s', $hash);
                  $ins->execute();
                  $ins->close();
                }
              }
            }
          }
        }
        @$mysqli->close();
      }
    }
  }

  api_respond([
    'ok' => true,
    'user' => bootstrap_public_user(bootstrap_find_user($username) ?? ['username' => $username, 'role' => $role ?: 'super_admin']),
  ]);
}

api_fail(400, 'Unknown action');
