<?php
// Browser-bound app session helpers for LMeve auth.
// This is the application session (admin or ESI identity), separate from EVE tokens.

declare(strict_types=1);

const LMEVE_SESSION_NAME = 'LMEVESESSID';
const LMEVE_SESSION_USER_KEY = 'lmeve_user';
const LMEVE_SESSION_OAUTH_KEY = 'lmeve_oauth';
const LMEVE_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

/**
 * Start a secure PHP session once per request.
 */
function api_session_start(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443)
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string)$_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');

    // Allow same-origin SPA + PHP API cookie auth.
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    } else {
        session_set_cookie_params(0, '/; samesite=Lax', '', $secure, true);
    }

    session_name(LMEVE_SESSION_NAME);
    @session_start();
}

/**
 * Build a public user payload safe to return to the browser (no secrets/tokens).
 */
function api_public_user_from_row(array $row): array {
    $authMethod = (string)($row['auth_method'] ?? 'manual');
    if ($authMethod !== 'esi' && $authMethod !== 'manual') {
        $authMethod = 'manual';
    }

    $scopesRaw = $row['scopes'] ?? '';
    $scopes = [];
    if (is_array($scopesRaw)) {
        $scopes = array_values(array_filter(array_map('strval', $scopesRaw)));
    } elseif (is_string($scopesRaw) && $scopesRaw !== '') {
        $scopes = preg_split('/\s+/', trim($scopesRaw)) ?: [];
    }

    $hasTokens = !empty($row['access_token']) || !empty($row['refresh_token']) || !empty($row['has_tokens']);

        // Expose token expiry metadata only — never raw tokens.
        $tokenExpiry = $row['token_expiry'] ?? ($row['tokenExpiry'] ?? null);
        if (is_string($tokenExpiry) && $tokenExpiry !== '' && strpos($tokenExpiry, 'T') === false) {
            // Normalize MySQL DATETIME to ISO-ish UTC for the browser.
            try {
                $tokenExpiry = (new DateTimeImmutable($tokenExpiry))->format('c');
            } catch (Throwable $e) {
                // keep original
            }
        }

        return [
            'id' => isset($row['id']) ? (int)$row['id'] : null,
            'username' => $row['username'] ?? null,
            'role' => $row['role'] ?? 'corp_member',
            'auth_method' => $authMethod,
            'character_id' => isset($row['character_id']) && $row['character_id'] !== null && $row['character_id'] !== ''
                ? (int)$row['character_id'] : null,
            'character_name' => $row['character_name'] ?? null,
            'corporation_id' => isset($row['corporation_id']) && $row['corporation_id'] !== null && $row['corporation_id'] !== ''
                ? (int)$row['corporation_id'] : null,
            'corporation_name' => $row['corporation_name'] ?? null,
            'alliance_id' => isset($row['alliance_id']) && $row['alliance_id'] !== null && $row['alliance_id'] !== ''
                ? (int)$row['alliance_id'] : null,
            'alliance_name' => $row['alliance_name'] ?? null,
            'scopes' => $scopes,
            'last_login' => $row['last_login'] ?? null,
            'session_expiry' => $row['session_expiry'] ?? null,
            'token_expiry' => $tokenExpiry,
            'is_active' => isset($row['is_active']) ? (int)$row['is_active'] : 1,
            'has_tokens' => $hasTokens ? 1 : 0,
        ];
    }

/**
 * Establish the browser session for a public user payload.
 */
/**
 * Establish browser session and return the public user payload (with expiry).
 * Callers must use the returned array in API responses — the input is not by-ref.
 *
 * @param array<string, mixed> $publicUser
 * @return array<string, mixed>
 */
function api_session_establish(array $publicUser): array {
    api_session_start();

    // Prevent session fixation after privilege change.
    if (session_status() === PHP_SESSION_ACTIVE) {
        @session_regenerate_id(true);
    }

    $expiresAt = time() + LMEVE_SESSION_TTL_SECONDS;
    $publicUser['session_expiry'] = gmdate('c', $expiresAt);
    $publicUser['session_established_at'] = gmdate('c');

    $_SESSION[LMEVE_SESSION_USER_KEY] = $publicUser;
    $_SESSION['lmeve_session_expires_at'] = $expiresAt;

    return $publicUser;
}

/**
 * Get the current session user, or null if missing/expired.
 */
function api_session_user(): ?array {
    api_session_start();

    $expiresAt = isset($_SESSION['lmeve_session_expires_at']) ? (int)$_SESSION['lmeve_session_expires_at'] : 0;
    if ($expiresAt > 0 && time() > $expiresAt) {
        api_session_clear(false);
        return null;
    }

    $user = $_SESSION[LMEVE_SESSION_USER_KEY] ?? null;
    return is_array($user) ? $user : null;
}

/**
 * Clear auth session data. Optionally destroy the whole PHP session.
 */
function api_session_clear(bool $destroy = true): void {
    api_session_start();

    unset($_SESSION[LMEVE_SESSION_USER_KEY], $_SESSION['lmeve_session_expires_at'], $_SESSION[LMEVE_SESSION_OAUTH_KEY]);

    if (!$destroy) {
        return;
    }

    if (session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'] ?? '/', $params['domain'] ?? '', !empty($params['secure']), !empty($params['httponly']));
        }
        @session_destroy();
    }
}

/**
 * Secret used to sign OAuth state so callbacks work across hosts
 * (e.g. start on LAN IP, callback on public IP). Session cookies are host-bound.
 */
function api_oauth_signing_secret(): string {
    static $secret = null;
    if (is_string($secret) && $secret !== '') {
        return $secret;
    }

    $dir = function_exists('api_storage_dir') ? api_storage_dir() : null;
    if ($dir) {
        $path = rtrim($dir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'oauth-state-secret';
        if (is_file($path)) {
            $raw = trim((string)@file_get_contents($path));
            if ($raw !== '') {
                $secret = $raw;
                return $secret;
            }
        }
        try {
            $raw = bin2hex(random_bytes(32));
        } catch (Throwable $e) {
            $raw = hash('sha256', uniqid('lmeve', true) . mt_rand());
        }
        @file_put_contents($path, $raw, LOCK_EX);
        @chmod($path, 0660);
        $secret = $raw;
        return $secret;
    }

    $secret = hash('sha256', __FILE__ . '|' . (string)($_SERVER['SERVER_NAME'] ?? 'lmeve'));
    return $secret;
}

/**
 * Build a signed, self-contained OAuth state token (host-independent).
 *
 * @param array<string, mixed> $extra
 */
function api_oauth_issue_state(array $extra = []): string {
    $payload = array_merge([
        'n' => bin2hex(random_bytes(16)),
        'iat' => time(),
        'exp' => time() + 900, // 15 minutes
    ], $extra);
    $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        $json = '{}';
    }
    $body = rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
    $sig = hash_hmac('sha256', $body, api_oauth_signing_secret());
    return $body . '.' . $sig;
}

/**
 * Verify signed OAuth state. Returns payload array or null.
 *
 * @return array<string, mixed>|null
 */
function api_oauth_verify_state(?string $state): ?array {
    if ($state === null || $state === '' || strpos($state, '.') === false) {
        return null;
    }
    $parts = explode('.', $state, 2);
    if (count($parts) !== 2) {
        return null;
    }
    list($body, $sig) = $parts;
    $expected = hash_hmac('sha256', $body, api_oauth_signing_secret());
    if (!hash_equals($expected, $sig)) {
        return null;
    }
    $pad = strlen($body) % 4;
    if ($pad > 0) {
        $body .= str_repeat('=', 4 - $pad);
    }
    $json = base64_decode(strtr($body, '-_', '+/'), true);
    if ($json === false) {
        return null;
    }
    $payload = json_decode($json, true);
    if (!is_array($payload)) {
        return null;
    }
    $exp = isset($payload['exp']) ? (int)$payload['exp'] : 0;
    if ($exp > 0 && time() > $exp) {
        return null;
    }
    return $payload;
}

/**
 * Store OAuth start state for CSRF protection (server callback flow).
 * Also keeps a host-local copy when start+callback share a host.
 */
function api_oauth_store_state(string $state, array $extra = []): void {
    api_session_start();
    $_SESSION[LMEVE_SESSION_OAUTH_KEY] = array_merge([
        'state' => $state,
        'created_at' => time(),
    ], $extra);
}

/**
 * Validate and consume OAuth state. Prefers signed state (cross-host),
 * falls back to same-host PHP session state.
 *
 * @return array<string, mixed>|null
 */
function api_oauth_consume_state(?string $state): ?array {
    // 1) Signed self-contained state (works when callback host != start host)
    $signed = api_oauth_verify_state($state);
    if (is_array($signed)) {
        // Best-effort clear any local session copy
        api_session_start();
        unset($_SESSION[LMEVE_SESSION_OAUTH_KEY]);
        return $signed;
    }

    // 2) Legacy same-host session state
    api_session_start();
    $stored = $_SESSION[LMEVE_SESSION_OAUTH_KEY] ?? null;
    unset($_SESSION[LMEVE_SESSION_OAUTH_KEY]);

    if (!is_array($stored) || empty($stored['state']) || !$state) {
        return null;
    }

    // 15 minute window for authorize -> callback.
    $createdAt = isset($stored['created_at']) ? (int)$stored['created_at'] : 0;
    if ($createdAt > 0 && (time() - $createdAt) > 900) {
        return null;
    }

    if (!hash_equals((string)$stored['state'], (string)$state)) {
        return null;
    }

    return $stored;
}

/**
 * Best-effort update of users.session_expiry / last_login after auth.
 */
function api_touch_user_session(mysqli $db, int $userId): void {
    if ($userId <= 0) return;
    $expiry = (new DateTimeImmutable('+' . LMEVE_SESSION_TTL_SECONDS . ' seconds'))->format('Y-m-d H:i:s');
    $stmt = @$db->prepare('UPDATE users SET last_login=NOW(), session_expiry=?, updated_date=NOW() WHERE id=?');
    if (!$stmt) return;
    $stmt->bind_param('si', $expiry, $userId);
    @$stmt->execute();
    $stmt->close();
}
