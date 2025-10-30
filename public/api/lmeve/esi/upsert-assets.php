<?php
require_once __DIR__ . '/../../_lib/common.php';
$payload = api_read_json();
api_expect($payload, ['host','port','username','password','database','records']);
$records = $payload['records'];
if (!is_array($records) || count($records) === 0) {
  api_fail(400, 'records must be a non-empty array');
}
$mysqli = api_connect($payload);
api_select_db($mysqli, (string)$payload['database']);

$cols = [
  // Match schema in setup-lmeve-db.sh
  'item_id','type_id','location_id','location_type','location_flag','quantity','is_singleton','is_blueprint_copy','owner_id','corporation_id'
];

$sql = 'INSERT INTO assets (' . implode(',', $cols) . ') VALUES ('
  . implode(',', array_fill(0, count($cols), '?')) . ') '
  . 'ON DUPLICATE KEY UPDATE '
  . 'type_id=VALUES(type_id), location_id=VALUES(location_id), location_type=VALUES(location_type), location_flag=VALUES(location_flag), '
  . 'quantity=VALUES(quantity), is_singleton=VALUES(is_singleton), is_blueprint_copy=VALUES(is_blueprint_copy), owner_id=VALUES(owner_id), corporation_id=VALUES(corporation_id)';

$stmt = @$mysqli->prepare($sql);
if (!$stmt) { api_fail(200, 'Prepare failed', ['error' => $mysqli->error]); }

$typeMap = [
  'item_id' => 'i','type_id' => 'i','location_id' => 'i','location_type' => 's','location_flag' => 's','quantity' => 'i','is_singleton' => 'i','is_blueprint_copy' => 'i','owner_id' => 'i','corporation_id' => 'i'
];
$typeStr = '';
foreach ($cols as $c) { $typeStr .= $typeMap[$c]; }

$inserted = 0; $updated = 0; $failed = 0;
foreach ($records as $r) {
  if (!is_array($r)) { $failed++; continue; }
  $vals = [];
  foreach ($cols as $c) {
    $v = $r[$c] ?? null;
  if ($c === 'is_singleton' || $c === 'is_blueprint_copy') { $v = $v ? 1 : 0; }
  if ($c === 'location_type' && $v === null) { $v = 'station'; }
    $vals[] = $v;
  }
  $bindParams = [$typeStr];
  foreach ($vals as $k => $v) { $bindParams[] = &$vals[$k]; }
  call_user_func_array([$stmt, 'bind_param'], $bindParams);
  if (!$stmt->execute()) { $failed++; continue; }
  if ($stmt->affected_rows === 1) { $inserted++; } else { $updated++; }
}

$stmt->close();
$mysqli->close();
api_respond(['ok' => true, 'inserted' => $inserted, 'updated' => $updated, 'failed' => $failed]);
