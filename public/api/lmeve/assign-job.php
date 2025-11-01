<?php
// Create/assign a manufacturing job by inserting into industry_jobs
require_once __DIR__ . '/../_lib/common.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

$payload = api_read_json();
// Minimal required fields; others optional
api_expect($payload, ['job_id','corporation_id','installer_id','blueprint_type_id','product_type_id','runs','status','start_date','end_date']);

$db = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($db, (string)($payload['database'] ?? $dbCfg['database'] ?? 'lmeve2'));

$cols = [
  'job_id','corporation_id','installer_id','facility_id','activity_id','blueprint_type_id','product_type_id','runs','status','duration','start_date','end_date','completed_date'
];

$values = [
  (int)$payload['job_id'],
  (int)$payload['corporation_id'],
  (int)$payload['installer_id'],
  isset($payload['facility_id']) ? (int)$payload['facility_id'] : null,
  isset($payload['activity_id']) ? (int)$payload['activity_id'] : null,
  (int)$payload['blueprint_type_id'],
  (int)$payload['product_type_id'],
  (int)$payload['runs'],
  (string)$payload['status'],
  isset($payload['duration']) ? (int)$payload['duration'] : null,
  (string)$payload['start_date'],
  (string)$payload['end_date'],
  isset($payload['completed_date']) ? (string)$payload['completed_date'] : null
];

$placeholders = implode(',', array_fill(0, count($cols), '?'));
$sql = 'INSERT INTO industry_jobs (' . implode(',', $cols) . ') VALUES (' . $placeholders . ')
        ON DUPLICATE KEY UPDATE 
          corporation_id=VALUES(corporation_id),
          installer_id=VALUES(installer_id),
          facility_id=VALUES(facility_id),
          activity_id=VALUES(activity_id),
          blueprint_type_id=VALUES(blueprint_type_id),
          product_type_id=VALUES(product_type_id),
          runs=VALUES(runs),
          status=VALUES(status),
          duration=VALUES(duration),
          start_date=VALUES(start_date),
          end_date=VALUES(end_date),
          completed_date=VALUES(completed_date)';

$stmt = @$db->prepare($sql);
if (!$stmt) { api_fail(200, 'DB prepare failed', ['error' => $db->error]); }

// Bind with explicit types (handle nullable ints as ints; MySQL will accept nulls)
$types = 'iiiiiiiisisss';
$stmt->bind_param(
  $types,
  $values[0],$values[1],$values[2],$values[3],$values[4],$values[5],$values[6],$values[7],$values[8],$values[9],$values[10],$values[11],$values[12]
);

if (!$stmt->execute()) { api_fail(200, 'DB execute failed', ['error' => $stmt->error]); }
$affected = $stmt->affected_rows;
$stmt->close();
$db->close();

api_respond(['ok' => true, 'affected' => $affected]);
