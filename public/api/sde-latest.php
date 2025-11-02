<?php
// public/api/sde-latest.php
// Server-side helper to fetch the latest Fuzzwork SDE release date in a throttled, cache-friendly way.
// Returns: { ok: true, latestVersion: 'YYYY-MM-DD', lastChecked: iso, nextAllowed: iso, source: 'cache'|'remote' }

declare(strict_types=1);
require_once __DIR__ . '/_lib/common.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'GET') {
    http_response_code(405);
    echo 'Method Not Allowed';
    exit;
}

$storeDir = __DIR__ . '/../../server/storage';
$cacheFile = $storeDir . '/sde-cache.json';
$now = time();
$oneDay = 24 * 60 * 60;

if (!is_dir($storeDir)) {
    @mkdir($storeDir, 0775, true);
}

// Load cache if present
$cache = null;
if (file_exists($cacheFile)) {
    $raw = @file_get_contents($cacheFile);
    if ($raw !== false) {
        $j = json_decode($raw, true);
        if (is_array($j)) $cache = $j;
    }
}

$lastChecked = isset($cache['lastChecked']) ? strtotime((string)$cache['lastChecked']) : 0;
$nextAllowedTs = $lastChecked > 0 ? ($lastChecked + $oneDay) : 0;

// If within throttle window and have cached value, return it
if ($cache && $nextAllowedTs > $now && !empty($cache['latestVersion'])) {
    echo json_encode([
        'ok' => true,
        'latestVersion' => $cache['latestVersion'],
        'lastChecked' => $cache['lastChecked'],
        'nextAllowed' => date('c', $nextAllowedTs),
        'source' => 'cache'
    ]);
    exit;
}

// Remote HEAD to get Last-Modified of the latest dump file
$url = 'https://www.fuzzwork.co.uk/dump/mysql-latest.tar.bz2';
$ch = curl_init($url);
if ($ch === false) {
    // Fallback to cache if available
    if ($cache && !empty($cache['latestVersion'])) {
        echo json_encode([
            'ok' => true,
            'latestVersion' => $cache['latestVersion'],
            'lastChecked' => $cache['lastChecked'] ?? null,
            'nextAllowed' => date('c', $nextAllowedTs ?: ($now + $oneDay)),
            'source' => 'cache'
        ]);
        exit;
    }
    api_fail(500, 'Failed to init cURL for SDE check');
}

curl_setopt_array($ch, [
    CURLOPT_NOBODY => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_HEADER => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$err = curl_error($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

curl_close($ch);

if ($response === false || $httpCode < 200 || $httpCode >= 400) {
    // Fallback to cache if present
    if ($cache && !empty($cache['latestVersion'])) {
        echo json_encode([
            'ok' => true,
            'latestVersion' => $cache['latestVersion'],
            'lastChecked' => $cache['lastChecked'] ?? null,
            'nextAllowed' => date('c', $nextAllowedTs ?: ($now + $oneDay)),
            'source' => 'cache',
            'note' => 'remote_unavailable'
        ]);
        exit;
    }
    api_fail(502, 'Failed to fetch SDE latest metadata', [ 'httpCode' => $httpCode, 'error' => $err ]);
}

// Parse headers for Last-Modified
$latestVersion = null;
$lines = preg_split("/(\r\n|\n|\r)/", (string)$response);
foreach ($lines as $line) {
    if (stripos($line, 'Last-Modified:') === 0) {
        $dateStr = trim(substr($line, strlen('Last-Modified:')));
        $ts = strtotime($dateStr);
        if ($ts !== false) {
            // Convert to YYYY-MM-DD as our version marker
            $latestVersion = date('Y-m-d', $ts);
        }
        break;
    }
}

if (!$latestVersion) {
    // As a fallback, set today (best-effort) to avoid hammering
    $latestVersion = date('Y-m-d');
}

$payload = [
    'ok' => true,
    'latestVersion' => $latestVersion,
    'lastChecked' => date('c', $now),
    'nextAllowed' => date('c', $now + $oneDay),
    'source' => 'remote'
];

@file_put_contents($cacheFile, json_encode([
    'latestVersion' => $latestVersion,
    'lastChecked' => $payload['lastChecked']
], JSON_PRETTY_PRINT));

echo json_encode($payload);
