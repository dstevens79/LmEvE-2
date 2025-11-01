<?php
// Server-side proxy for EVE SSO /oauth/verify to avoid browser CORS

header('Cache-Control: no-store, max-age=0');
header('Pragma: no-cache');
header('Content-Type: application/json');

$auth = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
if (!$auth) {
  // Also accept token in POST body
  $input = json_decode(file_get_contents('php://input'), true);
  if (!$input || empty($input['access_token'])) {
    http_response_code(400);
    echo json_encode([ 'ok' => false, 'error' => 'missing_authorization' ]);
    exit;
  }
  $auth = 'Bearer ' . $input['access_token'];
}

$ch = curl_init('https://login.eveonline.com/oauth/verify');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Authorization: ' . $auth,
  'User-Agent: LMeve/1.0 (+https://github.com/dstevens79/lmeve)'
]);

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
$payload = json_decode($resp, true);
if (!is_array($payload)) {
  echo $resp;
  exit;
}
$payload['ok'] = $status >= 200 && $status < 300;
echo json_encode($payload);
exit;
