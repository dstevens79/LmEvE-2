<?php
require_once __DIR__ . '/../_lib/common.php';
$payload = api_read_json();
api_expect($payload, ['host','port','username','password','database']);
$mysqli = api_connect($payload);
api_select_db($mysqli, (string)$payload['database']);
$limit = api_limit($payload, 200, 2000);
$corp = isset($payload['corporationId']) ? (int)$payload['corporationId'] : 0;
if ($corp > 0) {
    $sql = "SELECT * FROM characters WHERE corporation_id = $corp ORDER BY name LIMIT $limit";
} else {
    $sql = "SELECT * FROM characters ORDER BY name LIMIT $limit";
}
$res = @$mysqli->query($sql);
if ($res === false) {
    api_fail(200, 'Query failed', ['error' => $mysqli->error]);
}
$rows = [];
while ($row = $res->fetch_assoc()) { $rows[] = $row; }
$res->close();
$mysqli->close();
api_respond(['ok' => true, 'rows' => $rows, 'rowCount' => count($rows)]);
