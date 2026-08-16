<?php
// Shared ESI identity enrichment + site role derivation for login handoff.
// Used by auth/esi/callback.php and auth/esi/establish.php.

declare(strict_types=1);

/**
 * Minimal HTTP GET helper (JSON body).
 * @return array{0: ?string, 1: int, 2: ?string} [body, httpCode, curlError]
 */
function esi_http_get(string $url, array $headers = []): array {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    if (count($headers) > 0) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }
    $resp = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($resp === false) {
        return [null, $code > 0 ? $code : 0, $err !== '' ? $err : 'request_failed'];
    }
    return [$resp, $code, null];
}

/**
 * Parse scopes from SSO verify string or array into a list.
 * @param mixed $scopes
 * @return string[]
 */
function esi_parse_scopes($scopes): array {
    if (is_array($scopes)) {
        return array_values(array_filter(array_map('strval', $scopes), static function ($s) { return $s !== ''; }));
    }
    if (!is_string($scopes) || trim($scopes) === '') {
        return [];
    }
    return preg_split('/\s+/', trim($scopes)) ?: [];
}

/**
 * Map EVE corporation roles to an LMeve site role.
 * @param string[] $eveRoles
 */
function esi_map_eve_roles_to_site_role(array $eveRoles): string {
    $normalized = array_map(static function ($role) {
        return strtolower(str_replace([' ', '-'], '_', (string)$role));
    }, $eveRoles);

    if (in_array('ceo', $normalized, true) || in_array('chief_executive_officer', $normalized, true)) {
        return 'corp_admin';
    }

    foreach ($normalized as $role) {
        if (
            strpos($role, 'director') !== false
            || $role === 'personnel_manager'
            || $role === 'security_officer'
            || $role === 'communications_officer'
        ) {
            return 'corp_director';
        }
    }

    foreach ($normalized as $role) {
        if (in_array($role, [
            'factory_manager',
            'station_manager',
            'accountant',
            'junior_accountant',
            'trader',
            'config_equipment',
            'config_starbase_equipment',
        ], true) || strpos($role, 'hangar_can_take') === 0 || strpos($role, 'container_can_take') === 0) {
            return 'corp_manager';
        }
    }

    return 'corp_member';
}

/**
 * Rank roles for elevation comparisons (higher = more privilege).
 */
function esi_role_rank(string $role): int {
    $ranks = [
        'super_admin' => 100,
        'corp_admin' => 80,
        'corp_director' => 60,
        'corp_manager' => 40,
        'corp_member' => 20,
        'guest' => 10,
    ];
    return $ranks[$role] ?? 0;
}

/**
 * Pick the higher of two site roles.
 */
function esi_higher_role(string $a, string $b): string {
    return esi_role_rank($a) >= esi_role_rank($b) ? $a : $b;
}

/**
 * Enrich character identity from ESI public + authenticated endpoints.
 *
 * @return array{
 *   corporation_id: int,
 *   corporation_name: ?string,
 *   corporation_ticker: ?string,
 *   alliance_id: ?int,
 *   alliance_name: ?string,
 *   ceo_id: ?int,
 *   member_count: ?int,
 *   eve_roles: string[],
 *   site_role: string
 * }
 */
function esi_enrich_character_identity(int $characterId, string $accessToken, array $grantedScopes = []): array {
    $out = [
        'corporation_id' => 0,
        'corporation_name' => null,
        'corporation_ticker' => null,
        'alliance_id' => null,
        'alliance_name' => null,
        'ceo_id' => null,
        'member_count' => null,
        'eve_roles' => [],
        'site_role' => 'corp_member',
    ];

    $ua = ['User-Agent: LMeve-2'];
    $auth = array_merge($ua, ['Authorization: Bearer ' . $accessToken]);

    // 1) Character public profile → corporation_id (+ alliance sometimes absent here)
    $charUrl = "https://esi.evetech.net/latest/characters/{$characterId}/?datasource=tranquility";
    list($cbody, $ccode) = esi_http_get($charUrl, $ua);
    if ($cbody !== null && $ccode >= 200 && $ccode < 300) {
        $char = json_decode($cbody, true);
        if (is_array($char)) {
            $out['corporation_id'] = (int)($char['corporation_id'] ?? 0);
            if (!empty($char['alliance_id'])) {
                $out['alliance_id'] = (int)$char['alliance_id'];
            }
        }
    }

    $corpId = (int)$out['corporation_id'];
    if ($corpId > 0) {
        // 2) Corporation public profile → name/ticker/ceo/alliance
        $corpUrl = "https://esi.evetech.net/latest/corporations/{$corpId}/?datasource=tranquility";
        list($corpBody, $corpCode) = esi_http_get($corpUrl, $ua);
        if ($corpBody !== null && $corpCode >= 200 && $corpCode < 300) {
            $corp = json_decode($corpBody, true);
            if (is_array($corp)) {
                $out['corporation_name'] = isset($corp['name']) ? (string)$corp['name'] : null;
                $out['corporation_ticker'] = isset($corp['ticker']) ? (string)$corp['ticker'] : null;
                if (!empty($corp['alliance_id'])) {
                    $out['alliance_id'] = (int)$corp['alliance_id'];
                }
                if (!empty($corp['ceo_id'])) {
                    $out['ceo_id'] = (int)$corp['ceo_id'];
                }
                if (isset($corp['member_count'])) {
                    $out['member_count'] = (int)$corp['member_count'];
                }
            }
        }
    }

    // 3) Alliance public name
    $allianceId = $out['alliance_id'] !== null ? (int)$out['alliance_id'] : 0;
    if ($allianceId > 0) {
        $allUrl = "https://esi.evetech.net/latest/alliances/{$allianceId}/?datasource=tranquility";
        list($abody, $acode) = esi_http_get($allUrl, $ua);
        if ($abody !== null && $acode >= 200 && $acode < 300) {
            $all = json_decode($abody, true);
            if (is_array($all) && !empty($all['name'])) {
                $out['alliance_name'] = (string)$all['name'];
            }
        }
    }

    // 4) Character corporation roles (requires scope)
    $hasRolesScope = in_array('esi-characters.read_corporation_roles.v1', $grantedScopes, true);
    if ($hasRolesScope || count($grantedScopes) === 0) {
        // Try anyway when scopes unknown; ESI will 403 if missing.
        $rolesUrl = "https://esi.evetech.net/latest/characters/{$characterId}/roles/?datasource=tranquility";
        list($rbody, $rcode) = esi_http_get($rolesUrl, $auth);
        if ($rbody !== null && $rcode >= 200 && $rcode < 300) {
            $roles = json_decode($rbody, true);
            if (is_array($roles)) {
                $list = [];
                foreach (['roles', 'roles_at_hq', 'roles_at_base', 'roles_at_other'] as $key) {
                    if (!empty($roles[$key]) && is_array($roles[$key])) {
                        foreach ($roles[$key] as $role) {
                            $list[] = (string)$role;
                        }
                    }
                }
                $out['eve_roles'] = array_values(array_unique($list));
            }
        }
    }

    // 5) Site role from EVE roles, with CEO-id fallback from public corp data
    $mapped = esi_map_eve_roles_to_site_role($out['eve_roles']);
    if (
        $mapped === 'corp_member'
        && !empty($out['ceo_id'])
        && (int)$out['ceo_id'] === $characterId
    ) {
        $mapped = 'corp_admin';
    }
    $out['site_role'] = $mapped;

    return $out;
}

/**
 * Resolve final site role for an ESI login.
 *
 * Rules:
 * - Start from EVE-derived role (CEO → corp_admin, etc.)
 * - Never drop an already-elevated DB role on the same character
 * - Admin handoff: if the browser currently has super_admin (local admin),
 *   the character being linked inherits super_admin. That is the bootstrap path.
 *
 * @param array|null $existingSession api_session_user() payload
 * @param string|null $existingDbRole role already stored on the users row (if any)
 */
function esi_resolve_login_role(
    string $eveDerivedRole,
    ?array $existingSession,
    ?string $existingDbRole = null
): string {
    $role = $eveDerivedRole !== '' ? $eveDerivedRole : 'corp_member';

    if (is_string($existingDbRole) && $existingDbRole !== '') {
        $role = esi_higher_role($role, $existingDbRole);
    }

    $sessionRole = is_array($existingSession) ? (string)($existingSession['role'] ?? '') : '';
    if ($sessionRole === 'super_admin') {
        // Explicit admin → character handoff: bootstrap operator keeps full control.
        $role = 'super_admin';
    } elseif ($sessionRole !== '' && esi_role_rank($sessionRole) >= esi_role_rank('corp_admin')) {
        // corp_admin already signed in linking another character keeps at least corp_admin.
        $role = esi_higher_role($role, 'corp_admin');
    }

    return $role;
}

/**
 * Best-effort upsert of a corporations row from public ESI identity.
 * Does not overwrite ESI secrets/scopes if the corp already exists.
 */
function esi_seed_corporation_row(mysqli $db, array $identity, ?int $characterId = null, ?string $characterName = null): void {
    $corpId = (int)($identity['corporation_id'] ?? 0);
    if ($corpId <= 0) {
        return;
    }

    $name = (string)($identity['corporation_name'] ?? ('Corporation ' . $corpId));
    $ticker = (string)($identity['corporation_ticker'] ?? '????');
    if ($ticker === '') {
        $ticker = '????';
    }

    // mysqli bind_param is awkward with SQL NULL ints — use 0 as "unknown" and
    // only write alliance/ceo when we have real positive IDs.
    $allianceId = isset($identity['alliance_id']) && (int)$identity['alliance_id'] > 0
        ? (int)$identity['alliance_id']
        : 0;
    $allianceName = isset($identity['alliance_name']) && $identity['alliance_name'] !== null && $identity['alliance_name'] !== ''
        ? (string)$identity['alliance_name']
        : '';
    $memberCount = isset($identity['member_count']) && $identity['member_count'] !== null
        ? (int)$identity['member_count']
        : 0;
    $ceoId = isset($identity['ceo_id']) && (int)$identity['ceo_id'] > 0
        ? (int)$identity['ceo_id']
        : ($characterId !== null && $characterId > 0 ? (int)$characterId : 0);
    $ceoName = '';
    if ($ceoId > 0 && $characterId !== null && $ceoId === (int)$characterId && is_string($characterName) && $characterName !== '') {
        $ceoName = $characterName;
    }

    $check = @$db->prepare('SELECT id FROM corporations WHERE corporation_id=? LIMIT 1');
    if (!$check) {
        return;
    }
    $check->bind_param('i', $corpId);
    @$check->execute();
    $res = $check->get_result();
    $exists = $res && $res->fetch_assoc();
    $check->close();

    if ($exists) {
        // Refresh public metadata only; never touch secrets/scopes.
        $sql = 'UPDATE corporations SET corporation_name=?, ticker=?, last_update=NOW()';
        $types = 'ss';
        $params = [$name, $ticker];

        if ($allianceId > 0) {
            $sql .= ', alliance_id=?';
            $types .= 'i';
            $params[] = $allianceId;
        }
        if ($allianceName !== '') {
            $sql .= ', alliance_name=?';
            $types .= 's';
            $params[] = $allianceName;
        }
        if ($memberCount > 0) {
            $sql .= ', member_count=?';
            $types .= 'i';
            $params[] = $memberCount;
        }
        if ($ceoId > 0) {
            $sql .= ', ceo_id=?';
            $types .= 'i';
            $params[] = $ceoId;
        }
        if ($ceoName !== '') {
            $sql .= ', ceo_name=?';
            $types .= 's';
            $params[] = $ceoName;
        }
        $sql .= ' WHERE corporation_id=?';
        $types .= 'i';
        $params[] = $corpId;

        $upd = @$db->prepare($sql);
        if (!$upd) {
            return;
        }
        $upd->bind_param($types, ...$params);
        @$upd->execute();
        $upd->close();
        return;
    }

    $ins = @$db->prepare(
        'INSERT INTO corporations (
            corporation_id, corporation_name, ticker, alliance_id, alliance_name,
            member_count, ceo_id, ceo_name, is_active, registration_date
         ) VALUES (?,?,?,?,?,?,?,?,1,NOW())'
    );
    if (!$ins) {
        return;
    }
    // Store 0/'' when unknown; app treats non-positive as empty.
    $ins->bind_param(
        'issisiis',
        $corpId,
        $name,
        $ticker,
        $allianceId,
        $allianceName,
        $memberCount,
        $ceoId,
        $ceoName
    );
    @$ins->execute();
    $ins->close();
}

/**
 * Count active managed corporations in DB.
 */
function esi_count_corporations(mysqli $db): int {
    $res = @$db->query('SELECT COUNT(*) AS c FROM corporations WHERE is_active=1');
    if (!$res) {
        return 0;
    }
    $row = $res->fetch_assoc();
    $res->close();
    return isset($row['c']) ? (int)$row['c'] : 0;
}
