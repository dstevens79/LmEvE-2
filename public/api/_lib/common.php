<?php
// Common helpers for API endpoints

declare(strict_types=1);

// Same-origin cookie sessions need credentialed CORS when a specific Origin is present.
// Avoid wildcard + credentials (browsers reject that combination).
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (is_string($origin) && $origin !== '') {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function api_respond(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
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

function api_secret_is_real($value): bool {
    return is_string($value) && $value !== '' && $value !== '***';
}

function api_get_db_config(array $payload = []): array {
    // Server-owned credentials only. Request payload is intentionally ignored here.
    // For authenticated admin "test before save", use api_get_db_config_for_admin_test().
    $json = api_load_server_settings();
    if (!$json) return [
        'host' => 'localhost',
        'port' => 3306,
        'username' => '',
        'password' => '',
        'database' => 'lmeve2',
    ];
    $root = api_resolve_settings_root($json);
    $db = isset($root['database']) && is_array($root['database']) ? $root['database'] : [];
    $serverPass = $db['password'] ?? '';
    if ($serverPass === '***') $serverPass = '';
    return [
        'host' => (string)($db['host'] ?? 'localhost'),
        'port' => isset($db['port']) ? (int)$db['port'] : 3306,
        'username' => (string)($db['username'] ?? ''),
        'password' => (string)$serverPass,
        'database' => (string)($db['database'] ?? 'lmeve2'),
    ];
}

/**
 * Build DB config for authenticated admin connection tests.
 * Allows form overrides so bootstrap admins can test credentials before saving settings.
 * Never used for ordinary data queries.
 */
function api_get_db_config_for_admin_test(array $payload = []): array {
    $base = api_get_db_config([]);
    $src = $payload;
    if (isset($payload['database']) && is_array($payload['database'])) {
        $src = $payload['database'];
    }

    $host = trim((string)($src['host'] ?? ''));
    $port = isset($src['port']) ? (int)$src['port'] : 0;
    $user = trim((string)($src['username'] ?? ($src['user'] ?? '')));
    $pass = $src['password'] ?? null;
    $database = trim((string)($src['database'] ?? ($src['db'] ?? '')));

    if ($host !== '') $base['host'] = $host;
    if ($port > 0) $base['port'] = $port;
    if ($user !== '') $base['username'] = $user;
    if ($database !== '') $base['database'] = $database;
    // Keep saved password when UI sends masked/empty secret
    if (is_string($pass) && $pass !== '' && $pass !== '***') {
        $base['password'] = $pass;
    }
    return $base;
}

function api_get_esi_config(array $payload = []): array {
    // Client id/secret come from server settings first.
    // Callback URL is not a user setting — see api_get_esi_callback_url().
    $cfg = [
        'clientId' => '',
        'clientSecret' => '',
        'callbackUrl' => '',
        'userAgent' => 'LMeve-2',
    ];

    $json = api_load_server_settings();
    if ($json) {
        $root = api_resolve_settings_root($json);
        $esi = isset($root['esi']) && is_array($root['esi']) ? $root['esi'] : [];
        $cfg['clientId'] = (string)($esi['clientId'] ?? '');
        $secret = $esi['clientSecret'] ?? '';
        if ($secret === '***') $secret = '';
        $cfg['clientSecret'] = (string)$secret;
        $cfg['userAgent'] = (string)($esi['userAgent'] ?? 'LMeve-2');
    }

    // Fill blanks only (e.g. first-run before settings saved)
    if ($cfg['clientId'] === '' && !empty($payload['clientId'])) {
        $cfg['clientId'] = (string)$payload['clientId'];
    }
    if ($cfg['clientSecret'] === '' && !empty($payload['clientSecret']) && $payload['clientSecret'] !== '***') {
        $cfg['clientSecret'] = (string)$payload['clientSecret'];
    }
    if (!empty($payload['userAgent'])) {
        $cfg['userAgent'] = (string)$payload['userAgent'];
    }

    $cfg['callbackUrl'] = api_get_esi_callback_url($payload);
    return $cfg;
}

/**
 * Canonical EVE SSO callback. Fixed for this site — not a user-typed setting.
 * Must match the URL registered on the EVE application exactly.
 */
function api_public_ipv4(): ?string {
    static $resolved = false;
    static $address = null;
    if ($resolved) return $address;
    $resolved = true;

    $dir = api_storage_dir();
    $cache = $dir ? rtrim($dir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'public-ip.json' : null;
    $saved = null;
    if ($cache && is_file($cache)) {
        $saved = json_decode((string)@file_get_contents($cache), true);
        if (is_array($saved)
            && isset($saved['ip'], $saved['checkedAt'])
            && filter_var($saved['ip'], FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)
            && time() - (int)$saved['checkedAt'] < 21600) {
            $address = $saved['ip'];
            return $address;
        }
    }

    $ctx = stream_context_create(['http' => [
        'timeout' => 3,
        'ignore_errors' => true,
        'header' => "User-Agent: LMeve-2/public-callback\r\n",
    ]]);
    $raw = @file_get_contents('https://api.ipify.org?format=json', false, $ctx);
    $json = $raw !== false ? json_decode($raw, true) : null;
    $candidate = is_array($json) ? ($json['ip'] ?? null) : null;
    if (is_string($candidate)
        && filter_var($candidate, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        $address = $candidate;
        if ($cache) @file_put_contents($cache, json_encode(['ip' => $candidate, 'checkedAt' => time()]), LOCK_EX);
        return $address;
    }
    if (is_array($saved) && isset($saved['ip'])
        && filter_var($saved['ip'], FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        $address = $saved['ip'];
    }
    return $address;
}

function api_get_esi_callback_url(array $payload = []): string {
    // Deployments reachable by both LAN and public hosts can pin the one EVE
    // developer application callback with LMEVE_PUBLIC_URL.
    $publicBase = trim((string)(getenv('LMEVE_PUBLIC_URL') ?: ''));
    $scheme = '';
    $host = '';
    $port = null;
    if ($publicBase !== '') {
        $parts = parse_url($publicBase);
        if (is_array($parts) && in_array($parts['scheme'] ?? '', ['http', 'https'], true) && !empty($parts['host'])) {
            $scheme = $parts['scheme'];
            $host = $parts['host'];
            $port = $parts['port'] ?? null;
        }
    }
    if ($host === '') {
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443)
            || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string)$_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
        $scheme = $https ? 'https' : 'http';
        $requestHost = parse_url($scheme . '://' . (string)($_SERVER['HTTP_HOST'] ?? 'localhost'));
        $host = is_array($requestHost) ? (string)($requestHost['host'] ?? 'localhost') : 'localhost';
        $port = is_array($requestHost) ? ($requestHost['port'] ?? null) : null;
    }
    if (filter_var($host, FILTER_VALIDATE_IP) && !filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        $host = api_public_ipv4() ?? '';
    }
    if ($host === '') return '';
    return $scheme . '://' . $host . ($port !== null ? ':' . $port : '') . '/api/auth/esi/callback.php';
}

/**
 * Connect to MySQL using credentials stored in server settings.
 */
function api_connect(array $payload): mysqli {
    mysqli_report(MYSQLI_REPORT_OFF);
    $mysqli = @mysqli_init();
    if (!$mysqli) {
        api_fail(500, 'Failed to initialize MySQL client');
    }
    // Fail fast: set connection and read timeouts
    @ini_set('default_socket_timeout', '10');
    if (defined('MYSQLI_OPT_CONNECT_TIMEOUT')) { @$mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 10); }
    if (defined('MYSQLI_OPT_READ_TIMEOUT')) { @$mysqli->options(MYSQLI_OPT_READ_TIMEOUT, 10); }

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

function api_current_user(): ?array {
    require_once __DIR__ . '/session.php';
    return api_session_user();
}

function api_require_auth(array $roles = []): array {
    $user = api_current_user();
    if ($user === null) {
        api_fail(401, 'Authentication required');
    }

    if ($roles === []) {
        return $user;
    }

    require_once __DIR__ . '/session.php';
    $role = api_normalize_role($user['role'] ?? '');
    // Site/local admins satisfy any authenticated role gate.
    if (api_is_site_admin($user) || in_array($role, $roles, true)) {
        return $user;
    }

    api_fail(403, 'Insufficient privileges');
}

function api_require_admin(): array {
    $user = api_current_user();
    if ($user === null) {
        api_fail(401, 'Authentication required');
    }

    require_once __DIR__ . '/session.php';
    $role = api_normalize_role($user['role'] ?? '');
    if (api_is_site_admin($user) || $role === 'super_admin' || $role === 'corp_admin') {
        return $user;
    }

    api_fail(403, 'Insufficient privileges');
}

function api_require_corporation_access(array $user, int $corporationId): void {
    require_once __DIR__ . '/session.php';
    if ($corporationId <= 0 || api_is_site_admin($user) || api_normalize_role($user['role'] ?? '') === 'super_admin') {
        return;
    }

    $sessionCorporationId = isset($user['corporation_id']) ? (int)$user['corporation_id'] : 0;
    if ($sessionCorporationId <= 0 || $sessionCorporationId !== $corporationId) {
        api_fail(403, 'Corporation access denied');
    }
}
