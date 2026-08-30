<?php
require_once __DIR__ . '/../_lib/common.php';
$user = api_require_auth();
$payload = api_read_json();
$corp = isset($payload['corporationId']) ? (int)$payload['corporationId'] : 0;
api_require_corporation_access($user, $corp);
$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));

// ESI has no corp job-history endpoint: income is derived at read time from
// completed runs captured in industry_jobs while jobs were still listed.
$limit = api_limit($payload, 500, 2000);
$sql = "SELECT * FROM industry_jobs WHERE corporation_id = $corp AND completed_runs IS NOT NULL AND completed_runs > 0 ORDER BY COALESCE(completed_date, end_date) DESC LIMIT $limit";
$res = @$mysqli->query($sql);
if ($res === false) { api_fail(200, 'Query failed', ['error' => $mysqli->error]); }
$jobs = [];
while ($row = $res->fetch_assoc()) { $jobs[] = $row; }
$res->close();

// Market prices for the product types in play (adjusted, then average).
$typeIds = array_unique(array_map(static fn($j) => (int)$j['product_type_id'], $jobs));
$prices = [];
if (count($typeIds) > 0) {
  $inList = implode(',', $typeIds); // ints only, safe to inline
  $pres = @$mysqli->query("SELECT type_id, adjusted_price, average_price FROM market_prices WHERE type_id IN ($inList)");
  if ($pres !== false) {
    while ($row = $pres->fetch_assoc()) { $prices[(int)$row['type_id']] = $row; }
    $pres->close();
  }
}

// Pilot names from the name cache (get-names.php keeps it warm).
$pilotIds = array_unique(array_filter(array_map(static fn($j) => (int)$j['installer_id'], $jobs)));
$pilotNames = [];
if (count($pilotIds) > 0) {
  $inList = implode(',', $pilotIds); // ints only, safe to inline
  $nres = @$mysqli->query("SELECT entity_id, entity_name FROM name_cache WHERE entity_kind = 'character' AND entity_id IN ($inList)");
  if ($nres !== false) {
    while ($row = $nres->fetch_assoc()) { $pilotNames[(int)$row['entity_id']] = (string)$row['entity_name']; }
    $nres->close();
  }
}

// EVE industry activity ids: 2=Invention, 3=Manufacturing, 5=Research.
$activityMap = [2 => 'invention', 3 => 'manufacturing', 5 => 'research'];
$records = [];
foreach ($jobs as $j) {
  $productTypeId = (int)$j['product_type_id'];
  $completedRuns = (int)$j['completed_runs'];
  $priceRow = isset($prices[$productTypeId]) ? $prices[$productTypeId] : null;
  $unitPrice = 0.0;
  if ($priceRow) {
    foreach (['adjusted_price', 'average_price'] as $pk) {
      if (isset($priceRow[$pk]) && is_numeric($priceRow[$pk])) { $unitPrice = (float)$priceRow[$pk]; break; }
    }
  }
  $marketValue = round($unitPrice * $completedRuns, 2);
  $costPerRun = isset($j['cost']) && $j['cost'] !== null ? (float)$j['cost'] : null;
  $totalCost = $costPerRun !== null ? round($costPerRun * $completedRuns, 2) : null;
  $profit = ($marketValue > 0.0 && $totalCost !== null) ? round($marketValue - $totalCost, 2) : null;
  $pilotId = (int)$j['installer_id'];
  $activity = isset($activityMap[(int)$j['activity_id']]) ? $activityMap[(int)$j['activity_id']] : 'other';
  $records[] = [
    'id' => 'job-' . (string)(int)$j['job_id'],
    'date' => isset($j['completed_date']) && $j['completed_date'] !== null ? (string)$j['completed_date'] : (isset($j['end_date']) ? (string)$j['end_date'] : null),
    'pilotId' => $pilotId,
    'pilotName' => isset($pilotNames[$pilotId]) ? $pilotNames[$pilotId] : ('Character #' . $pilotId),
    'activityType' => $activity === 'other' ? 'manufacturing' : $activity,
    'jobType' => $activity,
    'jobId' => (int)$j['job_id'],
    'itemTypeId' => $productTypeId,
    'itemTypeName' => '', // resolved client-side via SDE type names
    'quantity' => $completedRuns,
    'runs' => $completedRuns,
    'hoursWorked' => 0,
    'ratePerHour' => 0,
    'totalEarned' => $marketValue,
    'status' => 'pending',
    'completedDate' => isset($j['completed_date']) && $j['completed_date'] !== null ? (string)$j['completed_date'] : (isset($j['end_date']) ? (string)$j['end_date'] : null),
    'productTypeId' => $productTypeId,
    'productTypeName' => '', // resolved client-side via SDE type names
    'productQuantity' => $completedRuns,
    'profit' => $profit,
    'totalCost' => $totalCost,
    'materialCost' => $costPerRun !== null ? round($costPerRun, 2) : null,
    'marketValue' => $unitPrice > 0.0 ? $marketValue : null,
    'profitMargin' => ($profit !== null && $marketValue > 0.0) ? round((float)$profit / (float)$marketValue, 4) : null,
  ];
}
$mysqli->close();
api_respond(['ok' => true, 'rows' => $records, 'rowCount' => count($records)]);
