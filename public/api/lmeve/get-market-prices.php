<?php
require_once __DIR__ . '/../_lib/common.php';
$user = api_require_auth();
$payload = api_read_json();
$corp = isset($payload['corporationId']) ? (int)$payload['corporationId'] : 0;
api_require_corporation_access($user, $corp);
$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));

// /markets/prices is public and global — one row per type for the whole game.
$sql = "SELECT * FROM market_prices ORDER BY adjusted_price DESC LIMIT 1000";
$res = @$mysqli->query($sql);
if ($res === false) { api_fail(200, 'Query failed', ['error' => $mysqli->error]); }
$rows = [];
while ($row = $res->fetch_assoc()) { $rows[] = $row; }
$res->close();
$mysqli->close();
api_respond(['ok' => true, 'rows' => $rows, 'rowCount' => count($rows)]);
