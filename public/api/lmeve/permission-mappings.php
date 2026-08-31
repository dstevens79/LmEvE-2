<?php
// Permission mappings: EVE corporation role OR corp title -> site role.
//   GET  ?corporationId=N            -> { ok, corporationId, rules: [ {corporationId|null, kind, sourceName, siteRoleKey, priority} ] }
//   POST { corporationId?, action:'save'|'delete', kind:'eve_role'|'title', sourceName, siteRoleKey?, priority? }
// Scope: a rule with no corporationId (or 0) is a GLOBAL fallback; one with a corporationId
// overrides the global rule for that same (kind, source). Resolution prefers corp-specific.

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
// GET: effective rules for one corporation (corp-specific rows merged over global fallbacks)
// ---------------------------------------------------------------------------
if ($method === 'GET') {
  $corpId = isset($_GET['corporationId']) ? (int)$_GET['corporationId'] : 0;
  if ($corpId > 0) api_require_corporation_access($user, $corpId);

  $rules = role_config_load_mappings($mysqli, $corpId);
  // Stable display order: kind, then source name.
  usort($rules, function ($a, $b) {
    $ca = strcmp((string)$a['kind'], (string)$b['kind']);
    if ($ca !== 0) return $ca;
    return strcasecmp((string)$a['sourceName'], (string)$b['sourceName']);
  });

  // Include the known site-role keys so the UI can offer them in a picker.
  $roleKeys = [];
  foreach (array_keys(role_config_builtin_permissions()) as $k) { $roleKeys[] = $k; }
  if ($corpId > 0) {
    $stmt = @$mysqli->prepare('SELECT `key` FROM role_definitions WHERE corporation_id=? AND is_builtin=0');
    if ($stmt) { $c = $corpId; $stmt->bind_param('i', $c); @$stmt->execute(); $res = $stmt ? $stmt->get_result() : null; while ($r = $res ? $res->fetch_assoc() : false) { if (!$r) break; if (!in_array($r['key'], $roleKeys, true)) $roleKeys[] = (string)$r['key']; } if ($res) {$res->free();} $stmt->close(); }
  }

  $mysqli->close();
  api_respond([
    'ok' => true,
    'corporationId' => $corpId > 0 ? $corpId : null,
    'siteRoleKeys' => $roleKeys,
    'rules' => $rules,
  ]);
}

// ---------------------------------------------------------------------------
// POST: save (upsert) or delete a mapping rule
// ---------------------------------------------------------------------------
$payload = api_read_json();
api_expect($payload, ['action', 'kind', 'sourceName']);

$action = (string)$payload['action'];
if (!in_array($action, ['save', 'delete'], true)) api_fail(400, "action must be save or delete");

$corpId = isset($payload['corporationId']) ? (int)$payload['corporationId'] : 0;
if ($corpId > 0) api_require_corporation_access($user, $corpId);

$kind = strtolower((string)$payload['kind']);
if (!in_array($kind, ['eve_role', 'title'], true)) api_fail(400, "kind must be eve_role or title");

$sourceName = trim((string)$payload['sourceName']);
// EVE role identifiers are a fixed set (e.g. ceo, director, factory_manager); titles are free-form text.
if ($kind === 'eve_role') {
  if (!preg_match('/^[a-z0-9_]{2,80}$/', $sourceName)) api_fail(400, 'Invalid EVE role name');
} else {
  if (mb_strlen($sourceName) < 1 || mb_strlen($sourceName) > 150) api_fail(400, 'Title must be 1-150 characters');
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
if ($action === 'delete') {
  if ($corpId > 0) {
    // Remove the corp-specific rule only.
    $stmt = @$mysqli->prepare('SELECT id FROM permission_mappings WHERE corporation_id=? AND kind=? AND source_name=? LIMIT 1');
    if (!$stmt) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
    $sn = $sourceName;
    $stmt->bind_param('iss', $corpId, $kind, $sn);
    @$stmt->execute();
    $res = $stmt ? $stmt->get_result() : null;
    $row = $res ? $res->fetch_assoc() : null;
    if ($res) { $res->free(); }
    $stmt->close();
    if (!$row) api_fail(404, 'No corporation-specific rule for this source (it comes from the site-wide set)');

    $del = @$mysqli->prepare('DELETE FROM permission_mappings WHERE corporation_id=? AND kind=? AND source_name=?');
    if (!$del) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
    $sn = $sourceName;
    $del->bind_param('iss', $corpId, $kind, $sn);
    if (!@$del->execute()) api_fail(500, 'DB execute failed', ['error' => $mysqli->error]);
    $del->close();

    $mysqli->close();
    api_respond(['ok' => true, 'action' => 'delete', 'kind' => $kind, 'sourceName' => $sourceName, 'corporationId' => $corpId]);
  }

  // Global scope: site admin only.
  if (!$isSiteAdmin) api_fail(403, 'Deleting a site-wide rule requires a site admin');
  $del = @$mysqli->prepare('DELETE FROM permission_mappings WHERE corporation_id IS NULL AND kind=? AND source_name=?');
  if (!$del) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
  $sn = $sourceName;
  $del->bind_param('ss', $kind, $sn);
  if (!@$del->execute() || (int)$del->affected_rows === 0) api_fail(404, 'Rule not found in the site-wide set');
  $del->close();

  $mysqli->close();
  api_respond(['ok' => true, 'action' => 'delete', 'kind' => $kind, 'sourceName' => $sourceName, 'corporationId' => null]);
}

// ---------------------------------------------------------------------------
// SAVE (upsert)
// ---------------------------------------------------------------------------
$siteRoleKey = trim((string)($payload['siteRoleKey'] ?? ''));
if (!preg_match('/^[a-z0-9_\-]{2,64}$/', $siteRoleKey)) api_fail(400, 'Invalid or missing siteRoleKey');

// Verify the target role exists in scope (global set + corp custom roles).
$exists = 0;
if ($corpId > 0) {
  // A corp rule may point to a global role OR any corp-specific role.
  $stmt = @$mysqli->prepare('SELECT COUNT(*) AS c FROM role_definitions WHERE `key`=? AND (corporation_id IS NULL OR corporation_id=?)');
  if ($stmt) { $k = $siteRoleKey; $c = $corpId; $stmt->bind_param('si', $k, $c); @$stmt->execute(); $res = $stmt ? $stmt->get_result() : null; $row = $res ? $res->fetch_assoc() : null; if ($res) {$res->free();} $stmt->close(); }
  $exists = $row ? (int)$row['c'] : 0;
} else {
  $stmt = @$mysqli->prepare('SELECT COUNT(*) AS c FROM role_definitions WHERE `key`=? AND corporation_id IS NULL');
  if ($stmt) { $k = $siteRoleKey; $stmt->bind_param('s', $k); @$stmt->execute(); $res = $stmt ? $stmt->get_result() : null; $row = $res ? $res->fetch_assoc() : null; if ($res) {$res->free();} $stmt->close(); }
  $exists = $row ? (int)$row['c'] : 0;
}
if ($exists < 1) api_fail(400, "Unknown site role: $siteRoleKey");

// Mappings never grant super_admin.
if ($siteRoleKey === 'super_admin') api_fail(400, 'Mappings cannot target super_admin');

$priority = isset($payload['priority']) ? (int)$payload['priority'] : 0;
if ($priority < -1000 || $priority > 1000) $priority = 0;

// Global-scope rules are site-admin only.
if ($corpId <= 0 && !$isSiteAdmin) api_fail(403, 'Creating a site-wide rule requires a site admin');

$targetCorp = ($corpId > 0) ? $corpId : null;
$stmt = @$mysqli->prepare(
  'INSERT INTO permission_mappings (corporation_id, kind, source_name, site_role_key, priority)
   VALUES (?, ?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE site_role_key=VALUES(site_role_key), priority=VALUES(priority)'
);
if (!$stmt) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
$stmt->bind_param('isssi', $targetCorp, $kind, $sourceName, $siteRoleKey, $priority);
if (!@$stmt->execute()) api_fail(500, 'DB execute failed', ['error' => $mysqli->error]);
$stmt->close();

$mysqli->close();
api_respond([
  'ok' => true,
  'action' => 'save',
  'kind' => $kind,
  'sourceName' => $sourceName,
  'siteRoleKey' => $siteRoleKey,
  'corporationId' => ($corpId > 0) ? $corpId : null,
]);
