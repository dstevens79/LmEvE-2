# LmEvE-2

Corporation management web app for **EVE Online**.

LmEvE-2 is a self-hosted React + PHP application that helps corps manage members, assets, manufacturing, wallets, market data, planetary interaction, and ESI-linked corporation access.

## What it does

- **Offline local admin** for first-time install and maintenance (works before MySQL is configured)
- **EVE SSO / ESI** login for character and corporation tokens
- **Settings** for database, ESI credentials, data sync, and permissions
- **Corp tools**: dashboard, members, assets, manufacturing, market, wallet, buyback, notifications, theme

## Stack

| Layer | Tech |
|--------|------|
| UI | React 19, TypeScript, Vite, Tailwind CSS 4, Phosphor icons |
| API | PHP under `public/api/` (session cookies; ESI secrets stay server-side) |
| Data | MySQL (after setup), server-backed settings, localStorage for UI prefs |
| Auth | Bootstrap JSON accounts + DB users + ESI OAuth callback |

## Requirements

- Node.js 20+ (build)
- PHP 8.1+ with typical web extensions
- MySQL/MariaDB (after first admin login)
- HTTPS public URL for ESI callback in production

## Quick start (development)

```bash
npm install
npm run dev
```

Point a PHP-capable host (or your reverse proxy) at `public/` for `/api/*`.

Production build:

```bash
npm run build
npm run preview   # static UI only
```

Installer (Ubuntu/Debian, **main branch only**):

```bash
sudo bash scripts/setup-lmeve-app.sh
```

## First-run flow

1. Open the app → land on the dashboard (not setup).
2. Sign in with the offline admin (`admin` / `12345` by default — change it).
3. **Settings → Database** — configure and connect MySQL.
4. **Settings → ESI / SSO** — set client id/secret and public callback URL.
5. Sync data and sign in with EVE characters as needed.

Local admin keeps a site-admin free pass for Settings even when the database is down.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production bundle |
| `npm run lint` | ESLint (flat config) |
| `npm test` | Focused unit tests (Vitest) |
| `npm run preview` | Serve `dist/` |

## Project layout

```
src/                 React UI
public/api/          PHP session + ESI + settings APIs
scripts/             Installer and ops helpers
docs/                Design/ops notes (historical cleanup docs may be stale)
```

## Security notes

- ESI tokens stay server-side; the browser only holds a session cookie identity.
- Do not expose database setup or ESI secrets without an authenticated admin session.
- Change the default offline admin password after install.

## License

Application code in this repository follows the project license. No GitHub Spark runtime is required.
