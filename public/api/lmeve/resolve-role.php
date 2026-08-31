<?php
// Resolve the site role for a logging-in character from its EVE roles + corp titles.
//   POST { corporationId, eveRoles: [..], titles: [..] } -> { ok, corporationId, roleKey, reason, matched }
// The SSO client calls this after token exchange so that per-corp/site mapping rules decide the
// effective site role instead of a hardcoded table. super_admin is never returned here (it comes
// from the CEO check / local admin bootstrap); if a rule targets it we fall back to corp_member.

require_once __DIR__ . '/../../_lib/common.php';
require_once __DIR__ . '/../../_lib/role-config-lib.php';

$user = api_require_auth();
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'POST') { http_response_code(405); echo 'Method Not Allowed'; exit; }

$mysqli = api_connect([]);
$dbCfg = api_get_db_config([]);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));

role_config_ensure_schema($mysqli);

$payload = api_read_json();
api_expect($payload, ['corporationId']);

$corpId = (int)$payload['corporationId'];
if ($corpId <= 0) api_fail(400, 'corporationId must be a positive integer');
// The session character may belong to this corp OR be an admin inspecting another.
api_require_corporation_access($user, $corpId);

$eveRoles = isset($payload['eveRoles']) && is_array($payload['eveRoles']) ? array_map('strval', $payload['eveRoles']) : [];
$titles = isset($payload['titles']) && is_array($payload['titles']) ? array_map('strval', $payload['titles']) : [];

$result = role_config_resolve($mysqli, $corpId, $eveRoles, $titles);

$mysqli->close();
api_respond([
  'ok' => true,
  'corporationId' => $corpId,
  'roleKey' => (string)$result['roleKey'],
  'reason' => (string)$result['reason'],
  'matched' => array_values($result['matched']),
]);
