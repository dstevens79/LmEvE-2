<?php
// Lightweight ESI config test — validates client ID + secret against EVE SSO
// without a browser redirect. Uses the secret already saved on the server when
// the form sends a mask or leaves the field blank.
//
// POST { "clientId": "...", "clientSecret": "..." }
require_once __DIR__ . '/../../_lib/common.php';
require_once __DIR__ . '/../../_lib/session.php';

$user = api_require_auth();
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
$esiCfg = api_get_esi_config([]);
$clientId = trim((string)($body['clientId'] ?? ($body['esiSettings']['clientId'] ?? '')));
$clientSecret = trim((string)($body['clientSecret'] ?? ($body['esiSettings']['clientSecret'] ?? '')));

if ($clientId === '' || $clientId === '***') {
  $clientId = trim((string)($esiCfg['clientId'] ?? ''));
}
if ($clientSecret === '' || $clientSecret === '***') {
  $clientSecret = trim((string)($esiCfg['clientSecret'] ?? ''));
}

if ($clientId === '') {
  api_fail(400, 'ESI Client ID is required');
}

$callbackUrl = api_get_esi_callback_url([]);
if ($callbackUrl === '') {
  api_fail(503, 'The server could not determine its public ESI callback URL');
}

$results = [
  'ok' => false,
  'clientId' => $clientId,
  'hasSecret' => $clientSecret !== '',
  'callbackUrl' => $callbackUrl,
];

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

$clientIdValid = preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $clientId);
$results['clientIdFormat'] = $clientIdValid ? 'valid_uuid' : 'invalid';

if ($clientSecret !== '' && isset($wellKnown['token_endpoint'])) {
  $tokenUrl = $wellKnown['token_endpoint'];
  $basic = base64_encode($clientId . ':' . $clientSecret);
  $postData = http_build_query([
    'grant_type' => 'authorization_code',
    'code' => 'invalid_test_code',
    'redirect_uri' => $callbackUrl,
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
    $results['tokenTestError'] = is_array($tokenResp) ? ($tokenResp['error'] ?? null) : null;
    $authOk = $status === 400 && in_array($results['tokenTestError'] ?? '', [
      'invalid_grant', 'invalid_request', 'unsupported_grant_type'
    ], true);
    $results['credentialsValid'] = $authOk;
  } else {
    $results['tokenTestError'] = $err;
    $results['credentialsValid'] = false;
  }
} elseif ($clientSecret === '') {
  $results['credentialsValid'] = false;
  $results['tokenTestError'] = 'client_secret_missing';
}

$results['ok'] = $results['wellKnownOk']
  && $clientIdValid
  && (!isset($results['credentialsValid']) || $results['credentialsValid'] === true);

if ($results['ok']) {
  $results['message'] = 'ESI credentials validated — callback is ' . $callbackUrl;
} else {
  $errors = [];
  if (!$results['wellKnownOk']) $errors[] = 'Could not reach EVE SSO';
  if (!$clientIdValid) $errors[] = 'Client ID is not a valid UUID';
  if (isset($results['credentialsValid']) && $results['credentialsValid'] === false) {
    $errors[] = 'Client ID/Secret rejected by EVE SSO (' . ($results['tokenTestError'] ?? 'unknown') . ')';
  }
  $results['message'] = implode('; ', $errors);
}

api_respond($results, $results['ok'] ? 200 : 400);
