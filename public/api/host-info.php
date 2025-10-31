<?php
// Returns server and client IP information to help with configuration
require_once __DIR__ . '/_lib/common.php';

// Best-effort local addresses
$localAddrs = [];
if (!empty($_SERVER['SERVER_ADDR'])) {
  $localAddrs[] = $_SERVER['SERVER_ADDR'];
}
$hostname = gethostname();
if ($hostname) {
  $resolved = gethostbyname($hostname);
  if ($resolved && $resolved !== $hostname && !in_array($resolved, $localAddrs, true)) {
    $localAddrs[] = $resolved;
  }
}

// Attempt to detect public IP via ipify (fast timeout, optional)
$publicIp = null;
try {
  $ctx = stream_context_create([
    'http' => [
      'timeout' => 1.5,
      'ignore_errors' => true,
      'header' => "User-Agent: LMeve-2/host-info\r\n",
    ]
  ]);
  $resp = @file_get_contents('https://api.ipify.org?format=json', false, $ctx);
  if ($resp) {
    $json = json_decode($resp, true);
    if (isset($json['ip'])) { $publicIp = $json['ip']; }
  }
} catch (\Throwable $e) {
  // ignore
}

// Client IPs
$clientIp = $_SERVER['REMOTE_ADDR'] ?? null;
$forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null;

api_respond([
  'ok' => true,
  'server' => [
    'hostname' => $hostname,
    'localAddrs' => array_values(array_unique(array_filter($localAddrs))),
    'publicIp' => $publicIp,
  ],
  'client' => [
    'ip' => $clientIp,
    'forwardedFor' => $forwarded,
  ]
]);
