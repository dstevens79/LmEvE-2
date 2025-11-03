<?php
// public/api/test-connection.php
// Robust MySQL connectivity check endpoint (no mysql.user reads). Uses server settings by default.

declare(strict_types=1);

require_once __DIR__ . '/_lib/common.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$payload = json_decode($raw, true);
if (!is_array($payload)) { $payload = []; }

$dbCfg = api_get_db_config($payload);
$host = (string)($dbCfg['host'] ?? 'localhost');
$port = (int)($dbCfg['port'] ?? 3306);
$user = (string)($dbCfg['username'] ?? '');
$pass = (string)($dbCfg['password'] ?? '');
$db   = (string)($payload['database'] ?? $dbCfg['database'] ?? '');
$sdeDb = (string)($payload['sdeDatabase'] ?? 'EveStaticData');

if ($host === '' || $user === '' || $db === '') {
    echo json_encode(['ok' => false, 'error' => 'Missing database configuration (host/username/database). Configure in Settings first or include overrides in the request body.']);
    exit;
}

$start = microtime(true);

mysqli_report(MYSQLI_REPORT_OFF);
$mysqli = @mysqli_init();
if (!$mysqli) {
    echo json_encode(['ok' => false, 'error' => 'Failed to initialize mysqli']);
    exit;
}
// Fail fast on connect and reads to avoid blocking the web worker
@ini_set('default_socket_timeout', '10');
if (defined('MYSQLI_OPT_CONNECT_TIMEOUT')) { @$mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 10); }
if (defined('MYSQLI_OPT_READ_TIMEOUT')) { @$mysqli->options(MYSQLI_OPT_READ_TIMEOUT, 10); }

// Connect without selecting DB first to allow separate checks
$connected = @$mysqli->real_connect($host, $user, $pass, null, $port);
$latencyMs = (int) round((microtime(true) - $start) * 1000);

if (!$connected) {
    echo json_encode([
        'ok' => false,
        'latencyMs' => $latencyMs,
        'mysqlError' => $mysqli->connect_error,
        'mysqlErrno' => $mysqli->connect_errno,
    ]);
    exit;
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
$hasLmeveDb = false; $canSelectLmeve = false; $usersTableExists = false; $adminExists = false; $adminPasswordInfo = null;
if (@$mysqli->select_db($db)) {
    $hasLmeveDb = true;
    if ($res = @$mysqli->query('SELECT 1 AS ok')) { $canSelectLmeve = true; $res->close(); }
    // Check for users table and admin account existence
    if ($res = @$mysqli->query("SHOW TABLES LIKE 'users'")) {
        if ($res->num_rows > 0) { $usersTableExists = true; }
        $res->close();
    }
    if ($usersTableExists) {
        if ($res = @$mysqli->query("SELECT `password` FROM `users` WHERE `username`='admin' LIMIT 1")) {
            if ($row = $res->fetch_assoc()) {
                $adminExists = true;
                $stored = (string)($row['password'] ?? '');
                $type = 'empty';
                if ($stored !== '') {
                    if (strpos($stored, '$2y$') === 0 || strpos($stored, '$2a$') === 0) {
                        $type = 'bcrypt';
                    } elseif (strlen($stored) === 64 && ctype_xdigit($stored)) {
                        $type = 'sha256';
                    } else {
                        $type = 'plaintext_or_other';
                    }
                }
                // Determine if matches the default '12345' without exposing the secret
                $matchesDefault = false;
                if ($stored !== '') {
                    if ($type === 'bcrypt') {
                        $matchesDefault = password_verify('12345', $stored);
                    } elseif ($type === 'sha256') {
                        $matchesDefault = hash_equals($stored, hash('sha256', '12345'));
                    } else {
                        $matchesDefault = hash_equals($stored, '12345');
                    }
                }
                $adminPasswordInfo = [
                    'set' => $stored !== '',
                    'type' => $type,
                    'matchesDefault' => (bool)$matchesDefault,
                ];
            }
            $res->close();
        }
    }
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

echo json_encode([
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
    'usersTableExists' => $usersTableExists,
    'adminExists' => $adminExists,
    // Back-compat for clients expecting `userExists` to indicate admin presence
    'userExists' => $adminExists,
    'adminPasswordInfo' => $adminPasswordInfo,
    'hasSdeDb' => $hasSdeDb,
    'canSelectSde' => $canSelectSde,
]);
