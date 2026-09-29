<?php
// Returns server and client IP information to help with configuration
require_once __DIR__ . '/_lib/common.php';
api_require_auth();

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

$publicIp = api_public_ipv4();

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
