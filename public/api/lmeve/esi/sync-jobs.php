<?php
// Read a queued/running/completed ESI sync job. The browser gets status and
// counts only; tokens and other credentials never leave the server.

declare(strict_types=1);

require_once __DIR__ . '/../../_lib/common.php';
require_once __DIR__ . '/../../_lib/session.php';
require_once __DIR__ . '/sync-core.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

$user = api_require_auth();
$jobId = isset($_GET['jobId']) ? (int)$_GET['jobId'] : 0;
if ($jobId <= 0) api_fail(400, 'jobId must be a positive integer');

$db = api_connect([]);
$cfg = api_get_db_config([]);
api_select_db($db, (string)($cfg['database'] ?? 'lmeve2'));
sync_queue_ensure_schema($db);
$job = sync_queue_get_job($db, $jobId);
if (!$job) {
  $db->close();
  api_fail(404, 'Sync job not found');
}
api_require_corporation_access($user, (int)$job['corporation_id']);
$result = json_decode((string)($job['result_json'] ?? ''), true);
$db->close();

api_respond([
  'ok' => true,
  'job' => [
    'id' => (int)$job['id'],
    'corporationId' => (int)$job['corporation_id'],
    'segment' => $job['segment'],
    'status' => $job['status'],
    'attempts' => (int)$job['attempts'],
    'createdAt' => $job['created_at'],
    'startedAt' => $job['started_at'],
    'finishedAt' => $job['finished_at'],
    'error' => $job['error_message'],
  ],
  'result' => is_array($result) ? $result : null,
]);
