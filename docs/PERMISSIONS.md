# Roles and Permissions

Role-based access control. Site roles are **data** (stored in the DB), not just code constants: built-ins are seeded defaults that a site admin can edit, corporations can override per-role, and new custom roles can be created. EVE corp roles and titles map onto site roles through configurable rules.

## Where things live

- Built-in role defaults + static fallback: `src/lib/roles.ts` (`ROLE_DEFINITIONS`). Used offline (bootstrap) and as the seed source of truth mirror on the server.
- Roles as data + resolution logic (server): `public/api/_lib/role-config-lib.php`.
- Role / mapping / user endpoints: `public/api/lmeve/role-definitions.php`, `permission-mappings.php`, `resolve-role.php`, `users.php`.
- SSO role resolution at login: `public/api/_lib/esi-identity.php` (`esi_enrich_character_identity`) → `role_config_resolve`.
- Client permission gate + custom-role registry: `src/lib/roles.ts` (`hasPermission`, `canAccessTab`, `canAccessSettingsTab`, `registerResolvedRoles`).

## How a role is resolved at SSO login

1. Token exchange, then `esi_enrich_character_identity` fetches the character's EVE corp **roles** and corp **titles**.
2. `role_config_resolve` matches those against `permission_mappings` rules (per-corp rows override global fallbacks for the same source; highest priority wins; no match → `corp_member`). Mappings can never grant `super_admin`.
3. CEO check: if the character is the corp's `ceo_id`, it resolves to at least `corp_admin`.
4. The resolved key (built-in or custom) is stored on the `users` row (`role` is `VARCHAR(64)`) and the server attaches the role's permission set + display label onto the public session payload (`role_config_attach_permissions`).
5. The client registers that data via `registerResolvedRoles`, so permission checks honor the DB-defined set, not just the static built-in table.

Local (manual / service-account) logins keep their manually-assigned role; the bootstrap admin is always full access regardless of config.

## Built-in role defaults

Source: seeded from `role_config_builtin_permissions()` (server) and mirrored in `ROLE_DEFINITIONS` (`src/lib/roles.ts`). These are starting points — edit them under Settings → Permissions → Roles.

- **super_admin** — all permissions; its permission set is locked server-side and cannot be reduced or deleted.
- **corp_admin** — system + full corp management (canManageSystem, canConfigureESI, canManageDatabase, canManageCorp/Users/Financials/Manufacturing/Mining/Assets/Market/Income, canViewKillmails, data view/edit/export; no delete).
- **corp_director** — financials + manufacturing/mining/assets/market/income management, killmail view, member/data view/edit/export.
- **corp_manager** — manufacturing/mining/market management, killmail view, member view.
- **corp_member** — canViewKillmails only.
- **guest** — no permissions.

## Mapping EVE roles & titles to site roles

`permission_mappings` rows: `kind` (`eve_role` | `title`), `source_name`, `site_role_key`, `priority`, and an optional `corporation_id` (null = global fallback). Example rules:
- Global: `eve_role ceo → corp_admin`.
- Corp-specific: `title "Veteran Pilot" → logistics_chief` (a custom role) for a given corporation.

Configure these under Settings → Permissions → Mappings. Resolution prefers the most specific, then highest priority.

## Guard helpers (UI enforcement)

- `hasPermission(user, permission)` — core gate.
- `canAccessTab(user, tab)` — primary nav gates, e.g. members→canViewAllMembers, assets→canManageAssets, manufacturing→canManageManufacturing, planetary→manufacturing OR mining, market→canManageMarket, wallet/income→income OR financials, settings→canManageCorp OR canManageSystem.
- `canAccessSettingsTab(user, tab)` — per-section, e.g. database→canManageDatabase, permissions→canManageUsers OR canManageSystem, sync/sync-monitoring→corp/system management.

## Managing roles from the UI

Settings → Permissions has three panels: **Roles** (edit any role's permission flags; create custom roles; corp-scoped overrides vs site-wide), **Mappings** (EVE role/title → site-role rules with priority and scope), and **Users** (assign a site role to an account, enable/disable — persisted to `users`).

## Scope notes (ESI)

- Corp registration requires corporation scopes.
- Titles are free-form per-corp strings; EVE role identifiers are the fixed set (ceo, director, factory_manager, hangar_can_take*, etc.).

## OAuth callback flow

The OAuth callback is handled **server-side**: EVE redirects to `/api/auth/esi/callback.php`, which exchanges the code, enriches identity, resolves the site role from the mapping rules, upserts the user row and establishes the `LMEVESESSID` browser session. The SPA then hydrates via `GET /api/auth/session.php`. Set your EVE developer app callback to `/api/auth/esi/callback.php`.
