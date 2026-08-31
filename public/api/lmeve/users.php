<?php
// Server-persisted user list + role assignment for the Permissions tab.
//   GET  ?corporationId=N      -> { ok, corporationId, users: [...] }
//      Site admin may omit the id (all users). corp_admin is limited to their own corporation.
//   POST { action:'set-role', userId, role }        assign a site role key (built-in or defined)
//   POST { action:'set-active', userId, isActive }  enable/disable an account
// Guards:
//   - super_admin may only be granted by a site admin; mappings can never grant it either.
//   - corp admins operate on their own corporation's users only.
//   - nobody may demote or disable themselves unless they are a site admin (no lockout).

require_once __DIR__ . '/../../_lib/common.php';
require_once __DIR__ . '/../../_lib/role-config-lib.php';

$user = api_require_admin();
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if (!in_array($method, ['GET', 'POST'], true)) { http_response_code(405); echo 'Method Not Allowed'; exit; }

$mysqli = api_connect([]);
$dbCfg = api_get_db_config([]);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));

role_config_ensure_schema($mysqli);

$isSiteAdmin = api_is_site_admin($user) || ((isset($user['role']) ? $user['role'] : '') === 'super_admin');
$selfId = isset($user['id']) && is_numeric($user['id']) ? (int)$user['id'] : 0;

function users_endpoint_public_row(array $row): array {
  return [
    'id' => (is_string($row['id']) && !is_numeric((string)$row['id'])) ? (string)$row['id'] : (int)$row['id'],
    'username' => isset($row['username']) && $row['username'] !== '' ? (string)$row['username'] : null,
    'characterName' => isset($row['character_name']) && $row['character_name'] !== '' ? (string)$row['character_name'] : null,
    'authMethod' => ((isset($row['auth_method']) ? (string)$row['auth_method'] : '') === 'esi') ? 'esi' : 'manual',
    'role' => (string)($row['role'] ?? 'corp_member'),
    'corporationId' => isset($row['corporation_id']) && $row['corporation_id'] !== null && $row['corporation_id'] !== '' ? (int)$row['corporation_id'] : null,
    'corporationName' => isset($row['corporation_name']) && $row['corporation_name'] !== '' ? (string)$row['corporation_name'] : null,
    'isActive' => !isset($row['is_active']) || (int)$row['is_active'],
  ];
}

// ---------------------------------------------------------------------------
// GET: list users in scope
// ---------------------------------------------------------------------------
if ($method === 'GET') {
  $corpId = isset($_GET['corporationId']) ? (int)$_GET['corporationId'] : 0;
  if (!$isSiteAdmin && $corpId <= 0) api_fail(400, 'corporationId is required for non-site-admins');
  if ($corpId > 0) api_require_corporation_access($user, $corpId);

  if ($corpId > 0) {
    $stmt = @$mysqli->prepare('SELECT id, username, character_name, auth_method, role, corporation_id, corporation_name, is_active FROM users WHERE corporation_id=? ORDER BY character_name');
    if (!$stmt) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
    $stmt->bind_param('i', $corpId);
  } else {
    $stmt = @$mysqli->query('SELECT id, username, character_name, auth_method, role, corporation_id, corporation_name, is_active FROM users ORDER BY character_name');
  }
  if (!$stmt) api_fail(500, 'DB query failed', ['error' => $mysqli->error]);
  @$stmt->execute();
  $res = method_exists($stmt, 'get_result') ? $stmt->get_result() : null;
  $users = [];
  while ($row = $res ? $res->fetch_assoc() : false) {
    if (!$row) break;
    $users[] = users_endpoint_public_row($row);
  }
  if ($res && method_exists($res, 'free')) { $res->free(); }
  if (method_exists($stmt, 'close')) { $stmt->close(); }

  $mysqli->close();
  api_respond(['ok' => true, 'corporationId' => $corpId > 0 ? $corpId : null, 'users' => array_values($users)]);
}

// ---------------------------------------------------------------------------
// POST: mutations
// ---------------------------------------------------------------------------
$payload = api_read_json();
api_expect($payload, ['action', 'userId']);

$action = (string)$payload['action'];
if (!in_array($action, ['set-role', 'set-active'], true)) api_fail(400, "action must be set-role or set-active");

$targetIdRaw = $payload['userId'];
$targetId = is_numeric($targetIdRaw) ? (int)$targetIdRaw : 0;
if ($targetId <= 0) api_fail(400, 'Invalid userId');

// Load the target row once.
$q = @$mysqli->prepare('SELECT id, role, corporation_id, is_active FROM users WHERE id=? LIMIT 1');
if (!$q) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
$idBind = $targetId;
$q->bind_param('i', $idBind);
@$q->execute();
$res2 = $q ? $q->get_result() : null;
$target = $res2 ? $res2->fetch_assoc() : null;
if ($res2) { $res2->free(); }
$q->close();
if (!$target) api_fail(404, 'User not found');

$targetCorpId = isset($target['corporation_id']) && $target['corporation_id'] !== '' ? (int)$target['corporation_id'] : 0;
// Scope check: corp admins may only touch users of their own corporation.
if (!$isSiteAdmin) api_require_corporation_access($user, max(1, $targetCorpId));

$isSelf = ($selfId > 0 && $selfId === $targetId);

if ($action === 'set-active') {
  if (!$isSiteAdmin && $isSelf) api_fail(403, 'A non-site-admin cannot disable their own account');
  $active = !empty($payload['isActive']) ? 1 : 0;
  $upd = @$mysqli->prepare('UPDATE users SET is_active=?, updated_date=NOW() WHERE id=?');
  if (!$upd) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
  $upd->bind_param('ii', $active, $targetId);
  if (!@$upd->execute()) api_fail(500, 'DB execute failed', ['error' => $upd->error]);
  $upd->close();

  $mysqli->close();
  api_respond(['ok' => true, 'action' => 'set-active', 'userId' => $targetId, 'isActive' => (bool)$active]);
}

// set-role
$roleKey = trim((string)($payload['role'] ?? ''));
if (!preg_match('/^[a-z0-9_\-]{2,64}$/', $roleKey)) api_fail(400, 'Invalid role key');

$builtinKeys = array_keys(role_config_builtin_permissions());
if (in_array('super_admin', $builtinKeys, true) && $roleKey === 'super_admin' && !$isSiteAdmin) {
  api_fail(403, 'Only a site admin can assign super_admin');
}
if (!$isSiteAdmin && $isSelf) api_fail(403, 'A non-site-admin cannot change their own role');

// The key must exist: built-in or defined (global set or this corp's rows).
$exists = 0;
$stmt2 = @$mysqli->prepare('SELECT COUNT(*) AS c FROM role_definitions WHERE `key`=? AND (corporation_id IS NULL OR corporation_id=?)');
if ($stmt2) {
  $kBind = $roleKey; $cBind = max(1, $targetCorpId);
  $stmt2->bind_param('si', $kBind, $cBind);
  @$stmt2->execute();
  $res3 = $stmt2 ? $stmt2->get_result() : null;
  $rrow = $res3 ? $res3->fetch_assoc() : null;
  if ($res3) { $res3->free(); }
  $stmt2->close();
  $exists = $rrow ? (int)$rrow['c'] : 0;
}
if (!$isSiteAdmin && !in_array($roleKey, $builtinKeys, true)) api_fail(400, "Unknown site role: $roleKey");
if ($isSiteAdmin && $exists < 1 && !in_array($roleKey, $builtinKeys, true)) api_fail(400, "Unknown site role: $roleKey");

$upd2 = @$mysqli->prepare('UPDATE users SET role=?, updated_date=NOW() WHERE id=?');
if (!$upd2) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
$upd2->bind_param('si', $roleKey, $targetId);
if (!@$upd2->execute()) api_fail(500, 'DB execute failed', ['error' => $upd2->error]);
$upd2->close();

$mysqli->close();
api_respond(['ok' => true, 'action' => 'set-role', 'userId' => $targetId, 'role' => $roleKey]);
