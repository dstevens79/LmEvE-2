<?php
// Minimal EVE SSO callback relay
// Receives code/state from CCP and immediately redirects to the SPA root
// preserving parameters, so the frontend can complete the flow reliably.

// Allow error pass-through as well
$code = isset($_GET['code']) ? $_GET['code'] : null;
$state = isset($_GET['state']) ? $_GET['state'] : null;
$error = isset($_GET['error']) ? $_GET['error'] : null;
$error_description = isset($_GET['error_description']) ? $_GET['error_description'] : null;

// Build destination
$dest = '/';
$params = [];
if ($error) {
  $params['error'] = $error;
  if ($error_description) {
    $params['error_description'] = $error_description;
  }
} elseif ($code && $state) {
  $params['code'] = $code;
  $params['state'] = $state;
} else {
  $params['sso_error'] = 'missing_params';
}

$qs = http_build_query($params);

// Best-effort logging to help diagnose callback handoff issues
try {
  $logDir = __DIR__ . '/../../server/storage/logs';
  if (is_dir($logDir) && is_writable($logDir)) {
    $line = sprintf("%s\tcode=%s\tstate=%s\terror=%s\n", date('c'), $code ? 'yes' : 'no', $state ? 'yes' : 'no', $error ?: '');
    file_put_contents($logDir . '/esi-callback.log', $line, FILE_APPEND);
  }
} catch (Throwable $e) {
  // ignore logging failures
}

// No caching of auth responses
header('Cache-Control: no-store, max-age=0');
header('Pragma: no-cache');

// Redirect to SPA with params so it can finish the flow
header('Location: ' . $dest . ($qs ? ('?' . $qs) : ''));
exit;
