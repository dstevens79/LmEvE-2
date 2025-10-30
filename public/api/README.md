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

Notes:
- All endpoints return `{ ok: boolean, ... }` and HTTP 200 for expected errors with an `error` message payload.
- Credentials are provided per request; no server-side session is stored.
- Inputs are minimally sanitized; avoid passing raw SQL except via `query.php` for diagnostic use.
