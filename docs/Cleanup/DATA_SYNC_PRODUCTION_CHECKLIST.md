# Data Sync Production Implementation Checklist

## Overview
**Current State**: Data sync UI exists but does NOT actually sync data. It simulates progress bars with no real ESI calls or database writes.

**Goal**: Implement scheduled polling: ESI API → Database Cache → UI reads from database

**Complexity**: High (8/10) - Multi-system integration required

---

## Critical Path Items

### 1. Database Storage Layer (PRIORITY: CRITICAL)
**Status**: ❌ Missing - Tables exist but no storage functions

**Tasks**:
- [ ] 1.1 Create ESI data storage service (`/src/lib/esi-data-storage.ts`)
  - `storeCorporationMembers(corpId, data)` - Save member tracking
  - `storeCorporationAssets(corpId, data)` - Save assets with locations
  - `storeIndustryJobs(corpId, data)` - Save manufacturing/research jobs
  - `storeMarketOrders(corpId, data)` - Save market buy/sell orders
  - `storeWalletTransactions(corpId, division, data)` - Save wallet data
  - `storeMiningLedger(corpId, data)` - Save mining operations
  - `storeContainerLogs(corpId, data)` - Save hangar delivery logs (for PI tracking)
  - `storeBlueprints(corpId, data)` - Save blueprint library

- [ ] 1.2 Verify database schemas match ESI response structures
  - Review each table in `database-schemas.ts`
  - Add missing columns for ESI fields
  - Add indexes for common queries (character_id, type_id, location_id)

- [ ] 1.3 Add data retrieval queries
  - `getCachedMembers(corpId, maxAge)` - Read with freshness check
  - `getCachedAssets(corpId, locationId, maxAge)`
  - `getCachedIndustryJobs(corpId, status, maxAge)`
  - `getCachedMarketOrders(corpId, maxAge)`
  - `getCachedWalletData(corpId, division, startDate, endDate)`

**Files**:
- Create: `/src/lib/esi-data-storage.ts`
- Modify: `/src/lib/database-schemas.ts`
- Modify: `/src/lib/database.ts`

**Time Estimate**: 8-10 hours

---

### 2. ESI Data Fetching Service (PRIORITY: CRITICAL)
**Status**: ⚠️ Partial - Route definitions exist but no authenticated fetching

**Tasks**:
- [ ] 2.1 Create authenticated ESI client (`/src/lib/esi-client.ts`)
  - Implement bearer token authentication
  - Handle ESI rate limiting (429 responses, wait for reset)
  - Implement ETag caching (if-none-match headers)
  - Handle pagination for large datasets
  - Implement retry logic with exponential backoff
  - Proper error handling for ESI error responses

- [ ] 2.2 Create ESI data fetch functions
  - `fetchCorporationMembers(corpId, token)` - GET /v4/corporations/{id}/membertracking/
  - `fetchCorporationAssets(corpId, token)` - GET /v5/corporations/{id}/assets/ (paginated)
  - `fetchIndustryJobs(corpId, token)` - GET /v1/corporations/{id}/industry/jobs/
  - `fetchMarketOrders(corpId, token)` - GET /v3/corporations/{id}/orders/
  - `fetchWalletTransactions(corpId, division, token)` - GET /v1/corporations/{id}/wallets/{div}/transactions/
  - `fetchWalletJournal(corpId, division, token)` - GET /v4/corporations/{id}/wallets/{div}/journal/
  - `fetchMiningLedger(corpId, token)` - GET /v1/corporations/{id}/mining/
  - `fetchContainerLogs(corpId, token)` - GET /v3/corporations/{id}/containers/logs/ (for deliveries)
  - `fetchBlueprints(corpId, token)` - GET /v3/corporations/{id}/blueprints/

- [ ] 2.3 Implement ESI metadata caching
  - Cache ETag values per endpoint
  - Track last modified timestamps
  - Only refetch if data has changed (304 responses)

**Files**:
- Create: `/src/lib/esi-client.ts`
- Create: `/src/lib/esi-fetch-service.ts`
- Modify: `/src/lib/eveApi.ts`

**Time Estimate**: 10-12 hours

---

### 3. Sync Orchestration Engine (PRIORITY: CRITICAL)
**Status**: ❌ Completely Missing - This is the core scheduler

**Tasks**:
- [ ] 3.1 Create sync scheduler (`/src/lib/sync-scheduler.ts`)
  - Interval timer system for each sync process
  - Check enabled/disabled state from settings
  - Calculate next run time based on interval
  - Prevent concurrent runs of same process
  - Track running processes

- [ ] 3.2 Create sync executor (`/src/lib/sync-executor.ts`)
  - Execute sync pipeline: Fetch ESI → Transform → Store DB
  - Handle process-specific logic
  - Update last sync timestamp
  - Log sync results (success/failure, rows affected)
  - Emit events for UI updates

- [ ] 3.3 Create sync state manager (`/src/lib/sync-state-manager.ts`)
  - Track sync status per process (idle/running/success/error)
  - Store last successful sync time
  - Track error count and last error message
  - Persist state to database
  - Expose state to UI components

- [ ] 3.4 Implement sync lifecycle
  ```
  For each enabled sync process:
  1. Check if interval has elapsed since last sync
  2. Get corporation ESI token from auth system
  3. Call ESI fetch function
  4. Transform/validate data
  5. Store in database via storage functions
  6. Update sync state (timestamp, status, error if any)
  7. Schedule next run
  ```

**Files**:
- Create: `/src/lib/sync-scheduler.ts`
- Create: `/src/lib/sync-executor.ts`
- Create: `/src/lib/sync-state-manager.ts`

**Time Estimate**: 12-15 hours

---

### 4. Background Worker (PRIORITY: HIGH)
**Status**: ❌ Missing - Critical for automatic scheduling

**Problem**: Browser apps cannot reliably run background tasks

**Solutions**:

#### Option A: React-Based Polling (Development/Demo Only)
- Use React effect with setInterval
- Only works while app is open
- **Limitation**: Stops when browser closed
- **Good for**: Development and testing

#### Option B: Service Worker (Better)
- Runs in background even when tab inactive
- Browser policies may limit execution
- **Limitation**: Only works while browser open
- **Good for**: Browser-based deployment

#### Option C: Server-Side Cron (Production Recommended)
- Separate Node.js process or cron job
- Runs independently of browser
- Most reliable for production
- **Limitation**: Requires server deployment

**Tasks**:
- [ ] 4.1 Implement Option A for immediate functionality
  - Create React hook that runs scheduler while app open
  - Use in App.tsx to start background sync
  - Add UI controls to pause/resume

- [ ] 4.2 Document Option C for production (create deployment guide)
  - Create example cron script
  - Document server requirements
  - Provide systemd service example

**Files**:
- Create: `/src/hooks/useSyncScheduler.ts` (Option A)
- Create: `/scripts/sync-daemon.js` (Option C example)
- Create: `/docs/PRODUCTION_DEPLOYMENT.md`

**Time Estimate**: 6-8 hours

---

### 5. Token Management Integration (PRIORITY: HIGH)
**Status**: ⚠️ Needs Verification

**Tasks**:
- [ ] 5.1 Verify corporation ESI token storage
  - Ensure director/CEO tokens stored with full scopes
  - Required scopes:
    - `esi-corporations.read_corporation_membership.v1`
    - `esi-assets.read_corporation_assets.v1`
    - `esi-industry.read_corporation_jobs.v1`
    - `esi-markets.read_corporation_orders.v1`
    - `esi-wallet.read_corporation_wallets.v1`
    - `esi-corporations.read_container_logs.v1`
    - `esi-corporations.read_blueprints.v1`

- [ ] 5.2 Implement token refresh before sync
  - Check token expiration before each sync
  - Auto-refresh if expiring within 5 minutes
  - Handle refresh failures gracefully

- [ ] 5.3 Multi-corporation support
  - Identify which corporation to sync (if multiple registered)
  - Use correct token for each corp
  - Track sync state per corporation

**Files**:
- Review: `/src/lib/auth-provider.tsx`
- Review: `/src/lib/esi-auth.ts`
- Modify: `/src/lib/sync-executor.ts`

**Time Estimate**: 4-5 hours

---

### 6. UI Integration (PRIORITY: MEDIUM)
**Status**: ⚠️ UI exists but not connected to real sync

**Tasks**:
- [ ] 6.1 Connect DataSyncSettings to real sync service
  - Replace simulated `runSyncProcess()` with real implementation
  - Wire up manual "Sync Now" buttons to sync executor
  - Display real-time sync status from state manager
  - Show actual last sync times from database

- [ ] 6.2 Add sync monitoring features
  - Real-time progress updates during sync
  - Sync history log viewer
  - Error display with retry options
  - ETA based on previous sync durations

- [ ] 6.3 Add data freshness indicators to all tabs
  - Show "Last updated X minutes ago" on each tab
  - Warning icon if data is stale (older than 2x sync interval)
  - Manual "Refresh Now" option on each tab

**Files**:
- Modify: `/src/components/settings/DataSyncSettings.tsx`
- Modify: All tab components (Dashboard, Members, Assets, etc.)

**Time Estimate**: 6-8 hours

---

### 7. Replace Mock Data with Database Queries (PRIORITY: HIGH)
**Status**: ❌ All tabs use hardcoded mock data

**Tasks**:
- [ ] 7.1 Update dataService.ts
  - Replace mock data with real database queries
  - Add data freshness checks
  - Return cache age with results

- [ ] 7.2 Update tab components
  - Dashboard: Read from cached wallet/jobs/assets data
  - Members: Query corporation_members table
  - Assets: Query corporation_assets by location
  - Manufacturing: Query industry_jobs table
  - Market: Query market_orders table
  - Wallet: Query wallet_transactions and journal
  - Planetary Interaction: Query container_logs for deliveries

- [ ] 7.3 Handle empty/stale data states
  - Show empty state if no cached data
  - Prompt to run initial sync
  - Show "data may be stale" warning

**Files**:
- Modify: `/src/lib/dataService.ts`
- Modify: All tab component files

**Time Estimate**: 8-10 hours

---

### 8. Error Handling & Monitoring (PRIORITY: MEDIUM)
**Status**: ❌ No error tracking system

**Tasks**:
- [ ] 8.1 Create sync error logger
  - Log all sync errors to database with:
    - Timestamp
    - Process name
    - Error type/message
    - ESI endpoint
    - HTTP status code
    - Retry count
  - Track error patterns

- [ ] 8.2 Implement error notifications
  - Toast notifications for sync failures
  - Email/Discord alerts for repeated failures (optional)
  - Error summary in dashboard

- [ ] 8.3 Create sync monitoring dashboard
  - Overall sync health status
  - Per-process success rate
  - Error history viewer
  - ESI rate limit tracking
  - Database storage usage

**Files**:
- Create: `/src/lib/sync-error-logger.ts`
- Create: `/src/components/tabs/SyncMonitoring.tsx`
- Modify: `/src/components/tabs/Dashboard.tsx` (add health widget)

**Time Estimate**: 6-8 hours

---

### 9. Testing & Validation (PRIORITY: HIGH)
**Status**: ❌ No testing infrastructure for sync

**Tasks**:
- [ ] 9.1 Create sync system tests
  - Test ESI fetch for each endpoint
  - Test database storage for each data type
  - Test sync scheduler intervals
  - Test error handling and retry logic
  - Test token refresh

- [ ] 9.2 Create integration tests
  - End-to-end sync: ESI → Database → UI
  - Multi-corporation sync
  - Concurrent sync handling
  - Stale data detection

- [ ] 9.3 Load testing
  - Test with large datasets (10k+ assets)
  - Test pagination handling
  - Test sync performance
  - Identify bottlenecks

**Files**:
- Create: `/src/lib/__tests__/sync-system.test.ts`
- Create: `/src/lib/__tests__/esi-client.test.ts`
- Create: `/src/lib/__tests__/esi-data-storage.test.ts`

**Time Estimate**: 8-10 hours

---

### 10. Documentation (PRIORITY: MEDIUM)
**Status**: ❌ No production deployment docs

**Tasks**:
- [ ] 10.1 Create production deployment guide
  - Server requirements
  - Database setup
  - Cron/systemd configuration
  - Token scope requirements
  - Troubleshooting guide

- [ ] 10.2 Create sync configuration guide
  - Recommended intervals per sync type
  - ESI rate limit guidance
  - Database sizing recommendations
  - Performance tuning

- [ ] 10.3 Update user documentation
  - How to configure sync processes
  - How to monitor sync health
  - How to troubleshoot sync errors

**Files**:
- Create: `/docs/PRODUCTION_DEPLOYMENT.md`
- Create: `/docs/SYNC_CONFIGURATION.md`
- Update: `/README.md`

**Time Estimate**: 4-6 hours

---

## Total Effort Estimate

**Conservative Estimate**: 72-92 hours (9-12 full working days)

**Breakdown by Priority**:
- Critical Items (1, 2, 3): 30-37 hours
- High Priority Items (4, 5, 7): 18-23 hours  
- Medium Priority Items (6, 8, 10): 16-22 hours
- Testing (9): 8-10 hours

---

## Recommended Implementation Strategy

### Phase 1: Core Functionality (MVP)
**Goal**: Get data flowing ESI → Database → UI

**Items**: 1, 2, 3, 5, 7
**Time**: ~48 hours
**Result**: Manual sync works, data persists, UI shows real data

### Phase 2: Automation
**Goal**: Add scheduled background sync

**Items**: 4
**Time**: ~8 hours
**Result**: Automatic polling while app is open

### Phase 3: Polish & Production
**Goal**: Production-ready deployment

**Items**: 6, 8, 9, 10
**Time**: ~28 hours
**Result**: Full monitoring, error handling, documentation

---

## Alternative: Minimal Working Implementation

If you need something working ASAP, here's the absolute minimum:

### Quick Path (16-20 hours)
1. **ESI Fetch Service** (6h) - Get one sync type working (e.g., members)
2. **Database Storage** (4h) - Store that one type
3. **Manual Sync UI** (3h) - "Sync Now" button that works
4. **Replace Mock Data** (3h) - Show real data in Members tab

**Result**: Proof of concept that can be expanded incrementally

---

## Decision Required

**Option A**: Full Implementation (~72-92 hours)
- Complete automated sync system
- Production-ready
- All features

**Option B**: Phased Implementation
- Phase 1 first (~48 hours)
- Evaluate, then proceed to Phase 2/3

**Option C**: Minimal Working Version (~16-20 hours)
- One sync type fully working
- Expand others after validating approach

**Which would you prefer?**

I recommend **Option B** (Phased) as it provides working functionality soonest while maintaining path to full implementation.
