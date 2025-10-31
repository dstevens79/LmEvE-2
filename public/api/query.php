<?php
// public/api/query.php
// Execute a read-only SQL query. Uses server settings for DB config by default; payload can override.

require_once __DIR__ . '/_lib/common.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$payload = api_read_json();
$sql  = isset($payload['query']) ? (string)$payload['query'] : '';
if ($sql === '') {
    api_fail(400, 'Missing required field: query');
}

// Basic read-only guard
$prefix = strtoupper(substr(ltrim($sql), 0, 10));
if (strpos($prefix, 'SELECT') !== 0 && strpos($prefix, 'SHOW') !== 0 && strpos($prefix, 'DESCRIBE') !== 0 && strpos($prefix, 'EXPLAIN') !== 0) {
    api_respond([ 'ok' => false, 'error' => 'Only read-only queries are allowed (SELECT/SHOW/DESCRIBE/EXPLAIN).' ], 200);
}

$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
$db   = (string)($payload['database'] ?? $dbCfg['database'] ?? 'lmeve2');
api_select_db($mysqli, $db);

$result = @$mysqli->query($sql);
if ($result === false) {
    $err = $mysqli->error;
    @$mysqli->close();
    api_respond([ 'ok' => false, 'error' => $err ], 200);
}

$rows = [];
if ($result instanceof mysqli_result) {
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    $result->free();
}
$affected = $mysqli->affected_rows;
@$mysqli->close();

api_respond([
    'ok' => true,
    'rows' => $rows,
    'rowCount' => count($rows),
    'affectedRows' => $affected,
]);
