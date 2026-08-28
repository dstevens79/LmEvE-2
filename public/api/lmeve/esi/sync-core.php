<?php
// Shared server-side corp ESI sync core. Used by:
//   - public/api/lmeve/esi/sync-run.php  (HTTP, session auth, manual "Run now")
//   - public/bin/poller.php              (CLI system cron, no session)
//
// The browser never touches raw corp tokens. This core resolves the vaulted
// corp token from the users table, refreshes it when expired/401, fetches the
// ESI segment, upserts rows into the app database, and records per-process
// sync bookkeeping in corp_sync_log (+ legacy corporations.last_sync*).

declare(strict_types=1);

require_once __DIR__ . '/../../_lib/common.php';

define('SYNC_CORE_ESI_BASE', 'https://esi.evetech.net/latest');
define('SYNC_CORE_DS', '?datasource=tranquility');

// Server-implemented segments, in stable execution order.
const SYNC_CORE_SEGMENTS = ['members', 'assets', 'industry', 'market'];

// SPA process id (DataSyncSettings) -> server segment. Null => no server-side
// implementation; the poller skips it and the UI may offer browser-mode runs
// when a personal token is present.
function sync_core_process_segment(string $processType): ?string {
  static $map = null;
  if ($map === null) {
    $map = [
      'corporation_members' => 'members',
      'members'             => 'members',
      'corporation_assets'  => 'assets',
      'assets'              => 'assets',
      'industry_jobs'       => 'industry',
      'manufacturing'       => 'industry',
      'market_orders'       => 'market',
      'market'              => 'market',
    ];
  }
  return $map[$processType] ?? null;
}

// Scope required per segment.
function sync_core_segment_scopes(): array {
  static $scopes = null;
  if ($scopes === null) {
    $scopes = [
      'members'  => 'esi-corporations.read_corporation_membership.v1',
      'assets'   => 'esi-assets.read_corporation_assets.v1',
      'industry' => 'esi-industry.read_corporation_jobs.v1',
      'market'   => 'esi-markets.read_corporation_orders.v1',
    ];
  }
  return $scopes;
}

// Default per-process schedule (minutes) for newly registered corps.
function sync_core_default_intervals(): array {
  static $defaults = null;
  if ($defaults === null) {
    $defaults = [
      'corporation_members'   => 60,     // membership churns fastest
      'corporation_assets'    => 360,
      'industry_jobs'         => 15,     // jobs complete within minutes/hours
      'market_orders'         => 60,
      'mining_ledger'         => 1440,   // browser-only for now
      'killmails'             => 360,    // browser-only for now
      'corporation_wallets'   => 1440,   // browser-only for now
      'structures'            => 1440,   // browser-only for now
      'corporation_contracts' => 1440,   // browser-only for now
      'item_pricing'          => 1440,   // browser-only for now
      'planetary_interaction' => 1440,   // browser-only for now
      'personal_esi'          => 60,     // personal token; never polled by cron
    ];
  }
  return $defaults;
}

function sync_core_all_process_ids(): array {
  static $ids = null;
  if ($ids === null) {
    $ids = [
      'corporation_members', 'corporation_assets', 'industry_jobs', 'mining_ledger',
      'market_orders', 'killmails', 'corporation_wallets', 'structures',
      'corporation_contracts', 'item_pricing', 'planetary_interaction', 'personal_esi',
    ];
  }
  return $ids;
}

// ---------------------------------------------------------------------------
// Schema (in-place migration, safe to call on every run)
// ---------------------------------------------------------------------------

function sync_core_ensure_schema(mysqli $db): void {
  static $done = false;
  if ($done) return;

  $res = @$db->query(
    "CREATE TABLE IF NOT EXISTS corp_sync_log (
      corporation_id BIGINT NOT NULL,
      process_type VARCHAR(50) NOT NULL,
      last_run_at DATETIME NULL DEFAULT NULL,
      last_status ENUM('success','error') NULL DEFAULT NULL,
      last_items INT NULL DEFAULT NULL,
      last_error TEXT NULL,
      took_ms INT NULL DEFAULT NULL,
      updated_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (corporation_id, process_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );

  $res = @$db->query(
    "CREATE TABLE IF NOT EXISTS sync_process_config (
      corporation_id BIGINT NOT NULL,
      process_type VARCHAR(50) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      interval_minutes INT NOT NULL DEFAULT 60,
      updated_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (corporation_id, process_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );

  // Legacy per-corp bookkeeping columns kept for existing pages.
  $wanted = [
    'last_sync'           => 'DATETIME NULL DEFAULT NULL',
    'last_sync_process'   => 'VARCHAR(50) NULL DEFAULT NULL',
    'last_sync_items'     => 'INT NULL DEFAULT NULL',
    'last_sync_error'     => 'TEXT NULL',
  ];
  foreach ($wanted as $col => $def) {
    $r = @$db->query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
      . "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='corporations' AND COLUMN_NAME='" . $col . "'"
    );
    if (!$r) continue;
    $row = $r->fetch_assoc();
    $r->close();
    if (!$row) {
      @$db->query("ALTER TABLE corporations ADD COLUMN `{$col}` {$def}");
    }
  }

  $done = true;
}

/**
 * Seed default config rows for a corporation (no-op for existing rows).
 */
function sync_core_seed_process_config(mysqli $db, int $corpId): void {
  $defaults = sync_core_default_intervals();
  foreach ($defaults as $process => $interval) {
    $stmt = @$db->prepare(
      'INSERT IGNORE INTO sync_process_config (corporation_id, process_type, enabled, interval_minutes) VALUES (?, ?, 1, ?)'
    );
    if (!$stmt) return;
    $stmt->bind_param('isi', $corpId, $process, $interval);
    @$stmt->execute();
    $stmt->close();
  }
}

// ---------------------------------------------------------------------------
// ESI transport
// ---------------------------------------------------------------------------

/**
 * Single ESI GET. Returns [body, httpCode, curlError, nextUrl].
 */
function sync_core_get_one(string $url, string $accessToken): array {
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
  curl_setopt($ch, CURLOPT_TIMEOUT, 30);
  curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $accessToken,
    'User-Agent: LMeve-2',
    'Accept: application/json',
  ]);
  $body = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $err = curl_error($ch);
  $link = curl_getheader($ch, 'Link');
  curl_close($ch);

  $next = null;
  if (is_string($link) && $link !== '' && preg_match('/<([^>]+)>;\s*rel="next"/', $link, $m)) {
    $next = $m[1];
  }
  if ($body === false) {
    $body = null;
  }
  return [$body, $code, $err !== '' ? $err : null, $next];
}

/**
 * Fetch a paginated ESI list. Returns [items: array, error: ?array{status,message}].
 */
function sync_core_get_all(string $url, string $accessToken, int $maxPages = 50): array {
  $items = [];
  $current = $url;
  $pages = 0;
  while ($current !== null && $pages < $maxPages) {
    list($body, $code, $err, $next) = sync_core_get_one($current, $accessToken);

    if ($code === 420) {
      // Rate limited: ESI still sends the next page in the Link header.
      usleep(2000000);
      if ($body !== null && $body !== '') {
        $data = json_decode((string)$body, true);
        if (is_array($data)) $items = array_merge($items, $data);
      }
      $pages++;
      $current = $next;
      continue;
    }

    if ($body === null || $code < 200 || $code >= 300) {
      return [
        $items,
        ['status' => $code > 0 ? $code : 0, 'message' => 'ESI request failed (HTTP ' . $code . ')' . ($err ? ': ' . $err : '')],
      ];
    }

    $data = json_decode((string)$body, true);
    if (!is_array($data)) {
      return [$items, ['status' => 502, 'message' => 'ESI returned a non-JSON response']];
    }
    $items = array_merge($items, $data);
    $pages++;
    $current = $next;
  }
  return [$items, null];
}

// ---------------------------------------------------------------------------
// Token resolution + refresh (throws Exception on hard failure)
// ---------------------------------------------------------------------------

/**
 * Refresh the vaulted corp token via EVE SSO and persist the new pair.
 */
function sync_core_refresh_token(mysqli $db, int $corpId, int $characterId, string $refreshToken): array {
  $esiCfg = api_get_esi_config([]);
  $clientId = (string)($esiCfg['clientId'] ?? '');
  $clientSecret = (string)($esiCfg['clientSecret'] ?? '');
  if ($clientId === '' || $clientSecret === '') {
    throw new Exception('ESI is not configured (clientId/clientSecret missing in server settings)', 400);
  }

  $ch = curl_init('https://login.eveonline.com/v2/oauth/token');
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
  curl_setopt($ch, CURLOPT_TIMEOUT, 30);
  curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/x-www-form-urlencoded',
    'Authorization: Basic ' . base64_encode($clientId . ':' . $clientSecret),
    'User-Agent: LMeve-2',
  ]);
  curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
    'grant_type' => 'refresh_token',
    'refresh_token' => $refreshToken,
  ]));
  $resp = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $err = curl_error($ch);
  curl_close($ch);

  if ($resp === false || $code < 200 || $code >= 300) {
    throw new Exception(
      'Corp ESI token refresh failed (HTTP ' . $code . '). Re-run Corp ESI consent from the Corporations page.',
      401
    );
  }
  $data = json_decode((string)$resp, true);
  if (!is_array($data) || empty($data['access_token'])) {
    throw new Exception('Corp ESI token refresh returned no access token', 401);
  }

  $newAccess = (string)$data['access_token'];
  $newRefresh = isset($data['refresh_token']) && is_string($data['refresh_token']) && $data['refresh_token'] !== ''
    ? $data['refresh_token'] : $refreshToken;
  $expiresIn = (int)($data['expires_in'] ?? 0);
  $expiry = (new DateTime('@' . (time() + max($expiresIn, 0))))->format('Y-m-d H:i:s');

  $stmt = @$db->prepare('UPDATE users SET access_token=?, refresh_token=?, token_expiry=?, updated_date=NOW() WHERE character_id=?');
  if (!$stmt) throw new Exception('DB prepare failed: ' . $db->error, 500);
  $stmt->bind_param('sssi', $newAccess, $newRefresh, $expiry, $characterId);
  if (!$stmt->execute()) throw new Exception('DB execute failed: ' . $stmt->error, 500);
  $stmt->close();

  $stmt2 = @$db->prepare('UPDATE corporations SET last_token_refresh=NOW() WHERE corporation_id=?');
  if ($stmt2) {
    $stmt2->bind_param('i', $corpId);
    @$stmt2->execute();
    $stmt2->close();
  }

  return ['access' => $newAccess, 'expiry' => $expiry];
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

/**
 * Upsert records into a table (same column contract as the upsert-*.php
 * endpoints so the read paths stay identical). Returns count summary.
 */
function sync_core_upsert(mysqli $db, string $table, array $cols, array $typeMap, array $records): array {
  $updateCols = [];
  foreach ($cols as $c) {
    if ($c === $cols[0]) continue; // unique key
    $updateCols[] = $c . '=VALUES(' . $c . ')';
  }
  $sql = 'INSERT INTO ' . $table . ' (' . implode(',', $cols) . ') VALUES ('
    . implode(',', array_fill(0, count($cols), '?')) . ') ON DUPLICATE KEY UPDATE '
    . implode(', ', $updateCols);

  $stmt = @$db->prepare($sql);
  if (!$stmt) {
    throw new Exception('DB prepare failed: ' . $db->error, 500);
  }

  $typeStr = '';
  foreach ($cols as $c) $typeStr .= $typeMap[$c];

  $inserted = 0; $updated = 0; $failed = 0;
  foreach ($records as $r) {
    if (!is_array($r)) { $failed++; continue; }
    $vals = [];
    foreach ($cols as $c) $vals[] = $r[$c] ?? null;
    $bindParams = [$typeStr];
    foreach ($vals as $k => $v) $bindParams[] = &$vals[$k];
    call_user_func_array([$stmt, 'bind_param'], $bindParams);
    if (!$stmt->execute()) { $failed++; continue; }
    if ($stmt->affected_rows === 1) $inserted++; else $updated++;
  }
  $stmt->close();
  return ['inserted' => $inserted, 'updated' => $updated, 'failed' => $failed];
}

// ---------------------------------------------------------------------------
// Segment bodies (shared by HTTP + poller)
// ---------------------------------------------------------------------------

/**
 * Fetch+upsert one segment. Mutates $tokenState on refresh/401 retry.
 * Throws Exception on hard failure; returns ['fetched','inserted','updated','failed'].
 */
function sync_core_execute_segment(
  mysqli $db,
  array $corpRow,
  string $segment,
  int $corpId,
  array &$tokenState
): array {
  $corpName = (string)$corpRow['corporation_name'];
  $allianceId = (int)($corpRow['alliance_id'] ?? 0);
  $allianceName = (string)($corpRow['alliance_name'] ?? '');

  $esiFetch = function (string $url, int $maxPages) use ($db, $corpId, &$tokenState): array {
    $r = sync_core_get_all($url, $tokenState['access'], $maxPages);
    if ($r[1] !== null && (int)$r[1]['status'] === 401 && !$tokenState['retryUsed']) {
      $tokenState['retryUsed'] = true;
      $new = sync_core_refresh_token($db, $corpId, $tokenState['characterId'], $tokenState['refresh']);
      $tokenState['access'] = $new['access'];
      $tokenState['refreshed'] = true;
      $r = sync_core_get_all($url, $tokenState['access'], $maxPages);
    }
    return $r;
  };

  $records = [];
  $fetched = 0;
  $summary = ['inserted' => 0, 'updated' => 0, 'failed' => 0];

  switch ($segment) {
    case 'members': {
      list($rawMembers, $err) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/members/' . SYNC_CORE_DS, 100);
      if ($err) throw new Exception($err['message'], (int)$err['status']);
      $fetched = count($rawMembers);

      // Public enrichment: roles + titles (non-fatal on failure).
      $roleMap = [];
      $titleMap = [];
      list($roles, $rolesErr) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/roles/' . SYNC_CORE_DS, 1);
      if (!$rolesErr && is_array($roles)) {
        foreach ($roles as $key => $val) {
          // Scalar values are top-level roles (ceo/tcop/logistics); nested
          // arrays are per-station/division role holders (hangar, wallet, ...).
          if (is_int($val)) {
            $roleMap[$val][] = (string)$key;
          } elseif (is_array($val)) {
            foreach ($val as $v2) {
              if (is_int($v2)) $roleMap[$v2][] = (string)$key;
            }
          }
        }
      }
      list($titles, $titlesErr) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/titles/' . SYNC_CORE_DS, 1);
      if (!$titlesErr && is_array($titles)) {
        foreach ($titles as $titleId => $charIds) {
          if (is_array($charIds)) {
            foreach ($charIds as $cid) {
              if (is_int($cid)) $titleMap[$cid][] = (string)$titleId;
            }
          }
        }
      }

      foreach ($rawMembers as $m) {
        $cid = (int)($m['character_id'] ?? 0);
        if ($cid <= 0) continue;
        $records[] = [
          'character_id' => $cid,
          'character_name' => (string)($m['name'] ?? ('Character ' . $cid)),
          'corporation_id' => $corpId,
          'corporation_name' => $corpName,
          'alliance_id' => $allianceId > 0 ? $allianceId : null,
          'alliance_name' => $allianceName !== '' ? $allianceName : null,
          'roles' => json_encode(isset($roleMap[$cid]) ? $roleMap[$cid] : []),
          'titles' => json_encode(isset($titleMap[$cid]) ? $titleMap[$cid] : []),
          'last_login' => null,
          'location_id' => null,
          'location_name' => null,
          'ship_type_id' => null,
          'ship_type_name' => null,
          'is_online' => 0,
        ];
      }

      $summary = sync_core_upsert($db, 'members', [
        'character_id','character_name','corporation_id','corporation_name',
        'alliance_id','alliance_name','roles','titles','last_login',
        'location_id','location_name','ship_type_id','ship_type_name',
        'is_online'
      ], [
        'character_id'=>'i','character_name'=>'s','corporation_id'=>'i','corporation_name'=>'s',
        'alliance_id'=>'i','alliance_name'=>'s','roles'=>'s','titles'=>'s','last_login'=>'s',
        'location_id'=>'i','location_name'=>'s','ship_type_id'=>'i','ship_type_name'=>'s',
        'is_online'=>'i'
      ], $records);

      // Keep corp member count fresh.
      $memberCount = count($rawMembers);
      $up = @$db->prepare('UPDATE corporations SET member_count=? WHERE corporation_id=?');
      if ($up) {
        $up->bind_param('ii', $memberCount, $corpId);
        @$up->execute();
        $up->close();
      }
      break;
    }

    case 'assets': {
      list($raw, $err) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/assets/' . SYNC_CORE_DS, 100);
      if ($err) throw new Exception($err['message'], (int)$err['status']);
      $fetched = count($raw);

      foreach ($raw as $a) {
        $itemId = (int)($a['item_id'] ?? 0);
        if ($itemId <= 0) continue;
        $flag = isset($a['flag']) && $a['flag'] !== null ? (string)$a['flag'] : null;
        $records[] = [
          'item_id' => $itemId,
          'type_id' => (int)($a['type_id'] ?? 0),
          'location_id' => isset($a['location_id']) ? (int)$a['location_id'] : null,
          'location_type' => $flag !== null ? $flag : 'station',
          'location_flag' => $flag,
          'quantity' => (int)($a['quantity'] ?? 0),
          'is_singleton' => !empty($a['is_singleton']) ? 1 : 0,
          'is_blueprint_copy' => !empty($a['is_blueprint_copy']) ? 1 : 0,
          'owner_id' => isset($a['owner_id']) ? (int)$a['owner_id'] : null,
          'corporation_id' => $corpId,
        ];
      }

      $summary = sync_core_upsert($db, 'assets', [
        'item_id','type_id','location_id','location_type','location_flag','quantity',
        'is_singleton','is_blueprint_copy','owner_id','corporation_id'
      ], [
        'item_id'=>'i','type_id'=>'i','location_id'=>'i','location_type'=>'s','location_flag'=>'s',
        'quantity'=>'i','is_singleton'=>'i','is_blueprint_copy'=>'i','owner_id'=>'i','corporation_id'=>'i'
      ], $records);
      break;
    }

    case 'industry': {
      list($raw, $err) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/industry/jobs/' . SYNC_CORE_DS, 50);
      if ($err) throw new Exception($err['message'], (int)$err['status']);
      $fetched = count($raw);

      foreach ($raw as $j) {
        $jobId = (int)($j['job_id'] ?? 0);
        if ($jobId <= 0) continue;
        $completedDate = null;
        if (isset($j['completed_dates']) && is_array($j['completed_dates']) && count($j['completed_dates']) > 0) {
          $max = 0;
          foreach ($j['completed_dates'] as $t) {
            $t = (int)$t;
            if ($t > $max) $max = $t;
          }
          if ($max > 0) $completedDate = (new DateTime('@' . $max))->format('Y-m-d H:i:s');
        }
        $records[] = [
          'job_id' => $jobId,
          'corporation_id' => $corpId,
          'installer_id' => isset($j['installer_id']) ? (int)$j['installer_id'] : null,
          'facility_id' => isset($j['facility_id']) ? (int)$j['facility_id'] : null,
          'activity_id' => isset($j['activity_id']) ? (int)$j['activity_id'] : null,
          'blueprint_type_id' => isset($j['blueprint_id']) ? (int)$j['blueprint_id'] : null,
          'product_type_id' => isset($j['product_id']) ? (int)$j['product_id'] : null,
          'runs' => (int)($j['runs'] ?? 0),
          'status' => (string)($j['status'] ?? ''),
          'duration' => (int)($j['duration'] ?? 0),
          'start_date' => isset($j['start_date']) ? (string)$j['start_date'] : null,
          'end_date' => isset($j['end_date']) ? (string)$j['end_date'] : null,
          'completed_date' => $completedDate,
        ];
      }

      $summary = sync_core_upsert($db, 'industry_jobs', [
        'job_id','corporation_id','installer_id','facility_id','activity_id',
        'blueprint_type_id','product_type_id','runs','status','duration',
        'start_date','end_date','completed_date'
      ], [
        'job_id'=>'i','corporation_id'=>'i','installer_id'=>'i','facility_id'=>'i','activity_id'=>'i',
        'blueprint_type_id'=>'i','product_type_id'=>'i','runs'=>'i','status'=>'s','duration'=>'i',
        'start_date'=>'s','end_date'=>'s','completed_date'=>'s'
      ], $records);
      break;
    }

    case 'market': {
      list($marketIds, $err) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/markets/' . SYNC_CORE_DS, 1);
      if ($err) throw new Exception($err['message'], (int)$err['status']);
      $fetched = count($marketIds);

      $marketCap = 40;
      $count = 0;
      foreach ($marketIds as $mid) {
        if ($count >= $marketCap) break;
        $mid = (int)$mid;
        if ($mid <= 0) continue;
        $count++;

        list($orders, $oErr) = $esiFetch(SYNC_CORE_ESI_BASE . '/markets/' . $mid . '/orders/' . SYNC_CORE_DS, 1);
        if ($oErr) continue; // keep going; other markets may still work
        foreach ($orders as $o) {
          if ((int)($o['corporation_id'] ?? 0) !== $corpId) continue;
          $orderId = (int)($o['order_id'] ?? 0);
          if ($orderId <= 0) continue;
          $records[] = [
            'order_id' => $orderId,
            'corporation_id' => $corpId,
            'type_id' => (int)($o['type_id'] ?? 0),
            'region_id' => null,
            'location_id' => $mid,
            'volume_total' => (int)($o['volume_total'] ?? 0),
            'volume_remain' => (int)($o['volume_remain'] ?? 0),
            'min_volume' => (int)($o['min_volume'] ?? 0),
            'price' => (float)($o['price'] ?? 0),
            'is_buy_order' => !empty($o['is_buy_order']) ? 1 : 0,
            'duration' => (int)($o['duration'] ?? 0),
            'issued' => isset($o['issued']) ? (string)$o['issued'] : null,
            'state' => (string)($o['state'] ?? 'active'),
          ];
        }
      }

      $summary = sync_core_upsert($db, 'market_orders', [
        'order_id','corporation_id','type_id','region_id','location_id','volume_total',
        'volume_remain','min_volume','price','is_buy_order','duration','issued','state'
      ], [
        'order_id'=>'i','corporation_id'=>'i','type_id'=>'i','region_id'=>'i','location_id'=>'i',
        'volume_total'=>'i','volume_remain'=>'i','min_volume'=>'i','price'=>'d','is_buy_order'=>'i',
        'duration'=>'i','issued'=>'s','state'=>'s'
      ], $records);
      break;
    }

    default:
      throw new Exception('Unsupported segment: ' . $segment, 400);
  }

  return [
    'fetched' => $fetched,
    'inserted' => $summary['inserted'],
    'updated' => $summary['updated'],
    'failed' => $summary['failed'],
  ];
}

// ---------------------------------------------------------------------------
// Top-level entry point (used by HTTP endpoint and CLI poller)
// ---------------------------------------------------------------------------

/**
 * Resolve the corp row + vaulted token state for a segment run.
 * Manual runs intentionally ignore the enabled flag (explicit user action);
 * due-ness is enforced by the poller against sync_process_config.
 * Returns [corpRow, tokenState] or throws Exception with an HTTP-ish code.
 */
function sync_core_prepare_run(mysqli $db, int $corpId, string $segment, int $preferredCharId): array {
  $stmt = @$db->prepare(
    'SELECT corporation_id, corporation_name, is_active, ceo_id, alliance_id, alliance_name
     FROM corporations WHERE corporation_id=? LIMIT 1'
  );
  if (!$stmt) throw new Exception('DB prepare failed', 500);
  $stmt->bind_param('i', $corpId);
  $stmt->execute();
  $res = $stmt->get_result();
  $corpRow = $res ? $res->fetch_assoc() : null;
  $stmt->close();
  if (!$corpRow) {
    throw new Exception('Corporation not registered. Complete Corp ESI consent from the Corporations page first.', 404);
  }

  sync_core_seed_process_config($db, $corpId);

  // Resolve vaulted corp token (prefer the preferred character's row).
  $stmt = @$db->prepare(
    "SELECT character_id, character_name, access_token, refresh_token, token_expiry, scopes
     FROM users
     WHERE corporation_id=?
       AND access_token IS NOT NULL AND access_token<>''
       AND refresh_token IS NOT NULL AND refresh_token<>''
     ORDER BY (character_id=?) DESC, updated_date DESC
     LIMIT 1"
  );
  if (!$stmt) throw new Exception('DB prepare failed', 500);
  $stmt->bind_param('ii', $corpId, $preferredCharId > 0 ? $preferredCharId : ($corpRow['ceo_id'] ?? 0));
  $stmt->execute();
  $res = $stmt->get_result();
  $tokenRow = $res ? $res->fetch_assoc() : null;
  $stmt->close();
  if (!$tokenRow) {
    throw new Exception('No corp ESI token in server vault for this corporation. Have a Director/CEO complete Corp ESI consent from the Corporations page.', 409);
  }

  $scopes = sync_core_segment_scopes();
  $scopeList = preg_split('/\s+/', trim((string)($tokenRow['scopes'] ?? ''))) ?: [];
  if (count($scopeList) > 0 && !in_array($scopes[$segment], $scopeList, true)) {
    throw new Exception('Corp token is missing scope ' . $scopes[$segment] . '. Re-run Corp ESI consent with full scopes.', 403);
  }

  $tokenState = [
    'access' => (string)$tokenRow['access_token'],
    'refresh' => (string)$tokenRow['refresh_token'],
    'characterId' => (int)$tokenRow['character_id'],
    'refreshed' => false,
    'retryUsed' => false,
  ];

  // Proactive refresh when expired (60s buffer); unknown expiry left to the 401 retry.
  $expiryRaw = trim((string)($tokenRow['token_expiry'] ?? ''));
  if ($expiryRaw !== '') {
    $expiryTime = strtotime($expiryRaw);
    if ($expiryTime === false || $expiryTime <= time() + 60) {
      $new = sync_core_refresh_token($db, $corpId, $tokenState['characterId'], $tokenState['refresh']);
      $tokenState['access'] = $new['access'];
      $tokenState['refreshed'] = true;
    }
  }

  return [$corpRow, $tokenState];
}

/**
 * Record one run's outcome in corp_sync_log + legacy corporations columns.
 */
function sync_core_record_run(
  mysqli $db,
  int $corpId,
  string $processType,
  bool $success,
  ?string $error,
  int $items,
  int $tookMs
): void {
  $stmt = @$db->prepare(
    'INSERT INTO corp_sync_log (corporation_id, process_type, last_run_at, last_status, last_items, last_error, took_ms)
     VALUES (?, ?, NOW(), ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE last_run_at=NOW(), last_status=VALUES(last_status), last_items=VALUES(last_items), last_error=VALUES(last_error), took_ms=VALUES(took_ms)'
  );
  if ($stmt) {
    $status = $success ? 'success' : 'error';
    $itemsVal = $items > 0 || !$success ? $items : null;
    $stmt->bind_param('isssii', $corpId, $processType, $status, $itemsVal === null ? 0 : $itemsVal, $error, $tookMs);
    @$stmt->execute();
    $stmt->close();
  }

  // Legacy per-corp bookkeeping (last successful segment wins) for existing pages.
  if ($success) {
    $now = (new DateTime())->format('Y-m-d H:i:s');
    $up = @$db->prepare(
      'UPDATE corporations SET last_sync=?, last_sync_process=?, last_sync_items=?, last_sync_error=NULL WHERE corporation_id=?'
    );
    if ($up) {
      $up->bind_param('ssii', $now, $processType, max($items, 0), $corpId);
      @$up->execute();
      $up->close();
    }
  } else {
    $up = @$db->prepare('UPDATE corporations SET last_sync_error=? WHERE corporation_id=?');
    if ($up) {
      $up->bind_param('si', (string)$error, $corpId);
      @$up->execute();
      $up->close();
    }
  }
}

/**
 * Run one segment end-to-end. Never throws; returns:
 * ['ok'=>bool,'httpCode'=>int,'processType','corporationId','corporationName',
 *  'tokenCharacterId','tokenRefreshed','fetched','inserted','updated','failed',
 *  'tookMs','error'?]
 */
function sync_core_run_segment(
  mysqli $db,
  int $corpId,
  string $segment,
  int $preferredCharId = 0
): array {
  $startMs = (int)(microtime(true) * 1000);
  $base = [
    'processType' => $segment,
    'corporationId' => $corpId,
    'tookMs' => 0,
  ];

  try {
    sync_core_ensure_schema($db);
    list($corpRow, $tokenState) = array_slice(
      sync_core_prepare_run($db, $corpId, $segment, $preferredCharId), 0, 2
    );
    $result = sync_core_execute_segment($db, $corpRow, $segment, $corpId, $tokenState);

    $tookMs = (int)(microtime(true) * 1000) - $startMs;
    $items = (int)($result['inserted'] + $result['updated']);
    sync_core_record_run($db, $corpId, $segment, true, null, $items, $tookMs);

    return array_merge($base, [
      'ok' => true,
      'httpCode' => 200,
      'corporationName' => (string)$corpRow['corporation_name'],
      'tokenCharacterId' => $tokenState['characterId'],
      'tokenRefreshed' => $tokenState['refreshed'] ? 1 : 0,
    ], $result, ['tookMs' => $tookMs]);
  } catch (Exception $e) {
    $tookMs = (int)(microtime(true) * 1000) - $startMs;
    $code = $e->getCode();
    if (!is_int($code) || $code < 400 || $code > 599) $code = 502;
    sync_core_record_run($db, $corpId, $segment, false, $e->getMessage(), 0, $tookMs);
    return array_merge($base, [
      'ok' => false,
      'httpCode' => $code,
      'error' => $e->getMessage(),
      'tookMs' => $tookMs,
    ]);
  }
}
