<?php
// Simple site-level data store for non-user, non-secret data (machine local)
// GET  /api/site-data.php?key=foo            -> { ok, key, value }
// POST { key: "foo", value: any }           -> { ok }

require_once __DIR__ . '/_lib/common.php';

// Resolve a writable storage directory with fallbacks (env and system temp)
$preferredDir = __DIR__ . '/../../server/storage';
$attemptLog = [];
$storeDir = null;

$candidates = [];
$candidates[] = $preferredDir;
$envDir = getenv('LMEVE_STORAGE_DIR');
if ($envDir && $envDir !== '') $candidates[] = $envDir;
$candidates[] = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'lmeve2-storage';

foreach ($candidates as $dir) {
  $attempt = [ 'dir' => $dir, 'created' => false, 'exists' => false, 'writable' => false, 'error' => null ];
  if (!is_dir($dir)) {
    @mkdir($dir, 0775, true);
    $attempt['created'] = true;
    clearstatcache();
  }
  $attempt['exists'] = is_dir($dir);
  if ($attempt['exists']) {
    $attempt['writable'] = @is_writable($dir);
  } else {
    $lastErr = error_get_last();
    $attempt['error'] = $lastErr ? ($lastErr['message'] ?? 'unknown') : 'unknown';
  }
  $attemptLog[] = $attempt;
  if ($attempt['exists'] && $attempt['writable']) {
    $storeDir = $dir;
    break;
  }
}

if ($storeDir === null) {
  api_fail(500, 'Failed to resolve writable site-data storage directory', [ 'attempts' => $attemptLog ]);
}

$storeFile = rtrim($storeDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'site-data.json';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function load_site_data(string $file): array {
  if (!file_exists($file)) return [];
  $raw = @file_get_contents($file);
  if ($raw === false) return [];
  $json = json_decode($raw, true);
  return is_array($json) ? $json : [];
}

function save_site_data(string $file, array $data): bool {
  $json = json_encode($data, JSON_PRETTY_PRINT);
  if ($json === false) return false;
  return @file_put_contents($file, $json) !== false;
}

if ($method === 'GET') {
  $key = isset($_GET['key']) ? (string)$_GET['key'] : '';
  if ($key === '') api_fail(400, 'Missing key');
  $all = load_site_data($storeFile);
  $value = $all[$key] ?? null;
  api_respond(['ok' => true, 'key' => $key, 'value' => $value]);
}

if ($method === 'POST') {
  $payload = api_read_json();
  api_expect($payload, ['key']);
  $key = (string)$payload['key'];
  $value = $payload['value'] ?? null;
  $all = load_site_data($storeFile);
  $all[$key] = $value;
  if (!save_site_data($storeFile, $all)) {
    $lastErr = error_get_last();
    api_fail(500, 'Failed to write site data', [
      'storeDir' => $storeDir,
      'storeFile' => $storeFile,
      'dirExists' => is_dir($storeDir),
      'dirIsWritable' => is_writable($storeDir),
      'fileExists' => file_exists($storeFile),
      'fileIsWritable' => file_exists($storeFile) ? is_writable($storeFile) : null,
      'lastPhpError' => $lastErr ? ($lastErr['message'] ?? 'unknown') : null
    ]);
  }
  api_respond(['ok' => true]);
}

http_response_code(405);
echo 'Method Not Allowed';
