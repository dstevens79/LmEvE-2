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
require_once __DIR__ . '/sync-queue.php';

define('SYNC_CORE_ESI_BASE', 'https://esi.evetech.net/latest');
define('SYNC_CORE_DS', '?datasource=tranquility');

// Server-implemented segments, in stable execution order. Every segment has a
// vaulted-corp-token ESI source (no browser, no personal token) and writes to
// the app database. The full table list lives in scripts/setup-lmeve-db.sh —
// this core only fetches + upserts into those tables.
const SYNC_CORE_SEGMENTS = [
  'members',      // /corporations/{id}/members/           -> members (+roles/titles enrichment)
  'assets',       // /corporations/{id}/assets/            -> assets
  'industry',     // /corporations/{id}/industry/jobs/     -> industry_jobs
  'market',       // /corporations/{id}/orders[/history]   -> market_orders + market_order_history
  'wallets',      // /corporations/{id}/wallets[/div]      -> wallet_divisions + wallet_transactions (30-day window)
  'mining',       // /corporation/{id}/mining/observers    -> mining_ledger (per-pilot extraction rows)
  'killmails',    // /corporations/{id}/killmails/recent/  -> killmails (losses; detail fetched via public endpoint)
  'contracts',    // /corporations/{id}/contracts[+items]  -> contracts + contract_items
  'structures',   // /corporations/{id}/structures/        -> structures (+container_logs on access)
  'pricing',      // /markets/prices (public, no token)    -> market_prices
];

// SPA process id (DataSyncSettings) -> server segment. Null => personal-token
// only (never run by the cron poller or the manual server endpoint).
function sync_core_process_segment(string $processType): ?string {
  static $map = null;
  if ($map === null) {
    $map = [
      'corporation_members'   => 'members',
      'members'               => 'members',
      'corporation_assets'    => 'assets',
      'assets'                => 'assets',
      'industry_jobs'         => 'industry',
      'manufacturing'         => 'industry',
      'market_orders'         => 'market',
      'market'                => 'market',
      'corporation_wallets'   => 'wallets',
      'mining_ledger'         => 'mining',
      'killmails'             => 'killmails',
      'corporation_contracts' => 'contracts',
      'structures'            => 'structures',
      'container_logs'        => 'structures',
      'item_pricing'          => 'pricing',
    ];
  }
  return $map[$processType] ?? null;
}

// Scope required per segment (verified against the official ESI OpenAPI spec).
function sync_core_segment_scopes(): array {
  static $scopes = null;
  if ($scopes === null) {
    $scopes = [
      'members'   => 'esi-corporations.read_corporation_membership.v1',
      'assets'    => 'esi-assets.read_corporation_assets.v1',
      'industry'  => 'esi-industry.read_corporation_jobs.v1',
      'market'    => 'esi-markets.read_corporation_orders.v1',
      'wallets'   => 'esi-wallet.read_corporation_wallets.v1',
      'mining'    => 'esi-industry.read_corporation_mining.v1',
      'killmails' => 'esi-killmails.read_corporation_killmails.v1',
      'contracts' => 'esi-contracts.read_corporation_contracts.v1',
      'structures'=> 'esi-corporations.read_structures.v1',
      // Public endpoint — no corp scope required; the token is only reused for
      // rate-limiting identity, never verified.
      'pricing'   => null,
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
      'industry_jobs'         => 15,     // jobs complete within minutes/hours
      'market_orders'         => 30,     // orders are placed/cancelled often
      'killmails'             => 30,
      'corporation_assets'    => 360,
      'mining_ledger'         => 360,
      'structures'            => 1440,   // structures rarely change; logs ride along
      'corporation_wallets'   => 180,    // transactions post frequently, cap the scan window
      'corporation_contracts' => 720,    // contract state changes are slower
      'item_pricing'          => 360,    // market prices move daily-ish
      'planetary_interaction' => 1440,   // personal-token only in the browser
      'personal_esi'          => 60,     // personal token; never polled by cron
    ];
  }
  return $defaults;
}

function sync_core_all_process_ids(): array {
  static $ids = null;
  if ($ids === null) {
    $ids = [
      'corporation_members', 'industry_jobs', 'market_orders', 'killmails',
      'corporation_assets', 'mining_ledger', 'structures',
      'corporation_wallets', 'corporation_contracts', 'item_pricing',
      'planetary_interaction', 'personal_esi',
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

  // Fresh installs get the whole schema from scripts/setup-lmeve-db.sh (the one
  // source of truth). These IF NOT EXISTS guards only bring *pre-existing*
  // databases up to that same shape with zero manual SQL — so they must mirror
  // the base DDL, not invent extra columns.
  $tables = [
    'market_prices' => "CREATE TABLE IF NOT EXISTS market_prices (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      type_id INT NOT NULL UNIQUE,
      adjusted_price DECIMAL(20,4) NULL DEFAULT NULL,
      average_price DECIMAL(20,4) NULL DEFAULT NULL,
      last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_type_id (type_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    'structures' => "CREATE TABLE IF NOT EXISTS structures (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      structure_id BIGINT NOT NULL UNIQUE,
      corporation_id BIGINT NOT NULL,
      type_id INT NOT NULL DEFAULT 0,
      system_id BIGINT,
      status VARCHAR(50) NULL DEFAULT NULL,
      name VARCHAR(255) NULL DEFAULT NULL,
      last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_corporation_id (corporation_id),
      INDEX idx_type_id (type_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    'market_order_history' => "CREATE TABLE IF NOT EXISTS market_order_history (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      order_id BIGINT NOT NULL UNIQUE,
      corporation_id BIGINT NOT NULL,
      type_id INT NOT NULL DEFAULT 0,
      region_id BIGINT,
      location_id BIGINT,
      volume_total BIGINT NOT NULL DEFAULT 0,
      price DECIMAL(20,2) NOT NULL DEFAULT 0.0,
      is_buy_order BOOLEAN NOT NULL DEFAULT FALSE,
      issued DATETIME,
      state VARCHAR(50),
      last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_corporation_id (corporation_id),
      INDEX idx_state (state)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  ];

  // name_cache lives with get-names.php (public endpoint that runs without the
  // sync core loaded); it is part of the canonical schema in setup-lmeve-db.sh.
  foreach ($tables as $tableName => $ddl) {
    @$db->query($ddl);
  }

  // Additive columns present in the canonical schema that older installs may lack.
  $colWanted = [
    'wallet_transactions' => [
      'division'        => "INT",
      'client_name'     => "VARCHAR(255) NULL DEFAULT NULL",
      'location_name'   => "VARCHAR(255) NULL DEFAULT NULL",
      'type_name'       => "VARCHAR(255) NULL DEFAULT NULL",
    ],
    'mining_ledger' => [
      'character_name'  => "VARCHAR(255) NULL DEFAULT NULL",
      'type_name'       => "VARCHAR(255) NULL DEFAULT NULL",
      'system_name'     => "VARCHAR(255) NULL DEFAULT NULL",
    ],
    'contracts' => [
      'acceptor_id'     => "BIGINT NULL DEFAULT NULL",
    ],
    'killmails' => [
      'victim_character_id'   => "BIGINT NULL DEFAULT NULL",
      'victim_damage_taken'   => "BIGINT NULL DEFAULT NULL",
      'final_blow_character_id' => "BIGINT NULL DEFAULT NULL",
    ],
  ];
  foreach ($colWanted as $tbl => $cols) {
    foreach ($cols as $col => $def) {
      $r = @$db->query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
        . "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='" . $tbl . "' AND COLUMN_NAME='" . $col . "'"
      );
      if (!$r) continue;
      $row = $r->fetch_assoc();
      $r->close();
      if (!$row) {
        @$db->query("ALTER TABLE {$tbl} ADD COLUMN `{$col}` {$def}");
      }
    }
  }

  // contract_items needs UNIQUE (contract_id, record_id) so re-polls upsert
  // instead of duplicating. Existing installs may lack it — dedupe first.
  $uk = @$db->query(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='contract_items' AND INDEX_NAME='idx_contract_record' LIMIT 1"
  );
  if ($uk) {
    $found = (bool)$uk->fetch_assoc();
    $uk->close();
  } else {
    $found = false;
  }
  if (!$found) {
    // No-op on fresh installs (table just created with the unique key).
    @$db->query(
      'DELETE c1 FROM contract_items c1 INNER JOIN contract_items c2
       WHERE c1.contract_id=c2.contract_id AND c1.record_id=c2.record_id AND c1.id>c2.id'
    );
    @$db->query('ALTER TABLE contract_items ADD UNIQUE KEY idx_contract_record (contract_id, record_id)');
  }

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
  sync_queue_ensure_schema($db);
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
  // Empty token => public ESI endpoint (market prices, killmail details).
  $headers = [
    'User-Agent: LMeve-2',
    'Accept: application/json',
  ];
  if ($accessToken !== '') {
    array_unshift($headers, 'Authorization: Bearer ' . $accessToken);
  }
  curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
  // PHP's cURL extension has no curl_getheader() API. Capture the pagination
  // Link header while cURL receives it instead, so every segment can share
  // this transport safely.
  $link = '';
  curl_setopt($ch, CURLOPT_HEADERFUNCTION, static function ($curl, string $header) use (&$link): int {
    if (stripos($header, 'Link:') === 0) {
      $link = trim(substr($header, 5));
    }
    return strlen($header);
  });
  $body = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $err = curl_error($ch);
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

      // Enrichment: roles + titles (non-fatal on failure). Paths verified
      // against the official ESI OpenAPI spec.
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
          // cost = ESI's material cost per run; income derivation uses it when set.
          'cost' => isset($j['cost']) && is_numeric($j['cost']) ? (float)$j['cost'] : null,
          // successful_runs = how many runs finished so far; income is derived
          // from this at read time (ESI has no corp job-history endpoint).
          'completed_runs' => isset($j['successful_runs']) && is_numeric($j['successful_runs']) ? (int)$j['successful_runs'] : null,
          'status' => (string)($j['status'] ?? ''),
          'duration' => (int)($j['duration'] ?? 0),
          'start_date' => isset($j['start_date']) ? (string)$j['start_date'] : null,
          'end_date' => isset($j['end_date']) ? (string)$j['end_date'] : null,
          'completed_date' => $completedDate,
        ];
      }

      $summary = sync_core_upsert($db, 'industry_jobs', [
        'job_id','corporation_id','installer_id','facility_id','activity_id',
        'blueprint_type_id','product_type_id','runs','cost','completed_runs','status','duration',
        'start_date','end_date','completed_date'
      ], [
        'job_id'=>'i','corporation_id'=>'i','installer_id'=>'i','facility_id'=>'i','activity_id'=>'i',
        'blueprint_type_id'=>'i','product_type_id'=>'i','runs'=>'i','cost'=>'d','completed_runs'=>'i','status'=>'s','duration'=>'i',
        'start_date'=>'s','end_date'=>'s','completed_date'=>'s'
      ], $records);
      break;
    }

    case 'market': {
      // The corp's own open buy/sell orders — paginated. (The old /markets/ +
      // per-station scan called an endpoint that does not exist in ESI.)
      list($raw, $err) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/orders/' . SYNC_CORE_DS, 100);
      if ($err) throw new Exception($err['message'], (int)$err['status']);
      $fetched = count($raw);

      foreach ((array)$raw as $o) {
        if (!is_array($o)) continue;
        // /corporations/{id}/orders returns this corp's own orders only.
        if (isset($o['corporation_id']) && (int)$o['corporation_id'] !== 0 && (int)$o['corporation_id'] !== $corpId) continue;
        $orderId = isset($o['order_id']) ? (int)$o['order_id'] : 0;
        if ($orderId <= 0) continue;

        // Spec fields: volume_remain, min_volume, duration, issued, state(range enum), region_id.
        $volumeRemain = null;
        foreach (['volume_remain', 'volume_remained'] as $vk) {
          if (isset($o[$vk]) && is_numeric($o[$vk])) { $volumeRemain = (int)$o[$vk]; break; }
        }
        $minVolume = (isset($o['min_volume']) && is_numeric($o['min_volume']) && (int)$o['min_volume'] > 0) ? (int)$o['min_volume'] : null;

        $records[] = [
          'order_id' => $orderId,
          'corporation_id' => $corpId,
          'type_id' => isset($o['type_id']) ? (int)$o['type_id'] : 0,
          'region_id' => isset($o['region_id']) && (int)$o['region_id'] > 0 ? (int)$o['region_id'] : null,
          'location_id' => isset($o['location_id']) ? (int)$o['location_id'] : null,
          'volume_total' => isset($o['volume_total']) ? (int)$o['volume_total'] : 0,
          'volume_remain' => $volumeRemain !== null ? $volumeRemain : (isset($o['volume_total']) ? (int)$o['volume_total'] : 0),
          'min_volume' => $minVolume,
          'price' => isset($o['price']) && is_numeric($o['price']) ? (float)$o['price'] : 0.0,
          'is_buy_order' => !empty($o['is_buy_order']) ? 1 : 0,
          'duration' => isset($o['duration']) && is_numeric($o['duration']) ? (int)$o['duration'] : null,
          'issued' => !empty($o['issued']) && is_string($o['issued']) ? $o['issued'] : null,
          // range = ESI jump-range number (1/2/3 or 10/20/30). Open orders carry no state.
          'state' => isset($o['range']) ? (string)$o['range'] : 'active',
        ];
      }

      $summary = sync_core_upsert($db, 'market_orders', [
        'order_id','corporation_id','type_id','region_id','location_id','volume_total',
        'volume_remain','min_volume','price','is_buy_order','duration','issued','state'
      ], [
        'order_id'=>'i','corporation_id'=>'i','type_id'=>'i','region_id'=>'i','location_id'=>'i',
        'volume_total'=>'i','volume_remain'=>'i','min_volume'=>'i','price'=>'d','is_buy_order'=>'i',
        'duration'=>'i','issued'=>'s','state'=>'s'
      ], $records);

      // Closed orders — the real source for the Market page's sales section.
      list($rawHistory, $hErr) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/orders/history' . SYNC_CORE_DS, 50);
      if ($hErr) throw new Exception($hErr['message'], (int)$hErr['status']);

      $historyRecords = [];
      foreach ((array)$rawHistory as $o) {
        if (!is_array($o)) continue;
        $orderId = isset($o['order_id']) ? (int)$o['order_id'] : 0;
        if ($orderId <= 0) continue;
        $historyRecords[] = [
          'order_id' => $orderId,
          'corporation_id' => $corpId,
          'type_id' => isset($o['type_id']) ? (int)$o['type_id'] : 0,
          'region_id' => isset($o['region_id']) && (int)$o['region_id'] > 0 ? (int)$o['region_id'] : null,
          'location_id' => isset($o['location_id']) ? (int)$o['location_id'] : null,
          'volume_total' => isset($o['volume_total']) ? (int)$o['volume_total'] : 0,
          'price' => isset($o['price']) && is_numeric($o['price']) ? (float)$o['price'] : 0.0,
          'is_buy_order' => !empty($o['is_buy_order']) ? 1 : 0,
          'issued' => !empty($o['issued']) && is_string($o['issued']) ? $o['issued'] : null,
          'state' => isset($o['state']) && is_string($o['state']) ? $o['state'] : (string)($o['status'] ?? ''),
        ];
      }

      if ($historyRecords) {
        $h = sync_core_upsert($db, 'market_order_history', [
          'order_id','corporation_id','type_id','region_id','location_id','volume_total',
          'price','is_buy_order','issued','state'
        ], [
          'order_id'=>'i','corporation_id'=>'i','type_id'=>'i','region_id'=>'i','location_id'=>'i',
          'volume_total'=>'i','price'=>'d','is_buy_order'=>'i','issued'=>'s','state'=>'s'
        ], $historyRecords);
        $summary['inserted'] += $h['inserted'];
        $summary['updated']  += $h['updated'];
        $summary['failed']   += $h['failed'];
      }
      break;
    }

    case 'wallets': {
      // Division balances. /corporations/{id}/divisions/ returns an object with
      // two arrays, "hangar" and "wallet", each element {division: int, name}.
      // Only the wallet division names are custom; hangar ones stay default.
      $numToName = [];
      list($divInfo, $_diErr) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/divisions' . SYNC_CORE_DS, 1);
      if (is_array($divInfo)) {
        foreach ((array)$divInfo as $bucket => $items) { // hangar / wallet buckets
          if (!in_array((string)$bucket, ['hangar', 'wallet'], true) || !is_array($items)) continue;
          foreach ($items as $d) {
            if (is_array($d) && isset($d['division']) && is_numeric($d['division'])) {
              $num = (int)$d['division'];
              $name = trim((string)($d['name'] ?? ''));
              if ($num > 0 && $bucket === 'wallet' && $name !== '') $numToName[$num] = $name;
            }
          }
        }
      }

      // /corporations/{id}/wallets returns an array of {balance, division}.
      list($divisions, $err) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/wallets' . SYNC_CORE_DS, 1);
      if ($err) throw new Exception($err['message'], (int)$err['status']);

      $divRecords = [];
      foreach ((array)$divisions as $d) {
        if (!is_array($d)) continue;
        $numKey = isset($d['division']) && is_numeric($d['division']) ? (int)$d['division'] : null;
        if ($numKey === null || $numKey <= 0) continue;
        $divRecords[] = [
          'corporation_id' => $corpId,
          'division_id' => $numKey,
          'division_name' => isset($numToName[$numKey]) ? $numToName[$numKey] : null,
          'balance' => (float)($d['balance'] ?? 0),
        ];
      }
      if ($divRecords) {
        @$db->query('DELETE FROM wallet_divisions WHERE corporation_id=' . (int)$corpId);
        $summary = sync_core_upsert($db, 'wallet_divisions', [
          'corporation_id','division_id','division_name','balance'
        ], [
          'corporation_id'=>'i','division_id'=>'i','division_name'=>'s','balance'=>'d'
        ], $divRecords);
      }

      // Transactions per wallet division, capped to the last 30 days.
      $since = date('Y-m-d', time() - 30 * 86400);
      foreach ([1, 2, 3, 4, 5, 6] as $divNum) {
        list($rawTx, $txErr) = $esiFetch(
          SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/wallets/' . $divNum . '/transactions?from=' . rawurlencode($since) . SYNC_CORE_DS, 50);
        if ($txErr || !is_array($rawTx)) continue; // one division failing does not sink the segment

        $txRecords = [];
        foreach ((array)$rawTx as $t) {
          if (!is_array($t)) continue;
          $transactionId = isset($t['transaction_id']) ? (int)$t['transaction_id'] : 0;
          if ($transactionId <= 0 || !isset($t['date'])) continue;
          $txRecords[] = [
            'transaction_id' => $transactionId,
            'corporation_id' => $corpId,
            'division' => $divNum,
            'client_id' => isset($t['client_id']) && (int)$t['client_id'] > 0 ? (int)$t['client_id'] : null,
            'date' => (string)$t['date'],
            'is_buy' => !empty($t['is_buy']) ? 1 : 0,
            'journal_ref_id' => isset($t['journal_ref_id']) && is_numeric($t['journal_ref_id']) ? (int)$t['journal_ref_id'] : null,
            'location_id' => isset($t['location_id']) && (int)$t['location_id'] > 0 ? (int)$t['location_id'] : null,
            'quantity' => (int)($t['quantity'] ?? 0),
            'type_id' => (int)($t['type_id'] ?? 0),
            'unit_price' => (float)($t['unit_price'] ?? 0),
          ];
        }
        if ($txRecords) {
          $s = sync_core_upsert($db, 'wallet_transactions', [
            'transaction_id','corporation_id','division','client_id','date',
            'journal_ref_id','location_id','quantity','type_id','unit_price'
          ], [
            'transaction_id'=>'i','corporation_id'=>'i','division'=>'i','client_id'=>'i','date'=>'s',
            'journal_ref_id'=>'i','location_id'=>'i','quantity'=>'i','type_id'=>'i','unit_price'=>'d'
          ], $txRecords);
          $summary['inserted'] += $s['inserted'];
          $summary['updated']  += $s['updated'];
          $summary['failed']   += $s['failed'];
        }
      }

      // Income records are derived at read time from completed industry jobs +
      // market prices by get-income.php — wallet transactions feed the Wallet page.
      break;
    }

    case 'mining': {
      // Corporate mining: /corporation/{id}/mining/observers lists the pilots
      // (observer_type=character), then each observer's extractions give per-day
      // rows: character_id, date, type_id (ore), quantity, moon_id/structure_id.
      list($observers, $err) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporation/' . $corpId . '/mining/observers' . SYNC_CORE_DS, 10);
      if ($err) throw new Exception($err['message'], (int)$err['status']);

      $charObservers = [];
      foreach ((array)$observers as $o) {
        if (!is_array($o)) continue;
        // ESI shape: rows keyed by observer_id, or objects with observer_type.
        $oid = isset($o['observer_id']) ? (int)$o['observer_id'] : 0;
        $otype = isset($o['observer_type']) ? (string)$o['observer_type'] : '';
        if ($oid <= 0) {
          // Keyed object: the key is the observer id.
          continue;
        }
        if ($otype === '' || mb_strtolower($otype) === 'character') $charObservers[$oid] = true;
      }

      // Also accept the keyed-object variant: {"<observer_id>": {...}}.
      foreach ((array)$observers as $oid => $_o) {
        if (is_numeric($oid)) $charObservers[(int)$oid] = true;
      }

      $fetchedCount = 0;
      $recordsOut = [];
      foreach (array_keys($charObservers) as $observerId) {
        list($raw, $oErr) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporation/' . $corpId . '/mining/observers/' . (int)$observerId . SYNC_CORE_DS, 10);
        if ($oErr || !is_array($raw)) continue;

        foreach ((array)$raw as $row) {
          if (!is_array($row)) continue;
          $characterId = isset($row['character_id']) && (int)$row['character_id'] > 0 ? (int)$row['character_id'] : (int)$observerId;
          $typeId = isset($row['type_id']) ? (int)$row['type_id'] : 0;
          if ($typeId <= 0) continue;

          // ESI rows carry last_updated (ISO datetime); the ledger keys on day.
          $dateIso = null;
          foreach (['last_updated', 'extraction_start_time', 'chunk_arrival_time'] as $k) {
            if (!empty($row[$k]) && is_string($row[$k])) { $dateIso = $row[$k]; break; }
          }

          $recordsOut[] = [
            'corporation_id' => $corpId,
            'character_id' => $characterId,
            'date' => $dateIso !== null ? (new DateTime('@' . strtotime($dateIso)))->format('Y-m-d') : date('Y-m-d'),
            'type_id' => $typeId,
            'quantity' => isset($row['quantity']) ? (int)$row['quantity'] : 0,
            'system_id' => null, // not exposed by the observer endpoint; UI shows "—"
          ];
        }

        $fetchedCount += count((array)$raw);
        usleep(200000); // be polite between observer fetches
      }

      $fetched = $fetchedCount;
      if ($recordsOut) {
        // The observer endpoint exposes no solar system, so the table unique key
        // (which includes solar_system_id) cannot dedupe. Merge manually on
        // (corporation, character, date, type): update quantity when it changed,
        // insert otherwise.
        $ins = @$db->prepare(
          'INSERT INTO mining_ledger (corporation_id, character_id, date, type_id, quantity, solar_system_id)
           VALUES (?, ?, ?, ?, ?, NULL)'
        );
        $sel = @$db->prepare(
          'SELECT id, quantity FROM mining_ledger
           WHERE corporation_id=? AND character_id=? AND date=? AND type_id=? LIMIT 1'
        );
        $upd = @$db->prepare('UPDATE mining_ledger SET quantity=? WHERE id=?');
        if (!$ins || !$sel || !$upd) throw new Exception('DB prepare failed', 500);

        $summary = ['inserted' => 0, 'updated' => 0, 'failed' => 0];
        foreach ($recordsOut as $mo) {
          try {
            $sid = (int)$mo['corporation_id'];
            $cid = (int)$mo['character_id'];
            $day = (string)$mo['date'];
            $tid = (int)$mo['type_id'];
            $qty = (int)$mo['quantity'];

            $sel->bind_param('iiss', $sid, $cid, $day, $tid);
            @$sel->execute();
            $sr = $sel ? $sel->get_result() : null;
            $cur = $sr ? $sr->fetch_assoc() : null;
            if ($cur) {
              if ((int)$cur['quantity'] !== $qty && $upd) {
                $upd->bind_param('ii', $qty, (int)$cur['id']);
                @$upd->execute();
                $summary['updated']++;
              }
              continue; // same data already stored
            }
            $ins->bind_param('iissi', $sid, $cid, $day, $tid, $qty);
            if (!$ins->execute()) { $summary['failed']++; continue; }
            $summary['inserted'] += ($ins->affected_rows === 1) ? 1 : 0;
          } catch (Throwable $e) {
            $summary['failed']++;
          }
        }
        $ins->close(); $sel->close(); $upd->close();

        // Backfill miner names from the members table (best effort, one query).
        try {
          @$db->query(
            "UPDATE mining_ledger ml LEFT JOIN members m ON m.character_id=ml.character_id AND m.corporation_id=ml.corporation_id
             SET ml.character_name=m.character_name
             WHERE ml.corporation_id=" . (int)$corpId . " AND (ml.character_name IS NULL OR ml.character_name='')"
          );
        } catch (Throwable $e) { /* non-fatal */ }
      } else {
        $summary = ['inserted' => 0, 'updated' => 0, 'failed' => 0];
      }
      break;
    }

    case 'killmails': {
      // Corp losses: /killmails/recent returns killmail_id + killmail_hash per row.
      // The detail is public (no token) — fetch each new one and store the rows
      // the read endpoints expect. Cap at 10 pages (~25 kills/page).
      $maxPages = 10;
      list($recent, $err) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/killmails/recent/' . SYNC_CORE_DS, $maxPages);
      if ($err) throw new Exception($err['message'], (int)$err['status']);

      // Skip killmail ids already stored.
      $knownRes = @$db->query('SELECT killmail_id FROM killmails WHERE victim_corporation_id=' . (int)$corpId);
      $known = [];
      if ($knownRes) {
        while ($kr = $knownRes ? $knownRes->fetch_assoc() : false) {
          if (!$kr) break;
          $known[(int)$kr['killmail_id']] = true;
        }
        $knownRes->close();
      }

      $newKills = [];
      foreach ((array)$recent as $km) {
        if (!is_array($km)) continue;
        $kid = isset($km['killmail_id']) ? (int)$km['killmail_id'] : 0;
        $hash = isset($km['killmail_hash']) && is_string($km['killmail_hash']) ? trim((string)$km['killmail_hash']) : '';
        if ($kid <= 0 || $hash === '' || isset($known[$kid])) continue;
        $newKills[] = ['id' => $kid, 'hash' => $hash];
      }

      $fetched = count((array)$recent);
      $summary = ['inserted' => 0, 'updated' => 0, 'failed' => 0];

      foreach ($newKills as $k) {
        // Detail is public — no token needed (roxlukas/lmeve does the same).
        list($body, $code, , ) = sync_core_get_one(
          SYNC_CORE_ESI_BASE . '/killmails/' . $k['id'] . '/' . rawurlencode($k['hash']) . SYNC_CORE_DS, '');
        if ($code < 200 || $code >= 300) continue; // transient: retried on next run
        $d = json_decode((string)$body, true);
        if (!is_array($d)) continue;

        $victim = isset($d['victim']) && is_array($d['victim']) ? $d['victim'] : [];
        $attackers = isset($d['attackers']) && is_array($d['attackers']) ? $d['attackers'] : [];

        // Final blow: first attacker with final_blow=true, else the last one.
        $finalBlowCharId = 0;
        foreach ($attackers as $a) {
          if (is_array($a) && !empty($a['final_blow'])) {
            $finalBlowCharId = isset($a['character_id']) ? (int)$a['character_id'] : 0;
            break;
          }
        }
        if ($finalBlowCharId === 0 && count($attackers) > 0) {
          $lastA = end($attackers);
          if (is_array($lastA)) $finalBlowCharId = isset($lastA['character_id']) ? (int)$lastA['character_id'] : 0;
        }

        $stmt = @$db->prepare(
          'INSERT INTO killmails (killmail_id, killmail_hash, solar_system_id, killmail_time, victim_character_id,
                                   victim_corporation_id, victim_ship_type_id, victim_damage_taken,
                                   final_blow_character_id, attacker_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE victim_character_id=VALUES(victim_character_id),
                                   victim_corporation_id=VALUES(victim_corporation_id),
                                   victim_ship_type_id=VALUES(victim_ship_type_id),
                                   victim_damage_taken=VALUES(victim_damage_taken),
                                   final_blow_character_id=VALUES(final_blow_character_id),
                                   attacker_count=VALUES(attacker_count)'
        );
        if (!$stmt) { $summary['failed']++; continue; }
        try {
          $systemId = isset($d['solar_system_id']) && (int)$d['solar_system_id'] > 0 ? (int)$d['solar_system_id'] : null;
          $killTime = !empty($d['killmail_time']) ? (string)$d['killmail_time'] : null;
          $victimCharId = isset($victim['character_id']) && (int)$victim['character_id'] > 0 ? (int)$victim['character_id'] : null;
          $victimCorpId = isset($victim['corporation_id']) && (int)$victim['corporation_id'] > 0 ? (int)$victim['corporation_id'] : null;
          $shipTypeId = isset($victim['ship_type_id']) && (int)$victim['ship_type_id'] > 0 ? (int)$victim['ship_type_id'] : null;
          $damageTaken = isset($victim['damage_taken']) && is_numeric($victim['damage_taken']) ? (int)$victim['damage_taken'] : null;

          // ESI exposes no item values, so total_value stays NULL; the page
          // estimates from market prices client-side.
          $stmt->bind_param('isisiiiiii',
            (int)$k['id'], $k['hash'], $systemId, $killTime, $victimCharId, $victimCorpId,
            $shipTypeId, $damageTaken,
            $finalBlowCharId > 0 ? $finalBlowCharId : null, count($attackers));
          if (!$stmt->execute()) { $summary['failed']++; continue; }
          $summary['inserted'] += ($stmt->affected_rows === 1) ? 1 : 0;
        } catch (Throwable $e) {
          $summary['failed']++;
        }

        usleep(250000); // be polite to the public endpoint between details
      }

      // Name resolution (system/ship/character) happens at read time in
      // corp-data.ts via get-names.php + SDE, same as every other page.
      break;
    }

    case 'contracts': {
      list($rawContracts, $err) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/contracts' . SYNC_CORE_DS, 50);
      if ($err) throw new Exception($err['message'], (int)$err['status']);
      $fetched = count((array)$rawContracts);

      // Collect contracts + all items first. Items are inserted in one batch
      // after stale rows for this corp are removed, so re-polls never duplicate
      // and completed contracts' items get pruned cleanly.
      $allItemRecords = [];

      foreach ((array)$rawContracts as $c) {
        if (!is_array($c)) continue;
        $contractId = isset($c['contract_id']) ? (int)$c['contract_id'] : 0;
        if ($contractId <= 0) continue;

        // Contract items (paginated). Non-fatal if they fail.
        list($rawItems, $iErr) = $esiFetch(
          SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/contracts/' . $contractId . '/items' . SYNC_CORE_DS, 20);
        if (!$iErr) {
          foreach ((array)$rawItems as $it) {
            if (!is_array($it)) continue;
            $recordId = isset($it['record_id']) ? (int)$it['record_id'] : 0;
            if ($recordId <= 0) continue;
            // Sign encodes direction: included (provided) = +qty, requested = -qty.
            $allItemRecords[] = [
              'contract_id' => $contractId,
              'record_id' => $recordId,
              'type_id' => isset($it['type_id']) ? (int)$it['type_id'] : 0,
              'quantity' => !empty($it['is_included'])
                ? (isset($it['raw_quantity']) ? (int)$it['raw_quantity'] : 1)
                : (isset($it['raw_quantity']) ? -(int)$it['raw_quantity'] : -1),
              'is_singleton' => !empty($it['is_singleton']) ? 1 : 0,
            ];
          }
        }

        $records[] = [
          'contract_id' => $contractId,
          'corporation_id' => $corpId,
          'issuer_id' => isset($c['issuer_id']) ? (int)$c['issuer_id'] : 0,
          'assignee_id' => isset($c['assignee_id']) && is_numeric($c['assignee_id']) && (int)$c['assignee_id'] > 0 ? (int)$c['assignee_id'] : null,
          'acceptor_id' => isset($c['acceptor_id']) && is_numeric($c['acceptor_id']) && (int)$c['acceptor_id'] > 0 ? (int)$c['acceptor_id'] : null,
          'type' => (string)($c['contract_type'] ?? $c['type'] ?? ''),
          'status' => (string)($c['status'] ?? ''),
          'title' => isset($c['title']) && trim((string)$c['title']) !== '' ? (string)$c['title'] : null,
          'for_corporation' => !empty($c['for_corporation']) ? 1 : 0,
          'availability' => isset($c['availability']) ? (string)$c['availability'] : null,
          'date_issued' => !empty($c['date_issued']) ? (string)$c['date_issued'] : null,
          'date_expired' => !empty($c['date_expired']) ? (string)$c['date_expired']
            : (!empty($c['date_expires']) ? (string)$c['date_expires'] : null),
          'date_accepted' => isset($c['date_accepted']) && is_string($c['date_accepted']) && $c['date_accepted'] !== '' ? (string)$c['date_accepted'] : null,
          'date_completed' => isset($c['date_completed']) && is_string($c['date_completed']) && $c['date_completed'] !== '' ? (string)$c['date_completed'] : null,
          'price' => isset($c['price']) && is_numeric($c['price']) ? (float)$c['price'] : null,
          'reward' => isset($c['reward']) && is_numeric($c['reward']) ? (float)$c['reward'] : null,
          'collateral' => isset($c['collateral']) && is_numeric($c['collateral']) ? (float)$c['collateral'] : null,
        ];

      }

      // Replace this corp's item rows wholesale (re-fetched in full every run).
      // Scoped to this corp so we never touch other corporations' rows.
      $del = @$db->prepare(
        'DELETE ci FROM contract_items ci JOIN contracts ct ON ct.contract_id=ci.contract_id WHERE ct.corporation_id=?'
      );
      if ($del) {
        $cidDel = $corpId;
        $del->bind_param('i', $cidDel);
        @$del->execute();
        $del->close();
      }

      if ($allItemRecords) {
        $s = sync_core_upsert($db, 'contract_items', [
          'contract_id','record_id','type_id','quantity','is_singleton'
        ], [
          'contract_id'=>'i','record_id'=>'i','type_id'=>'i','quantity'=>'i','is_singleton'=>'i'
        ], $allItemRecords);
        $summary['inserted'] += $s['inserted'];
        $summary['updated']  += $s['updated'];
        $summary['failed']   += $s['failed'];
      }

      if ($records) {
        $s = sync_core_upsert($db, 'contracts', [
          'contract_id','corporation_id','issuer_id','assignee_id','acceptor_id','type','status','title',
          'for_corporation','availability','date_issued','date_expired','date_accepted',
          'date_completed','price','reward','collateral'
        ], [
          'contract_id'=>'i','corporation_id'=>'i','issuer_id'=>'i','assignee_id'=>'i','acceptor_id'=>'i',
          'type'=>'s','status'=>'s','title'=>'s','for_corporation'=>'i','availability'=>'s','date_issued'=>'s',
          'date_expired'=>'s','date_accepted'=>'s','date_completed'=>'s','price'=>'d','reward'=>'d','collateral'=>'d'
        ], $records);
        $summary['inserted'] += $s['inserted'];
        $summary['updated']  += $s['updated'];
        $summary['failed']   += $s['failed'];
      } else {
        $summary = ['inserted' => 0, 'updated' => 0, 'failed' => 0];
      }
      break;
    }

    case 'structures': {
      list($rawStructures, $err) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/structures' . SYNC_CORE_DS, 50);
      if ($err) throw new Exception($err['message'], (int)$err['status']);

      foreach ((array)$rawStructures as $s) {
        if (!is_array($s)) continue;
        $structureId = isset($s['structure_id']) ? (int)$s['structure_id'] : 0;
        if ($structureId <= 0) continue;
        $records[] = [
          'structure_id' => $structureId,
          'corporation_id' => $corpId,
          'type_id' => isset($s['type_id']) ? (int)$s['type_id'] : 0,
          'system_id' => isset($s['system_id']) ? (int)$s['system_id'] : null,
          'status' => isset($s['state']) && is_string($s['state']) ? $s['state'] : null,
          'name' => isset($s['name']) && trim((string)$s['name']) !== '' ? (string)$s['name'] : null,
        ];
      }

      // Container access logs ride along with the same auth domain.
      $logRecords = [];
      list($rawLogs, $_logErr) = $esiFetch(SYNC_CORE_ESI_BASE . '/corporations/' . $corpId . '/containers/logs' . SYNC_CORE_DS, 10);
      foreach ((array)$rawLogs as $lg) {
        if (!is_array($lg)) continue;
        $containerId = isset($lg['container_id']) ? (int)$lg['container_id'] : 0;
        if ($containerId <= 0 || !isset($lg['logged_at'])) continue;
        $logRecords[] = [
          'corporation_id' => $corpId,
          'logged_at' => (string)$lg['logged_at'],
          'character_id' => isset($lg['character_id']) ? (int)$lg['character_id'] : 0,
          'container_id' => $containerId,
          'container_type_id' => isset($lg['container_type_id']) ? (int)$lg['container_type_id'] : 0,
          'action' => isset($lg['action']) && is_string($lg['action']) ? $lg['action'] : '',
          'location_id' => isset($lg['location_id']) ? (int)$lg['location_id'] : 0,
          'type_id' => isset($lg['type_id']) ? (int)$lg['type_id'] : 0,
          'quantity' => isset($lg['quantity']) && is_numeric($lg['quantity']) ? (int)$lg['quantity'] : 0,
        ];
      }

      $fetched = count($records) + (isset($logRecords) ? count((array)$logRecords) : 0);
      if ($records) {
        $s = sync_core_upsert($db, 'structures', [
          'structure_id','corporation_id','type_id','system_id','status','name'
        ], [
          'structure_id'=>'i','corporation_id'=>'i','type_id'=>'i','system_id'=>'i','status'=>'s','name'=>'s'
        ], $records);
        $summary['inserted'] += $s['inserted'];
        $summary['updated']  += $s['updated'];
        $summary['failed']   += $s['failed'];
      } else {
        $summary = ['inserted' => 0, 'updated' => 0, 'failed' => 0];
      }
      if (isset($logRecords) && count($logRecords)) {
        // container_logs has no unique key; keep the most recent per (container, character).
        $ls = sync_core_upsert_container_logs($db, $corpId, $logRecords);
        $summary['inserted'] += $ls['inserted'];
        $summary['updated']  += $ls['updated'];
      }
      break;
    }

    case 'pricing': {
      // Public market prices — no token needed.
      list($rawPrices, $err) = sync_core_get_all(SYNC_CORE_ESI_BASE . '/markets/prices' . SYNC_CORE_DS, '');
      if ($err) throw new Exception($err['message'], (int)$err['status']);

      foreach ((array)$rawPrices as $p) {
        if (!is_array($p)) continue;
        $typeId = isset($p['type_id']) ? (int)$p['type_id'] : 0;
        if ($typeId <= 0) continue;
        $records[] = [
          'type_id' => $typeId,
          'adjusted_price' => isset($p['adjusted_price']) && is_numeric($p['adjusted_price']) ? (float)$p['adjusted_price'] : null,
          'average_price' => isset($p['average_price']) && is_numeric($p['average_price']) ? (float)$p['average_price'] : null,
        ];
      }

      $fetched = count($records);
      if ($records) {
        sync_core_upsert($db, 'market_prices', [
          'type_id','adjusted_price','average_price'
        ], [
          'type_id'=>'i','adjusted_price'=>'d','average_price'=>'d'
        ], $records);
      } else {
        $summary = ['inserted' => 0, 'updated' => 0, 'failed' => 0];
      }
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

  // Public segments (pricing) do not verify the token's scopes.
  $requiredScope = sync_core_segment_scopes()[$segment];
  if ($requiredScope !== null) {
    $scopeList = preg_split('/\s+/', trim((string)($tokenRow['scopes'] ?? ''))) ?: [];
    if (count($scopeList) > 0 && !in_array($requiredScope, $scopeList, true)) {
      throw new Exception('Corp token is missing scope ' . $requiredScope . '. Re-run Corp ESI consent with full scopes.', 403);
    }
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

// ---------------------------------------------------------------------------
// Segment helpers
// ---------------------------------------------------------------------------

/**
 * Upsert container access logs, keeping only the newest entry per
 * (container_id, character_id). The ESI endpoint returns a rolling window, so
 * every poll re-sees recent rows — dedupe before insert. Never throws.
 */
function sync_core_upsert_container_logs(mysqli $db, int $corpId, array $logRecords): array {
  // Keep the latest per (container_id, character_id).
  $latest = [];
  foreach ($logRecords as $lg) {
    if (!is_array($lg)) continue;
    $key = ((int)($lg['container_id'] ?? 0)) . ':' . ((int)($lg['character_id'] ?? 0));
    $when = (string)($lg['logged_at'] ?? '');
    $cur = isset($latest[$key]) ? $latest[$key] : null;
    if ($cur === null || strcmp($when, (string)$cur['_when']) > 0) {
      $lg['_when'] = $when;
      $latest[$key] = $lg;
    }
  }

  // Drop stale rows for this corp that the current window no longer reports.
  try {
    @$db->query('DELETE FROM container_logs WHERE corporation_id=' . (int)$corpId);
  } catch (Throwable $e) { /* non-fatal */ }

  $inserted = 0; $updated = 0; $failed = 0;
  $stmt = @$db->prepare(
    'INSERT INTO container_logs (corporation_id, logged_at, character_id, container_id, container_type_id, action, location_id, type_id, quantity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  if (!$stmt) return ['inserted' => 0, 'updated' => 0, 'failed' => count($latest)];

  foreach ($latest as $lg) {
    try {
      $stmt->bind_param('ississsii',
        (int)$corpId,
        (string)($lg['logged_at'] ?? '') !== '' ? (string)$lg['logged_at'] : date('Y-m-d H:i:s'),
        (int)($lg['character_id'] ?? 0),
        (int)($lg['container_id'] ?? 0),
        (int)($lg['container_type_id'] ?? 0),
        (string)($lg['action'] ?? ''),
        (int)($lg['location_id'] ?? 0),
        (int)($lg['type_id'] ?? 0),
        isset($lg['quantity']) && is_numeric($lg['quantity']) ? (int)$lg['quantity'] : 0
      );
      if (!$stmt->execute()) { $failed++; continue; }
      $inserted++;
    } catch (Throwable $e) { $failed++; }
  }
  $stmt->close();
  return ['inserted' => $inserted, 'updated' => $updated, 'failed' => $failed];
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
  } catch (Throwable $e) {
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
