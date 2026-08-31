<?php
// Site role definitions (roles as data). Per-corp + global built-ins.
//   GET  ?corporationId=N            -> { ok, corporationId, permissionKeys, roles: [...] }
//   POST { corporationId?, action:'save'|'delete', roleKey, name?, permissions? }
// Semantics:
//   - save with no corporationId (or 0) edits the GLOBAL set. Global built-ins can be edited
//     but not deleted (use a save of default permissions to "reset"). Custom global roles are site-admin only.
//   - save with corporationId creates/updates a CORP-specific row: either an override of a builtin
//     key or a new corp-scoped custom role.
//   - delete with corporationId removes the corp-specific row (restore default / drop corp custom role).
//   - delete without corporationId removes a GLOBAL custom role; global built-ins are undeletable.
// Auth: site admin / super_admin always; corp_admin only for their own corp.

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

// ---------------------------------------------------------------------------
// GET: effective role set for one corporation (corp rows merged over globals)
// ---------------------------------------------------------------------------
if ($method === 'GET') {
  $corpId = isset($_GET['corporationId']) ? (int)$_GET['corporationId'] : 0;
  if ($corpId > 0) api_require_corporation_access($user, $corpId);

  $roles = role_config_load_roles($mysqli, $corpId);
  $mysqli->close();
  api_respond([
    'ok' => true,
    'corporationId' => $corpId > 0 ? $corpId : null,
    'permissionKeys' => role_config_permission_keys(),
    'roles' => $roles,
  ]);
}

// ---------------------------------------------------------------------------
// POST: save (upsert) or delete a role definition
// ---------------------------------------------------------------------------
$payload = api_read_json();
api_expect($payload, ['action', 'roleKey']);

$action = (string)$payload['action'];
if (!in_array($action, ['save', 'delete'], true)) api_fail(400, "action must be save or delete");

$corpId = isset($payload['corporationId']) ? (int)$payload['corporationId'] : 0;
if ($corpId > 0) api_require_corporation_access($user, $corpId);

$roleKey = trim((string)$payload['roleKey']);
if (!preg_match('/^[a-z0-9_\-]{2,64}$/', $roleKey)) api_fail(400, 'Invalid role key');

$isBuiltinKey = in_array($roleKey, array_keys(role_config_builtin_permissions()), true);

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
if ($action === 'delete') {
  if ($corpId > 0) {
    // Corp scope: only the corp-specific row may be removed.
    $stmt = @$mysqli->prepare('SELECT `key` FROM role_definitions WHERE corporation_id=? AND `key`=? LIMIT 1');
    if (!$stmt) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
    $k = $roleKey;
    $stmt->bind_param('is', $corpId, $k);
    @$stmt->execute();
    $res = $stmt ? $stmt->get_result() : null;
    $row = $res ? $res->fetch_assoc() : null;
    if ($res) { $res->free(); }
    $stmt->close();
    if (!$row) api_fail(404, 'No corporation-specific definition for this role (it comes from the site-wide set)');

    $del = @$mysqli->prepare('DELETE FROM role_definitions WHERE corporation_id=? AND `key`=?');
    if (!$del) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
    $k = $roleKey;
    $del->bind_param('is', $corpId, $k);
    if (!@$del->execute()) api_fail(500, 'DB execute failed', ['error' => $mysqli->error]);
    $del->close();

    $mysqli->close();
    api_respond(['ok' => true, 'action' => 'delete', 'roleKey' => $roleKey, 'corporationId' => $corpId]);
  }

  // Global scope: site admin only; built-ins undeletable (reset instead).
  if (!$isSiteAdmin) api_fail(403, 'Deleting a site-wide role requires a site admin');
  if ($roleKey === 'super_admin') api_fail(400, 'Cannot delete super_admin');

  $stmt = @$mysqli->prepare('SELECT is_builtin FROM role_definitions WHERE corporation_id IS NULL AND `key`=? LIMIT 1');
  if (!$stmt) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
  $k = $roleKey;
  $stmt->bind_param('s', $k);
  @$stmt->execute();
  $res = $stmt ? $stmt->get_result() : null;
  $row = $res ? $res->fetch_assoc() : null;
  if ($res) { $res->free(); }
  $stmt->close();
  if (!$row) api_fail(404, 'Role not found in the site-wide set');
  if ((int)$row['is_builtin'] === 1 || $isBuiltinKey) {
    api_fail(400, 'Site-wide built-in roles cannot be deleted. Save default permissions to reset instead.');
  }

  $del = @$mysqli->prepare('DELETE FROM role_definitions WHERE corporation_id IS NULL AND `key`=?');
  if (!$del) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
  $k = $roleKey;
  $del->bind_param('s', $k);
  if (!@$del->execute()) api_fail(500, 'DB execute failed', ['error' => $mysqli->error]);
  $del->close();

  $mysqli->close();
  api_respond(['ok' => true, 'action' => 'delete', 'roleKey' => $roleKey, 'corporationId' => null]);
}

// ---------------------------------------------------------------------------
// SAVE (upsert)
// ---------------------------------------------------------------------------
if (!array_key_exists('name', $payload) || !is_string($payload['name']) || trim($payload['name']) === '') {
  api_fail(400, 'Missing required field: name');
}
$name = mb_substr(trim((string)$payload['name']), 0, 100);
if ($name === '') $name = $roleKey;

// super_admin permissions are locked server-side (escape hatch) ? ignore client payload for it.
$permsOut = null;
if ($roleKey !== 'super_admin') {
  if (!isset($payload['permissions']) || !is_array($payload['permissions'])) api_fail(400, 'Missing required field: permissions');
  $permsOut = role_config_normalize_permissions($payload['permissions']);
}

$storedIsBuiltin = (int)($isBuiltinKey ? 1 : 0);
// Global scope edits to built-ins require a site admin; corp-scoped overrides do not.
if ($corpId <= 0 && $isBuiltinKey && !$isSiteAdmin) {
  api_fail(403, 'Editing the site-wide definition of a built-in role requires a site admin');
}

$permsJson = json_encode($roleKey === 'super_admin' ? role_config_builtin_permissions()['super_admin'] : $permsOut);
$targetCorp = ($corpId > 0) ? $corpId : null;

$stmt = @$mysqli->prepare(
  'INSERT INTO role_definitions (corporation_id, `key`, name, permissions_json, is_builtin)
   VALUES (?, ?, ?, CAST(? AS JSON), ?)
   ON DUPLICATE KEY UPDATE name=VALUES(name), permissions_json=VALUES(permissions_json)'
);
if (!$stmt) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
$stmt->bind_param('isiss', $targetCorp, $roleKey, $name, $permsJson, $storedIsBuiltin);
if (!@$stmt->execute()) api_fail(500, 'DB execute failed', ['error' => $mysqli->error]);
$stmt->close();

$mysqli->close();
api_respond([
  'ok' => true,
  'action' => 'save',
  'roleKey' => $roleKey,
  'corporationId' => ($corpId > 0) ? $corpId : null,
]);
