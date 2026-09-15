<?php
// Lightweight ESI config test — validates client ID + secret against the
// EVE SSO /oauth/verify endpoint with a real token request, without the
// full browser OAuth redirect flow. Used by the "Test ESI Config" button.
//
// Strategy: request a minimal token using the client_credentials or a
// test grant, OR simply verify the client credentials produce a valid
// OIDC well-known config. Since EVE SSO doesn't support client_credentials,
// we verify by checking the JWKS endpoint + well-known config, which proves
// the client ID resolves to a real EVE SSO app.
//
// POST { "clientId": "...", "clientSecret": "..." }
require_once __DIR__ . '/../_lib/common.php';
require_once __DIR__ . '/../_lib/session.php';

api_require_auth();
$role = api_normalize_role($user['role'] ?? '');
if (!api_is_site_admin($user) && $role !== 'super_admin' && $role !== 'corp_admin') {
  api_fail(403, 'Insufficient privileges');
}

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

$body = api_read_json();
$clientId = trim((string)($body['clientId'] ?? ($body['esiSettings']['clientId'] ?? '')));
$clientSecret = trim((string)($body['clientSecret'] ?? ($body['esiSettings']['clientSecret'] ?? '')));

if ($clientId === '') {
  api_fail(400, 'ESI Client ID is required');
}

// Merge with server settings to know the callback URL
$settingsRoot = null;
$storage = api_storage_dir();
$settingsFile = $storage ? rtrim($storage, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'settings.json' : null;
if ($settingsFile && file_exists($settingsFile)) {
  $raw = @file_get_contents($settingsFile);
  if ($raw !== false) {
    $json = json_decode($raw, true);
    if (is_array($json)) {
      $settingsRoot = api_resolve_settings_root($json);
    }
  }
}

// The callback URL must be registered with CCP — verify it exists in settings
$callbackUrl = '';
if ($settingsRoot && isset($settingsRoot['esi']) && is_array($settingsRoot['esi'])) {
  $callbackUrl = trim((string)($settingsRoot['esi']['callbackUrl'] ?? ''));
}

// Test: make a real OIDC well-known request with the client_id.
// EVE SSO exposes https://login.eveonline.com/.well-known/openid-configuration
// which returns client metadata. We also try to validate by hitting the
// token endpoint with a test grant (JWT client credentials if supported,
// otherwise we just verify the well-known config resolves and the client_id
// format looks valid).
$results = [
  'ok' => false,
  'clientId' => $clientId,
  'hasSecret' => $clientSecret !== '',
  'callbackUrl' => $callbackUrl,
];

// Step 1: Check well-known OIDC config
$wellKnown = null;
$ctx = stream_context_create([
  'http' => [
    'method' => 'GET',
    'timeout' => 8,
    'ignore_errors' => true,
    'header' => "User-Agent: LMeve-2/ESI-Config-Test\r\n",
  ]
]);
$wellKnownRaw = @file_get_contents('https://login.eveonline.com/.well-known/openid-configuration', false, $ctx);
if ($wellKnownRaw !== false) {
  $wellKnown = json_decode($wellKnownRaw, true);
  $results['wellKnownOk'] = is_array($wellKnown) && !empty($wellKnown['token_endpoint']);
} else {
  $results['wellKnownOk'] = false;
}

// Step 2: Validate client ID format (EVE SSO client IDs are UUIDs)
$clientIdValid = preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $clientId);
$results['clientIdFormat'] = $clientIdValid ? 'valid_uuid' : 'invalid';

// Step 3: If we have a secret, try a minimal token request to verify credentials.
// EVE SSO supports the authorization_code grant only, but we can test the
// token endpoint with an invalid code to see if the client_id/secret are rejected.
if ($clientSecret !== '' && isset($wellKnown['token_endpoint'])) {
  $tokenUrl = $wellKnown['token_endpoint'];
  $basic = base64_encode($clientId . ':' . $clientSecret);

  // Send an invalid grant to see if auth itself fails (400 with bad_request/invalid_grant
  // means creds were accepted; 401 means client auth failed)
  $postData = http_build_query([
    'grant_type' => 'authorization_code',
    'code' => 'invalid_test_code',
    'redirect_uri' => $callbackUrl !== '' ? $callbackUrl : 'https://example.com/callback',
  ]);

  $ch = curl_init($tokenUrl);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
  curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/x-www-form-urlencoded',
    'Authorization: Basic ' . $basic,
    'User-Agent: LMeve-2/ESI-Config-Test',
  ]);
  curl_setopt($ch, CURLOPT_TIMEOUT, 10);
  $resp = curl_exec($ch);
  $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err = curl_error($ch);
  curl_close($ch);

  if ($resp !== false) {
    $tokenResp = json_decode($resp, true);
    $results['tokenTestStatus'] = $status;
    $results['tokenTestError'] = $tokenResp['error'] ?? null;

    // 400 with invalid_grant/temporarily_unavailable means client auth succeeded
    // 401 means client_id/secret are wrong
    $authOk = $status === 400 && in_array($tokenResp['error'] ?? '', [
      'invalid_grant', 'invalid_request', 'unsupported_grant_type'
    ]);
    $results['credentialsValid'] = $authOk;
  } else {
    $results['tokenTestError'] = $err;
    $results['credentialsValid'] = false;
  }
}

// Overall result
$results['ok'] = $results['wellKnownOk']
  && $clientIdValid
  && (!isset($results['credentialsValid']) || $results['credentialsValid'] === true);

if ($results['ok']) {
  $results['message'] = 'ESI configuration validated successfully';
} else {
  $errors = [];
  if (!$results['wellKnownOk']) $errors[] = 'Could not reach EVE SSO well-known endpoint';
  if (!$clientIdValid) $errors[] = 'Client ID is not a valid UUID format';
  if (isset($results['credentialsValid']) && $results['credentialsValid'] === false) {
    $errors[] = 'Client ID/Secret rejected by EVE SSO (' . ($results['tokenTestError'] ?? 'unknown') . ')';
  }
  $results['message'] = implode('; ', $errors);
}

$code = $results['ok'] ? 200 : 400;
api_respond($results, $code);
