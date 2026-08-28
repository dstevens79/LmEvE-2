<?php
// Batch EVE universe name resolution for page rendering.
//
// The app DB stores numeric IDs (type/character/system/location/station). Pages
// need human-readable names without an SDE install, so this endpoint resolves
// them through public ESI and caches results in a local `name_cache` table
// (in-place migration), keeping repeat loads fast and ESI-friendly.
//
// POST { "ids": [10000002, 30000142], "kind": "universe" | "characters" | "systems" }
// -> { ok: true, names: { "<id>": "Name", ... }, cached: <int>, fetched: <int> }
//
// Auth: session required (same as every other lmeve read endpoint).

require_once __DIR__ . '/../_lib/common.php';

api_require_auth();

$payload = api_read_json();
$idsRaw = isset($payload['ids']) && is_array($payload['ids']) ? $payload['ids'] : [];
$kind = isset($payload['kind']) ? (string)$payload['kind'] : 'universe';

if (!in_array($kind, ['universe', 'characters', 'systems'], true)) {
  api_fail(400, "kind must be one of: universe, characters, systems");
}

$ids = [];
foreach ($idsRaw as $v) {
  $i = (int)$v;
  if ($i > 0 && !in_array($i, $ids, true)) $ids[] = $i;
}
if (count($ids) === 0) {
  api_respond(['ok' => true, 'names' => [], 'cached' => 0, 'fetched' => 0]);
}
if (count($ids) > 1200) {
  $ids = array_slice($ids, 0, 1200);
}

$mysqli = api_connect($payload);
$dbCfg = api_get_db_config($payload);
api_select_db($mysqli, (string)($dbCfg['database'] ?? 'lmeve2'));

// In-place migration: name cache table.
@$mysqli->query(
  "CREATE TABLE IF NOT EXISTS name_cache (
    entity_kind VARCHAR(16) NOT NULL,
    entity_id BIGINT NOT NULL,
    entity_name VARCHAR(512) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entity_kind, entity_id),
    INDEX idx_entity_id (entity_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);

// ---------------------------------------------------------------------------
// ESI fetch (with Link pagination + 420 backoff)
// ---------------------------------------------------------------------------

function names_get_one(string $url): array {
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
  curl_setopt($ch, CURLOPT_TIMEOUT, 30);
  curl_setopt($ch, CURLOPT_HTTPHEADER, ['User-Agent: LMeve-2', 'Accept: application/json']);
  $body = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $err = curl_error($ch);
  $link = curl_getheader($ch, 'Link');
  curl_close($ch);

  $next = null;
  if (is_string($link) && $link !== '' && preg_match('/<([^>]+)>;\s*rel="next"/', $link, $m)) {
    $next = $m[1];
  }
  return [$body === false ? null : $body, $code, $err !== '' ? $err : null, $next];
}

function names_get_all(string $url): array {
  $items = [];
  $current = $url;
  $pages = 0;
  while ($current !== null && $pages < 10) {
    list($body, $code, $err, $next) = names_get_one($current);

    if ($code === 420) { // rate limited: wait, follow Link (may be null for some routes)
      usleep(2500000);
      $pages++;
      $current = $next;
      continue;
    }
    if ($body === null || $code < 200 || $code >= 300) {
      return [$items, 'ESI request failed (HTTP ' . $code . ')' . ($err ? ': ' . $err : '')];
    }
    $data = json_decode((string)$body, true);
    if (!is_array($data)) {
      return [$items, 'ESI returned non-JSON response'];
    }
    $items = array_merge($items, $data);
    $pages++;
    $current = $next;
  }
  return [$items, null];
}

// ---------------------------------------------------------------------------
// Resolve: cache first, ESI for misses (batched by route rules)
// ---------------------------------------------------------------------------

$placeholders = implode(',', array_fill(0, count($ids), '?'));

$stmt = @$mysqli->prepare("SELECT entity_id, entity_name FROM name_cache WHERE entity_kind=? AND entity_id IN ($placeholders)");
if (!$stmt) api_fail(500, 'DB prepare failed', ['error' => $mysqli->error]);

// Bind: kind (string) then ids (ints). bind_param needs references.
$allParams = array_merge([$kind], $ids);
$typeChars = 's' . str_repeat('i', count($ids)); // 1 string + N ints
$refBind = [$typeChars];
foreach ($allParams as $k => $v) { $refBind[] = &$allParams[$k]; }
call_user_func_array([$stmt, 'bind_param'], $refBind);
if (!$stmt->execute()) api_fail(500, 'DB execute failed', ['error' => $stmt->error]);

$names = []; // id (string) => name
$res = $stmt ? $stmt->get_result() : null;
while ($row = $res ? $res->fetch_assoc() : false) {
  if (!$row) break;
  $names[(string)(int)$row['entity_id']] = (string)$row['entity_name'];
}
$stmt->close();

$missing = array_values(array_diff($ids, array_map('intval', array_keys($names))));
$fetched = 0;

if (count($missing) > 0 && $kind !== 'characters') {
  // universe + systems: ESI accepts up to ~1000 ids per call.
  foreach (array_chunk($missing, 500) as $chunk) {
    if ($kind === 'universe') {
      list($items, $err) = names_get_all('https://esi.evetech.net/latest/universe/names/?ids=' . implode(',', $chunk));
    } else {
      list($items, $err) = names_get_all('https://esi.evetech.net/latest/universe/systems/?ids=' . implode(',', $chunk));
    }
    if ($err !== null || !is_array($items)) continue; // non-fatal: partial results ok
    foreach ($items as $it) {
      if (!is_array($it) || empty($it['id']) || !isset($it['name'])) continue;
      $eid = (int)$it['id'];
      $ename = (string)$it['name'];
      $names[(string)$eid] = $ename;

      $ins = @$mysqli->prepare('INSERT IGNORE INTO name_cache (entity_kind, entity_id, entity_name) VALUES (?, ?, ?)');
      if ($ins) {
        $ins->bind_param('sis', $kind, $eid, $ename);
        @$ins->execute();
        $ins->close();
      }
      $fetched++;
    }
  }
}

if (count($missing) > 0 && $kind === 'characters') {
  // Characters: one call per id (cheap, no batching route). Cap to keep pages snappy.
  foreach (array_slice($missing, 0, 100) as $cid) {
    list($body, $code, , ) = names_get_one('https://esi.evetech.net/latest/characters/' . (int)$cid . '/');
    if ($body === null || $code < 200 || $code >= 300) continue;
    $data = json_decode((string)$body, true);
    if (!is_array($data) || empty($data['name'])) continue;
    $cname = (string)$data['name'];
    $names[(string)(int)$cid] = $cname;

    $ins = @$mysqli->prepare('INSERT IGNORE INTO name_cache (entity_kind, entity_id, entity_name) VALUES (?, ?, ?)');
    if ($ins) {
      $kind2 = 'characters';
      $eid = (int)$cid;
      $ins->bind_param('sis', $kind2, $eid, $cname);
      @$ins->execute();
      $ins->close();
    }
    $fetched++;
  }
}

$mysqli->close();

api_respond([
  'ok' => true,
  'names' => $names, // keys are stringified ids
  'cached' => count($ids) - count($missing),
  'fetched' => $fetched,
]);
