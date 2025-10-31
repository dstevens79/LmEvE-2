<?php
require_once __DIR__ . '/../../_lib/common.php';
$payload = api_read_json();
api_expect($payload, ['records']);
$records = $payload['records'];
if (!is_array($records) || count($records) === 0) {
  api_fail(400, 'records must be a non-empty array');
}
$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($mysqli, (string)($payload['database'] ?? $dbCfg['database'] ?? 'lmeve2'));

// Fixed column order as per schema used in app
$cols = [
  // Compatible with members schema; extra fields like is_active/access_level are optional
  'character_id','character_name','corporation_id','corporation_name',
  'alliance_id','alliance_name','roles','titles','last_login',
  'location_id','location_name','ship_type_id','ship_type_name',
  'is_online'
];

$sql = 'INSERT INTO members (' . implode(',', $cols) . ') VALUES ('
  . implode(',', array_fill(0, count($cols), '?')) . ') '
  . 'ON DUPLICATE KEY UPDATE '
  . 'character_name=VALUES(character_name), corporation_name=VALUES(corporation_name), '
  . 'alliance_id=VALUES(alliance_id), alliance_name=VALUES(alliance_name), roles=VALUES(roles), titles=VALUES(titles), '
  . 'last_login=VALUES(last_login), location_id=VALUES(location_id), location_name=VALUES(location_name), '
  . 'ship_type_id=VALUES(ship_type_id), ship_type_name=VALUES(ship_type_name), is_online=VALUES(is_online)';

$stmt = @$mysqli->prepare($sql);
if (!$stmt) {
  api_fail(200, 'Prepare failed', ['error' => $mysqli->error]);
}

// Build type string: i=int, s=string; booleans as i
$typeMap = [
  'character_id' => 'i', 'character_name' => 's', 'corporation_id' => 'i', 'corporation_name' => 's',
  'alliance_id' => 'i', 'alliance_name' => 's', 'roles' => 's', 'titles' => 's', 'last_login' => 's',
  'location_id' => 'i', 'location_name' => 's', 'ship_type_id' => 'i', 'ship_type_name' => 's',
  'is_online' => 'i'
];
$typeStr = '';
foreach ($cols as $c) { $typeStr .= $typeMap[$c]; }

$inserted = 0; $updated = 0; $failed = 0;
foreach ($records as $r) {
  if (!is_array($r)) { $failed++; continue; }
  $vals = [];
  foreach ($cols as $c) {
    $v = $r[$c] ?? null;
  if ($c === 'is_online') { $v = $v ? 1 : 0; }
    $vals[] = $v;
  }
  $bindParams = [$typeStr];
  foreach ($vals as $k => $v) { $bindParams[] = &$vals[$k]; }
  // bind_param requires references
  call_user_func_array([$stmt, 'bind_param'], $bindParams);
  if (!$stmt->execute()) { $failed++; continue; }
  if ($stmt->affected_rows === 1) { $inserted++; } else { $updated++; }
}

$stmt->close();
$mysqli->close();
api_respond(['ok' => true, 'inserted' => $inserted, 'updated' => $updated, 'failed' => $failed]);
