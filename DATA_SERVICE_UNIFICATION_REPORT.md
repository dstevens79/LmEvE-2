# Data Service Unification Report

## Executive Summary

The LMeve application currently has **multiple competing data service implementations** that need to be unified into a single, coherent architecture. The poller/sync services are designed to fetch ESI data and store it in the database, but the tabs are not consistently using this database-first approach.

## Current Architecture Analysis

### Data Service Implementations Found

1. **`dataService.ts`** - LMeveDataService class
   - Returns mock data
   - Has database query methods but they're not fully implemented
   - Used by: LMeveDataContext

2. **`esi-data-service.ts`** - ESIDataFetchService class
   - Direct ESI API calls with retry logic and caching
   - Does NOT use database at all
   - Comprehensive fetching for all data types
   - Used by: Some tabs call this directly

3. **`integrated-data-service.ts`** - IntegratedDataService class
   - Smart fallback: ESI → Database → Cache
   - Partially implemented
   - NOT widely adopted in tabs

4. **`LMeveDataContext.tsx`** - React Context Provider
   - Uses LMeveDataService (which returns mock data)
   - Has ESI integration attempts mixed in
   - Inconsistent implementation
   - Used by: Most tabs through `useLMeveData()` hook

5. **`sync-executor.ts` + `sync-scheduler.ts`** - Poller Services
   - Designed to sync ESI → Database on schedules
   - Comprehensive sync processes for all data types
   - NOT connected to the tab data loading

### The Core Problem

**Tabs are NOT reading from the database that the poller services populate.** Instead, they either:
- Call ESI directly (bypassing database entirely)
- Use mock data from LMeveDataService
- Mix ESI calls with database queries inconsistently

## Required Changes

### Phase 1: Unified Data Service Layer

Create a **single, authoritative data service** that:

1. **Primary Source**: Database (populated by poller services)
2. **Secondary Source**: ESI (if database is empty/stale and user has token)
3. **Fallback**: Cache (in-memory for performance)

### Phase 2: Update All Tabs to Use Unified Service

#### Tabs Requiring Updates:

1. **Members** (`src/components/tabs/Members.tsx`)
   - ✅ Already uses `useLMeveData()` 
   - ❌ But LMeveData returns mock data, not database data
   - **Fix**: Make `refreshMembers()` in LMeveDataContext query database first

2. **Assets** (`src/components/tabs/Assets.tsx`)
   - ✅ Already uses `useLMeveData()`
   - ❌ But LMeveData returns mock data, not database data
   - **Fix**: Make `refreshAssets()` query database first

3. **Manufacturing** (`src/components/tabs/Manufacturing.tsx`)
   - ❌ Uses `useKV` for local storage of jobs
   - ❌ Has direct ESI calls via `ESIDataFetchService`
   - **Fix**: Use `useLMeveData()` and ensure it reads from database

4. **PlanetaryInteraction** (`src/components/tabs/PlanetaryInteraction.tsx`)
   - **Status**: Need to check
   - **Expected**: Likely using mock or direct ESI
   - **Fix**: Use database-first approach

5. **Market** (`src/components/tabs/Market.tsx`)
   - **Status**: Need to check
   - **Expected**: Likely using mock or direct ESI
   - **Fix**: Use database-first approach

6. **Wallet** (`src/components/tabs/Wallet.tsx`)
   - **Status**: Need to check
   - **Expected**: Likely using mock or direct ESI
   - **Fix**: Use database-first approach

7. **Buyback** (`src/components/tabs/Buyback.tsx`)
   - **Status**: Need to check
   - **Expected**: May be reading item costs from database
   - **Fix**: Ensure consistent with unified service

### Phase 3: Database Schema & Storage

Ensure database has proper tables for all synced data:

**Tables Required:**
- ✅ `characters` (members)
- ✅ `assets`
- ✅ `industry_jobs` (manufacturing)
- ✅ `market_orders`
- ✅ `wallet_transactions`
- ✅ `wallet_divisions`
- ✅ `mining_ledger`
- ✅ `container_logs`
- ✅ `contracts`
- ❓ `planetary_colonies`
- ❓ `planetary_pins`
- ✅ `item_costs` (for buyback)

### Phase 4: Sync Process Integration

Connect the sync scheduler to populate database:

1. **Sync processes already exist**:
   - `syncMembers()` ✅
   - `syncAssets()` ✅
   - `syncManufacturing()` ✅
   - `syncMarket()` ✅
   - `syncWallet()` ✅
   - `syncMining()` ✅
   - `syncContainerLogs()` ✅
   - `syncContracts()` ✅
   - `syncPlanetary()` ✅
   - `syncItemCosts()` ✅

2. **Integration needed**:
   - Settings panel should allow configuring sync intervals
   - Manual "Sync Now" button for each data type
   - Display last sync time and status
   - Show data source (ESI vs Database) in UI

## Proposed Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         TAB COMPONENTS                       │
│   (Members, Assets, Manufacturing, Market, Wallet, etc.)     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ useLMeveData() hook
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   UNIFIED DATA SERVICE                       │
│                  (LMeveDataContext.tsx)                      │
│                                                              │
│  Strategy:                                                   │
│  1. Try Database first (fastest, no rate limits)            │
│  2. If empty/stale + has token → fetch ESI                  │
│  3. Store ESI response in database                          │
│  4. Return data to component                                │
└────────┬─────────────────────────────────────┬──────────────┘
         │                                     │
         │ Database queries                    │ ESI API calls
         ▼                                     ▼
┌──────────────────────┐            ┌──────────────────────┐
│   DATABASE SERVICE   │            │   ESI DATA SERVICE   │
│  (database.ts)       │            │ (esi-data-service.ts)│
│                      │            │                      │
│  - Query DB tables   │            │  - Fetch from ESI    │
│  - Store results     │            │  - Retry logic       │
│  - Transaction mgmt  │            │  - Rate limiting     │
└──────────────────────┘            └──────────────────────┘
         ▲                                     │
         │                                     │
         │ Periodic sync writes                │ Periodic reads
         │                                     │
┌────────┴─────────────────────────────────────┴──────────────┐
│                    SYNC SCHEDULER                            │
│                  (sync-scheduler.ts)                         │
│                                                              │
│  - Runs every N minutes (configurable)                       │
│  - Fetches ESI data for corporation                          │
│  - Stores in database                                        │
│  - Updates "last sync" timestamp                             │
└──────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Step 1: Fix LMeveDataContext to Use Database

Update `src/lib/LMeveDataContext.tsx`:

```typescript
// Current: Returns mock data
const members = await dataService.getMembers();

// New: Database-first approach
async function fetchMembers() {
  // 1. Try database first
  const dbMembers = await db.query('SELECT * FROM characters WHERE corporation_id = ?', [corpId]);
  
  // 2. If empty and has token, fetch from ESI and store
  if (dbMembers.length === 0 && user.accessToken) {
    const esiMembers = await esiService.fetchCorporationMembers(corpId, token);
    await db.storeManyCharacters(esiMembers);
    return transformESIMembers(esiMembers);
  }
  
  // 3. Return database data
  return dbMembers;
}
```

### Step 2: Remove Direct ESI Calls from Tabs

- Remove `ESIDataFetchService` imports from tabs
- Remove direct `eveApi` calls from tabs
- Use only `useLMeveData()` hook

### Step 3: Add Data Freshness Indicators

In each tab, show:
- Last sync time
- Data source (Database/ESI/Cache)
- "Refresh" button to force ESI fetch

### Step 4: Connect Sync Scheduler UI

In Settings → Data Sync tab:
- Configure sync intervals per data type
- Manual "Sync Now" buttons
- Last sync timestamps
- Sync status and errors

## Files to Modify

### Core Service Files
1. ✏️ `src/lib/LMeveDataContext.tsx` - Make database-first
2. ✏️ `src/lib/dataService.ts` - Remove mock data, implement real DB queries
3. ✏️ `src/lib/database.ts` - Ensure all storage methods exist
4. 📝 `src/lib/unified-data-service.ts` - NEW: Single source of truth

### Tab Files
1. ✏️ `src/components/tabs/Members.tsx` - Remove ESI direct calls
2. ✏️ `src/components/tabs/Assets.tsx` - Remove ESI direct calls
3. ✏️ `src/components/tabs/Manufacturing.tsx` - Use unified service
4. ✏️ `src/components/tabs/PlanetaryInteraction.tsx` - Use unified service
5. ✏️ `src/components/tabs/Market.tsx` - Use unified service
6. ✏️ `src/components/tabs/Wallet.tsx` - Use unified service
7. ✏️ `src/components/tabs/Buyback.tsx` - Verify database usage

### Settings Integration
1. ✏️ `src/components/tabs/Settings.tsx` - Add sync controls
2. ✏️ `src/components/tabs/SyncMonitoring.tsx` - Display sync status

## Data Flow Examples

### Example: Loading Members Tab

**Current (Broken) Flow:**
```
User opens Members tab
  → useLMeveData() called
    → dataService.getMembers()
      → Returns MOCK DATA (not from database)
```

**New (Correct) Flow:**
```
User opens Members tab
  → useLMeveData() called
    → Check database for members
      → If found: Return database members
      → If empty + has token:
          → Fetch from ESI
          → Store in database
          → Return fresh data
      → If empty + no token: Return empty (show login prompt)
```

### Example: Background Sync

**New Flow:**
```
Every 30 minutes (configurable):
  Sync Scheduler triggers
    → For each registered corporation:
      → Fetch members from ESI
      → Store in database (UPDATE or INSERT)
      → Update last_sync timestamp
    → For each data type:
      → Repeat above
```

When user opens tab later:
```
User opens Members tab
  → Check database
    → Found 42 members (synced 5 minutes ago)
    → Display immediately (fast!)
    → Show "Last synced: 5m ago"
```

## Benefits of This Approach

1. **Performance**: Database queries are much faster than ESI API calls
2. **Rate Limiting**: Respects ESI rate limits via scheduled polling
3. **Offline Capability**: Can view cached data without ESI connection
4. **Consistency**: All tabs use same data source
5. **Scalability**: Can handle large corporations with pagination in DB
6. **Transparency**: Users see data source and freshness

## Testing Strategy

1. **Unit Tests**: Each data service method
2. **Integration Tests**: Database ↔ ESI sync
3. **UI Tests**: Tab data loading with various states
4. **Manual Tests**:
   - Fresh database (should trigger ESI fetch)
   - Populated database (should use cached data)
   - Token expired (should show stale data + login prompt)
   - Sync errors (should display gracefully)

## Rollout Plan

### Phase 1: Core Service (Week 1)
- Implement unified data service
- Fix LMeveDataContext
- Update dataService to use real DB queries

### Phase 2: High-Traffic Tabs (Week 2)
- Members tab
- Assets tab
- Dashboard

### Phase 3: Manufacturing & Jobs (Week 3)
- Manufacturing tab
- Verify sync processes working

### Phase 4: Financial & Market (Week 4)
- Market tab
- Wallet tab
- Buyback tab integration

### Phase 5: Additional Features (Week 5)
- Planetary Interaction tab
- Mining tab integration
- Killmails integration

### Phase 6: Polish & Monitoring (Week 6)
- Sync monitoring UI
- Error logging dashboard
- Performance optimization

## Risk Mitigation

**Risk**: Breaking existing functionality during transition

**Mitigation**:
- Keep both old and new services temporarily
- Feature flag to switch between modes
- Extensive logging during transition
- Ability to rollback

**Risk**: Database not populated when users first login

**Mitigation**:
- On first login, trigger immediate sync
- Show loading state while syncing
- Allow users to browse with ESI fallback during initial sync

**Risk**: Sync scheduler performance issues

**Mitigation**:
- Make sync intervals configurable
- Add abort capability
- Monitor sync duration
- Limit concurrent syncs

## Success Criteria

- [ ] All tabs load data from database first
- [ ] ESI calls only when database is empty or manual refresh
- [ ] Sync scheduler running and populating database
- [ ] Data freshness indicators visible in UI
- [ ] No mock data in production code
- [ ] All sync processes have error handling
- [ ] Settings panel shows sync configuration
- [ ] Performance: Tab load time < 500ms (database query)
- [ ] No ESI rate limit errors during normal usage

## Conclusion

The current architecture has **3+ competing data service implementations** that need to be **unified into a single database-first approach**. The poller services are already built and ready to populate the database, but the tabs aren't reading from it.

**Recommended Action**: Implement the unified data service architecture outlined above, starting with core services and high-traffic tabs, then rolling out to all tabs systematically.
