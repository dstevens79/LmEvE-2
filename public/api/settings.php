<?php
// Server-backed settings storage for persistence across origins
// GET  -> returns stored settings JSON (200 with {} if none)
// POST -> saves posted JSON as settings

require_once __DIR__ . '/_lib/common.php';

$storeDir = __DIR__ . '/../../server/storage';
$storeFile = $storeDir . '/settings.json';

if (!is_dir($storeDir)) {
  @mkdir($storeDir, 0775, true);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  if (!file_exists($storeFile)) {
    api_respond(['ok' => true, 'settings' => null]);
  }
  $raw = @file_get_contents($storeFile);
  if ($raw === false) {
    api_fail(500, 'Failed to read settings file');
  }
  $json = json_decode($raw, true);
  if (!is_array($json)) {
    api_fail(500, 'Corrupt settings file');
  }
  api_respond(['ok' => true, 'settings' => $json]);
}

if ($method === 'POST') {
  $payload = api_read_json();
  // Persist whatever the client sends (exportAllSettings() shape expected)
  $ok = @file_put_contents($storeFile, json_encode($payload, JSON_PRETTY_PRINT));
  if ($ok === false) {
    api_fail(500, 'Failed to write settings file');
  }
  api_respond(['ok' => true]);
}

// Method not allowed
http_response_code(405);
echo 'Method Not Allowed';
