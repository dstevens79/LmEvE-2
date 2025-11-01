# Roles and Permissions

This app uses role-based access control (RBAC) to gate features by user capabilities derived from EVE SSO and in-app roles.

- Roles are defined in `src/lib/roles.ts`.
- Permissions are materialized per-user on login via `createUserWithRole(...)`.
- CEO detection upgrades effective role to `corp_admin` when the character is the corporation CEO.
- UI access is enforced with helper guards: `hasPermission`, `canAccessTab`, and `canAccessSettingsTab`.

## Role matrix

Source: `src/lib/roles.ts` (`ROLE_DEFINITIONS`)

- super_admin
  - System: canManageSystem, canManageMultipleCorps, canConfigureESI, canManageDatabase
  - Corporation: canManageCorp, canManageUsers, canViewFinancials, canManageManufacturing, canManageMining, canManageAssets, canManageMarket, canViewKillmails, canManageIncome
  - Data: canViewAllMembers, canEditAllData, canExportData, canDeleteData
- corp_admin (CEO)
  - System: canManageSystem, canConfigureESI, canManageDatabase
  - Corporation: canManageCorp, canManageUsers, canViewFinancials, canManageManufacturing, canManageMining, canManageAssets, canManageMarket, canViewKillmails, canManageIncome
  - Data: canViewAllMembers, canEditAllData, canExportData
- corp_director
  - Corporation: canViewFinancials, canManageManufacturing, canManageMining, canManageAssets, canManageMarket, canViewKillmails, canManageIncome
  - Data: canViewAllMembers, canEditAllData, canExportData
- corp_manager
  - Corporation: canManageManufacturing, canManageMining, canManageMarket, canViewKillmails
  - Data: canViewAllMembers
- corp_member
  - Minimal: canViewKillmails
- guest
  - No permissions

Notes:
- Only `super_admin` and `corp_admin` can access system-level settings. Directors can manage most corp features but not system settings or ESI configuration.

## CEO and role mapping

- File: `src/lib/roles.ts` → `getEVERoleMapping(eveRoles: string[]): UserRole`
  - Maps EVE roles to app roles. `CEO`/`chief_executive_officer` → `corp_admin`; directors → `corp_director`; various management roles → `corp_manager`.
- File: `src/lib/esi-auth.ts` (callback flow)
  - After token exchange and role discovery, calls EVE corporation info to confirm `ceo_id`. If it matches the logging-in character, it force-sets `effectiveRole = 'corp_admin'`.

## Guard helpers (UI enforcement)

- `hasPermission(user, permission)`
  - Source: `src/lib/roles.ts`
  - Core gate used throughout UI.

- `canAccessTab(user, tab)`
  - Source: `src/lib/roles.ts`
  - Maps navigation tabs to required permissions, e.g.:
    - members → canViewAllMembers
    - assets → canManageAssets
    - manufacturing → canManageManufacturing
    - planetary → canManageManufacturing OR canManageMining
    - market → canManageMarket
    - buyback → canManageMarket OR canManageCorp OR canManageSystem
    - wallet → canManageIncome OR canViewFinancials
    - notifications → canManageCorp OR canManageSystem
    - corporations → canManageSystem OR canConfigureESI
    - settings → canManageCorp OR canManageSystem

- `canAccessSettingsTab(user, settingsTab)`
  - Source: `src/lib/roles.ts`
  - Per-settings section access, e.g.:
    - general → canManageCorp OR canManageSystem
    - database → canManageDatabase
    - sync → canManageCorp OR canManageSystem
    - sync-monitoring → canManageCorp OR canManageSystem
    - permissions → canManageUsers OR canManageSystem

## Notable UI gates (where used)

- Corporation registration button
  - File: `src/components/Corporations.tsx`
  - Gate: authenticated ESI user AND (canManageCorp OR canManageSystem)
  - Action: `loginWithESI('corporation')` to request corp scopes

- Settings → ESI/Database save actions
  - File: `src/components/tabs/Settings.tsx`
  - Gate: canManageCorp OR canManageSystem for most ESI sections; `database` tab requires canManageDatabase

- Planetary Interaction tab
  - File: `src/components/tabs/PlanetaryInteraction.tsx`
  - Gate: canManageManufacturing OR canManageMining

- App shell routing
  - File: `src/App.tsx`
  - Uses `canAccessSettingsTab` to determine visibility and navigation of settings subsections; also applies `canAccessTab` for primary tabs

## Quick checks (troubleshooting)

- Is the CEO mapped to corp_admin?
  - Confirm `esi-auth.ts` logs "CEO detected via corporation info ceo_id match" after callback.
  - Inspect `user.role` and `user.permissions` in localStorage/session (or via `/public/tools/storage-tools.html`).
- Button disabled?
  - Ensure `esiConfig.clientId` is present (server settings hydrate on first load).
  - Verify `hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem')` evaluates to true.

## Scope notes (ESI)

- Corp registration requires corporation scopes; directors/CEOs should authenticate via the "Register Corporation ESI" button.
- We removed deprecated/invalid scopes and fixed typos. Exact scopes requested are logged during initiation for verification.

## OAuth callback flow

**Important:** The app uses a **pure SPA OAuth flow**—no PHP callback endpoint.

- **Callback URL:** Set your EVE developer app callback to your site root (e.g., `http://24.128.239.249/` or `https://yourdomain.com/`)
- **Why:** sessionStorage (used to validate the OAuth state) only persists within the same browsing context. Redirecting through a server-side PHP endpoint breaks this context.
- **Token storage:** Tokens are kept in-memory and sessionStorage only—they never persist to localStorage or the database. When the browser session ends, tokens are gone.
- **What changed:** Previously the default was `/api/auth/esi/callback.php`, which caused the "sits and spins" issue during corp auth. Now the SPA handles the full OAuth flow client-side.

**To update your EVE developer app:**
1. Visit https://developers.eveonline.com
2. Edit your LMeve application
3. Set "Callback URL" to `http://YOUR_IP/` or `https://YOUR_DOMAIN/` (must match exactly what you access the app from)
4. Save
