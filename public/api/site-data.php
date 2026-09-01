<?php
// Simple site-level data store for non-user, non-secret data (machine local)
// GET  /api/site-data.php?key=foo            -> { ok, key, value }
// POST { key: "foo", value: any }           -> { ok }

require_once __DIR__ . '/_lib/common.php';
api_require_auth();

// Resolve a writable storage directory (server/storage → LMEVE_STORAGE_DIR → system temp).
$storeDir = api_storage_dir();
if ($storeDir === null) {
  api_fail(500, 'Failed to resolve writable site-data storage directory', [
    'candidates' => array_values(array_filter([
      __DIR__ . '/../../server/storage',
      getenv('LMEVE_STORAGE_DIR') ?: null,
      rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'lmeve2-storage',
    ]))
  ]);
}

$storeFile = $storeDir . DIRECTORY_SEPARATOR . 'site-data.json';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'POST') {
  api_require_admin();
}

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
