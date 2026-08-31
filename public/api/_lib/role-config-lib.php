<?php
// Role & permission-mapping library.
// Server-side source of truth for: site roles as data (per-corp + global built-ins)
// and EVE role / corp title -> site-role mapping rules. Used by the three
// role-config endpoints. PHP 7.4 compatible (no match / str_contains / nullsafe).

require_once __DIR__ . '/common.php';

/** The 17 permission flags, in stable order (must mirror src/lib/types.ts RolePermissions). */
function role_config_permission_keys(): array {
  return [
    // System
    'canManageSystem', 'canManageMultipleCorps', 'canConfigureESI', 'canManageDatabase',
    // Corporation
    'canManageCorp', 'canManageUsers', 'canViewFinancials',
    'canManageManufacturing', 'canManageMining', 'canManageAssets',
    'canManageMarket', 'canViewKillmails', 'canManageIncome',
    // Data
    'canViewAllMembers', 'canEditAllData', 'canExportData', 'canDeleteData',
  ];
}

/** Canonical permission sets for the six built-in roles (seed + super_admin lock source of truth). */
function role_config_builtin_permissions(): array {
  $t = true; $f = false;
  return [
    'super_admin'   => ['canManageSystem'=>$t,'canManageMultipleCorps'=>$t,'canConfigureESI'=>$t,'canManageDatabase'=>$t,
      'canManageCorp'=>$t,'canManageUsers'=>$t,'canViewFinancials'=>$t,'canManageManufacturing'=>$t,'canManageMining'=>$t,
      'canManageAssets'=>$t,'canManageMarket'=>$t,'canViewKillmails'=>$t,'canManageIncome'=>$t,
      'canViewAllMembers'=>$t,'canEditAllData'=>$t,'canExportData'=>$t,'canDeleteData'=>$t],
    'corp_admin'    => ['canManageSystem'=>$t,'canManageMultipleCorps'=>$f,'canConfigureESI'=>$t,'canManageDatabase'=>$t,
      'canManageCorp'=>$t,'canManageUsers'=>$t,'canViewFinancials'=>$t,'canManageManufacturing'=>$t,'canManageMining'=>$t,
      'canManageAssets'=>$t,'canManageMarket'=>$t,'canViewKillmails'=>$t,'canManageIncome'=>$t,
      'canViewAllMembers'=>$t,'canEditAllData'=>$t,'canExportData'=>$t,'canDeleteData'=>$f],
    'corp_director' => ['canManageSystem'=>$f,'canManageMultipleCorps'=>$f,'canConfigureESI'=>$f,'canManageDatabase'=>$f,
      'canManageCorp'=>$f,'canManageUsers'=>$f,'canViewFinancials'=>$t,'canManageManufacturing'=>$t,'canManageMining'=>$t,
      'canManageAssets'=>$t,'canManageMarket'=>$t,'canViewKillmails'=>$t,'canManageIncome'=>$t,
      'canViewAllMembers'=>$t,'canEditAllData'=>$t,'canExportData'=>$t,'canDeleteData'=>$f],
    'corp_manager'  => ['canManageSystem'=>$f,'canManageMultipleCorps'=>$f,'canConfigureESI'=>$f,'canManageDatabase'=>$f,
      'canManageCorp'=>$f,'canManageUsers'=>$f,'canViewFinancials'=>$f,'canManageManufacturing'=>$t,'canManageMining'=>$t,
      'canManageAssets'=>$f,'canManageMarket'=>$t,'canViewKillmails'=>$t,'canManageIncome'=>$f,
      'canViewAllMembers'=>$t,'canEditAllData'=>$f,'canExportData'=>$f,'canDeleteData'=>$f],
    'corp_member'   => ['canManageSystem'=>$f,'canManageMultipleCorps'=>$f,'canConfigureESI'=>$f,'canManageDatabase'=>$f,
      'canManageCorp'=>$f,'canManageUsers'=>$f,'canViewFinancials'=>$f,'canManageManufacturing'=>$f,'canManageMining'=>$f,
      'canManageAssets'=>$f,'canManageMarket'=>$f,'canViewKillmails'=>$t,'canManageIncome'=>$f,
      'canViewAllMembers'=>$f,'canEditAllData'=>$f,'canExportData'=>$f,'canDeleteData'=>$f],
    'guest'         => ['canManageSystem'=>$f,'canManageMultipleCorps'=>$f,'canConfigureESI'=>$f,'canManageDatabase'=>$f,
      'canManageCorp'=>$f,'canManageUsers'=>$f,'canViewFinancials'=>$f,'canManageManufacturing'=>$f,'canManageMining'=>$f,
      'canManageAssets'=>$f,'canManageMarket'=>$f,'canViewKillmails'=>$f,'canManageIncome'=>$f,
      'canViewAllMembers'=>$f,'canEditAllData'=>$f,'canExportData'=>$f,'canDeleteData'=>$f],
  ];
}

/** Display labels for built-in role keys. */
function role_config_builtin_names(): array {
  return [
    'super_admin' => 'Super Admin', 'corp_admin' => 'Corp Admin',
    'corp_director' => 'Director', 'corp_manager' => 'Manager',
    'corp_member' => 'Member', 'guest' => 'Guest',
  ];
}

/** Fixed privilege ladder used for deterministic tie-breaks (lower index = lower privilege). */
function role_config_role_ladder(): array {
  return ['guest', 'corp_member', 'corp_manager', 'corp_director', 'corp_admin'];
}

/** Self-healing schema + built-in seed. Safe to call on every request. */
function role_config_ensure_schema(mysqli $db): void {
  static $done = false;
  if ($done) return;

  @$db->query(
    "CREATE TABLE IF NOT EXISTS `role_definitions` (
       `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
       `corporation_id` BIGINT NULL,
       `key` VARCHAR(64) NOT NULL,
       `name` VARCHAR(100) NOT NULL,
       `permissions_json` JSON NOT NULL,
       `is_builtin` TINYINT(1) NOT NULL DEFAULT 0,
       `created_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       `updated_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       UNIQUE KEY `uk_corp_key` (`corporation_id`, `key`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );

  @$db->query(
    "CREATE TABLE IF NOT EXISTS `permission_mappings` (
       `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
       `corporation_id` BIGINT NULL,
       `kind` ENUM('eve_role','title') NOT NULL,
       `source_name` VARCHAR(150) NOT NULL,
       `site_role_key` VARCHAR(64) NOT NULL DEFAULT 'corp_member',
       `priority` INT NOT NULL DEFAULT 0,
       `updated_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       UNIQUE KEY `uk_corp_kind_source` (`corporation_id`, `kind`, `source_name`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );

  // Seed global built-ins. corporation_id NULL = shared by all corps.
  // MySQL UNIQUE treats NULLs as distinct, so INSERT IGNORE would duplicate on every
  // process start — check existing global keys first and only insert the missing ones.
  $existingKeys = [];
  $chkRes = @$db->query('SELECT `key` FROM role_definitions WHERE corporation_id IS NULL');
  if ($chkRes) {
    while ($r = $chkRes->fetch_assoc()) {
      if (!$r) break;
      $existingKeys[(string)$r['key']] = true;
    }
    $chkRes->close();
  }

  $stmt = @$db->prepare(
    'INSERT INTO role_definitions (corporation_id, `key`, name, permissions_json, is_builtin)
     VALUES (NULL, ?, ?, CAST(? AS JSON), 1)'
  );
  if ($stmt) {
    foreach (role_config_builtin_permissions() as $k => $perms) {
      if (isset($existingKeys[$k])) continue;
      $name = isset(role_config_builtin_names()[$k]) ? role_config_builtin_names()[$k] : $k;
      $json = json_encode($perms);
      $stmt->bind_param('sss', $k, $name, $json);
      @$stmt->execute();
    }
    $stmt->close();
  }

  // Self-heal: collapse any pre-existing duplicate global rows (keep the lowest id per key).
  $dupRes = @$db->query(
    'SELECT `key`, MIN(id) AS keep_id, COUNT(*) AS c FROM role_definitions WHERE corporation_id IS NULL GROUP BY `key` HAVING COUNT(*) > 1'
  );
  if ($dupRes) {
    while ($r = $dupRes->fetch_assoc()) {
      if (!$r) break;
      $keepId = (int)$r['keep_id'];
      $kDel = (string)$r['key'];
      $del = @$db->prepare('DELETE FROM role_definitions WHERE corporation_id IS NULL AND `key`=? AND id<>?');
      if ($del) {
        $del->bind_param('si', $kDel, $keepId);
        @$del->execute();
        $del->close();
      }
    }
    $dupRes->free();
  }

  $done = true;
}

/** Normalize a stored permission JSON blob into a full flag map (missing => false). */
function role_config_normalize_permissions(array $raw): array {
  $out = [];
  foreach (role_config_permission_keys() as $k) { $out[$k] = false; }
  if (is_array($raw)) {
    foreach ($raw as $k => $v) {
      if (isset($out[$k])) { $out[$k] = (bool)$v; }
    }
  }
  return $out;
}

/** Effective permissions for a role key: super_admin is always forced to full true (escape hatch). */
function role_config_effective_permissions(string $key, array $stored): array {
  if ($key === 'super_admin') {
    $full = [];
    foreach (role_config_permission_keys() as $k) { $full[$k] = true; }
    return $full;
  }
  return role_config_normalize_permissions($stored);
}

/**
 * Attach the resolved permission set for a role key onto a public user payload.
 * No-op when the key is a built-in (client falls back to its static table) or corp unknown.
 */
function role_config_attach_permissions(mysqli $db, ?int $corpId, string $roleKey, array &$user): void {
  if ($corpId === null || $corpId <= 0) return;
  if (!preg_match('/^[a-z0-9_\-]{2,64}$/', (string)$roleKey)) return;
  try {
    foreach (role_config_load_roles($db, $corpId) as $r) {
      if (($r['key'] ?? '') === (string)$roleKey) {
        $user['role_permissions'] = $r['permissions'];
        $user['role_label'] = (string)($r['name'] ?? $roleKey);
        return;
      }
    }
  } catch (\Throwable $e) { /* DB mapping unavailable — client falls back to built-in table */ }
}

/**
 * Load the effective role set for a corporation: global built-ins/custom roles merged with any
 * corp-specific overrides (same key, corp row wins). Returns list of
 * [key,name,is_builtin,permissions] sorted by privilege ladder then name.
 */
function role_config_load_roles(mysqli $db, int $corpId): array {
  role_config_ensure_schema($db);

  // Global rows first.
  $g = @$db->query('SELECT `key`, name, permissions_json, is_builtin FROM role_definitions WHERE corporation_id IS NULL');
  $byKey = [];
  if ($g) {
    while ($row = $g->fetch_assoc()) {
      if (!$row) break;
      $k = (string)$row['key'];
      $permsRaw = json_decode((string)$row['permissions_json'], true);
      $byKey[$k] = [
        'key' => $k,
        'name' => (string)$row['name'],
        'is_builtin' => (int)(int)$row['is_builtin'] === 1,
        'corporation_id' => null,
        'permissions' => role_config_effective_permissions($k, is_array($permsRaw) ? $permsRaw : []),
      ];
    }
    $g->close();
  }

  // Corp-specific rows override / extend.
  if ($corpId > 0) {
    $stmt = @$db->prepare('SELECT `key`, name, permissions_json, is_builtin FROM role_definitions WHERE corporation_id=?');
    if ($stmt) {
      $stmt->bind_param('i', $corpId);
      @$stmt->execute();
      $res = $stmt ? $stmt->get_result() : null;
      while ($row = $res ? $res->fetch_assoc() : false) {
        if (!$row) break;
        $k = (string)$row['key'];
        $permsRaw = json_decode((string)$row['permissions_json'], true);
        // If a global row exists with same key, the corp row is an override of it.
        $base = isset($byKey[$k]) ? $byKey[$k] : null;
        $isBuiltin = (int)(int)$row['is_builtin'] === 1;
        if ($base !== null) {
          // Override: keep builtin flag from global, take corp name/perms.
          $byKey[$k] = [
            'key' => $k,
            'name' => (string)$row['name'],
            'is_builtin' => $base['is_builtin'] || $isBuiltin,
            'corporation_id' => null, // merged into the global slot
            'permissions' => role_config_effective_permissions($k, is_array($permsRaw) ? $permsRaw : []),
          ];
        } else {
          $byKey[$k] = [
            'key' => $k,
            'name' => (string)$row['name'],
            'is_builtin' => $isBuiltin,
            'corporation_id' => $corpId,
            'permissions' => role_config_effective_permissions($k, is_array($permsRaw) ? $permsRaw : []),
          ];
        }
      }
      if ($res) { $res->free(); }
      $stmt->close();
    }
  }

  $list = array_values($byKey);
  // Sort: privilege ladder (super_admin first, then by ladder index desc), then name.
  usort($list, function ($a, $b) {
    if ($a['key'] === 'super_admin' && $b['key'] !== 'super_admin') return -1;
    if ($b['key'] === 'super_admin' && $a['key'] !== 'super_admin') return 1;
    $ladder = array_flip(role_config_role_ladder()); // guest=0 ... corp_admin=4
    $ra = isset($ladder[$a['key']]) ? $ladder[$a['key']] : -2;
    $rb = isset($ladder[$b['key']]) ? $ladder[$b['key']] : -1; // custom roles sort above builtins, below super_admin
    if ($ra !== $rb) return $rb <=> $ra; // higher privilege first
    return strcmp((string)$a['name'], (string)$b['name']);
  });

  return $list;
}

/** Load mapping rules for a corp: corp-specific rows merged over global fallback per (kind, source_name). */
function role_config_load_mappings(mysqli $db, int $corpId): array {
  role_config_ensure_schema($db);
  // Global.
  $g = @$db->query(
    "SELECT kind, source_name, site_role_key, priority FROM permission_mappings WHERE corporation_id IS NULL ORDER BY id"
  );
  $byRule = [];
  if ($g) {
    while ($row = $g->fetch_assoc()) {
      if (!$row) break;
      $rkey = strtolower((string)$row['kind']) . '|' . strtolower((string)$row['source_name']);
      $byRule[$rkey] = [
        'corporation_id' => null,
        'kind' => (string)$row['kind'],
        'sourceName' => (string)$row['source_name'],
        'siteRoleKey' => (string)$row['site_role_key'],
        'priority' => (int)$row['priority'],
      ];
    }
    $g->close();
  }

  if ($corpId > 0) {
    $stmt = @$db->prepare(
      'SELECT kind, source_name, site_role_key, priority FROM permission_mappings WHERE corporation_id=? ORDER BY id'
    );
    if ($stmt) {
      $stmt->bind_param('i', $corpId);
      @$stmt->execute();
      $res = $stmt ? $stmt->get_result() : null;
      while ($row = $res ? $res->fetch_assoc() : false) {
        if (!$row) break;
        $rkey = strtolower((string)$row['kind']) . '|' . strtolower((string)$row['source_name']);
        // Corp row is the effective rule for that (kind, source); global is only a fallback when corp has none.
        $byRule[$rkey] = [
          'corporation_id' => $corpId,
          'kind' => (string)$row['kind'],
          'sourceName' => (string)$row['source_name'],
          'siteRoleKey' => (string)$row['site_role_key'],
          'priority' => (int)$row['priority'],
        ];
      }
      if ($res) { $res->free(); }
      $stmt->close();
    }
  }

  return array_values($byRule);
}

/**
 * Resolve the best site role for a character given its EVE roles and corp titles.
 * Returns [ 'roleKey' => string, 'matched' => [rule...] , 'reason' => string ].
 * Default (no match) is 'corp_member'. super_admin is never returned here (only via CEO/override).
 */
function role_config_resolve(mysqli $db, int $corpId, array $eveRoles, array $titles): array {
  $rules = role_config_load_mappings($db, $corpId);

  // Index character sources by kind.
  $roleSet = [];
  foreach ($eveRoles as $r) { $roleSet[strtolower((string)$r)] = true; }
  $titleSet = [];
  foreach ($titles as $t) { $titleSet[strtolower((string)$t)] = true; }

  $candidates = [];
  foreach ($rules as $rule) {
    $src = strtolower($rule['sourceName']);
    if ($src === '') continue;
    $matchedSource = false;
    if (strtolower($rule['kind']) === 'eve_role' && isset($roleSet[$src])) { $matchedSource = true; }
    elseif (strtolower($rule['kind']) === 'title' && isset($titleSet[$src])) { $matchedSource = true; }
    if (!$matchedSource) continue;

    // Specificity: corp-specific rule beats global for the same source.
    $specificity = ($rule['corporation_id'] !== null) ? 1 : 0;
    $candidates[] = [
      'roleKey' => (string)$rule['siteRoleKey'],
      'priority' => (int)$rule['priority'],
      'specificity' => $specificity,
      'matched' => $rule,
    ];
  }

  if (count($candidates) === 0) {
    return ['roleKey' => 'corp_member', 'matched' => [], 'reason' => 'no_mapping_match'];
  }

  // Rank: specificity desc, priority desc, then privilege ladder of the resolved role asc-to-desc.
  $ladder = array_flip(role_config_role_ladder());
  usort($candidates, function ($a, $b) use ($ladder) {
    if ($a['specificity'] !== $b['specificity']) return $b['specificity'] <=> $a['specificity'];
    if ($a['priority'] !== $b['priority']) return $b['priority'] <=> $a['priority'];
    $ra = isset($ladder[$a['roleKey']]) ? $ladder[$a['roleKey']] : -1;
    $rb = isset($ladder[$b['roleKey']]) ? $ladder[$b['roleKey']] : -1;
    return $rb <=> $ra; // higher privilege wins ties
  });

  $best = $candidates[0];
  // Guard: never resolve to super_admin via a mapping.
  $key = ($best['roleKey'] === 'super_admin') ? 'corp_member' : (string)$best['roleKey'];
  return ['roleKey' => $key, 'matched' => [$best['matched']], 'reason' => 'mapping_match'];
}
