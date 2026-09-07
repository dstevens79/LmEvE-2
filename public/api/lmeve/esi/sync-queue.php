<?php
// Durable, database-backed corporation ESI sync queue.
//
// One active job is allowed per corporation + segment. Browser requests only
// enqueue/dedupe work; poller.php drains jobs serially and remains the sole
// long-running ESI worker.

declare(strict_types=1);

const SYNC_QUEUE_STATUS_QUEUED = 'queued';
const SYNC_QUEUE_STATUS_RUNNING = 'running';
const SYNC_QUEUE_STATUS_SUCCEEDED = 'succeeded';
const SYNC_QUEUE_STATUS_FAILED = 'failed';

function sync_queue_ensure_schema(mysqli $db): void {
  static $done = false;
  if ($done) return;

  $ok = @$db->query(
    "CREATE TABLE IF NOT EXISTS esi_sync_jobs (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      corporation_id BIGINT NOT NULL,
      segment VARCHAR(50) NOT NULL,
      request_source VARCHAR(32) NOT NULL DEFAULT 'scheduled',
      requested_by_character_id BIGINT NULL DEFAULT NULL,
      priority INT NOT NULL DEFAULT 10,
      status VARCHAR(16) NOT NULL DEFAULT 'queued',
      active_key VARCHAR(128) NULL DEFAULT NULL,
      attempts INT NOT NULL DEFAULT 0,
      available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME NULL DEFAULT NULL,
      finished_at DATETIME NULL DEFAULT NULL,
      error_message TEXT NULL,
      result_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_esi_sync_jobs_active (active_key),
      INDEX idx_esi_sync_jobs_next (status, available_at, priority, id),
      INDEX idx_esi_sync_jobs_corp (corporation_id, segment, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  if (!$ok) throw new RuntimeException('Unable to create ESI sync queue: ' . $db->error, 500);
  $done = true;
}

function sync_queue_active_key(int $corpId, string $segment): string {
  return $corpId . ':' . $segment;
}

function sync_queue_acquire_worker_lock(mysqli $db, int $timeoutSeconds = 0): bool {
  $timeoutSeconds = max(0, min($timeoutSeconds, 10));
  $res = @$db->query("SELECT GET_LOCK('lmeve2_esi_sync_worker', {$timeoutSeconds}) AS acquired");
  $row = $res ? $res->fetch_assoc() : null;
  if ($res) $res->close();
  return is_array($row) && (int)($row['acquired'] ?? 0) === 1;
}

function sync_queue_release_worker_lock(mysqli $db): void {
  @$db->query("DO RELEASE_LOCK('lmeve2_esi_sync_worker')");
}

/** @return array<string,mixed>|null */
function sync_queue_get_job(mysqli $db, int $jobId): ?array {
  $stmt = @$db->prepare('SELECT * FROM esi_sync_jobs WHERE id=? LIMIT 1');
  if (!$stmt) throw new RuntimeException('Queue query prepare failed: ' . $db->error, 500);
  $stmt->bind_param('i', $jobId);
  $stmt->execute();
  $res = $stmt->get_result();
  $row = $res ? $res->fetch_assoc() : null;
  $stmt->close();
  return is_array($row) ? $row : null;
}

/** @return array{job:array<string,mixed>,created:bool} */
function sync_queue_enqueue(mysqli $db, int $corpId, string $segment, string $source = 'scheduled', int $priority = 10, int $requestedByCharacterId = 0): array {
  sync_queue_ensure_schema($db);
  $key = sync_queue_active_key($corpId, $segment);
  $stmt = @$db->prepare('SELECT * FROM esi_sync_jobs WHERE active_key=? LIMIT 1');
  if ($stmt) {
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $res = $stmt->get_result();
    $existing = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (is_array($existing)) return ['job' => $existing, 'created' => false];
  }

  $requestedBy = $requestedByCharacterId > 0 ? $requestedByCharacterId : null;
  $stmt = @$db->prepare("INSERT INTO esi_sync_jobs (corporation_id, segment, request_source, requested_by_character_id, priority, status, active_key) VALUES (?, ?, ?, ?, ?, 'queued', ?)");
  if (!$stmt) throw new RuntimeException('Queue insert prepare failed: ' . $db->error, 500);
  $stmt->bind_param('issiis', $corpId, $segment, $source, $requestedBy, $priority, $key);
  $inserted = @$stmt->execute();
  $errno = $stmt->errno;
  $jobId = (int)$stmt->insert_id;
  $stmt->close();

  if (!$inserted && $errno === 1062) {
    $stmt = @$db->prepare('SELECT * FROM esi_sync_jobs WHERE active_key=? LIMIT 1');
    if ($stmt) {
      $stmt->bind_param('s', $key);
      $stmt->execute();
      $res = $stmt->get_result();
      $existing = $res ? $res->fetch_assoc() : null;
      $stmt->close();
      if (is_array($existing)) return ['job' => $existing, 'created' => false];
    }
  }
  if (!$inserted) throw new RuntimeException('Unable to enqueue ESI sync: ' . $db->error, 500);

  $job = sync_queue_get_job($db, $jobId);
  if (!$job) throw new RuntimeException('Queued ESI sync could not be reloaded', 500);
  return ['job' => $job, 'created' => true];
}

/** @return array<string,mixed>|null */
function sync_queue_claim_job(mysqli $db, int $jobId): ?array {
  $stmt = @$db->prepare("UPDATE esi_sync_jobs SET status='running', started_at=NOW(), attempts=attempts+1 WHERE id=? AND status='queued'");
  if (!$stmt) throw new RuntimeException('Queue claim prepare failed: ' . $db->error, 500);
  $stmt->bind_param('i', $jobId);
  @$stmt->execute();
  $claimed = $stmt->affected_rows === 1;
  $stmt->close();
  return $claimed ? sync_queue_get_job($db, $jobId) : null;
}

/** @return array<string,mixed>|null */
function sync_queue_claim_next(mysqli $db): ?array {
  sync_queue_ensure_schema($db);
  $res = @$db->query("SELECT id FROM esi_sync_jobs WHERE status='queued' AND available_at<=NOW() ORDER BY priority DESC, id ASC LIMIT 1");
  $candidate = $res ? $res->fetch_assoc() : null;
  if ($res) $res->close();
  if (!is_array($candidate)) return null;
  return sync_queue_claim_job($db, (int)$candidate['id']);
}

/** @return array<string,mixed> */
function sync_queue_execute_job(mysqli $db, array $job): array {
  $jobId = (int)$job['id'];
  $result = sync_core_run_segment($db, (int)$job['corporation_id'], (string)$job['segment'], (int)($job['requested_by_character_id'] ?? 0));
  $success = !empty($result['ok']);
  $json = json_encode($result, JSON_UNESCAPED_SLASHES);
  $error = $success ? null : (string)($result['error'] ?? 'Unknown sync error');
  $status = $success ? SYNC_QUEUE_STATUS_SUCCEEDED : SYNC_QUEUE_STATUS_FAILED;
  $stmt = @$db->prepare('UPDATE esi_sync_jobs SET status=?, active_key=NULL, finished_at=NOW(), error_message=?, result_json=? WHERE id=?');
  if (!$stmt) throw new RuntimeException('Queue completion prepare failed: ' . $db->error, 500);
  $stmt->bind_param('sssi', $status, $error, $json, $jobId);
  if (!@$stmt->execute()) throw new RuntimeException('Queue completion failed: ' . $stmt->error, 500);
  $stmt->close();
  return sync_queue_get_job($db, $jobId) ?? $job;
}

/** @return array<string,mixed>|null */
function sync_queue_process_one(mysqli $db): ?array {
  if (!sync_queue_acquire_worker_lock($db)) return null;
  try {
    $job = sync_queue_claim_next($db);
    return $job ? sync_queue_execute_job($db, $job) : null;
  } finally {
    sync_queue_release_worker_lock($db);
  }
}

/**
 * Drain one specific queued job when the caller is authorized to request it.
 * A held worker lease means another worker owns execution; leave the job queued
 * for that worker rather than creating a parallel ESI request.
 *
 * @return array<string,mixed>|null
 */
function sync_queue_process_job(mysqli $db, int $jobId): ?array {
  if (!sync_queue_acquire_worker_lock($db)) return null;
  try {
    $job = sync_queue_claim_job($db, $jobId);
    return $job ? sync_queue_execute_job($db, $job) : null;
  } finally {
    sync_queue_release_worker_lock($db);
  }
}
