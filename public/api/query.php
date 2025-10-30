<?php
// public/api/query.php
// Execute a read-only SQL query using provided credentials. Intended for diagnostics/admin.
// NOTE: Use cautiously; ideally restrict to SELECT/SHOW/DESCRIBE queries.

header('Content-Type: application/json');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function json_response($status, $data) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    json_response(400, [
        'ok' => false,
        'error' => 'Invalid JSON body',
    ]);
}

$host = isset($payload['host']) ? (string)$payload['host'] : '';
$port = isset($payload['port']) ? (int)$payload['port'] : 3306;
$user = isset($payload['username']) ? (string)$payload['username'] : '';
$pass = isset($payload['password']) ? (string)$payload['password'] : '';
$db   = isset($payload['database']) ? (string)$payload['database'] : '';
$sql  = isset($payload['query']) ? (string)$payload['query'] : '';

if ($host === '' || $user === '' || $db === '' || $sql === '') {
    json_response(400, [
        'ok' => false,
        'error' => 'Missing required fields: host, username, database, query',
    ]);
}

// Basic read-only guard
$prefix = strtoupper(substr(ltrim($sql), 0, 10));
if (strpos($prefix, 'SELECT') !== 0 && strpos($prefix, 'SHOW') !== 0 && strpos($prefix, 'DESCRIBE') !== 0 && strpos($prefix, 'EXPLAIN') !== 0) {
    json_response(200, [
        'ok' => false,
        'error' => 'Only read-only queries are allowed (SELECT/SHOW/DESCRIBE/EXPLAIN).',
    ]);
}

mysqli_report(MYSQLI_REPORT_OFF);
$mysqli = @mysqli_init();
if (!$mysqli) {
    json_response(500, [ 'ok' => false, 'error' => 'Failed to initialize mysqli' ]);
}
@$mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 8);
$connected = @$mysqli->real_connect($host, $user, $pass, $db, $port);
if (!$connected) {
    json_response(200, [
        'ok' => false,
        'mysqlError' => $mysqli->connect_error,
        'mysqlErrno' => $mysqli->connect_errno,
    ]);
}

$result = @$mysqli->query($sql);
if ($result === false) {
    $err = $mysqli->error;
    @$mysqli->close();
    json_response(200, [ 'ok' => false, 'error' => $err ]);
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

json_response(200, [
    'ok' => true,
    'rows' => $rows,
    'rowCount' => count($rows),
    'affectedRows' => $affected,
]);
