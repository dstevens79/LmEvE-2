<?php
// Destroy the browser-bound app session.
require_once __DIR__ . '/../_lib/common.php';
require_once __DIR__ . '/../_lib/session.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if (!in_array(strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'), ['POST', 'GET'], true)) {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

api_session_clear(true);
api_respond(['ok' => true, 'loggedOut' => true]);
