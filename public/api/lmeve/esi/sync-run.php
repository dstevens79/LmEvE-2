<?php
// Server-side corporation ESI sync endpoint (manual "Run now" from the UI).
//
// The browser never touches raw corp tokens: this endpoint resolves the
// vaulted corp token from the users table, refreshes it when expired, fetches
// the requested ESI segment, and upserts rows into the app database. All of
// that logic lives in sync-core.php. Requests are first coalesced through the
// durable queue, so pages cannot flood ESI with duplicate corp+segment calls.
//
// POST { "processType": "members|assets|industry|market", "corporationId": 123 }
//       (SPA process ids like corporation_members / industry_jobs are accepted too)
//
// Auth: session required. Site admin / super_admin always; otherwise the
// session character must belong to the target corporation.

require_once __DIR__ . '/../../_lib/common.php';
require_once __DIR__ . '/../../_lib/session.php';
require_once __DIR__ . '/sync-core.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

$user = api_require_auth();
$payload = api_read_json();
api_expect($payload, ['processType', 'corporationId']);

$requestedProcess = (string)$payload['processType'];
$corpId = (int)$payload['corporationId'];

// Accept both vocabularies: SPA process ids and raw segment names.
if (in_array($requestedProcess, SYNC_CORE_SEGMENTS, true)) {
  $segment = $requestedProcess;
} else {
  $segment = sync_core_process_segment($requestedProcess);
  if ($segment === null) {
    api_fail(400, 'Unsupported processType: ' . $requestedProcess . '. Server segments are: ' . implode(', ', SYNC_CORE_SEGMENTS));
  }
}

if ($corpId <= 0) {
  api_fail(400, 'corporationId must be a positive integer');
}

api_require_corporation_access($user, $corpId);
$sessionCharId = isset($user['character_id']) ? (int)$user['character_id'] : 0;

$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));

$enqueued = sync_queue_enqueue($mysqli, $corpId, $segment, 'manual', 100, $sessionCharId);
$job = $enqueued['job'];

// A manual request is allowed to drain its own queued job immediately. This
// keeps the existing UI responsive while still deduplicating concurrent page
// requests; scheduled work is drained by the poller.
if (($job['status'] ?? '') === SYNC_QUEUE_STATUS_QUEUED) {
  $claimed = sync_queue_process_job($mysqli, (int)$job['id']);
  if ($claimed) {
    $job = $claimed;
  }
}
$result = json_decode((string)($job['result_json'] ?? ''), true);
$jobStatus = (string)($job['status'] ?? SYNC_QUEUE_STATUS_QUEUED);
$mysqli->close();

if ($jobStatus === SYNC_QUEUE_STATUS_SUCCEEDED && is_array($result) && !empty($result['ok'])) {
  api_respond([
    'ok' => true,
    'jobId' => (int)$job['id'],
    'jobStatus' => $jobStatus,
    'processType' => $result['processType'],
    'corporationId' => $result['corporationId'],
    'corporationName' => $result['corporationName'],
    'tokenCharacterId' => $result['tokenCharacterId'],
    'tokenRefreshed' => $result['tokenRefreshed'],
    'fetched' => $result['fetched'],
    'inserted' => $result['inserted'],
    'updated' => $result['updated'],
    'failed' => $result['failed'],
    'tookMs' => $result['tookMs'],
  ]);
}

if ($jobStatus === SYNC_QUEUE_STATUS_FAILED && is_array($result)) {
  api_fail((int)$result['httpCode'], 'Corp sync failed for ' . $segment . ': ' . ($result['error'] ?? 'unknown error'), [
    'jobId' => (int)$job['id'],
    'jobStatus' => $jobStatus,
    'processType' => $segment,
    'corporationId' => $corpId,
    'tookMs' => $result['tookMs'],
  ]);
}

api_respond([
  'ok' => true,
  'queued' => true,
  'deduplicated' => !$enqueued['created'],
  'jobId' => (int)$job['id'],
  'jobStatus' => $jobStatus,
  'processType' => $segment,
  'corporationId' => $corpId,
], 202);
