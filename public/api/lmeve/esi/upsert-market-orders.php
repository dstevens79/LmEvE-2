<?php
require_once __DIR__ . '/../../_lib/common.php';
$payload = api_read_json();
api_expect($payload, ['host','port','username','password','database','records']);
$records = $payload['records'];
if (!is_array($records) || count($records) === 0) { api_fail(400, 'records must be a non-empty array'); }
$mysqli = api_connect($payload);
api_select_db($mysqli, (string)$payload['database']);

$cols = [
  // Match market_orders schema in setup-lmeve-db.sh
  'order_id','corporation_id','type_id','region_id','location_id','volume_total','volume_remain','min_volume','price','is_buy_order','duration','issued','state'
];

$sql = 'INSERT INTO market_orders (' . implode(',', $cols) . ') VALUES ('
  . implode(',', array_fill(0, count($cols), '?')) . ') '
  . 'ON DUPLICATE KEY UPDATE '
  . 'corporation_id=VALUES(corporation_id), type_id=VALUES(type_id), region_id=VALUES(region_id), location_id=VALUES(location_id), volume_total=VALUES(volume_total), volume_remain=VALUES(volume_remain), min_volume=VALUES(min_volume), price=VALUES(price), is_buy_order=VALUES(is_buy_order), duration=VALUES(duration), issued=VALUES(issued), state=VALUES(state)';

$stmt = @$mysqli->prepare($sql);
if (!$stmt) { api_fail(200, 'Prepare failed', ['error' => $mysqli->error]); }

$typeMap = [
  'order_id'=>'i','corporation_id'=>'i','type_id'=>'i','region_id'=>'i','location_id'=>'i','volume_total'=>'i','volume_remain'=>'i','min_volume'=>'i','price'=>'d','is_buy_order'=>'i','duration'=>'i','issued'=>'s','state'=>'s'
];
$typeStr = '';
foreach ($cols as $c) { $typeStr .= $typeMap[$c]; }

$inserted = 0; $updated = 0; $failed = 0;
foreach ($records as $r) {
  if (!is_array($r)) { $failed++; continue; }
  $vals = [];
  foreach ($cols as $c) {
    $v = $r[$c] ?? null;
  if ($c === 'is_buy_order') { $v = $v ? 1 : 0; }
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
