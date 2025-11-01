<?php
// Server-side proxy for EVE SSO token operations to avoid browser CORS issues
// Supports authorization_code and refresh_token grants

header('Cache-Control: no-store, max-age=0');
header('Pragma: no-cache');
header('Content-Type: application/json');

function bad_request($msg, $code = 400) {
  http_response_code($code);
  echo json_encode([ 'ok' => false, 'error' => $msg ]);
  exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
  $input = $_POST; // allow form posts too
}

$grant_type = isset($input['grant_type']) ? $input['grant_type'] : null;
if (!$grant_type) {
  bad_request('grant_type is required');
}

$client_id = isset($input['client_id']) ? $input['client_id'] : null;
$client_secret = isset($input['client_secret']) ? $input['client_secret'] : null;

$token_url = 'https://login.eveonline.com/v2/oauth/token';

$params = [ 'grant_type' => $grant_type ];
if ($client_id) $params['client_id'] = $client_id;
// For confidential clients, Basic auth is preferred; but EVE SSO also accepts client_secret in body
if ($client_secret) $params['client_secret'] = $client_secret;

if ($grant_type === 'authorization_code') {
  $code = isset($input['code']) ? $input['code'] : null;
  $code_verifier = isset($input['code_verifier']) ? $input['code_verifier'] : null;
  $redirect_uri = isset($input['redirect_uri']) ? $input['redirect_uri'] : null;
  if (!$code || !$redirect_uri) {
    bad_request('code and redirect_uri are required for authorization_code');
  }
  $params['code'] = $code;
  $params['redirect_uri'] = $redirect_uri;
  if ($code_verifier) $params['code_verifier'] = $code_verifier;
} elseif ($grant_type === 'refresh_token') {
  $refresh_token = isset($input['refresh_token']) ? $input['refresh_token'] : null;
  if (!$refresh_token) {
    bad_request('refresh_token is required for refresh_token grant');
  }
  $params['refresh_token'] = $refresh_token;
} else {
  bad_request('unsupported grant_type');
}

$ch = curl_init($token_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Content-Type: application/x-www-form-urlencoded',
  'User-Agent: LMeve/1.0 (+https://github.com/dstevens79/lmeve)'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));

$resp = curl_exec($ch);
$err = curl_error($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($resp === false) {
  http_response_code(502);
  echo json_encode([ 'ok' => false, 'error' => 'upstream_error', 'message' => $err ]);
  exit;
}

http_response_code($status);
// pass-through upstream body; add ok=true for 2xx
$payload = json_decode($resp, true);
if (!is_array($payload)) {
  echo $resp;
  exit;
}
$payload['ok'] = $status >= 200 && $status < 300;
echo json_encode($payload);
exit;
