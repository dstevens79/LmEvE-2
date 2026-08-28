<?php
// Per-corporation sync process configuration + run status.
//
// GET  ?corporationId=N   -> { ok, corporationId, processes: [ {processType, enabled, intervalMinutes, serverSegment|null, lastRunAt|null, lastStatus|null, lastItems|null, lastError|null, tookMs|null} ] }
// POST { corporationId, updates: [ { processType, enabled?, intervalMinutes? } ] } -> upserts config rows
//
// Auth: session required; site admin / super_admin always, otherwise the
// session character must belong to the target corporation.

require_once __DIR__ . '/../../_lib/common.php';
require_once __DIR__ . '/../../_lib/session.php';
require_once __DIR__ . '/../esi/sync-core.php';

$user = api_require_auth();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if (!in_array($method, ['GET', 'POST'], true)) {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

$mysqli = api_connect([]);
$dbCfg = api_get_db_config([]);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));

// ---------------------------------------------------------------------------
// GET: config + status for one corp
// ---------------------------------------------------------------------------

if ($method === 'GET') {
  $corpId = isset($_GET['corporationId']) ? (int)$_GET['corporationId'] : 0;
  if ($corpId <= 0) api_fail(400, 'corporationId query param required');
  api_require_corporation_access($user, $corpId);

  sync_core_ensure_schema($mysqli);
  sync_core_seed_process_config($mysqli, $corpId);

  $stmt = @$mysqli->prepare(
    'SELECT cfg.process_type, cfg.enabled, cfg.interval_minutes,
            log.last_run_at, log.last_status, log.last_items, log.last_error, log.took_ms
     FROM sync_process_config cfg
     LEFT JOIN corp_sync_log log ON log.corporation_id=cfg.corporation_id AND log.process_type=cfg.process_type
     WHERE cfg.corporation_id=?
     ORDER BY cfg.process_type'
  );
  if (!$stmt) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
  $stmt->bind_param('i', $corpId);
  $stmt->execute();
  $res = $stmt ? $stmt->get_result() : null;

  $processes = [];
  while ($row = $res ? $res->fetch_assoc() : false) {
    if (!$row) break;
    $processType = (string)$row['process_type'];
    $processes[] = [
      'processType' => $processType,
      'enabled' => (bool)(int)$row['enabled'],
      'intervalMinutes' => (int)$row['interval_minutes'],
      'serverSegment' => sync_core_process_segment($processType), // null => browser-only process
      'lastRunAt' => isset($row['last_run_at']) && $row['last_run_at'] !== '' ? (string)$row['last_run_at'] : null,
      'lastStatus' => !empty($row['last_status']) ? (string)$row['last_status'] : null,
      'lastItems' => isset($row['last_items']) ? (int)$row['last_items'] : null,
      'lastError' => !empty($row['last_error']) ? (string)$row['last_error'] : null,
      'tookMs' => isset($row['took_ms']) ? (int)$row['took_ms'] : null,
    ];
  }
  $stmt->close();

  // Legacy last-sync from corporations table (drives "skip if already synced" in App.tsx).
  $legacy = ['lastSync' => null];
  $lr = @$mysqli->query('SELECT last_sync FROM corporations WHERE corporation_id=' . (int)$corpId . ' LIMIT 1');
  if ($lr) {
    $r2 = $lr->fetch_assoc();
    if ($r2 && !empty($r2['last_sync'])) $legacy['lastSync'] = (string)$r2['last_sync'];
    $lr->free();
  }

  $mysqli->close();
  api_respond(array_merge([
    'ok' => true,
    'corporationId' => $corpId,
  ], $legacy, ['processes' => $processes]));
}

// ---------------------------------------------------------------------------
// POST: update config rows for one corp
// ---------------------------------------------------------------------------

$payload = api_read_json();
api_expect($payload, ['corporationId', 'updates']);

$corpId = (int)$payload['corporationId'];
if ($corpId <= 0) api_fail(400, 'corporationId must be a positive integer');
api_require_corporation_access($user, $corpId);

$knownIds = sync_core_all_process_ids();
$updates = is_array($payload['updates']) ? $payload['updates'] : [];
if (count($updates) > 50) api_fail(400, 'Too many updates in one request');

sync_core_ensure_schema($mysqli);
sync_core_seed_process_config($mysqli, $corpId);

$applied = 0;
foreach ($updates as $u) {
  if (!is_array($u)) continue;
  $processType = (string)($u['processType'] ?? '');
  if (!in_array($processType, $knownIds, true)) {
    api_fail(400, 'Unknown processType: ' . $processType);
  }

  // Current values are the base; patch whatever was sent.
  $cur = ['enabled' => null, 'intervalMinutes' => null];
  $stmt = @$mysqli->prepare('SELECT enabled, interval_minutes FROM sync_process_config WHERE corporation_id=? AND process_type=? LIMIT 1');
  if ($stmt) {
    $stmt->bind_param('is', $corpId, $processType);
    @$stmt->execute();
    $res = $stmt ? $stmt->get_result() : null;
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if ($row) {
      $cur['enabled'] = (bool)(int)$row['enabled'];
      $cur['intervalMinutes'] = (int)$row['interval_minutes'];
    }
  }

  if (array_key_exists('enabled', $u)) $cur['enabled'] = filter_var($u['enabled'], FILTER_VALIDATE_BOOLEAN);
  if (array_key_exists('intervalMinutes', $u)) {
    $minutes = (int)$u['intervalMinutes'];
    // Clamp to a sane window: 5 min (cron granularity) .. 30 days.
    $cur['intervalMinutes'] = max(5, min($minutes, 43200));
  }

  if ($cur['enabled'] === null || $cur['intervalMinutes'] === null) continue; // nothing to change

  $stmt = @$mysqli->prepare(
    'INSERT INTO sync_process_config (corporation_id, process_type, enabled, interval_minutes)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), interval_minutes=VALUES(interval_minutes)'
  );
  if (!$stmt) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
  $enabled = $cur['enabled'] ? 1 : 0;
  $stmt->bind_param('isii', $corpId, $processType, $enabled, (int)$cur['intervalMinutes']);
  if (!$stmt->execute()) api_fail(500, 'DB execute failed', ['error' => $mysqli->error]);
  $stmt->close();
  $applied++;
}

$mysqli->close();
api_respond([
  'ok' => true,
  'corporationId' => $corpId,
  'applied' => $applied,
]);
