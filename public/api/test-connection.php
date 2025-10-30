<?php
// public/api/test-connection.php
// Robust MySQL connectivity check endpoint (no mysql.user reads)

declare(strict_types=1);

header('Content-Type: application/json');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    respond(['ok' => false, 'error' => 'Invalid JSON body'], 400);
}

$host = isset($payload['host']) ? (string)$payload['host'] : '';
$port = isset($payload['port']) ? (int)$payload['port'] : 3306;
$user = isset($payload['username']) ? (string)$payload['username'] : '';
$pass = isset($payload['password']) ? (string)$payload['password'] : '';
$db   = isset($payload['database']) ? (string)$payload['database'] : '';
$sdeDb = isset($payload['sdeDatabase']) ? (string)$payload['sdeDatabase'] : 'EveStaticData';

if ($host === '' || $user === '' || $db === '') {
    respond(['ok' => false, 'error' => 'Missing required fields: host, username, database'], 400);
}

$start = microtime(true);

mysqli_report(MYSQLI_REPORT_OFF);
$mysqli = @mysqli_init();
if (!$mysqli) {
    respond(['ok' => false, 'error' => 'Failed to initialize mysqli'], 500);
}
@$mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 10);

// Connect without selecting DB first to allow separate checks
$connected = @$mysqli->real_connect($host, $user, $pass, null, $port);
$latencyMs = (int) round((microtime(true) - $start) * 1000);

if (!$connected) {
    respond([
        'ok' => false,
        'latencyMs' => $latencyMs,
        'mysqlError' => $mysqli->connect_error,
        'mysqlErrno' => $mysqli->connect_errno,
    ]);
}

// Identify current user and server version
$currentUser = null; $serverVersion = null;
if ($res = @$mysqli->query('SELECT CURRENT_USER() AS u')) {
    if ($row = $res->fetch_assoc()) { $currentUser = $row['u']; }
    $res->close();
}
if ($res = @$mysqli->query('SELECT VERSION() AS v')) {
    if ($row = $res->fetch_assoc()) { $serverVersion = $row['v']; }
    $res->close();
}

// Check target DB access
$hasLmeveDb = false; $canSelectLmeve = false;
if (@$mysqli->select_db($db)) {
    $hasLmeveDb = true;
    if ($res = @$mysqli->query('SELECT 1 AS ok')) { $canSelectLmeve = true; $res->close(); }
}

// Check SDE DB access
$hasSdeDb = false; $canSelectSde = false;
if ($sdeDb) {
    if (@$mysqli->select_db($sdeDb)) {
        $hasSdeDb = true;
        if ($res = @$mysqli->query('SELECT 1 AS ok')) { $canSelectSde = true; $res->close(); }
    }
}

@$mysqli->close();

respond([
    'ok' => true,
    'latencyMs' => $latencyMs,
    'serverVersion' => $serverVersion,
    'currentUser' => $currentUser,
    'host' => $host,
    'port' => $port,
    'database' => $db,
    'sdeDatabase' => $sdeDb,
    'hasLmeveDb' => $hasLmeveDb,
    'canSelectLmeve' => $canSelectLmeve,
    'hasSdeDb' => $hasSdeDb,
    'canSelectSde' => $canSelectSde,
]);
