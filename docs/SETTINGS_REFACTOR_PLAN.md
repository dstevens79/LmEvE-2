# Settings Refactor Plan

This document outlines how we will decompose `src/components/tabs/Settings.tsx` into focused, maintainable tabs with clear lifecycle and persistence rules.

## Objectives
- Smaller, focused files; easier to reason about and test.
- Load data once when a tab is entered.
- Save changes automatically when navigating away from a tab (or via an explicit Save button).
- No per-keystroke persistence; batch writes only.
- Tabs never call ESI directly; all data served by backend (settings.php or database populated by pollers).
- Pollers are controlled only from the Poller/Sync tab.

## High-level structure
```
src/components/settings/
  SettingsShell.tsx              # Tab host: lifecycle, navigation, save-on-leave
  GeneralTab/
    GeneralSettingsPanel.tsx
  DatabaseTab/
    DatabaseConfigPanel.tsx      # DB host/port/user/pass/dbname, SSH/sudo, etc.
    ConnectionLogsPanel.tsx      # Right column, auto-scroll
  ESITab/
    ESICredentialsPanel.tsx      # clientId, clientSecret, callback
    ESIScopesPanel.tsx           # catalogs + selection (no ESI calls)
    CorpESIManagementPanel.tsx   # registered corps list; data from server
  SyncTab/
    SyncSetupPanel.tsx           # (existing)
    ESIRouteManagerPanel.tsx     # route selection + validate on click
    ProcessControlsPanel.tsx     # run manual sync, enable/disable, intervals
  NotificationsTab/
    DiscordPanel.tsx
    EveMailPanel.tsx
  UsersTab/
    UserManagementPanel.tsx
  PermissionsTab/
    PermissionsTab.tsx           # (existing)
  DebugTab/
    DiagnosticsPanel.tsx
```

## Lifecycle contract
Each tab/panel follows a tiny contract so the shell can coordinate saves:
- `load(): Promise<void>` — invoked once when entering the tab (idempotent fetch of server-backed data).
- `save(): Promise<void>` — invoked when leaving the tab if `isDirty()` is true.
- `isDirty(): boolean` — local form state differs from last loaded/saved snapshot.
- `reset(): void` — discard local changes and reapply last snapshot.

Implementation: The shell exposes a context (`useTabLifecycle`) so panels can register their handlers.

## Persistence rules
- All settings are server-backed (settings.php writes to durable storage). No browser storage for settings.
- Local component state holds a draft until save or navigation-away.
- DB/ESI/Sync/Notifications hooks return the last known snapshot and a `commit(updated)` function for server writes.
  - Hooks should not auto-save on every setter.
  - Example pattern:
    ```ts
    const [dbSnapshot, commitDb] = useDatabaseSettings();
    const [form, setForm] = useState(() => dbSnapshot);
    // on save / on navigate-away: await commitDb(form);
    ```

## Data sources
- Tabs never call ESI directly.
- Backend provides:
  - `GET /api/settings.php` (all categories) and `POST /api/settings.php` (partial updates by category).
  - `GET /api/status.php` → { eve: 'online'|'offline'|'unknown', sdeVersion: string, sdeDate: string, appVersion: string }
  - Any corp/user data shown in tabs is fetched from DB (populated by pollers) or from server-side cache.

## Save-on-navigation
- In `SettingsShell`, when `activeTab` changes:
  - call `save()` on previous tab if `isDirty()` is true.
  - then activate the next tab and call `load()` (only once per mount; panels keep their own `loaded` flag).

## Incremental plan (PRs)
1) Carve Database tab
- Extract `DatabaseConfigPanel` and `ConnectionLogsPanel`.
- Keep Test/Connect/Disconnect buttons; logs auto-scroll; move legacy SDE/status panels out.

2) Carve ESI tab
- Extract credentials, scope selection, and corp management (read-only from server; no direct ESI).

3) Carve Sync tab
- Move ESI route manager and process controls; validate only on user action.

4) Carve Notifications tab
- Split Discord and EveMail panels; preserve templates; explicit save or save-on-leave.

5) Extract Users/Permissions/Debug tabs
- Move user management and diagnostics panels.

6) Introduce SettingsShell
- Host all tabs, implement lifecycle, and remove old monolithic `Settings.tsx` usage.

7) Dead code sweep
- Remove legacy SDE/network/status code, mock data, and any localStorage fallbacks for settings.

8) Tighten hooks
- Change hooks to return `[snapshot, commit]` and remove write-through.

## Progress update (2025-11-02)

- Database tab now uses a local draft + dirty flag inside `Settings.tsx` and saves on navigation-away.
  - On entering Database tab, the draft is initialized from server-backed settings and dirty is reset.
  - On leaving Database tab, if dirty, a non-blocking save commits the draft to server.
  - Test/Connect operations use the draft so users can validate unsaved changes.
- ESI: credentials are still in General for now; ESI tab (scopes/corps) remains presentational with server-sourced data.
- Hooks still perform debounced write-through; this is a transitional state. Next, we’ll move to `[snapshot, commit]` to remove per-change writes entirely.

### Short-term next steps

1. Apply the draft/save-on-leave pattern to ESI settings (move credentials into ESITab or wire General’s ESI form to a draft and save on tab switch).
2. Extract `SettingsShell` (wrapper) so tab lifecycle is centralized instead of ad hoc inside `Settings.tsx`.
3. Update hooks to expose `commit(updated)` and stop auto-saving on every setter.
4. Migrate remaining tabs (Sync, Notifications) to the draft lifecycle and explicit save triggers.

## Acceptance criteria
- `Settings.tsx` shrinks to minimal coordinator (or is replaced by `SettingsShell`).
- Database tab: logs on right with auto-scroll; no legacy status/SDE cards; buttons under logs.
- No ESI calls from tabs; statuses and corp data are served by backend.
- Save on navigation-away; load on tab entry; no per-keystroke persistence.
- All settings persist to server storage or DB.

## Notes
- EVE server status and SDE recency should be provided by server endpoints; tabs should not fetch them directly from ESI/remote sources.
- Pollers and any manual runs must only exist on the Sync tab.
