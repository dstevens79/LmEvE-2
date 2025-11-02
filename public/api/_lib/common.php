<?php
// Common helpers for API endpoints

declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function api_respond(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    echo json_encode($data);
    exit;
}

function api_fail(int $status, string $message, array $extra = []): void {
    api_respond(array_merge(['ok' => false, 'error' => $message], $extra), $status);
}

function api_read_json(): array {
    $raw = file_get_contents('php://input') ?: '';
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        api_fail(400, 'Invalid JSON body');
    }
    return $payload;
}

function api_expect(array $payload, array $required): void {
    foreach ($required as $key) {
        if (!array_key_exists($key, $payload) || $payload[$key] === '' || $payload[$key] === null) {
            api_fail(400, "Missing required field: $key");
        }
    }
}

function api_select_db(mysqli $mysqli, string $db): void {
    if (!@$mysqli->select_db($db)) {
        api_fail(200, 'Database not found or permission denied', [ 'database' => $db ]);
    }
}

function api_limit(array $payload, int $default = 100, int $max = 1000): int {
    $limit = isset($payload['limit']) ? (int)$payload['limit'] : $default;
    if ($limit < 1) $limit = 1;
    if ($limit > $max) $limit = $max;
    return $limit;
}

// ---- Server settings helpers ----

/**
 * Resolve a writable storage directory for server-side files with fallbacks:
 * 1) Preferred repo path: /server/storage
 * 2) Environment variable LMEVE_STORAGE_DIR, if set
 * 3) System temp directory: sys_get_temp_dir()/lmeve2-storage
 * Returns the first directory that exists and is writable; attempts to create as needed.
 */
function api_storage_dir(): ?string {
    $preferredDir = __DIR__ . '/../../../server/storage';
    $candidates = [];
    $candidates[] = $preferredDir;
    $envDir = getenv('LMEVE_STORAGE_DIR');
    if ($envDir && $envDir !== '') $candidates[] = $envDir;
    $candidates[] = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'lmeve2-storage';

    foreach ($candidates as $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
            clearstatcache();
        }
        if (is_dir($dir) && @is_writable($dir)) {
            return $dir;
        }
    }
    return null;
}

function api_settings_path(): ?string {
    $dir = api_storage_dir();
    if ($dir === null) return null;
    return rtrim($dir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'settings.json';
}

function api_load_server_settings(): ?array {
    $file = api_settings_path();
    if ($file === null) return null;
    if (!file_exists($file)) return null;
    $raw = @file_get_contents($file);
    if ($raw === false) return null;
    $json = json_decode($raw, true);
    return is_array($json) ? $json : null;
}

function api_resolve_settings_root(array $json): array {
    // Support two shapes:
    // 1) Full export: { version, exportDate, settings: { database, esi, ... } }
    // 2) Direct: { database: {...}, esi: {...} }
    if (isset($json['settings']) && is_array($json['settings'])) {
        return $json['settings'];
    }
    return $json;
}

function api_get_db_config(array $payload = []): array {
    $cfg = [
        'host' => $payload['host'] ?? null,
        'port' => isset($payload['port']) ? (int)$payload['port'] : null,
        'username' => $payload['username'] ?? null,
        'password' => $payload['password'] ?? null,
        'database' => $payload['database'] ?? null,
    ];
    $missing = array_filter($cfg, fn($v) => $v === null || $v === '');
    if (count($missing) === 0) return $cfg;

    $json = api_load_server_settings();
    if (!$json) return $cfg; // return possibly-partial
    $root = api_resolve_settings_root($json);
    $db = isset($root['database']) && is_array($root['database']) ? $root['database'] : [];
    $cfg['host'] = $cfg['host'] ?? ($db['host'] ?? 'localhost');
    $cfg['port'] = $cfg['port'] ?? (isset($db['port']) ? (int)$db['port'] : 3306);
    $cfg['username'] = $cfg['username'] ?? ($db['username'] ?? '');
    // If server stores masked password '***', treat as empty (client should supply or have stored real one earlier)
    $serverPass = $db['password'] ?? '';
    if ($serverPass === '***') $serverPass = '';
    $cfg['password'] = $cfg['password'] ?? $serverPass;
    $cfg['database'] = $cfg['database'] ?? ($db['database'] ?? 'lmeve2');
    return $cfg;
}

function api_get_esi_config(array $payload = []): array {
    $cfg = [
        'clientId' => $payload['clientId'] ?? null,
        'clientSecret' => $payload['clientSecret'] ?? null,
        'callbackUrl' => $payload['redirectUri'] ?? ($payload['callbackUrl'] ?? null),
        'userAgent' => $payload['userAgent'] ?? null,
    ];
    $missing = array_filter($cfg, fn($v) => $v === null || $v === '');
    if (count($missing) === 0) return $cfg;

    $json = api_load_server_settings();
    if (!$json) return $cfg;
    $root = api_resolve_settings_root($json);
    $esi = isset($root['esi']) && is_array($root['esi']) ? $root['esi'] : [];
    $cfg['clientId'] = $cfg['clientId'] ?? ($esi['clientId'] ?? '');
    $secret = $esi['clientSecret'] ?? '';
    if ($secret === '***') $secret = '';
    $cfg['clientSecret'] = $cfg['clientSecret'] ?? $secret;
    $cfg['callbackUrl'] = $cfg['callbackUrl'] ?? ($esi['callbackUrl'] ?? '');
    $cfg['userAgent'] = $cfg['userAgent'] ?? ($esi['userAgent'] ?? 'LMeve-2');
    return $cfg;
}

/**
 * Connect to MySQL using credentials from payload (overrides) or server settings.
 */
function api_connect(array $payload): mysqli {
    mysqli_report(MYSQLI_REPORT_OFF);
    $mysqli = @mysqli_init();
    if (!$mysqli) {
        api_fail(500, 'Failed to initialize MySQL client');
    }
    @$mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 10);

    $dbCfg = api_get_db_config($payload);
    $host = (string)($dbCfg['host'] ?? 'localhost');
    $port = (int)($dbCfg['port'] ?? 3306);
    $user = (string)($dbCfg['username'] ?? '');
    $pass = (string)($dbCfg['password'] ?? '');

    if ($host === '' || $user === '') {
        api_fail(400, 'Database configuration missing: host/username');
    }

    $ok = @$mysqli->real_connect($host, $user, $pass, null, $port);
    if (!$ok) {
        api_fail(200, 'MySQL connect failed', [
            'mysqlError' => $mysqli->connect_error,
            'mysqlErrno' => $mysqli->connect_errno,
        ]);
    }
    return $mysqli;
}
