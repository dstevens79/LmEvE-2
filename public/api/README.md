# LMeve-2 PHP API

These endpoints are deployed alongside the built app and provide server-side database access without a separate daemon.

- Common helper: `public/api/_lib/common.php`
- Health: `GET /api/health.php` (the only unauthenticated diagnostic endpoint)
- Connection test: `POST /api/test-connection.php` (authenticated administrator) → `{ ok, latencyMs, currentUser, hasLmeveDb, canSelectLmeve, hasSdeDb, canSelectSde }`
- Read-only SQL: `POST /api/query.php` (authenticated administrator) with `{ query }` (SELECT/SHOW/DESCRIBE/EXPLAIN only)
- LMeve resources:
  - `POST /api/lmeve/get-corporations.php` `{ limit? }`
  - `POST /api/lmeve/get-characters.php` `{ corporationId?, limit? }`
  - `POST /api/lmeve/get-assets.php` `{ ownerId?, limit? }`
  - `POST /api/lmeve/get-industry-jobs.php` `{ status?, limit? }`

- ESI writes (bulk upsert, authenticated administrators): send `{ records: [...] }` where records are arrays of typed objects.
  - `POST /api/lmeve/esi/upsert-members.php`
    - columns: character_id, character_name, corporation_id, corporation_name, alliance_id, alliance_name, roles, titles, last_login, location_id, location_name, ship_type_id, ship_type_name, is_online
  - `POST /api/lmeve/esi/upsert-assets.php`
    - columns: item_id, type_id, location_id, location_type, location_flag, quantity, is_singleton, is_blueprint_copy, owner_id, corporation_id
  - `POST /api/lmeve/esi/upsert-industry-jobs.php`
    - table: industry_jobs; columns: job_id, corporation_id, installer_id, facility_id, activity_id, blueprint_type_id, product_type_id, runs, status, duration, start_date, end_date, completed_date
  - `POST /api/lmeve/esi/upsert-market-orders.php`
    - columns: order_id, corporation_id, type_id, region_id, location_id, volume_total, volume_remain, min_volume, price, is_buy_order, duration, issued, state

- Auth (EVE SSO):
  - OAuth start/callback/establish endpoints are flow endpoints and establish the same PHP session used by data APIs.
  - `POST /api/auth/esi/refresh.php` requires the current authenticated session and refreshes its vaulted token.

- SDE helpers:
  - `POST /api/sde/get-type-names.php` `{ typeIds: number[] }` → `{ ok, rows: [{ typeID, typeName }] }`

Notes:
- All endpoints return `{ ok: boolean, ... }` and HTTP 200 for expected errors with an `error` message payload.
- All non-auth flow APIs require the `LMEVESESSID` server session. Database credentials and database names come only from server-side settings.
- Inputs are minimally sanitized; avoid passing raw SQL except via `query.php` for diagnostic use.
