<?php
require_once __DIR__ . '/../_lib/common.php';
$payload = api_read_json();
$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($mysqli, (string)($payload['database'] ?? $dbCfg['database'] ?? 'lmeve2'));
$limit = api_limit($payload, 200, 2000);
$status = isset($payload['status']) ? strtoupper(preg_replace('/[^A-Z_]/','', (string)$payload['status'])) : '';
if ($status !== '') {
    $sql = "SELECT * FROM industry_jobs WHERE status = '$status' ORDER BY end_date DESC LIMIT $limit";
} else {
    $sql = "SELECT * FROM industry_jobs ORDER BY end_date DESC LIMIT $limit";
}
$res = @$mysqli->query($sql);
if ($res === false) { api_fail(200, 'Query failed', ['error' => $mysqli->error]); }
$rows = [];
while ($row = $res->fetch_assoc()) { $rows[] = $row; }
$res->close();
$mysqli->close();
api_respond(['ok' => true, 'rows' => $rows, 'rowCount' => count($rows)]);
