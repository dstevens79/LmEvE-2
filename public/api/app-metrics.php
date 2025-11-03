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
$registeredPilotsCount = 0;
$registeredCorpsCount = 0;
$dbOk = false;

try {
    $db = api_connect($_GET);
    $cfg = api_get_db_config($_GET);
    $dbname = (string)($_GET['database'] ?? $cfg['database'] ?? 'lmeve2');
    api_select_db($db, $dbname);

    // Consider DB connected if we can connect and select the target database
    $dbOk = true;

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

        // Determine managed corporations (if available) from server settings
        $managedCorpIds = [];
        $settings = api_load_server_settings();
        if (is_array($settings)) {
            $root = api_resolve_settings_root($settings);
            // Accept multiple shapes: settings.corporations[], settings.esi.registeredCorps[], settings.esi.corporations[]
            if (isset($root['corporations']) && is_array($root['corporations'])) {
                foreach ($root['corporations'] as $corp) {
                    if (is_array($corp)) {
                        $cid = $corp['corporationId'] ?? $corp['id'] ?? null;
                        $active = isset($corp['isActive']) ? (bool)$corp['isActive'] : true;
                        if ($cid && $active) $managedCorpIds[] = (int)$cid;
                    }
                }
            } elseif (isset($root['esi']) && is_array($root['esi'])) {
                $esiRoot = $root['esi'];
                $candidates = [];
                if (isset($esiRoot['registeredCorps']) && is_array($esiRoot['registeredCorps'])) $candidates = $esiRoot['registeredCorps'];
                if (isset($esiRoot['corporations']) && is_array($esiRoot['corporations'])) $candidates = $esiRoot['corporations'];
                foreach ($candidates as $corp) {
                    if (is_array($corp)) {
                        $cid = $corp['corporationId'] ?? $corp['id'] ?? null;
                        $active = isset($corp['isActive']) ? (bool)$corp['isActive'] : true;
                        if ($cid && $active) $managedCorpIds[] = (int)$cid;
                    } elseif (is_numeric($corp)) {
                        $managedCorpIds[] = (int)$corp;
                    }
                }
            }
        }
        $managedCorpIds = array_values(array_unique(array_filter($managedCorpIds, fn($v) => is_int($v) || is_numeric($v))));
        $registeredCorpsCount = count($managedCorpIds);

        // Build WHERE fragments
        $corpFilter = '';
        if ($registeredCorpsCount > 0) {
            $inList = implode(',', array_map('intval', $managedCorpIds));
            $corpFilter = " AND corporation_id IN ($inList)";
        }

        // Collect unique user IDs that satisfy any of the conditions:
        // 1) ESI user with at least one login and (optionally) member of a managed corp
        // 2) Any user assigned a role manually (role not null/empty)
        // 3) Any manual-auth user (local sign-in counts even without SSO)
        $ids = [];
        // Condition 1
        $sql1 = "SELECT id FROM users WHERE auth_method='esi' AND last_login IS NOT NULL" . $corpFilter;
        if ($res = $db->query($sql1)) {
            while ($row = $res->fetch_assoc()) { $ids[(string)$row['id']] = true; }
            $res->close();
        }
        // Condition 2
        $sql2 = "SELECT id FROM users WHERE role IS NOT NULL AND role <> ''";
        if ($res = $db->query($sql2)) {
            while ($row = $res->fetch_assoc()) { $ids[(string)$row['id']] = true; }
            $res->close();
        }
        // Condition 3
        $sql3 = "SELECT id FROM users WHERE auth_method='manual'";
        if ($res = $db->query($sql3)) {
            while ($row = $res->fetch_assoc()) { $ids[(string)$row['id']] = true; }
            $res->close();
        }
        $registeredPilotsCount = count($ids);
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
    'registeredPilotsCount' => $registeredPilotsCount,
    'registeredCorpsCount' => $registeredCorpsCount,
]);
