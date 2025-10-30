<?php
require_once __DIR__ . '/../_lib/common.php';
$payload = api_read_json();
api_expect($payload, ['host','port','username','password','database']);
$mysqli = api_connect($payload);
api_select_db($mysqli, (string)$payload['database']);
$limit = api_limit($payload, 200, 5000);
$owner = isset($payload['ownerId']) ? (int)$payload['ownerId'] : 0;
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
