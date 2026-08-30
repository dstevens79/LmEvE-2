<?php
require_once __DIR__ . '/../_lib/common.php';
$user = api_require_auth();
$payload = api_read_json();
$corp = isset($payload['corporationId']) ? (int)$payload['corporationId'] : 0;
api_require_corporation_access($user, $corp);
$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));

// Contracts + their items in one round trip. Items are scoped to this corp's
// contracts so the page never sees another corporation's rows.
$sql = "SELECT c.* FROM contracts c WHERE c.corporation_id = $corp ORDER BY c.date_issued DESC LIMIT 500";
$res = @$mysqli->query($sql);
if ($res === false) { api_fail(200, 'Query failed', ['error' => $mysqli->error]); }
$rows = [];
while ($row = $res->fetch_assoc()) { $rows[] = $row; }
$ids = array_map(static fn($r) => (int)$r['contract_id'], $rows);

$items = [];
if (count($ids) > 0) {
  $inList = implode(',', $ids); // ints only, safe to inline
  $ires = @$mysqli->query("SELECT * FROM contract_items WHERE contract_id IN ($inList) ORDER BY record_id");
  if ($ires !== false) {
    while ($row = $ires->fetch_assoc()) { $items[] = $row; }
    $ires->close();
  }
}
$res->close();
$mysqli->close();
api_respond(['ok' => true, 'rows' => $rows, 'items' => $items, 'rowCount' => count($rows)]);
