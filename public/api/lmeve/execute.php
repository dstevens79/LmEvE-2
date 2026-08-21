<?php
// public/api/lmeve/execute.php
// Real SQL executor for DatabaseManager.query(). Server-owned credentials
// (api_get_db_config ignores the request payload). Authenticated users only.
declare(strict_types=1);
require_once __DIR__ . '/../_lib/common.php';
api_require_auth();

$payload = api_read_json();
if (!isset($payload['sql']) || !is_string($payload['sql']) || trim($payload['sql']) === '') {
    api_fail(400, 'Missing required field: sql');
}
$sql = trim($payload['sql']);
$params = isset($payload['params']) && is_array($payload['params']) ? array_values($payload['params']) : [];

$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));

// Execute with optional positional params (? placeholders).
if (count($params) > 0) {
    $stmt = @$mysqli->prepare($sql);
    if (!$stmt) {
        $err = $mysqli->error;
        $mysqli->close();
        api_fail(200, 'Query prepare failed', ['error' => $err]);
    }
    $types = '';
    foreach ($params as $p) { $types .= (is_int($p) ? 'i' : 's'); }
    $bindParams = [$types];
    foreach ($params as $k => $v) { $bindParams[] = &$params[$k]; }
    call_user_func_array([$stmt, 'bind_param'], $bindParams);
    $ok = @$stmt->execute();
    if (!$ok) {
        $err = $stmt->error;
        $stmt->close();
        $mysqli->close();
        api_fail(200, 'Query failed', ['error' => $err]);
    }
    $result = $stmt->get_result();
    $affected = $stmt->affected_rows;
    $stmt->close();
} else {
    $res = @$mysqli->query($sql);
    if ($res === false) {
        $err = $mysqli->error;
        $mysqli->close();
        api_fail(200, 'Query failed', ['error' => $err]);
    }
    $result = $res;
    $affected = $res->affected_rows;
}

$rows = [];
$rowCount = 0;
if ($result instanceof mysqli_result) {
    while ($row = $result->fetch_assoc()) { $rows[] = $row; }
    $rowCount = $result->num_rows;
    $result->free();
}

$mysqli->close();
api_respond(['ok' => true, 'rows' => $rows, 'rowCount' => $rowCount, 'affectedRows' => $affected]);
