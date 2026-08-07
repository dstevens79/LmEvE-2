<?php
require_once __DIR__ . '/../_lib/common.php';
api_require_auth();
$payload = api_read_json();
$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));
$limit = api_limit($payload, 200, 2000);
$sql = "SELECT * FROM corporations ORDER BY corporation_id LIMIT $limit";
$res = @$mysqli->query($sql);
if ($res === false) {
    api_fail(200, 'Query failed', ['error' => $mysqli->error]);
}
$rows = [];
while ($row = $res->fetch_assoc()) { $rows[] = $row; }
$res->close();
$mysqli->close();
api_respond(['ok' => true, 'rows' => $rows, 'rowCount' => count($rows)]);
