<?php
// public/api/db-admin-actions.php
// Database admin operations: clear, schema init, SDE import.
// Requires authenticated admin + root (sudo) password verification.

declare(strict_types=1);

require_once __DIR__ . '/_lib/common.php';
api_require_admin();

header('Content-Type: application/json');
header('Cache-Control: no-store');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'POST') {
    http_response_code(405);
    echo 'Method Not Allowed';
    exit;
}

$payload = api_read_json();
api_expect($payload, ['action', 'sudoPassword']);

$action = strtolower(trim((string)$payload['action']));
$submittedPassword = (string)$payload['sudoPassword'];

$settings = api_load_server_settings();
if (!$settings) {
    api_fail(500, 'Server settings not configured');
}
$root = api_resolve_settings_root($settings);
$dbCfg = $root['database'] ?? [];

$dbHost = (string)($dbCfg['host'] ?? 'localhost');
$dbPort = isset($dbCfg['port']) ? (int)$dbCfg['port'] : 3306;
$dbName = (string)($dbCfg['database'] ?? 'lmeve2');
$sudoUser = (string)($dbCfg['sudoUsername'] ?? 'root');
$storedSudoPass = (string)($dbCfg['sudoPassword'] ?? '');
$lmeveUser = (string)($dbCfg['username'] ?? '');

if ($sudoUser === '' || $storedSudoPass === '') {
    api_fail(500, 'Sudo/root database credentials are not configured. Set them in Settings -> Database first.');
}

if ($submittedPassword === '' || !hash_equals($storedSudoPass, $submittedPassword)) {
    api_fail(403, 'Invalid sudo password');
}

if ($action !== 'clear' && $action !== 'schema' && $action !== 'sde') {
    api_fail(400, "Unknown action: $action. Valid actions: clear, schema, sde");
}

// --- Connect as root (sudo user) ---
mysqli_report(MYSQLI_REPORT_OFF);
$mysqli = @mysqli_init();
if (!$mysqli) {
    api_fail(500, 'Failed to initialize MySQL client');
}
@ini_set('default_socket_timeout', 10);
if (defined('MYSQLI_OPT_CONNECT_TIMEOUT')) { @$mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 10); }
if (defined('MYSQLI_OPT_READ_TIMEOUT')) { @$mysqli->options(MYSQLI_OPT_READ_TIMEOUT, 30); }

$connected = @$mysqli->real_connect($dbHost, $sudoUser, $storedSudoPass, null, $dbPort);
if (!$connected) {
    api_fail(200, 'MySQL root connection failed', [
        'mysqlError' => $mysqli->connect_error,
        'mysqlErrno' => $mysqli->connect_errno,
    ]);
}

// --- Action: clear (drop all tables in the lmeve DB) ---
if ($action === 'clear') {
    $tables = [];
    if ($res = @$mysqli->query("SELECT table_name FROM information_schema.tables WHERE table_schema = " . $mysqli->real_escape_string($dbName) . " AND table_type = 'BASE TABLE'")) {
        while ($row = $res->fetch_assoc()) {
            $tables[] = $row['table_name'];
        }
        $res->close();
    }

    $droppedCount = 0;
    if (!empty($tables)) {
        @$mysqli->query("SET FOREIGN_KEY_CHECKS = 0");
        foreach ($tables as $t) {
            $q = "DROP TABLE IF EXISTS `" . str_replace('`', '``', $t) . "`";
            if (@$mysqli->query($q)) {
                $droppedCount++;
            }
        }
        @$mysqli->query("SET FOREIGN_KEY_CHECKS = 1");
    }

    @$mysqli->close();

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

// --- Action: schema (create DB + run schema SQL) ---
if ($action === 'schema') {
    // Ensure database exists
    @$mysqli->query("CREATE DATABASE IF NOT EXISTS `" . str_replace('`', '``', $dbName) . "` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    if (!@$mysqli->select_db($dbName)) {
        @$mysqli->close();
        api_fail(200, 'Cannot select database', ['database' => $dbName]);
    }

    // Read schema SQL
    $schemaPath = __DIR__ . '/../../server/schema/lmeve-schema.sql';
    if (!file_exists($schemaPath)) {
        @$mysqli->close();
        api_fail(500, 'Schema file not found', ['path' => $schemaPath]);
    }
    $sql = @file_get_contents($schemaPath);
    if ($sql === false) {
        @$mysqli->close();
        api_fail(500, 'Failed to read schema file');
    }

    // Execute multi-statement SQL
    $success = @$mysqli->multi_query($sql);
    if (!$success) {
        $err = $mysqli->error;
        @$mysqli->close();
        api_fail(200, 'Schema import failed', ['mysqlError' => $err]);
    }

    // Drain all result sets
    while (@$mysqli->more_results() && @$mysqli->next_result()) {
        if ($res = @$mysqli->store_result()) {
            $res->close();
        }
    }

    // Count tables created
    $tableCount = 0;
    if ($res = @$mysqli->query("SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = " . $mysqli->real_escape_string($dbName))) {
        if ($row = $res->fetch_assoc()) {
            $tableCount = (int)$row['c'];
        }
        $res->close();
    }

    @$mysqli->close();

    echo json_encode([
        'ok' => true,
        'action' => 'schema',
        'tablesCreated' => $tableCount,
        'message' => "Schema initialized — $tableCount tables in `$dbName`",
    ]);
    exit;
}

// --- Action: sde (download + import SDE via background shell script) ---
if ($action === 'sde') {
    $sdeDb = 'EveStaticData';

    // Ensure SDE database exists and grant to lmeve user
    @$mysqli->query("CREATE DATABASE IF NOT EXISTS `" . str_replace('`', '``', $sdeDb) . "` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    $escapedSdeDb = str_replace('`', '``', $sdeDb);
    @$mysqli->query("GRANT ALL PRIVILEGES ON `$escapedSdeDb`.* TO '$lmeveUser'@'%'");
    @$mysqli->query("GRANT ALL PRIVILEGES ON `$escapedSdeDb`.* TO '$lmeveUser'@'localhost'");
    @$mysqli->query("FLUSH PRIVILEGES");

    @$mysqli->close();

    // Start background SDE import
    $scriptPath = __DIR__ . '/../../scripts/import-sde.sh';
    $logDir = api_storage_dir();
    $logFile = ($logDir ? $logDir : sys_get_temp_dir()) . '/sde-import.log';

    $env = [
        'DB_HOST=' . escapeshellarg($dbHost),
        'DB_PORT=' . escapeshellarg((string)$dbPort),
        'DB_USER=' . escapeshellarg($sudoUser),
        'DB_PASSWORD=' . escapeshellarg($storedSudoPass),
        'SDE_DB=' . escapeshellarg($sdeDb),
    ];
    $envStr = implode(' ', $env);

    // Launch in background; redirect output to log file
    $cmd = $envStr . ' bash ' . escapeshellarg($scriptPath) . ' > ' . escapeshellarg($logFile) . ' 2>&1 &';
    $pid = @shell_exec($cmd);

    if ($pid === null) {
        api_fail(500, 'Failed to start SDE import process');
    }

    $logRel = basename($logFile);
    echo json_encode([
        'ok' => true,
        'action' => 'sde',
        'started' => true,
        'database' => $sdeDb,
        'logFile' => $logRel,
        'message' => 'SDE import started in background. Check logs for progress.',
    ]);
    exit;
}
