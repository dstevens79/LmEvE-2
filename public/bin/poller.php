<?php
// LMeve-2 system cron poller (server-side corp ESI sync).
//
// Mirrors the original roxlukas/lmeve architecture: a scheduled CLI job runs
// on the server, reads vaulted corp tokens straight from the database (no
// session, no browser required), and refreshes whatever segments are due.
//
// Per-process schedules live in sync_process_config (minutes per corp);
// last-run state lives in corp_sync_log. The poller runs every 5 minutes via
// /etc/cron.d/lmeve2 and only executes processes whose interval has elapsed.
// Manual "Run now" and scheduled work both enqueue into the same durable
// queue. This worker drains it serially, preventing concurrent page requests
// and cron from flooding ESI with duplicate corporation calls.
//
// Usage:   php bin/poller.php            (run everything due)
//          php bin/poller.php --check    (print what would run; no writes)

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
  echo "poller.php must be run from the CLI\n";
  exit(64);
}

require_once __DIR__ . '/../api/_lib/common.php';
require_once __DIR__ . '/../api/lmeve/esi/sync-core.php';

// The template allows up to 15 minutes; give headroom for big corp market scans.
set_time_limit(1480);
date_default_timezone_set(@date_default_timezone_get() ?: 'UTC');

$checkOnly = in_array('--check', $_SERVER['argv'] ?? [], true);

// ---------------------------------------------------------------------------
// Logging (plain text, storage dir — same location as settings.json)
// ---------------------------------------------------------------------------

$storageDir = api_storage_dir();
$logFile = $storageDir !== null ? rtrim($storageDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'lmeve-poller.log' : null;

function poller_log(string $level, string $message): void {
  global $logFile;
  $line = date('Y-m-d H:i:s') . " [{$level}] {$message}\n";
  fwrite(STDOUT, $line);
  if ($logFile !== null) {
    @file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
  }
}

// ---------------------------------------------------------------------------
// Lock: refuse to overlap a previous run (auto-released on exit/crash)
// ---------------------------------------------------------------------------

$lockHandle = null;
if ($storageDir !== null) {
  $lockPath = rtrim($storageDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'poller.lock';
  $lockHandle = @fopen($lockPath, 'c');
  if ($lockHandle && !flock($lockHandle, LOCK_EX | LOCK_NB)) {
    poller_log('WARN', 'Another poller is already running; exiting.');
    exit(0);
  }
}

// ---------------------------------------------------------------------------
// Connect (server-side settings.json — no HTTP payload involved)
// ---------------------------------------------------------------------------

$mysqli = api_connect([]);
$dbCfg = api_get_db_config([]);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));
sync_core_ensure_schema($mysqli);

poller_log('INFO', $checkOnly ? 'Poller --check started' : 'Poller run started');

// ---------------------------------------------------------------------------
// Active corporations with a vaulted token
// ---------------------------------------------------------------------------

$corpRes = $mysqli->query(
  "SELECT c.corporation_id, c.corporation_name
   FROM corporations c
   WHERE c.is_active=1
     AND EXISTS (
       SELECT 1 FROM users u
       WHERE u.corporation_id=c.corporation_id
         AND u.access_token IS NOT NULL AND u.access_token<>''
         AND u.refresh_token IS NOT NULL AND u.refresh_token<>''
     )
   ORDER BY c.corporation_id"
);

if (!$corpRes) {
  poller_log('ERROR', 'Corporation query failed: ' . $mysqli->error);
  exit(1);
}

$corps = [];
while ($row = $corpRes->fetch_assoc()) {
  $corps[] = ['id' => (int)$row['corporation_id'], 'name' => (string)$row['corporation_name']];
}

if (!$corps) {
  poller_log('INFO', 'No active corporations with vaulted corp tokens; nothing to do.');
  exit(0);
}

// ---------------------------------------------------------------------------
// Due detection + enqueue
// ---------------------------------------------------------------------------

$ran = 0; $skippedDue = 0; $errors = 0;
$serverSegments = SYNC_CORE_SEGMENTS;

foreach ($corps as $corp) {
  $corpId = $corp['id'];

  // Config rows for all processes, with last-run state from corp_sync_log.
  $stmt = @$mysqli->prepare(
    'SELECT cfg.process_type, cfg.enabled, cfg.interval_minutes, log.last_run_at
     FROM sync_process_config cfg
     LEFT JOIN corp_sync_log log ON log.corporation_id=cfg.corporation_id AND log.process_type=cfg.process_type
     WHERE cfg.corporation_id=?'
  );
  if (!$stmt) {
    poller_log('ERROR', "corp {$corpId} config query failed: {$mysqli->error}");
    $errors++;
    continue;
  }
  $stmt->bind_param('i', $corpId);
  $stmt->execute();
  $res = $stmt ? $stmt->get_result() : null;

  $dueProcesses = [];
  while ($row = $res ? $res->fetch_assoc() : false) {
    if (!$row) break;
    $process = (string)$row['process_type'];
    if (!(int)$row['enabled']) continue;

    $segment = sync_core_process_segment($process);
    if ($segment === null) {
      // No server-side implementation yet (wallet, killmails, ...). The poller
      // never touches personal-token data — those stay browser-driven.
      continue;
    }

    $intervalMin = max((int)$row['interval_minutes'], 5);
    $lastRun = isset($row['last_run_at']) ? (string)$row['last_run_at'] : '';
    $due = $lastRun === '' || strtotime($lastRun) <= time() - ($intervalMin * 60);

    if (!$due) {
      $skippedDue++;
      continue;
    }
    $dueProcesses[] = ['process' => $process, 'segment' => $segment];
  }
  $stmt->close();

  if (!$dueProcesses) continue;

  poller_log('INFO', "corp {$corpId} ({$corp['name']}): due -> " . implode(', ', array_map(function ($d) { return $d['process']; }, $dueProcesses)));

  foreach ($dueProcesses as $p) {
    if ($checkOnly) {
      poller_log('INFO', "[check-only] would enqueue {$p['process']} (segment={$p['segment']}) for corp {$corpId}");
      continue;
    }
    try {
      $queued = sync_queue_enqueue($mysqli, $corpId, $p['segment'], 'scheduled', 10, 0);
      poller_log('INFO', ($queued['created'] ? 'QUEUED' : 'DEDUPED') . " corp {$corpId} {$p['process']} job={$queued['job']['id']}");
    } catch (Throwable $e) {
      $errors++;
      poller_log('ERROR', "QUEUE corp {$corpId} {$p['process']}: " . $e->getMessage());
    }
  }
}

// One worker, one job at a time. Jobs created by an interactive page are
// higher priority than scheduled jobs but share the same token/ESI budget.
if (!$checkOnly) {
  $maxJobs = 50;
  for ($i = 0; $i < $maxJobs; $i++) {
    try {
      $job = sync_queue_process_one($mysqli);
      if ($job === null) break;
      $result = json_decode((string)($job['result_json'] ?? ''), true);
      if (($job['status'] ?? '') === SYNC_QUEUE_STATUS_SUCCEEDED && is_array($result)) {
        $ran++;
        poller_log('INFO', "OK job {$job['id']} corp {$job['corporation_id']} {$job['segment']}: fetched={$result['fetched']} inserted={$result['inserted']} updated={$result['updated']} failed={$result['failed']} tookMs={$result['tookMs']}");
      } else {
        $errors++;
        poller_log('ERROR', "FAIL job {$job['id']} corp {$job['corporation_id']} {$job['segment']}: " . ($job['error_message'] ?? 'unknown error'));
      }
      usleep(500000); // small gap between ESI jobs
    } catch (Throwable $e) {
      $errors++;
      poller_log('ERROR', 'QUEUE WORKER EXCEPTION: ' . $e->getMessage());
      break;
    }
  }
}

$mysqli->close();
poller_log('INFO', ($checkOnly ? 'Poller --check finished: would-run listed above. ' : 'Poller run finished: ') . "ran={$ran} notDue={$skippedDue} errors={$errors}");
exit($errors > 0 ? 1 : 0);
