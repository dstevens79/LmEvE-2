<?php
// Lookup type names from EveStaticData.invTypes by IDs
require_once __DIR__ . '/../_lib/common.php';
$payload = api_read_json();
api_expect($payload, ['host','port','username','password']);
$ids = $payload['typeIds'] ?? [];
if (!is_array($ids) || count($ids) === 0) {
  api_fail(400, 'typeIds must be a non-empty array');
}
$sdeDb = (string)($payload['sdeDatabase'] ?? 'EveStaticData');
$mysqli = api_connect($payload);
api_select_db($mysqli, $sdeDb);

// Prepare IN clause safely
$ids = array_values(array_filter(array_map('intval', $ids), fn($x) => $x > 0));
if (count($ids) === 0) { api_fail(400, 'No valid typeIds provided'); }
$placeholders = implode(',', array_fill(0, count($ids), '?'));
$sql = "SELECT typeID, typeName FROM invTypes WHERE typeID IN ($placeholders)";
$stmt = @$mysqli->prepare($sql);
if (!$stmt) { api_fail(200, 'Prepare failed', ['error' => $mysqli->error]); }
$typeStr = str_repeat('i', count($ids));
$bind = [$typeStr];
foreach ($ids as $k => $v) { $bind[] = &$ids[$k]; }
call_user_func_array([$stmt,'bind_param'], $bind);
if (!$stmt->execute()) { api_fail(200, 'Query failed', ['error' => $stmt->error]); }
$res = $stmt->get_result();
$rows = [];
while ($row = $res->fetch_assoc()) { $rows[] = $row; }
$stmt->close();
$mysqli->close();
api_respond(['ok' => true, 'rows' => $rows]);
