<?php
// Common helpers for API endpoints

declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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

function api_connect(array $payload): mysqli {
    mysqli_report(MYSQLI_REPORT_OFF);
    $mysqli = @mysqli_init();
    if (!$mysqli) {
        api_fail(500, 'Failed to initialize MySQL client');
    }
    @$mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 10);

    $host = (string)($payload['host'] ?? 'localhost');
    $port = (int)($payload['port'] ?? 3306);
    $user = (string)($payload['username'] ?? '');
    $pass = (string)($payload['password'] ?? '');

    $ok = @$mysqli->real_connect($host, $user, $pass, null, $port);
    if (!$ok) {
        api_fail(200, 'MySQL connect failed', [
            'mysqlError' => $mysqli->connect_error,
            'mysqlErrno' => $mysqli->connect_errno,
        ]);
    }
    return $mysqli;
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
