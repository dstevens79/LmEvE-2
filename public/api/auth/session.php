<?php
// Return current session-like user (best-effort): last user who logged in via ESI (by last_login)
require_once __DIR__ . '/../_lib/common.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

try {
  $db = api_connect($_GET);
  $dbCfg = api_get_db_config($_GET);
  api_select_db($db, (string)($_GET['database'] ?? $dbCfg['database'] ?? 'lmeve2'));

  $sql = "SELECT id, username, character_id, character_name, corporation_id, scopes, auth_method, role, is_active, last_login
          FROM users
          WHERE auth_method='esi'
          ORDER BY last_login DESC
          LIMIT 1";
  $res = $db->query($sql);
  if (!$res) {
    api_fail(200, 'DB query failed', ['error' => $db->error]);
  }
  $row = $res->fetch_assoc();
  $res->close();
  $db->close();

  api_respond(['ok' => true, 'user' => $row ?: null]);
} catch (Throwable $e) {
  api_fail(500, 'Unhandled error', ['error' => $e->getMessage()]);
}
