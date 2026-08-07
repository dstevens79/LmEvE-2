<?php
// Begin server-side ESI OAuth: persist CSRF state in PHP session and return authorize URL.
require_once __DIR__ . '/../../_lib/common.php';
require_once __DIR__ . '/../../_lib/session.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  http_response_code(405);
  echo 'Method Not Allowed';
  exit;
}

$body = api_read_json();
$esiCfg = api_get_esi_config($body);
$clientId = (string)($esiCfg['clientId'] ?? '');
if ($clientId === '') {
  api_fail(400, 'ESI is not configured on the server');
}

// ALWAYS use the server-configured public callback URL.
// Browser host (LAN IP) must never become redirect_uri — CCP requires an exact match
// with the EVE application callback (typically the public IP/hostname).
$redirectUri = api_get_esi_callback_url($body);

$scopes = [];
if (isset($body['scopes']) && is_array($body['scopes'])) {
  $scopes = array_values(array_filter(array_map('strval', $body['scopes'])));
} elseif (isset($body['scope']) && is_string($body['scope'])) {
  $scopes = preg_split('/\s+/', trim($body['scope'])) ?: [];
}

// Session once: scopes defaults + admin handoff bit for signed state.
api_session_start();
$sessionUser = api_session_user();
$sessionRole = is_array($sessionUser) ? (string)($sessionUser['role'] ?? '') : '';
$isAdminSession = ($sessionRole === 'super_admin' || $sessionRole === 'corp_admin');
$adminHandoff = ($sessionRole === 'super_admin');

// If caller only sent scopeType, expand to the same sets the SPA client uses.
// "basic" still requests corporation-roles so every login can derive CEO/Director/etc.
// Admin browser sessions default toward corporation scopes for bootstrap handoff.
if (count($scopes) === 0) {
  $scopeType = strtolower((string)($body['scopeType'] ?? ($isAdminSession ? 'corporation' : 'basic')));
  $characterScopes = [
    'esi-characters.read_corporation_roles.v1',
    'esi-industry.read_character_jobs.v1',
    'esi-wallet.read_character_wallet.v1',
    'esi-assets.read_assets.v1',
    'esi-characters.read_blueprints.v1',
    'esi-characters.read_notifications.v1',
    'esi-planets.manage_planets.v1',
    'esi-skills.read_skills.v1',
  ];
  $corporationScopes = [
    'esi-corporations.read_corporation_membership.v1',
    'esi-corporations.read_titles.v1',
    'esi-assets.read_corporation_assets.v1',
    'esi-industry.read_corporation_jobs.v1',
    'esi-wallet.read_corporation_wallets.v1',
    'esi-killmails.read_corporation_killmails.v1',
    'esi-universe.read_structures.v1',
    'esi-markets.read_corporation_orders.v1',
    'esi-contracts.read_corporation_contracts.v1',
    'esi-industry.read_corporation_mining.v1',
    'esi-planets.read_customs_offices.v1',
    'esi-corporations.read_blueprints.v1',
    'esi-corporations.read_container_logs.v1',
    'esi-corporations.read_divisions.v1',
    'esi-corporations.read_facilities.v1',
    'esi-corporations.read_medals.v1',
    'esi-corporations.read_standings.v1',
    'esi-corporations.track_members.v1',
  ];
  if ($scopeType === 'enhanced') {
    $scopes = array_values(array_unique(array_merge(
      ['esi-characters.read_corporation_roles.v1'],
      [
        'esi-industry.read_character_jobs.v1',
        'esi-wallet.read_character_wallet.v1',
        'esi-assets.read_assets.v1',
        'esi-characters.read_blueprints.v1',
      ]
    )));
  } elseif ($scopeType === 'corporation') {
    $scopes = array_values(array_unique(array_merge($characterScopes, $corporationScopes)));
  } else {
    // basic: identity + roles (needed for site permission mapping on every login)
    $scopes = ['esi-characters.read_corporation_roles.v1'];
  }
}

// Signed, self-contained state — survives start-host != callback-host
$state = api_oauth_issue_state([
  'redirect_uri' => $redirectUri,
  'scopes' => $scopes,
  'client_id' => $clientId,
  'admin_handoff' => $adminHandoff ? 1 : 0,
]);

// Also keep a same-host session copy when start+callback share a host
api_oauth_store_state($state, [
  'redirect_uri' => $redirectUri,
  'scopes' => $scopes,
  'client_id' => $clientId,
  'admin_handoff' => $adminHandoff ? 1 : 0,
]);

$params = [
  'response_type' => 'code',
  'redirect_uri' => $redirectUri,
  'client_id' => $clientId,
  'state' => $state,
];
if (count($scopes) > 0) {
  $params['scope'] = implode(' ', $scopes);
}

$authorizeUrl = 'https://login.eveonline.com/v2/oauth/authorize/?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986);

// Hint the SPA when the browser origin differs from the public callback origin
$callbackOrigin = '';
try {
  $parts = parse_url($redirectUri);
  if (is_array($parts) && !empty($parts['scheme']) && !empty($parts['host'])) {
    $callbackOrigin = $parts['scheme'] . '://' . $parts['host'];
    if (!empty($parts['port'])) {
      $callbackOrigin .= ':' . $parts['port'];
    }
  }
} catch (Throwable $e) {}

api_respond([
  'ok' => true,
  'authorizeUrl' => $authorizeUrl,
  'state' => $state,
  'redirectUri' => $redirectUri,
  'callbackOrigin' => $callbackOrigin,
]);