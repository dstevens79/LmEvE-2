<?php
// Simple data endpoint for tab data. In production, replace file reads with DB queries.
// Reads from server/storage/data/*.json as placeholder seed until pollers populate the database.

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

// Basic CORS for same-origin usage; adjust if needed
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

$resource = isset($_GET['resource']) ? strtolower(trim($_GET['resource'])) : '';
$allowed = [
  'industry_jobs' => 'industry_jobs.json',
  'blueprints' => 'blueprints.json',
  'assets' => 'assets.json',
  'market_prices' => 'market_prices.json'
];

if (!isset($allowed[$resource])) {
  http_response_code(400);
  echo json_encode([ 'error' => 'invalid_resource', 'message' => 'Unknown resource' ]);
  exit;
}

$root = dirname(__DIR__, 2); // project root
$file = $root . DIRECTORY_SEPARATOR . 'server' . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . $allowed[$resource];

if (!file_exists($file)) {
  // Return empty array for known resources without data yet
  echo '[]';
  exit;
}

$contents = file_get_contents($file);
if ($contents === false) {
  http_response_code(500);
  echo json_encode([ 'error' => 'read_error', 'message' => 'Failed to read data file' ]);
  exit;
}

echo $contents;
