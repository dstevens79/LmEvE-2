# LMeve-2 PHP API

Endpoints are deployed alongside the built app and provide server-side database access without a separate daemon.

- Common helper: `public/api/_lib/common.php` (also `_lib/session.php`, `_lib/esi-identity.php`, `_lib/bootstrap-auth.php`)
- Connection test: `POST /api/test-connection.php` (authenticated administrator) → `{ ok, latencyMs, currentUser, hasLmeveDb, canSelectLmeve, hasSdeDb, canSelectSde }`

## LMeve data reads (server session required)

All accept a JSON body with optional `limit`:

- `POST /api/lmeve/get-corporations.php`
- `POST /api/lmeve/get-characters.php` `{ corporationId? }`
- `POST /api/lmeve/get-assets.php` `{ ownerId? }`
- `POST /api/lmeve/get-industry-jobs.php` `{ status? }`
- `POST /api/lmeve/get-market-orders.php`
- `POST /api/lmeve/get-market-order-history.php`
- `POST /api/lmeve/get-market-prices.php`
- `POST /api/lmeve/get-wallet-transactions.php`
- `POST /api/lmeve/get-wallet-divisions.php`
- `POST /api/lmeve/get-mining-ledger.php`
- `POST /api/lmeve/get-contracts.php`
- `POST /api/lmeve/get-income.php`
- `POST /api/lmeve/get-names.php` (cached name lookup)

## ESI sync (server-side, vaulted corp token)

The system cron poller runs due processes; the UI triggers manual runs. No browser tokens are involved:

- `GET/POST /api/lmeve/esi/sync-settings.php` — per-process schedule/status for a corporation (`sync_process_config`, `corp_sync_log`)
- `POST /api/lmeve/esi/sync-run.php` `{ processType, corporationId }` — enqueue/dedupe a high-priority segment sync; the request may drain its own job when the worker is free
- `GET /api/lmeve/esi/sync-jobs.php?jobId=N` — read an authorized sync job's queued/running/completed status and sanitized result

Corporation ESI work is persisted in `esi_sync_jobs`. At most one active job per
corporation + segment exists, and a database worker lease serializes ESI calls
from the UI and cron poller. `public/bin/poller.php` enqueues due work then
drains the queue in priority order.

## Role & permission config (site roles as data)

Backed by `role_definitions` / `permission_mappings`, resolved at SSO login:

- `GET/POST /api/lmeve/role-definitions.php` — list/save/delete role definitions (per-corp overrides over global built-ins; super_admin permissions locked server-side)
- `GET/POST /api/lmeve/permission-mappings.php` — EVE corp role / title → site-role rules with priority
- `POST /api/lmeve/resolve-role.php` `{ corporationId, eveRoles, titles }` — preview resolution for a character
- `GET/POST /api/lmeve/users.php` — server-persisted user list; assign roles / enable-disable accounts

## Auth (EVE SSO + local)

The OAuth callback is handled server-side: EVE redirects to `/api/auth/esi/callback.php`, which exchanges the code, enriches identity (corp roles + titles), resolves the site role from the mapping rules, upserts the user row and establishes the `LMEVESESSID` browser session. The SPA then hydrates via `GET /api/auth/session.php`.

- `POST /api/auth/esi/start.php` — begin OAuth with signed state (supports LAN→public host handoff)
- `GET|POST /api/auth/esi/callback.php` — code exchange + session establishment
- `POST /api/auth/esi/establish.php` — SPA path: verify a just-obtained access token and bind the session
- `POST /api/auth/manual-login.php` — local (service-account) login; bootstrap admin works without MySQL
- `GET /api/auth/session.php` — current browser-session user (role + resolved permissions attached)
- `POST /api/auth/logout.php`, `GET/POST /api/auth/bootstrap-users.php`

## SDE helpers

- `POST /api/sde/get-type-names.php` `{ typeIds: number[] }` → `{ ok, rows: [{ typeID, typeName }] }` (batched)
- `GET /api/sde-latest.php`, `GET /api/app-metrics.php` — operational probes

Notes:
- All endpoints return `{ ok: boolean, ... }`; expected errors are HTTP 200 with an `error` message unless a hard failure.
- All non-auth-flow APIs require the `LMEVESESSID` server session. Database credentials and database names come only from server-side settings — never from client payloads (except connection-test).
