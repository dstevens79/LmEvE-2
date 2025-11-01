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

// Helper: resolve root 'settings' object from various shapes
function resolve_settings_root(array $json): array {
  if (isset($json['settings']) && is_array($json['settings'])) {
    return $json['settings'];
  }
  return $json;
}

// Helper: merge incoming into existing with secret preservation
function merge_settings(array $existing, array $incoming): array {
  $merged = $existing;
  foreach ($incoming as $key => $value) {
    if (is_array($value)) {
      $existingChild = isset($existing[$key]) && is_array($existing[$key]) ? $existing[$key] : [];
      // Secret fields preservation
      foreach (['password','clientSecret','sudoPassword','smtpPassword'] as $secretKey) {
        if (isset($value[$secretKey])) {
          $v = $value[$secretKey];
          if ($v === '***' || $v === '' || $v === null) {
            // Keep existing if present
            if (isset($existingChild[$secretKey]) && $existingChild[$secretKey] !== '') {
              $value[$secretKey] = $existingChild[$secretKey];
            }
          }
        }
      }
      $merged[$key] = merge_settings($existingChild, $value);
    } else {
      $merged[$key] = $value;
    }
  }
  return $merged;
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
  // Mask secrets in response
  $maskKeys = ['password','clientSecret','sudoPassword','smtpPassword'];
  $maskSecrets = function ($value) use (&$maskSecrets, $maskKeys) {
    if (is_array($value)) {
      $masked = [];
      foreach ($value as $k => $v) {
        if (in_array($k, $maskKeys, true)) {
          // Only mask if not already masked and non-empty
          if (is_string($v) && $v !== '' && $v !== '***') {
            $masked[$k] = '***';
          } else {
            $masked[$k] = $v;
          }
        } else {
          $masked[$k] = $maskSecrets($v);
        }
      }
      return $masked;
    }
    return $value;
  };
  $maskedJson = $maskSecrets($json);
  api_respond(['ok' => true, 'settings' => $maskedJson]);
}

if ($method === 'POST') {
  $payload = api_read_json();

  // Load existing (any shape)
  $existing = [];
  if (file_exists($storeFile)) {
    $raw = @file_get_contents($storeFile);
    if ($raw !== false) {
      $cur = json_decode($raw, true);
      if (is_array($cur)) $existing = $cur;
    }
  }

  // Determine the shapes
  $existingRoot = resolve_settings_root($existing);
  $incomingRoot = resolve_settings_root($payload);

  // Merge incoming into existing
  $mergedRoot = merge_settings($existingRoot, $incomingRoot);

  // Preserve wrapper if original had one, otherwise store root-only
  if (isset($existing['settings']) && is_array($existing['settings'])) {
    $toStore = $existing;
    $toStore['settings'] = $mergedRoot;
  } else {
    // If incoming contains wrapper, honor it; else store root
    if (isset($payload['settings']) && is_array($payload['settings'])) {
      $toStore = $payload;
      $toStore['settings'] = $mergedRoot;
    } else {
      $toStore = $mergedRoot;
    }
  }

  $ok = @file_put_contents($storeFile, json_encode($toStore, JSON_PRETTY_PRINT));
  if ($ok === false) {
    api_fail(500, 'Failed to write settings file');
  }
  api_respond(['ok' => true]);
}

// Method not allowed
http_response_code(405);
echo 'Method Not Allowed';
