<?php
// Offline/bootstrap local accounts (independent of MySQL).
// Used for maintenance login (admin) before database settings exist.
//
// Storage: {storage}/bootstrap-users.json

declare(strict_types=1);

const LMEVE_BOOTSTRAP_ADMIN_USERNAME = 'admin';
const LMEVE_BOOTSTRAP_ADMIN_DEFAULT_PASSWORD = '12345';
const LMEVE_BOOTSTRAP_ADMIN_ID = 'bootstrap-admin';

function bootstrap_users_path(): ?string {
    if (!function_exists('api_storage_dir')) {
        require_once __DIR__ . '/common.php';
    }
    $dir = api_storage_dir();
    if ($dir === null) {
        return null;
    }
    return rtrim($dir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'bootstrap-users.json';
}

/**
 * @return array{users: array<int, array<string, mixed>>}
 */
function bootstrap_users_default(): array {
    $now = gmdate('c');
    $hash = password_hash(LMEVE_BOOTSTRAP_ADMIN_DEFAULT_PASSWORD, PASSWORD_BCRYPT);
    return [
        'users' => [
            [
                'id' => LMEVE_BOOTSTRAP_ADMIN_ID,
                'username' => LMEVE_BOOTSTRAP_ADMIN_USERNAME,
                'password_hash' => $hash,
                'role' => 'super_admin',
                'is_active' => true,
                'auth_method' => 'manual',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ],
    ];
}

/**
 * @return array{users: array<int, array<string, mixed>>}
 */
function bootstrap_users_load(): array {
    $path = bootstrap_users_path();
    if ($path === null) {
        return bootstrap_users_default();
    }

    if (!file_exists($path)) {
        $defaults = bootstrap_users_default();
        bootstrap_users_save($defaults);
        return $defaults;
    }

    $raw = @file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        $defaults = bootstrap_users_default();
        bootstrap_users_save($defaults);
        return $defaults;
    }

    $json = json_decode($raw, true);
    if (!is_array($json) || !isset($json['users']) || !is_array($json['users'])) {
        $defaults = bootstrap_users_default();
        bootstrap_users_save($defaults);
        return $defaults;
    }

    $hasAdmin = false;
    foreach ($json['users'] as $u) {
        if (is_array($u) && strtolower((string)($u['username'] ?? '')) === LMEVE_BOOTSTRAP_ADMIN_USERNAME) {
            $hasAdmin = true;
            break;
        }
    }
    if (!$hasAdmin) {
        $defaults = bootstrap_users_default();
        $json['users'][] = $defaults['users'][0];
        bootstrap_users_save($json);
    }

    return $json;
}

/**
 * @param array{users: array<int, array<string, mixed>>} $data
 */
function bootstrap_users_save(array $data): bool {
    $path = bootstrap_users_path();
    if ($path === null) {
        return false;
    }
    if (!isset($data['users']) || !is_array($data['users'])) {
        return false;
    }
    $encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        return false;
    }
    $ok = @file_put_contents($path, $encoded . "\n", LOCK_EX);
    if ($ok === false) {
        return false;
    }
    @chmod($path, 0660);
    return true;
}

/**
 * @return array<string, mixed>|null
 */
function bootstrap_find_user(string $username): ?array {
    $username = strtolower(trim($username));
    if ($username === '') {
        return null;
    }
    $data = bootstrap_users_load();
    foreach ($data['users'] as $u) {
        if (!is_array($u)) {
            continue;
        }
        if (strtolower((string)($u['username'] ?? '')) === $username) {
            return $u;
        }
    }
    return null;
}

/**
 * @return array<string, mixed>|null
 */
function bootstrap_verify_login(string $username, string $password): ?array {
    $user = bootstrap_find_user($username);
    if ($user === null) {
        return null;
    }
    if (isset($user['is_active']) && !(bool)$user['is_active']) {
        return null;
    }

    $hash = (string)($user['password_hash'] ?? $user['password'] ?? '');
    $verified = false;

    if ($hash !== '' && (strpos($hash, '$2y$') === 0 || strpos($hash, '$2a$') === 0 || strpos($hash, '$2b$') === 0)) {
        $verified = password_verify($password, $hash);
    } elseif ($hash !== '') {
        if (hash_equals($hash, $password)) {
            $verified = true;
        } else {
            $verified = hash_equals($hash, hash('sha256', $password));
        }
        if ($verified) {
            bootstrap_set_password((string)$user['username'], $password);
            $user = bootstrap_find_user((string)$user['username']) ?? $user;
        }
    }

    if (!$verified) {
        return null;
    }

    return bootstrap_public_user($user);
}

/**
 * @param array<string, mixed> $user
 * @return array<string, mixed>
 */
function bootstrap_public_user(array $user): array {
    $username = (string)($user['username'] ?? LMEVE_BOOTSTRAP_ADMIN_USERNAME);
    $role = (string)($user['role'] ?? 'super_admin');
    if ($role === '') {
        $role = 'super_admin';
    }
    return [
        'id' => $user['id'] ?? ('bootstrap-' . $username),
        'username' => $username,
        'role' => $role,
        'auth_method' => 'manual',
        'character_id' => null,
        'character_name' => $username === LMEVE_BOOTSTRAP_ADMIN_USERNAME ? 'Local Administrator' : $username,
        'corporation_id' => null,
        'corporation_name' => null,
        'alliance_id' => null,
        'alliance_name' => null,
        'scopes' => [],
        'last_login' => gmdate('c'),
        'session_expiry' => null,
        'token_expiry' => null,
        'is_active' => isset($user['is_active']) ? (int)(bool)$user['is_active'] : 1,
        'has_tokens' => 0,
        'bootstrap' => 1,
    ];
}

function bootstrap_set_password(string $username, string $newPassword, ?string $role = null): bool {
    $username = trim($username);
    if ($username === '' || $newPassword === '') {
        return false;
    }
    $data = bootstrap_users_load();
    $now = gmdate('c');
    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    $found = false;

    foreach ($data['users'] as $i => $u) {
        if (!is_array($u)) {
            continue;
        }
        if (strtolower((string)($u['username'] ?? '')) !== strtolower($username)) {
            continue;
        }
        $data['users'][$i]['password_hash'] = $hash;
        unset($data['users'][$i]['password']);
        $data['users'][$i]['updated_at'] = $now;
        $data['users'][$i]['is_active'] = true;
        if ($role !== null && $role !== '') {
            $data['users'][$i]['role'] = $role;
        }
        if (strtolower($username) === LMEVE_BOOTSTRAP_ADMIN_USERNAME) {
            $data['users'][$i]['role'] = 'super_admin';
            $data['users'][$i]['id'] = LMEVE_BOOTSTRAP_ADMIN_ID;
        }
        $found = true;
        break;
    }

    if (!$found) {
        $id = strtolower($username) === LMEVE_BOOTSTRAP_ADMIN_USERNAME
            ? LMEVE_BOOTSTRAP_ADMIN_ID
            : ('bootstrap-' . preg_replace('/[^a-z0-9_-]+/i', '-', strtolower($username)));
        $data['users'][] = [
            'id' => $id,
            'username' => $username,
            'password_hash' => $hash,
            'role' => (strtolower($username) === LMEVE_BOOTSTRAP_ADMIN_USERNAME)
                ? 'super_admin'
                : ($role ?: 'corp_member'),
            'is_active' => true,
            'auth_method' => 'manual',
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    return bootstrap_users_save($data);
}

function bootstrap_upsert_user(string $username, string $password, string $role = 'corp_member', bool $active = true): bool {
    $username = trim($username);
    if ($username === '' || $password === '') {
        return false;
    }
    if (strtolower($username) === LMEVE_BOOTSTRAP_ADMIN_USERNAME) {
        return bootstrap_set_password($username, $password, 'super_admin');
    }

    $allowed = ['super_admin', 'corp_admin', 'corp_director', 'corp_manager', 'corp_member', 'guest'];
    if (!in_array($role, $allowed, true)) {
        $role = 'corp_member';
    }

    $data = bootstrap_users_load();
    $now = gmdate('c');
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $found = false;
    foreach ($data['users'] as $i => $u) {
        if (!is_array($u)) continue;
        if (strtolower((string)($u['username'] ?? '')) !== strtolower($username)) continue;
        $data['users'][$i]['password_hash'] = $hash;
        $data['users'][$i]['role'] = $role;
        $data['users'][$i]['is_active'] = $active;
        $data['users'][$i]['updated_at'] = $now;
        $found = true;
        break;
    }
    if (!$found) {
        $data['users'][] = [
            'id' => 'bootstrap-' . preg_replace('/[^a-z0-9_-]+/i', '-', strtolower($username)),
            'username' => $username,
            'password_hash' => $hash,
            'role' => $role,
            'is_active' => $active,
            'auth_method' => 'manual',
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }
    return bootstrap_users_save($data);
}

/**
 * @return array<int, array<string, mixed>>
 */
function bootstrap_list_public_users(): array {
    $data = bootstrap_users_load();
    $out = [];
    foreach ($data['users'] as $u) {
        if (!is_array($u)) continue;
        $pub = bootstrap_public_user($u);
        unset($pub['last_login']);
        $out[] = $pub;
    }
    return $out;
}
