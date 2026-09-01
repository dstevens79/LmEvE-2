<?php
// Server-backed settings storage for persistence across origins
// GET  -> returns stored settings JSON (200 with {} if none)
// POST -> saves posted JSON as settings

require_once __DIR__ . '/_lib/common.php';
api_require_admin();

// Resolve a writable storage directory (server/storage â†’ LMEVE_STORAGE_DIR â†’ system temp).
$storeDir = api_storage_dir();
if ($storeDir === null) {
  api_fail(500, 'Failed to resolve writable settings storage directory', [
    'candidates' => array_values(array_filter([
      __DIR__ . '/../../server/storage',
      getenv('LMEVE_STORAGE_DIR') ?: null,
      rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'lmeve2-storage',
    ]))
  ]);
}

$storeFile = $storeDir . DIRECTORY_SEPARATOR . 'settings.json';

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
    $lastErr = error_get_last();
    api_fail(500, 'Failed to read settings file', [
      'storeFile' => $storeFile,
      'exists' => file_exists($storeFile),
      'isReadable' => is_readable($storeFile),
      'dirIsWritable' => is_writable($storeDir),
      'lastPhpError' => $lastErr ? ($lastErr['message'] ?? 'unknown') : null
    ]);
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
  // Always return a flat category map: { database, esi, general, ... }
    // regardless of whether the file used a nested { settings: {...} } wrapper.
    $root = api_resolve_settings_root($json);
    $maskedRoot = $maskSecrets($root);
    // Flag DB as configured when a real password is stored (client only sees ***).
    if (isset($root['database']) && is_array($root['database'])) {
      if (!isset($maskedRoot['database']) || !is_array($maskedRoot['database'])) {
        $maskedRoot['database'] = [];
      }
      $rawPass = isset($root['database']['password']) ? (string)$root['database']['password'] : '';
      $rawUser = trim((string)($root['database']['username'] ?? ''));
      $rawHost = trim((string)($root['database']['host'] ?? ''));
      $hasSecret = ($rawPass !== '' && $rawPass !== '***');
      $maskedRoot['database']['configured'] = ($rawHost !== '' && $rawUser !== '' && $hasSecret);
      if ($hasSecret) {
        $maskedRoot['database']['password'] = '***';
      }
    }
    api_respond(['ok' => true, 'settings' => $maskedRoot]);
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
  $existingRoot = api_resolve_settings_root($existing);
  $incomingRoot = api_resolve_settings_root($payload);

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

  $payloadToWrite = json_encode($toStore, JSON_PRETTY_PRINT);
  if ($payloadToWrite === false) {
    api_fail(500, 'Failed to encode settings JSON');
  }
  $ok = @file_put_contents($storeFile, $payloadToWrite);
  if ($ok === false) {
    $lastErr = error_get_last();
    api_fail(500, 'Failed to write settings file', [
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

// Method not allowed
http_response_code(405);
echo 'Method Not Allowed';
