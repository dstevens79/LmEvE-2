<?php
// Return the browser-bound app session user (admin or ESI).
// This is NOT "last ESI login in the database".
require_once __DIR__ . '/../_lib/common.php';
require_once __DIR__ . '/../_lib/session.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

try {
  $sessionUser = api_session_user();
  if (!$sessionUser) {
    api_respond(['ok' => true, 'user' => null, 'authenticated' => false]);
  }

  // Optionally refresh profile fields from DB when available, without changing session binding.
  $fresh = $sessionUser;
  try {
    $db = api_connect($_GET);
    $dbCfg = api_get_db_config($_GET);
    api_select_db($db, (string)($_GET['database'] ?? $dbCfg['database'] ?? 'lmeve2'));

    $row = null;
    if (!empty($sessionUser['id'])) {
      $id = (int)$sessionUser['id'];
      $stmt = $db->prepare('SELECT id, username, role, auth_method, character_id, character_name, corporation_id, corporation_name, alliance_id, alliance_name, scopes, last_login, session_expiry, is_active, access_token, refresh_token, token_expiry FROM users WHERE id=? LIMIT 1');
      if ($stmt) {
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $stmt->close();
      }
    } elseif (!empty($sessionUser['character_id'])) {
      $cid = (int)$sessionUser['character_id'];
      $stmt = $db->prepare('SELECT id, username, role, auth_method, character_id, character_name, corporation_id, corporation_name, alliance_id, alliance_name, scopes, last_login, session_expiry, is_active, access_token, refresh_token, token_expiry FROM users WHERE character_id=? LIMIT 1');
      if ($stmt) {
        $stmt->bind_param('i', $cid);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $stmt->close();
      }
    }

    if ($row) {
      if (!(int)$row['is_active']) {
        api_session_clear(true);
        $db->close();
        api_respond(['ok' => true, 'user' => null, 'authenticated' => false, 'reason' => 'disabled']);
      }
      // Preserve the auth method that established this browser session.
      // Admin bootstrap sessions stay manual even if the DB row later gains ESI fields.
      $sessionAuth = (string)($sessionUser['auth_method'] ?? 'manual');
      $public = api_public_user_from_row($row);
      $public['auth_method'] = $sessionAuth === 'esi' ? 'esi' : 'manual';
      if ($public['auth_method'] === 'manual' && empty($public['character_name'])) {
        $public['character_name'] = $public['username'] ?: 'Local Administrator';
      }
      // Browser session TTL lives in PHP session, not the DB mirror timestamp.
      if (!empty($sessionUser['session_expiry'])) {
        $public['session_expiry'] = $sessionUser['session_expiry'];
      } elseif (!empty($_SESSION['lmeve_session_expires_at'])) {
        $public['session_expiry'] = gmdate('c', (int)$_SESSION['lmeve_session_expires_at']);
      }
      // Keep session in sync with refreshed public profile.
      $_SESSION[LMEVE_SESSION_USER_KEY] = array_merge($sessionUser, $public);
      $fresh = $public;
    }

    $db->close();
  } catch (Throwable $e) {
    // DB may be unavailable during early setup; fall back to pure session payload.
    $fresh = $sessionUser;
  }

  api_respond([
    'ok' => true,
    'authenticated' => true,
    'user' => $fresh,
  ]);
} catch (Throwable $e) {
  api_fail(500, 'Unhandled error', ['error' => $e->getMessage()]);
}