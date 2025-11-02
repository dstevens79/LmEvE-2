<?php
// public/api/app-metrics.php
// Returns minimal counters to drive first-run UX without requiring prior configuration
// If DB is unreachable, returns zeros so the app can route to DB Settings.

declare(strict_types=1);

require_once __DIR__ . '/_lib/common.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'GET') {
    http_response_code(405);
    echo 'Method Not Allowed';
    exit;
}

$manualCount = 0;
$ssoCount = 0;
$dbOk = false;

try {
    $db = api_connect($_GET);
    $cfg = api_get_db_config($_GET);
    $dbname = (string)($_GET['database'] ?? $cfg['database'] ?? 'lmeve2');
    api_select_db($db, $dbname);

    // Check users table exists
    $hasUsers = false;
    if ($res = $db->query("SHOW TABLES LIKE 'users'")) {
        if ($res->num_rows > 0) { $hasUsers = true; }
        $res->close();
    }

    if ($hasUsers) {
        // Count distinct users who have successfully logged in at least once
        if ($res = $db->query("SELECT COUNT(*) AS c FROM users WHERE auth_method='manual' AND last_login IS NOT NULL")) {
            if ($row = $res->fetch_assoc()) { $manualCount = (int)$row['c']; }
            $res->close();
        }
        if ($res = $db->query("SELECT COUNT(*) AS c FROM users WHERE auth_method='esi' AND last_login IS NOT NULL")) {
            if ($row = $res->fetch_assoc()) { $ssoCount = (int)$row['c']; }
            $res->close();
        }
        $dbOk = true;
    }

    @$db->close();
} catch (Throwable $e) {
    // Leave counts at zero; indicate DB not OK
    $dbOk = false;
}

echo json_encode([
    'ok' => true,
    'dbConnected' => $dbOk,
    'manualLoginCount' => $manualCount,
    'ssoLoginCount' => $ssoCount,
]);
