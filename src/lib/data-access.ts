/**
 * Canonical data-access boundary for LMeve client code.
 *
 * Prefer these entry points:
 * - Server session / settings / offline admin: `@/lib/persistenceService`, `@/lib/auth-provider`
 * - Domain corp data (members, assets, jobs, etc.): `useLMeveData()` from `@/lib/LMeveDataContext`
 *   which owns a single `UnifiedDataService` instance after DB connect.
 * - Ad-hoc integrated fetches: `useIntegratedData` / `integratedDataService`
 *   for specialized multi-source reads not yet on UnifiedDataService.
 * - Freshness metadata helpers: `@/lib/data-retrieval-service` (via hooks).
 * - Low-level DB connection UI state: `useDatabase()` from `@/lib/DatabaseContext`
 *
 * Do not add new mock-backed services. The old `dataService` shim is removed.
 */

export { UnifiedDataService } from './unified-data-service';
export { useLMeveData, LMeveDataProvider } from './LMeveDataContext';
export { useDatabase, DatabaseProvider } from './DatabaseContext';
export { integratedDataService } from './integrated-data-service';
export type { FetchOptions, FetchResult } from './integrated-data-service';
