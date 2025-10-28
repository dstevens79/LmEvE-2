# Data Sync Implementation Checklist

## Current State Analysis

### What's Currently Happening ❌
The data sync system in `Settings -> Data Sync` is **NOT** actually syncing data. It's simulating a sync process with fake progress bars.

**Evidence:**
- `DataSyncSettings.tsx` line 208-229: `runSyncProcess()` only simulates progress
- No actual ESI API calls are being made
- No database writes are occurring
- No scheduled polling is happening
- Data shown in tabs is hardcoded mock data

### What Should Be Happening ✅

Data sync should work as follows:

1. **Scheduled Polling**: Each enabled sync process runs on its configured interval
2. **ESI Data Fetch**: Calls EVE ESI endpoints with proper authentication
3. **Database Storage**: Stores fetched data in the MySQL database
4. **Cache System**: UI reads from database instead of calling ESI directly
5. **Rate Limiting**: Respects ESI rate limits and uses ETags for efficient polling

---

## Implementation Checklist

This is a **multi-step implementation** that requires careful attention. Below are the steps needed to make data sync functional.

### Phase 1: Database Schema & Storage Layer ✅ (COMPLETE)
**Status**: Database schemas verified and storage functions created

- [x] Database schemas defined in `database-schemas.ts`
- [x] **Verify all ESI data tables exist and match ESI response structures**
  - [x] Members table (members)
  - [x] Assets table (assets)
  - [x] Industry jobs table (manufacturing_jobs)
  - [x] Market orders table (market_orders) - ADDED
  - [x] Wallet transactions table (wallet_transactions)
  - [x] Mining ledger table (mining_ledger) - ADDED
  - [x] Killmails table (killmails)
  - [x] Container logs table (container_logs) - ADDED

- [x] **Create database service functions for ESI data storage**
  - [x] `storeMembers(corporationId, membersData)` - Created in ESIDataStorageService class
  - [x] `storeAssets(corporationId, assetsData)` - Created in ESIDataStorageService class
  - [x] `storeIndustryJobs(corporationId, jobsData)` - Created in ESIDataStorageService class
  - [x] `storeMarketOrders(corporationId, ordersData)` - Created in ESIDataStorageService class
  - [x] `storeWalletTransactions(corporationId, division, transactionsData)` - Created in ESIDataStorageService class
  - [x] `storeMiningLedger(corporationId, miningData)` - Created in ESIDataStorageService class
  - [x] `storeContainerLogs(corporationId, logsData)` - Created in ESIDataStorageService class

**Files modified:**
- ✅ `/src/lib/database.ts` - Added ESIDataStorageService class with all storage methods
- ✅ `/src/lib/database-schemas.ts` - Added missing tables: market_orders, mining_ledger, container_logs

**Implementation Details:**
- Created ESIDataStorageService class with 7 storage methods
- Each method handles INSERT with ON DUPLICATE KEY UPDATE for efficient upserts
- Proper SQL escaping implemented
- Type-safe interfaces for all ESI data structures
- Console logging for debugging and monitoring

---

### Phase 2: ESI Integration Layer ⚠️ (Needs Major Work)
**Status**: ESI route definitions exist but no actual data fetching

- [x] ESI routes defined in `esi-routes.ts`
- [ ] **Create ESI data fetching service**
  - Implement authenticated ESI calls using corporation tokens
  - Handle pagination for large datasets
  - Implement ETag caching to minimize redundant calls
  - Handle ESI errors and rate limiting (429 responses)
  - Implement retry logic with exponential backoff

- [ ] **Create ESI fetch functions for each sync type**
  - `fetchCorporationMembers(corpId, token)`
  - `fetchCorporationAssets(corpId, token)`
  - `fetchIndustryJobs(corpId, token)`
  - `fetchMarketOrders(corpId, token)`
  - `fetchWalletData(corpId, division, token)`
  - `fetchMiningLedger(corpId, token)`
  - `fetchKillmails(corpId, token)`
  - `fetchContainerLogs(corpId, token)` - For PI delivery tracking

**Files to create/modify:**
- `/src/lib/esi-data-service.ts` - New file for ESI data fetching
- `/src/lib/eveApi.ts` - Extend with authenticated ESI calls

---

### Phase 3: Sync Orchestration Service 🔴 (Missing Entirely)
**Status**: Does not exist - this is the core missing piece

- [ ] **Create sync scheduler service**
  - Implements interval-based polling for each sync process
  - Tracks next run time for each process
  - Prevents concurrent runs of the same process
  - Logs sync history and errors

- [ ] **Create sync execution pipeline**
  - For each sync process:
    1. Check if process is enabled
    2. Check if it's time to run (based on interval)
    3. Get corporation ESI token from auth system
    4. Fetch data from ESI
    5. Transform/validate data
    6. Store in database
    7. Update last sync timestamp
    8. Log results

- [ ] **Implement sync state management**
  - Track running syncs
  - Track last successful sync per process
  - Track errors and retry counts
  - Expose sync status to UI

**Files to create:**
- `/src/lib/sync-scheduler.ts` - Interval-based scheduler
- `/src/lib/sync-executor.ts` - Sync execution pipeline
- `/src/lib/sync-state-manager.ts` - State tracking

---

### Phase 4: UI Integration 🟡 (Partially Complete)
**Status**: UI exists but needs connection to real sync service

- [x] Data Sync settings UI exists
- [x] Interval configuration per process exists
- [x] ESI route version selection exists
- [ ] **Connect UI to real sync service**
  - Replace simulated `runSyncProcess()` with real implementation
  - Display actual sync status from sync state manager
  - Show real last sync times from database
  - Display actual errors and retry information

- [ ] **Add sync monitoring features**
  - Real-time sync progress updates
  - Sync history log viewer
  - Error notification system
  - Manual sync trigger with feedback

**Files to modify:**
- `/src/components/settings/DataSyncSettings.tsx` - Connect to real sync service
- `/src/lib/persistenceService.ts` - May need sync state persistence

---

### Phase 5: Background Worker Implementation 🔴 (Critical - Missing)
**Status**: Does not exist

**Problem**: Browser apps cannot run background scheduled tasks reliably.

**Solutions:**

#### Option A: Browser-Based Polling (Limited)
- Use React effect to check sync schedule while app is open
- Only works when user has app open
- Not suitable for production

#### Option B: Service Worker (Better)
- Implement service worker for background sync
- Works when browser is open (even if tab is closed)
- Limited by browser policies

#### Option C: Server-Side Cron (Recommended for Production)
- Create server-side sync worker
- Run on same host as database or app server
- Use cron or systemd timer to trigger syncs
- Most reliable option

**For current Spark environment**, we're limited to Option A or B.

**Recommended Approach**:
1. Implement Option A for development/demo
2. Document Option C for production deployment
3. Create sync worker script for production use

**Files to create:**
- `/src/workers/sync-worker.ts` - Service worker for background sync
- `/scripts/sync-cron.sh` - Production cron script (documentation)
- `/docs/PRODUCTION_SYNC_SETUP.md` - Deployment guide

---

### Phase 6: Data Retrieval Layer 🟡 (Partially Complete)
**Status**: Mock data exists, need real database queries

- [ ] **Replace mock data with database queries**
  - Dashboard: Read from database instead of hardcoded data
  - Members: Query corporation_members table
  - Assets: Query corporation_assets table  
  - Manufacturing: Query industry_jobs table
  - Market: Query market_orders table
  - Wallet: Query wallet_transactions table
  - All tabs should read cached data from database

- [ ] **Implement data freshness indicators**
  - Show "last updated" time on each tab
  - Warn if data is stale (hasn't synced recently)
  - Provide manual refresh option

**Files to modify:**
- `/src/lib/dataService.ts` - Replace mock data with real queries
- All tab components - Add data freshness indicators

---

### Phase 7: Corporation Token Management 🟡 (Needs Review)
**Status**: ESI auth exists but needs verification for sync usage

- [ ] **Verify corporation ESI token storage**
  - Ensure corporation director/CEO tokens are stored
  - Verify tokens include all required scopes for sync processes
  - Implement token refresh before expiration

- [ ] **Token selection for sync**
  - Determine which corporation to sync (if multiple registered)
  - Use appropriate token for each sync process
  - Handle token expiration gracefully

**Files to review/modify:**
- `/src/lib/auth-provider.tsx` - Verify corp token storage
- `/src/lib/esi-auth.ts` - Review token refresh logic

---

### Phase 8: Error Handling & Monitoring 🔴 (Missing)
**Status**: No error tracking or monitoring

- [ ] **Implement sync error logging**
  - Log all sync errors to database
  - Track error patterns (repeated failures)
  - Implement error notification system

- [ ] **Create sync monitoring dashboard**
  - Show sync health status
  - Display error history
  - Show ESI rate limit status
  - Display database storage usage

**Files to create:**
- `/src/lib/sync-error-logger.ts` - Error logging service
- `/src/components/tabs/SyncMonitoring.tsx` - Monitoring dashboard

---

## Quick Assessment: Is This Easy to Fix?

**Answer: NO** - This is not a simple fix.

### Complexity Rating: 8/10

**Why it's complex:**
1. Requires proper ESI authentication flow
2. Needs reliable background scheduling (difficult in browser)
3. Database storage layer needs expansion
4. Multiple systems must work together (auth + ESI + database + scheduler)
5. Error handling and retry logic is non-trivial
6. Production deployment requires server-side components

### Estimated Effort:
- **Full implementation**: 40-60 hours of development
- **Testing & refinement**: 10-20 hours
- **Total**: 50-80 hours

---

## Recommended Approach

Given the complexity, I recommend we proceed **iteratively**:

### Immediate Next Steps (Choose One):

#### Path 1: Quick Demo Implementation (2-3 hours)
- Implement basic ESI fetch + database store for ONE sync type (e.g., members)
- Add manual "Sync Now" button that works
- Show this is proof-of-concept that can be expanded
- **Good for**: Understanding the flow, testing feasibility

#### Path 2: Full Scheduled System (20-30 hours)
- Implement all phases above
- Create production-ready sync system
- Full error handling and monitoring
- **Good for**: Production deployment

#### Path 3: Hybrid Approach (10-15 hours)
- Implement ESI fetch + database store for all sync types
- Manual sync triggers only (no automatic scheduling)
- Basic error handling
- Document automatic scheduling for production deployment
- **Good for**: Getting functional system quickly, finish scheduling later

---

## My Recommendation

**I recommend Path 3: Hybrid Approach**

**Reasoning:**
1. Gets data flowing from ESI → Database immediately
2. All tabs can read real data from database
3. Users can manually trigger syncs when needed
4. Provides clear path to add scheduling later
5. Can be implemented in manageable chunks

**Would you like me to proceed with Path 3?**

If yes, I'll start with:
1. Phase 1: Verify database schemas (30 min)
2. Phase 2: Create ESI data fetching service (3-4 hours)
3. Phase 1: Create database storage functions (2-3 hours)
4. Phase 4: Wire up manual sync triggers in UI (2 hours)
5. Phase 6: Replace mock data with database queries (3-4 hours)

---

## Alternative: Just Fix What's Broken

If you want me to just make the **existing Data Sync UI actually work** (even without scheduling):

**Simple fix scope:**
- Make "Sync Now" button actually fetch from ESI
- Store results in database
- Show real progress
- Display errors if they occur
- **Time**: 4-6 hours

This won't give you automatic scheduled syncing, but it will make the manual sync functional and data will persist in the database.

Let me know which approach you'd prefer!
