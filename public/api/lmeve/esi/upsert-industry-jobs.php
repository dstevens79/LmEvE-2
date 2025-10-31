<?php
require_once __DIR__ . '/../../_lib/common.php';
$payload = api_read_json();
api_expect($payload, ['records']);
$records = $payload['records'];
if (!is_array($records) || count($records) === 0) { api_fail(400, 'records must be a non-empty array'); }
$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($mysqli, (string)($payload['database'] ?? $dbCfg['database'] ?? 'lmeve2'));

// Match industry_jobs schema in setup-lmeve-db.sh
$cols = [
  'job_id','corporation_id','installer_id','facility_id','activity_id','blueprint_type_id','product_type_id','runs','status','duration','start_date','end_date','completed_date'
];

$sql = 'INSERT INTO industry_jobs (' . implode(',', $cols) . ') VALUES ('
  . implode(',', array_fill(0, count($cols), '?')) . ') '
  . 'ON DUPLICATE KEY UPDATE '
  . 'corporation_id=VALUES(corporation_id), installer_id=VALUES(installer_id), facility_id=VALUES(facility_id), activity_id=VALUES(activity_id), '
  . 'blueprint_type_id=VALUES(blueprint_type_id), product_type_id=VALUES(product_type_id), runs=VALUES(runs), status=VALUES(status), duration=VALUES(duration), '
  . 'start_date=VALUES(start_date), end_date=VALUES(end_date), completed_date=VALUES(completed_date)';

$stmt = @$mysqli->prepare($sql);
if (!$stmt) { api_fail(200, 'Prepare failed', ['error' => $mysqli->error]); }

$typeMap = [
  'job_id'=>'i','corporation_id'=>'i','installer_id'=>'i','facility_id'=>'i','activity_id'=>'i','blueprint_type_id'=>'i','product_type_id'=>'i','runs'=>'i','status'=>'s','duration'=>'i','start_date'=>'s','end_date'=>'s','completed_date'=>'s'
];
$typeStr = '';
foreach ($cols as $c) { $typeStr .= $typeMap[$c]; }

$inserted = 0; $updated = 0; $failed = 0;
foreach ($records as $r) {
  if (!is_array($r)) { $failed++; continue; }
  $vals = [];
  foreach ($cols as $c) { $vals[] = $r[$c] ?? null; }
  $bindParams = [$typeStr];
  foreach ($vals as $k => $v) { $bindParams[] = &$vals[$k]; }
  call_user_func_array([$stmt, 'bind_param'], $bindParams);
  if (!$stmt->execute()) { $failed++; continue; }
  if ($stmt->affected_rows === 1) { $inserted++; } else { $updated++; }
}

$stmt->close();
$mysqli->close();
api_respond(['ok' => true, 'inserted' => $inserted, 'updated' => $updated, 'failed' => $failed]);
