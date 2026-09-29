<?php
// public/api/db-admin-actions.php
// Database admin operations: clear, schema init, SDE import.
// Requires authenticated admin. Uses the saved sudo/root password when the
// client sends a mask or leaves the field blank (connectivity already stored it).

declare(strict_types=1);

require_once __DIR__ . '/_lib/common.php';
api_require_admin();

header('Content-Type: application/json');
header('Cache-Control: no-store');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'GET' && ($_GET['action'] ?? '') === 'sde-status') {
    $dir = api_storage_dir();
    $logFile = $dir ? rtrim($dir, DIRECTORY_SEPARATOR) . '/sde-import.log' : null;
    if (!$logFile || !is_file($logFile)) {
        api_respond(['ok' => true, 'state' => 'none', 'lines' => []]);
    }
    $handle = @fopen($logFile, 'rb');
    if (!$handle) api_fail(500, 'Cannot read SDE import log');
    $size = (int)@filesize($logFile);
    if ($size > 12000) fseek($handle, -12000, SEEK_END);
    $tail = (string)stream_get_contents($handle);
    fclose($handle);
    $state = strpos($tail, 'LMEVE_SDE_STATUS=success') !== false ? 'success'
        : (strpos($tail, 'LMEVE_SDE_STATUS=failed') !== false ? 'failed'
        : ((time() - (int)@filemtime($logFile) > 7200) ? 'unknown' : 'running'));
    $lines = array_slice(preg_split('/\R/', trim($tail)) ?: [], -30);
    api_respond(['ok' => true, 'state' => $state, 'lines' => $lines]);
}
if ($method !== 'POST') {
    http_response_code(405);
    echo 'Method Not Allowed';
    exit;
}

$payload = api_read_json();
$action = strtolower(trim((string)($payload['action'] ?? '')));
$submittedPassword = (string)($payload['sudoPassword'] ?? '');

if ($action !== 'clear' && $action !== 'schema' && $action !== 'sde') {
    api_fail(400, "Unknown action: $action. Valid actions: clear, schema, sde");
}

$settings = api_load_server_settings();
if (!$settings) {
    api_fail(500, 'Server settings not configured');
}
$root = api_resolve_settings_root($settings);
$dbCfg = isset($root['database']) && is_array($root['database']) ? $root['database'] : [];

$dbHost = (string)($dbCfg['host'] ?? 'localhost');
$dbPort = isset($dbCfg['port']) ? (int)$dbCfg['port'] : 3306;
$dbName = (string)($dbCfg['database'] ?? 'lmeve2');
$sudoUser = trim((string)($dbCfg['sudoUsername'] ?? 'root'));
$storedSudoPass = (string)($dbCfg['sudoPassword'] ?? '');
$lmeveUser = trim((string)($dbCfg['username'] ?? ''));
$lmevePass = (string)($dbCfg['password'] ?? '');

// Never run maintenance against a different saved target than the one shown
// in the current Connectivity form.
$target = isset($payload['target']) && is_array($payload['target']) ? $payload['target'] : [];
if ($target !== [] && (
    (string)($target['host'] ?? '') !== $dbHost
    || (int)($target['port'] ?? 0) !== $dbPort
    || (string)($target['database'] ?? '') !== $dbName
    || (string)($target['username'] ?? '') !== $lmeveUser
)) {
    api_fail(409, 'Database form differs from saved settings. Click Save before running maintenance.');
}

$storedReal = ($storedSudoPass !== '' && $storedSudoPass !== '***') ? $storedSudoPass : '';
$submittedReal = ($submittedPassword !== '' && $submittedPassword !== '***') ? $submittedPassword : '';

// An existing database can be initialized by its application user when that
// account has CREATE TABLE privileges. Clear is the only root-level action.
if ($action === 'schema' || $action === 'sde') {
    if ($lmeveUser === '' || $lmevePass === '' || $lmevePass === '***') {
        api_fail(400, 'Save the application database user and password before database maintenance.');
    }
} else {
    if ($sudoUser === '') {
        api_fail(400, 'Database admin user is not configured. Set it in Connectivity and click Save.');
    }
    if ($submittedReal !== '' && $storedReal !== '' && !hash_equals($storedReal, $submittedReal)) {
        api_fail(403, 'Invalid database admin password');
    }
    $sudoPass = $submittedReal !== '' ? $submittedReal : $storedReal;
    if ($sudoPass === '') {
        api_fail(400, 'Database admin password is not saved. Enter it in Connectivity and click Save.');
    }
}

function admin_ident(string $name): string {
    return '`' . str_replace('`', '``', $name) . '`';
}

function admin_sql_string(mysqli $mysqli, string $value): string {
    return "'" . $mysqli->real_escape_string($value) . "'";
}

function admin_connect(string $host, string $user, string $pass, int $port): mysqli {
    mysqli_report(MYSQLI_REPORT_OFF);
    $mysqli = @mysqli_init();
    if (!$mysqli) {
        api_fail(500, 'Failed to initialize MySQL client');
    }
    @ini_set('default_socket_timeout', '15');
    if (defined('MYSQLI_OPT_CONNECT_TIMEOUT')) { @$mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 15); }
    if (defined('MYSQLI_OPT_READ_TIMEOUT')) { @$mysqli->options(MYSQLI_OPT_READ_TIMEOUT, 120); }
    $connected = @$mysqli->real_connect($host, $user, $pass, null, $port);
    if (!$connected) {
        api_fail(200, 'MySQL database connection failed', [
            'mysqlError' => $mysqli->connect_error,
            'mysqlErrno' => $mysqli->connect_errno,
        ]);
    }
    @$mysqli->set_charset('utf8mb4');
    return $mysqli;
}

function admin_schema_path(): string {
    $candidates = [
        __DIR__ . '/../server/schema/lmeve-schema.sql',
        __DIR__ . '/../../server/schema/lmeve-schema.sql',
        __DIR__ . '/../../../server/schema/lmeve-schema.sql',
    ];
    foreach ($candidates as $path) {
        if (is_file($path)) {
            return $path;
        }
    }
    return $candidates[0];
}

function admin_split_sql(string $sql): array {
    $sql = preg_replace('/^\xEF\xBB\xBF/', '', $sql) ?? $sql;
    $lines = preg_split('/\R/', $sql) ?: [];
    $kept = [];
    foreach ($lines as $line) {
        $trim = ltrim($line);
        if ($trim === '' || strncmp($trim, '--', 2) === 0 || strncmp($trim, '#', 1) === 0) {
            continue;
        }
        $kept[] = $line;
    }
    $parts = explode(';', implode("\n", $kept));
    $stmts = [];
    foreach ($parts as $part) {
        $part = trim($part);
        if ($part !== '') {
            $stmts[] = $part;
        }
    }
    return $stmts;
}

function admin_list_tables(mysqli $mysqli, string $dbName): array {
    $tables = [];
    $sql = 'SELECT TABLE_NAME AS table_name FROM information_schema.tables WHERE table_schema = '
        . admin_sql_string($mysqli, $dbName)
        . " AND table_type = 'BASE TABLE'";
    if ($res = @$mysqli->query($sql)) {
        while ($row = $res->fetch_assoc()) {
            $name = (string)($row['table_name'] ?? $row['TABLE_NAME'] ?? '');
            if ($name !== '') {
                $tables[] = $name;
            }
        }
        $res->close();
        return $tables;
    }
    // Fallback: SHOW TABLES avoids information_schema column-case quirks.
    if (!@$mysqli->select_db($dbName)) {
        return $tables;
    }
    if ($res = @$mysqli->query('SHOW TABLES')) {
        while ($row = $res->fetch_row()) {
            if (!empty($row[0])) {
                $tables[] = (string)$row[0];
            }
        }
        $res->close();
    }
    return $tables;
}

$mysqli = $action === 'clear'
    ? admin_connect($dbHost, $sudoUser, $sudoPass, $dbPort)
    : admin_connect($dbHost, $lmeveUser, $lmevePass, $dbPort);

// If the saved sudo password was the mask, keep the password that just worked.
if ($action === 'clear' && $storedReal === '' && $submittedReal !== '') {
    $dbCfg['sudoPassword'] = $submittedReal;
    $root['database'] = $dbCfg;
    $store = api_settings_path();
    if ($store) {
        $existing = $settings;
        if (isset($existing['settings']) && is_array($existing['settings'])) {
            $existing['settings'] = $root;
            $toStore = $existing;
        } else {
            $toStore = $root;
        }
        @file_put_contents($store, json_encode($toStore, JSON_PRETTY_PRINT));
    }
}

if ($action === 'clear') {
    if (!@$mysqli->query('CREATE DATABASE IF NOT EXISTS ' . admin_ident($dbName) . ' DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')) {
        $err = $mysqli->error;
        @$mysqli->close();
        api_fail(200, 'Cannot create database', ['mysqlError' => $err, 'database' => $dbName]);
    }
    $tables = admin_list_tables($mysqli, $dbName);
    if (!@$mysqli->select_db($dbName)) {
        $err = $mysqli->error;
        @$mysqli->close();
        api_fail(200, 'Cannot select database', ['mysqlError' => $err, 'database' => $dbName]);
    }
    $droppedCount = 0;
    $errors = [];
    if ($tables !== []) {
        @$mysqli->query('SET FOREIGN_KEY_CHECKS = 0');
        foreach ($tables as $t) {
            if (@$mysqli->query('DROP TABLE IF EXISTS ' . admin_ident($t))) {
                $droppedCount++;
            } else {
                $errors[] = $t . ': ' . $mysqli->error;
            }
        }
        @$mysqli->query('SET FOREIGN_KEY_CHECKS = 1');
    }
    @$mysqli->close();
    if ($errors !== [] && $droppedCount === 0) {
        api_fail(200, 'Clear failed', ['mysqlError' => $errors[0], 'errors' => $errors]);
    }
    echo json_encode([
        'ok' => true,
        'action' => 'clear',
        'droppedTables' => $droppedCount,
        'message' => $droppedCount > 0
            ? "Cleared $droppedCount tables from `$dbName`"
            : "No tables found in `$dbName` — already empty",
    ]);
    exit;
}

if ($action === 'schema') {
    if (!@$mysqli->select_db($dbName)) {
        $err = $mysqli->error;
        @$mysqli->close();
        api_fail(200, 'Cannot select database. Create it or grant the application user access first.', ['mysqlError' => $err, 'database' => $dbName]);
    }

    $schemaPath = admin_schema_path();
    if (!is_file($schemaPath)) {
        @$mysqli->close();
        api_fail(500, 'Schema file not found', ['path' => $schemaPath]);
    }
    $sql = @file_get_contents($schemaPath);
    if ($sql === false || trim($sql) === '') {
        @$mysqli->close();
        api_fail(500, 'Failed to read schema file', ['path' => $schemaPath]);
    }

    @$mysqli->query('SET NAMES utf8mb4');
    @$mysqli->query('SET FOREIGN_KEY_CHECKS = 0');

    $statements = admin_split_sql($sql);
    $ran = 0;
    $failed = null;
    foreach ($statements as $stmtSql) {
        $ok = @$mysqli->query($stmtSql);
        if (!$ok && stripos((string)$mysqli->error, 'JSON') !== false) {
            $retry = preg_replace('/\bJSON\b/', 'LONGTEXT', $stmtSql) ?? $stmtSql;
            $ok = @$mysqli->query($retry);
        }
        if (!$ok) {
            $failed = [
                'mysqlError' => $mysqli->error,
                'mysqlErrno' => $mysqli->errno,
                'failedStatement' => substr(preg_replace('/\s+/', ' ', $stmtSql) ?? $stmtSql, 0, 240),
                'statementsRun' => $ran,
                'statementsTotal' => count($statements),
            ];
            break;
        }
        $ran++;
    }
    @$mysqli->query('SET FOREIGN_KEY_CHECKS = 1');

    if ($failed !== null) {
        @$mysqli->close();
        api_fail(200, 'Schema import failed', $failed);
    }

    $tables = admin_list_tables($mysqli, $dbName);
    @$mysqli->close();

    $message = 'Schema initialized — ' . count($tables) . " tables in `$dbName`";

    echo json_encode([
        'ok' => true,
        'action' => 'schema',
        'tablesCreated' => count($tables),
        'statementsRun' => $ran,
        'appUserGranted' => true,
        'grantNote' => 'Schema created using the application database user',
        'message' => $message,
    ]);
    exit;
}

// --- Action: sde (download + import SDE via background shell script) ---
$sdeDb = 'EveStaticData';
if (!@$mysqli->select_db($sdeDb)) {
    if (!@$mysqli->query('CREATE DATABASE IF NOT EXISTS ' . admin_ident($sdeDb) . ' DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
        || !@$mysqli->select_db($sdeDb)) {
        $error = $mysqli->error;
        @$mysqli->close();
        api_fail(200, 'Application database user cannot access EveStaticData', ['mysqlError' => $error]);
    }
}
@$mysqli->close();

$scriptPath = __DIR__ . '/../scripts/import-sde.sh';
if (!is_file($scriptPath)) {
    $scriptPath = __DIR__ . '/../../scripts/import-sde.sh';
}
if (!is_file($scriptPath)) {
    api_fail(500, 'SDE import script not found', ['path' => $scriptPath]);
}
if (stripos(PHP_OS, 'WIN') === 0) {
    api_fail(200, 'SDE import script is a bash script and cannot run on Windows. Run scripts/import-sde.sh on the database host.');
}

$logDir = api_storage_dir();
$logFile = ($logDir ? $logDir : sys_get_temp_dir()) . '/sde-import.log';
$queued = @file_put_contents($logFile, "SDE import queued\n", LOCK_EX);
if ($queued === false) api_fail(500, 'Cannot write SDE import log');
$env = [
    'DB_HOST=' . escapeshellarg($dbHost),
    'DB_PORT=' . escapeshellarg((string)$dbPort),
    'DB_USER=' . escapeshellarg($lmeveUser),
    'DB_PASSWORD=' . escapeshellarg($lmevePass),
    'SDE_DB=' . escapeshellarg($sdeDb),
];
$cmd = implode(' ', $env) . ' bash ' . escapeshellarg($scriptPath) . ' > ' . escapeshellarg($logFile) . ' 2>&1 & echo $!';
$pid = @shell_exec($cmd);
if (!is_string($pid) || !ctype_digit(trim($pid))) {
    @file_put_contents($logFile, "ERROR: Failed to launch SDE import\nLMEVE_SDE_STATUS=failed\n", LOCK_EX);
    api_fail(500, 'Failed to start SDE import process');
}

echo json_encode([
    'ok' => true,
    'action' => 'sde',
    'started' => true,
    'pid' => (int)trim($pid),
    'database' => $sdeDb,
    'logFile' => basename($logFile),
    'message' => 'SDE import started in background. Check logs for progress.',
]);
exit;
