<?php
// Simple site-level data store for non-user, non-secret data (machine local)
// GET  /api/site-data.php?key=foo            -> { ok, key, value }
// POST { key: "foo", value: any }           -> { ok }

require_once __DIR__ . '/_lib/common.php';

$storeDir = __DIR__ . '/../../server/storage';
$storeFile = $storeDir . '/site-data.json';

if (!is_dir($storeDir)) {
  @mkdir($storeDir, 0775, true);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function load_site_data(string $file): array {
  if (!file_exists($file)) return [];
  $raw = @file_get_contents($file);
  if ($raw === false) return [];
  $json = json_decode($raw, true);
  return is_array($json) ? $json : [];
}

function save_site_data(string $file, array $data): bool {
  return @file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT)) !== false;
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
    api_fail(500, 'Failed to write site data');
  }
  api_respond(['ok' => true]);
}

http_response_code(405);
echo 'Method Not Allowed';
