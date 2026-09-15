<?php
// Delete a registered corporation (admin only).
// Removes the corpus from the `corporations` table. Does NOT delete user
// rows — users retain their character_id but lose the corp link visually.
require_once __DIR__ . '/../_lib/common.php';
require_once __DIR__ . '/../_lib/session.php';

api_require_admin();

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

$payload = api_read_json();
api_expect($payload, ['corporationId']);

$corpId = (int)$payload['corporationId'];
if ($corpId <= 0) {
  api_fail(400, 'Invalid corporationId');
}

$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));

// Soft-check: does the corp exist?
$check = @$mysqli->prepare('SELECT corporation_id FROM corporations WHERE corporation_id=? LIMIT 1');
if (!$check) {
  $mysqli->close();
  api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
}
$check->bind_param('i', $corpId);
$check->execute();
$checkRes = $check->get_result();
if (!($checkRes && $row = $checkRes->fetch_assoc())) {
  $check->close();
  $mysqli->close();
  api_fail(404, 'Corporation not found in registry');
}
$check->close();

// Delete the corporation
$stmt = @$mysqli->prepare('DELETE FROM corporations WHERE corporation_id=?');
if (!$stmt) {
  $mysqli->close();
  api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);
}
$stmt->bind_param('i', $corpId);
if (!$stmt->execute()) {
  $stmt->close();
  $mysqli->close();
  api_fail(500, 'DB delete failed', ['error' => $stmt->error]);
}
$deleted = $stmt->affected_rows;
$stmt->close();
$mysqli->close();

api_respond([
  'ok' => true,
  'deleted' => $deleted,
  'corporationId' => $corpId,
]);
