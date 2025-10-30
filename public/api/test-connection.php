<?php
// public/api/test-connection.php
// Minimal MySQL connectivity check endpoint

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

if ($host === '' || $user === '' || $db === '') {
    json_response(400, [
        'ok' => false,
        'error' => 'Missing required fields: host, username, database',
    ]);
}

$start = microtime(true);

// Configure mysqli to use a short timeout
mysqli_report(MYSQLI_REPORT_OFF);
$mysqli = @mysqli_init();
if (!$mysqli) {
    json_response(500, [
        'ok' => false,
        'error' => 'Failed to initialize mysqli',
    ]);
}

// 8 second timeout
@$mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 8);

// Attempt connection
$connected = @$mysqli->real_connect($host, $user, $pass, $db, $port);
$latencyMs = (int) round((microtime(true) - $start) * 1000);

if (!$connected) {
    json_response(200, [
        'ok' => false,
        'latencyMs' => $latencyMs,
        'mysqlError' => $mysqli->connect_error,
        'mysqlErrno' => $mysqli->connect_errno,
    ]);
}

// Run a trivial query to confirm the selected DB is reachable
$pingOk = @$mysqli->query('SELECT 1 AS ok');
$serverVersion = @$mysqli->server_info;

// Close ASAP
@$mysqli->close();

json_response(200, [
    'ok' => $pingOk ? true : false,
    'latencyMs' => $latencyMs,
    'serverVersion' => $serverVersion,
]);
