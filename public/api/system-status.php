<?php
// Aggregate system status with light caching (10 minutes). Provides EVE/ESI/SDE/DB/CorpESI/server metrics.
// GET /api/system-status.php[?refresh=1]

require_once __DIR__ . '/_lib/common.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'GET') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

$cacheTtlSec = 600; // 10 minutes
$refresh = isset($_GET['refresh']) && ($_GET['refresh'] === '1' || $_GET['refresh'] === 'true');
$storage = api_storage_dir();
$cacheFile = $storage ? rtrim($storage, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'system-status.json' : null;

function fetch_json_with_timeout($url, $timeout = 5) {
  $ctx = stream_context_create([
    'http' => [
      'method' => 'GET',
      'timeout' => $timeout,
      'ignore_errors' => true,
      'header' => "User-Agent: LMeve-2/Status\r\n",
    ]
  ]);
  $raw = @file_get_contents($url, false, $ctx);
  if ($raw === false) return null;
  $j = json_decode($raw, true);
  return is_array($j) ? $j : null;
}

function parse_sde_age_status($version) {
  // Expect version like YYYY-MM-DD-... or similar; fall back to unknown
  $dateStr = null;
  if (is_string($version) && strlen($version) >= 10) {
    // find first YYYY-MM-DD pattern
    if (preg_match('/(\\d{4}-\\d{2}-\\d{2})/', $version, $m)) {
      $dateStr = $m[1];
    }
  }
  if (!$dateStr) return [ 'ageDays' => null, 'status' => 'unknown' ];
  $ts = strtotime($dateStr);
  if ($ts === false) return [ 'ageDays' => null, 'status' => 'unknown' ];
  $ageDays = (int) floor((time() - $ts) / 86400);
  // thresholds: < 90 green, < 180 yellow, else red
  $status = $ageDays < 90 ? 'green' : ($ageDays < 180 ? 'yellow' : 'red');
  return [ 'ageDays' => $ageDays, 'status' => $status ];
}

// Serve cache if fresh
if (!$refresh && $cacheFile && file_exists($cacheFile)) {
  $stat = @stat($cacheFile);
  if ($stat && (time() - (int)$stat['mtime']) < $cacheTtlSec) {
    $raw = @file_get_contents($cacheFile);
    if ($raw !== false) {
      echo $raw;
      exit;
    }
  }
}

// Compute status
$status = [
  'lastUpdated' => date('c'),
  'eve' => [ 'status' => 'unknown', 'players' => 0 ],
  'esi' => [ 'status' => 'unknown' ],
  'corpEsi' => [ 'status' => 'unknown', 'corpCount' => 0 ],
  'sde' => [ 'currentVersion' => null, 'latestVersion' => null, 'ageDays' => null, 'status' => 'unknown' ],
  'database' => [ 'connected' => false ],
  'activeUsers' => 0,
  'server' => [ 'hostname' => null, 'publicIp' => null ],
];

// EVE server status
$eve = fetch_json_with_timeout('https://esi.evetech.net/latest/status/?datasource=tranquility', 5);
if (is_array($eve)) {
  $status['eve']['players'] = isset($eve['players']) ? (int)$eve['players'] : 0;
  $status['eve']['status'] = 'online';
}

// ESI swagger ping
$esi = fetch_json_with_timeout('https://esi.evetech.net/latest/swagger.json', 5);
$status['esi']['status'] = $esi ? 'online' : 'offline';

// Load server settings to assess corp ESI and SDE
$settings = api_load_server_settings();
if (is_array($settings)) {
  $root = api_resolve_settings_root($settings);
  // corp ESI: look for configured corporations arrays
  $corps = [];
  if (isset($root['corporations']) && is_array($root['corporations'])) $corps = $root['corporations'];
  if (isset($root['esi']) && is_array($root['esi'])) {
    $esiRoot = $root['esi'];
    if (isset($esiRoot['registeredCorps']) && is_array($esiRoot['registeredCorps'])) $corps = $esiRoot['registeredCorps'];
    if (isset($esiRoot['corporations']) && is_array($esiRoot['corporations'])) $corps = $esiRoot['corporations'];
  }
  $corpCount = 0;
  foreach ($corps as $c) {
    if (is_array($c)) {
      $active = isset($c['isActive']) ? (bool)$c['isActive'] : true;
      if ($active) $corpCount++;
    } else if (is_numeric($c)) {
      $corpCount++;
    }
  }
  $status['corpEsi']['corpCount'] = $corpCount;
  $status['corpEsi']['status'] = $corpCount > 0 ? 'online' : 'offline';

  // SDE current version from settings
  if (isset($root['sde']) && is_array($root['sde'])) {
    $cur = $root['sde']['currentVersion'] ?? null;
    if ($cur) $status['sde']['currentVersion'] = $cur;
    $parsed = parse_sde_age_status($cur);
    $status['sde']['ageDays'] = $parsed['ageDays'];
    $status['sde']['status'] = $parsed['status'];
  }
}

// SDE latest (reuse existing endpoint)
$latest = fetch_json_with_timeout((isset($_SERVER['REQUEST_SCHEME']) ? $_SERVER['REQUEST_SCHEME'] : 'http') . '://' . $_SERVER['HTTP_HOST'] . '/api/sde-latest.php', 5);
if (is_array($latest) && isset($latest['latestVersion'])) {
  $status['sde']['latestVersion'] = $latest['latestVersion'];
}

// Database connectivity and active user count (best-effort)
try {
  $db = api_connect($_GET);
  $cfg = api_get_db_config($_GET);
  $dbname = (string)($_GET['database'] ?? $cfg['database'] ?? 'lmeve2');
  api_select_db($db, $dbname);
  $status['database']['connected'] = true;
  // Active users in last 15 minutes
  $active = 0;
  if ($res = @$db->query("SHOW TABLES LIKE 'users'")) {
    if ($res->num_rows > 0) {
      $res->close();
      if ($res2 = @$db->query("SELECT COUNT(*) AS c FROM users WHERE last_login >= (NOW() - INTERVAL 15 MINUTE)")) {
        if ($row = $res2->fetch_assoc()) { $active = (int)$row['c']; }
        $res2->close();
      }
    } else {
      $res->close();
    }
  }
  $status['activeUsers'] = $active;
  @$db->close();
} catch (Throwable $e) {
  // leave database.connected=false and activeUsers=0
}

// Server host info (reuse existing endpoint)
$hostInfo = fetch_json_with_timeout((isset($_SERVER['REQUEST_SCHEME']) ? $_SERVER['REQUEST_SCHEME'] : 'http') . '://' . $_SERVER['HTTP_HOST'] . '/api/host-info.php', 5);
if (is_array($hostInfo) && isset($hostInfo['server'])) {
  $status['server']['hostname'] = $hostInfo['server']['hostname'] ?? null;
  $status['server']['publicIp'] = $hostInfo['server']['publicIp'] ?? null;
}

$out = json_encode([ 'ok' => true, 'status' => $status ], JSON_UNESCAPED_SLASHES);
if ($cacheFile) { @file_put_contents($cacheFile, $out); }

echo $out;
