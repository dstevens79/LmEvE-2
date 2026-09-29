<?php
// Server-backed settings storage for persistence across origins
// GET  -> returns stored settings JSON (200 with {} if none)
// POST -> saves posted JSON as settings

require_once __DIR__ . '/_lib/common.php';
api_require_admin();

// Resolve a writable storage directory (server/storage → LMEVE_STORAGE_DIR → system temp).
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

// Helper: merge incoming into existing with secret preservation.
// Never store the mask "***" as a real secret, and never wipe a saved secret
// when the client reloads and posts the mask or an empty field.
function merge_settings(array $existing, array $incoming): array {
  $merged = $existing;
  $secretKeys = ['password', 'clientSecret', 'sudoPassword', 'smtpPassword'];
  foreach ($incoming as $key => $value) {
    if (is_array($value)) {
      $existingChild = isset($existing[$key]) && is_array($existing[$key]) ? $existing[$key] : [];
      foreach ($secretKeys as $secretKey) {
        if (!array_key_exists($secretKey, $value)) {
          continue;
        }
        $v = $value[$secretKey];
        $existingSecret = $existingChild[$secretKey] ?? '';
        $existingReal = is_string($existingSecret) && $existingSecret !== '' && $existingSecret !== '***';
        if ($v === '***' || $v === '' || $v === null || !is_string($v)) {
          if ($existingReal) {
            $value[$secretKey] = $existingSecret;
          } else {
            unset($value[$secretKey]);
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
    api_respond(['ok' => true, 'settings' => [
      'esi' => ['callbackUrl' => api_get_esi_callback_url([]), 'clientSecretSet' => false],
    ]]);
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
  $maskKeys = ['password', 'clientSecret', 'sudoPassword', 'smtpPassword'];
  $maskSecrets = function ($value) use (&$maskSecrets, $maskKeys) {
    if (is_array($value)) {
      $masked = [];
      foreach ($value as $k => $v) {
        if (in_array($k, $maskKeys, true)) {
          if (is_string($v) && $v !== '' && $v !== '***') {
            $masked[$k] = '***';
          } else {
            $masked[$k] = '';
          }
        } else {
          $masked[$k] = $maskSecrets($v);
        }
      }
      return $masked;
    }
    return $value;
  };
  $root = api_resolve_settings_root($json);
  $maskedRoot = $maskSecrets($root);
  if (isset($root['database']) && is_array($root['database'])) {
    if (!isset($maskedRoot['database']) || !is_array($maskedRoot['database'])) {
      $maskedRoot['database'] = [];
    }
    $rawPass = isset($root['database']['password']) ? (string)$root['database']['password'] : '';
    $rawSudo = isset($root['database']['sudoPassword']) ? (string)$root['database']['sudoPassword'] : '';
    $rawUser = trim((string)($root['database']['username'] ?? ''));
    $rawHost = trim((string)($root['database']['host'] ?? ''));
    $hasSecret = ($rawPass !== '' && $rawPass !== '***');
    $hasSudo = ($rawSudo !== '' && $rawSudo !== '***');
    $maskedRoot['database']['configured'] = ($rawHost !== '' && $rawUser !== '' && $hasSecret);
    $maskedRoot['database']['passwordSet'] = $hasSecret;
    $maskedRoot['database']['sudoPasswordSet'] = $hasSudo;
    $maskedRoot['database']['password'] = $hasSecret ? '***' : '';
    $maskedRoot['database']['sudoPassword'] = $hasSudo ? '***' : '';
  }
  if (!isset($maskedRoot['esi']) || !is_array($maskedRoot['esi'])) {
    $maskedRoot['esi'] = [];
  }
  if (isset($root['esi']) && is_array($root['esi'])) {
    $rawSecret = isset($root['esi']['clientSecret']) ? (string)$root['esi']['clientSecret'] : '';
    $secretSet = ($rawSecret !== '' && $rawSecret !== '***');
    $maskedRoot['esi']['clientSecretSet'] = $secretSet;
    $maskedRoot['esi']['clientSecret'] = $secretSet ? '***' : '';
  }
  // Callback is derived even before ESI credentials have been saved.
  $maskedRoot['esi']['callbackUrl'] = api_get_esi_callback_url([]);
  api_respond(['ok' => true, 'settings' => $maskedRoot]);
}

if ($method === 'POST') {
  $payload = api_read_json();

  $existing = [];
  if (file_exists($storeFile)) {
    $raw = @file_get_contents($storeFile);
    if ($raw !== false) {
      $cur = json_decode($raw, true);
      if (is_array($cur)) $existing = $cur;
    }
  }

  $existingRoot = api_resolve_settings_root($existing);
  $incomingRoot = api_resolve_settings_root($payload);
  if (isset($incomingRoot['esi']) && is_array($incomingRoot['esi'])) {
    unset($incomingRoot['esi']['callbackUrl'], $incomingRoot['esi']['clientSecretSet']);
  }
  if (isset($incomingRoot['database']) && is_array($incomingRoot['database'])) {
    unset($incomingRoot['database']['configured'], $incomingRoot['database']['passwordSet'], $incomingRoot['database']['sudoPasswordSet']);
  }
  $mergedRoot = merge_settings($existingRoot, $incomingRoot);
  if (isset($mergedRoot['esi']) && is_array($mergedRoot['esi'])) {
    unset($mergedRoot['esi']['callbackUrl'], $mergedRoot['esi']['clientSecretSet']);
  }

  if (isset($existing['settings']) && is_array($existing['settings'])) {
    $toStore = $existing;
    $toStore['settings'] = $mergedRoot;
  } else {
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

http_response_code(405);
echo 'Method Not Allowed';
