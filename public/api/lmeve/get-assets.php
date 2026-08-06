<?php
require_once __DIR__ . '/../_lib/common.php';
$user = api_require_auth();
$payload = api_read_json();
$owner = isset($payload['ownerId']) ? (int)$payload['ownerId'] : 0;
api_require_corporation_access($user, $owner);
$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));
$limit = api_limit($payload, 200, 5000);
if ($owner > 0) {
    $sql = "SELECT * FROM assets WHERE owner_id = $owner LIMIT $limit";
} else {
    $sql = "SELECT * FROM assets LIMIT $limit";
}
$res = @$mysqli->query($sql);
if ($res === false) { api_fail(200, 'Query failed', ['error' => $mysqli->error]); }
$rows = [];
while ($row = $res->fetch_assoc()) { $rows[] = $row; }
$res->close();
$mysqli->close();
api_respond(['ok' => true, 'rows' => $rows, 'rowCount' => count($rows)]);
