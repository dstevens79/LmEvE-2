# LMeve-2 PHP API

These endpoints are deployed alongside the built app and provide server-side database access without a separate daemon.

- Common helper: `public/api/_lib/common.php`
- Health: `POST /api/health.php` (no body) → `{ ok: true }`
- Connection test: `POST /api/test-connection.php` → `{ ok, latencyMs, currentUser, hasLmeveDb, canSelectLmeve, hasSdeDb, canSelectSde }`
- Read-only SQL: `POST /api/query.php` with `{ host, port, username, password, database, query }` (SELECT/SHOW/DESCRIBE/EXPLAIN only)
- LMeve resources:
  - `POST /api/lmeve/get-corporations.php` `{ host, port, username, password, database, limit? }`
  - `POST /api/lmeve/get-characters.php` `{ host, port, username, password, database, corporationId?, limit? }`
  - `POST /api/lmeve/get-assets.php` `{ host, port, username, password, database, ownerId?, limit? }`
  - `POST /api/lmeve/get-industry-jobs.php` `{ host, port, username, password, database, status?, limit? }`

- ESI writes (bulk upsert): send `{ host, port, username, password, database, records: [...] }` where records are arrays of typed objects.
  - `POST /api/lmeve/esi/upsert-members.php`
    - columns: character_id, character_name, corporation_id, corporation_name, alliance_id, alliance_name, roles, titles, last_login, location_id, location_name, ship_type_id, ship_type_name, is_online
  - `POST /api/lmeve/esi/upsert-assets.php`
    - columns: item_id, type_id, location_id, location_type, location_flag, quantity, is_singleton, is_blueprint_copy, owner_id, corporation_id
  - `POST /api/lmeve/esi/upsert-industry-jobs.php`
    - table: industry_jobs; columns: job_id, corporation_id, installer_id, facility_id, activity_id, blueprint_type_id, product_type_id, runs, status, duration, start_date, end_date, completed_date
  - `POST /api/lmeve/esi/upsert-market-orders.php`
    - columns: order_id, corporation_id, type_id, region_id, location_id, volume_total, volume_remain, min_volume, price, is_buy_order, duration, issued, state

- Auth (EVE SSO):
  - `POST /api/auth/esi/callback.php`
    - Body: `{ host, port, username, password, database, clientId, clientSecret, code, redirectUri }`
    - Exchanges code for tokens, verifies identity, looks up corporation, and upserts into `users` (access_token, refresh_token, token_expiry, scopes).
    - Returns `{ ok, characterId, characterName, corporationId, scopes, expiresAt }`
  - `POST /api/auth/esi/refresh.php`
    - Body: `{ host, port, username, password, database, clientId, clientSecret, characterId, refreshToken }`
    - Refreshes and updates tokens.

- SDE helpers:
  - `POST /api/sde/get-type-names.php` `{ host, port, username, password, sdeDatabase?, typeIds: number[] }` → `{ ok, rows: [{ typeID, typeName }] }`

Notes:
- All endpoints return `{ ok: boolean, ... }` and HTTP 200 for expected errors with an `error` message payload.
- Credentials are provided per request; no server-side session is stored.
- Inputs are minimally sanitized; avoid passing raw SQL except via `query.php` for diagnostic use.
