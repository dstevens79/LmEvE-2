<?php
require_once __DIR__ . '/../_lib/common.php';
api_require_auth();
$payload = api_read_json();
$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));
$limit = api_limit($payload, 200, 2000);
// has_vaulted_token: a users row for this corp holds a refreshable ESI token
// pair (set by Corp ESI consent). Drives the SPA's "ESI auth active" state
// without ever exposing raw tokens.
$sql = "SELECT c.*,
  (SELECT COUNT(*) FROM users u
    WHERE u.corporation_id = c.corporation_id
      AND u.access_token IS NOT NULL AND u.access_token <> ''
      AND u.refresh_token IS NOT NULL AND u.refresh_token <> '') AS has_vaulted_token
  FROM corporations c ORDER BY c.corporation_id LIMIT $limit";
$res = @$mysqli->query($sql);
if ($res === false) {
    api_fail(200, 'Query failed', ['error' => $mysqli->error]);
}
$rows = [];
while ($row = $res->fetch_assoc()) { $rows[] = $row; }
$res->close();
$mysqli->close();
api_respond(['ok' => true, 'rows' => $rows, 'rowCount' => count($rows)]);
