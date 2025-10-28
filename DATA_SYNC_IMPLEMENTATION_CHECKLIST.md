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

### Phase 2: ESI Integration Layer ✅ (COMPLETE)
**Status**: ESI data fetching service created with full functionality

- [x] ESI routes defined in `esi-routes.ts`
- [x] **Create ESI data fetching service**
  - [x] Implement authenticated ESI calls using corporation tokens
  - [x] Handle pagination for large datasets
  - [x] Implement ETag caching to minimize redundant calls
  - [x] Handle ESI errors and rate limiting (429 responses)
  - [x] Implement retry logic with exponential backoff

- [x] **Create ESI fetch functions for each sync type**
  - [x] `fetchCorporationMembers(corpId, token)`
  - [x] `fetchCorporationAssets(corpId, token)`
  - [x] `fetchIndustryJobs(corpId, token)`
  - [x] `fetchMarketOrders(corpId, token)`
  - [x] `fetchWalletData(corpId, division, token)`
  - [x] `fetchMiningLedger(corpId, token)`
  - [x] `fetchContainerLogs(corpId, token)` - For PI delivery tracking

**Files created/modified:**
- ✅ `/src/lib/esi-data-service.ts` - Created complete ESI data fetching service with:
  - ESIDataFetchService class with retry logic
  - ETag caching for efficient polling
  - Pagination support for large datasets
  - Rate limit handling (429 responses)
  - All 7 fetch functions implemented
  - Helper functions for resolving names (types, corporations, alliances, stations)

---

### Phase 3: Sync Orchestration Service ✅ (COMPLETE)
**Status**: Core orchestration services implemented

- [x] **Create sync scheduler service**
  - Implements interval-based polling for each sync process
  - Tracks next run time for each process
  - Prevents concurrent runs of the same process
  - Logs sync history and errors

- [x] **Create sync execution pipeline**
  - For each sync process:
    1. Check if process is enabled
    2. Check if it's time to run (based on interval)
    3. Get corporation ESI token from auth system
    4. Fetch data from ESI
    5. Transform/validate data
    6. Store in database
    7. Update last sync timestamp
    8. Log results

- [x] **Implement sync state management**
  - Track running syncs
  - Track last successful sync per process
  - Track errors and retry counts
  - Expose sync status to UI

**Files created:**
- ✅ `/src/lib/sync-scheduler.ts` - Interval-based scheduler with full scheduling logic
- ✅ `/src/lib/sync-executor.ts` - Sync execution pipeline for all 8 sync types
- ✅ `/src/lib/sync-state-manager.ts` - State tracking with React hooks

**Implementation Details:**
- **SyncStateManager**: Manages sync status, history, and running processes with KV persistence
- **SyncExecutor**: Executes each sync type (members, assets, manufacturing, market, wallet, mining, killmails, container_logs)
- **SyncScheduler**: Handles scheduling, interval management, and automatic triggering
- Full support for manual "Sync Now" triggers
- Real-time progress tracking with step-by-step updates
- Error handling and retry counting
- History tracking (last 100 sync operations)
- React hooks for UI integration (`useSyncState()`)

---

### Phase 4: UI Integration ✅ (COMPLETE)
**Status**: UI connected to real sync services

- [x] Data Sync settings UI exists
- [x] Interval configuration per process exists
- [x] ESI route version selection exists
- [x] **Connect UI to real sync service**
  - [x] Replace simulated `runSyncProcess()` with real implementation
  - [x] Display actual sync status from sync state manager
  - [x] Show real last sync times from database
  - [x] Display actual errors and retry information

- [x] **Add sync monitoring features**
  - [x] Real-time sync progress updates with current step display
  - [x] Sync history log viewer (last 20 entries)
  - [x] Error notification system via toast notifications
  - [x] Manual sync trigger with real-time feedback
  - [x] Progress bar with item count display
  - [x] Authentication status warnings

**Files modified:**
- ✅ `/src/components/settings/DataSyncSettings.tsx` - Connected to real sync services:
  - Integrated SyncStateManager for real-time status tracking
  - Integrated SyncExecutor for actual sync process execution
  - Added real-time progress display with current step
  - Added sync history viewer with last 20 operations
  - Added authentication requirement checks
  - Shows error messages and retry counts
  - Displays items processed count
  - Manual "Run Now" triggers real ESI sync
  
**Implementation Details:**
- **Real Sync Execution**: "Run Now" button triggers actual ESI data fetch and database storage
- **Real-time Status**: UI updates automatically as sync progresses through steps
- **Progress Tracking**: Shows percentage, current step, and items processed
- **History Log**: Displays last 20 sync operations with timestamps and results
- **Error Display**: Shows detailed error messages when syncs fail
- **Authentication Awareness**: Warns users when ESI authentication is required
- **Process Type Mapping**: Maps UI process IDs to executor process types
- **State Persistence**: All sync state persists in KV store

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

### Phase 6: Data Retrieval Layer ✅ (COMPLETE)
**Status**: Real database queries implemented with freshness tracking

- [x] **Replace mock data with database queries**
  - [x] Dashboard: Read from database instead of hardcoded data
  - [x] Members: Query corporation_members table
  - [x] Assets: Query corporation_assets table  
  - [x] Manufacturing: Query industry_jobs table
  - [x] Market: Query market_orders table
  - [x] Wallet: Query wallet_transactions table
  - [x] All tabs should read cached data from database

- [x] **Implement data freshness indicators**
  - [x] Show "last updated" time on each tab
  - [x] Warn if data is stale (hasn't synced recently)
  - [x] Provide manual refresh option

**Files created:**
- ✅ `/src/lib/data-retrieval-service.ts` - Complete data retrieval service with freshness tracking
- ✅ `/src/lib/data-retrieval-hooks.ts` - React hooks for all data types (useMembers, useAssets, etc.)
- ✅ `/src/components/DataFreshnessIndicator.tsx` - Reusable freshness indicator components

**Implementation Details:**
- **DataRetrievalService**: Queries all ESI data tables with proper SQL
- **Freshness Tracking**: Calculates data age and staleness for each data type
- **Configurable Staleness**: Different cutoff times per data type (members: 120min, assets: 60min, etc.)
- **React Hooks**: Easy-to-use hooks for all data types with automatic loading states
- **UI Components**: DataFreshnessIndicator and DataFreshnessAlert for visual feedback
- **Auto-refresh**: Data freshness updates every 60 seconds
- **Error Handling**: Graceful fallback to empty data on errors
- **Type Safety**: Full TypeScript support with proper interfaces

---

### Phase 7: Corporation Token Management ✅ (COMPLETE)
**Status**: Token management system fully implemented

- [x] **Verify corporation ESI token storage**
  - [x] Ensure corporation director/CEO tokens are stored
  - [x] Verify tokens include all required scopes for sync processes
  - [x] Implement token refresh before expiration

- [x] **Token selection for sync**
  - [x] Determine which corporation to sync (if multiple registered)
  - [x] Use appropriate token for each sync process
  - [x] Handle token expiration gracefully

**Files created/modified:**
- ✅ `/src/lib/corp-token-manager.ts` - Complete token management service created with:
  - CorporationTokenManager class for token lifecycle management
  - Automatic token storage from ESI auth
  - Token refresh logic with 5-minute expiry threshold
  - Pre-emptive token refresh to prevent expiration during sync
  - Token validation and scope checking
  - Multi-corporation token support
  - React hook (`useCorporationTokens`) for UI integration
  - Token status tracking and reporting

- ✅ `/src/lib/auth-provider.tsx` - Integrated token manager:
  - Automatic token storage on ESI login
  - Token manager initialization
  - Token updates on user authentication

**Implementation Details:**
- **Automatic Storage**: Tokens stored immediately on successful ESI authentication
- **Smart Refresh**: Tokens automatically refresh 5 minutes before expiration
- **Scope Validation**: Verifies tokens have required scopes for sync operations
- **Multi-Corp Support**: Handles multiple corporation tokens simultaneously
- **Token Selection**: Intelligently selects appropriate token for sync operations
- **Status Tracking**: Real-time token validity and expiration monitoring
- **Graceful Degradation**: Handles token failures without crashing sync processes

---

### Phase 8: Error Handling & Monitoring ✅ (COMPLETE)
**Status**: Comprehensive error tracking and monitoring dashboard implemented

- [x] **Implement sync error logging**
  - [x] Log all sync errors to KV storage
  - [x] Track error patterns (repeated failures)
  - [x] Implement error notification system
  - [x] Categorize errors by type (ESI API, Database, Auth, Network, Validation)

- [x] **Create sync monitoring dashboard**
  - [x] Show sync health status
  - [x] Display error history
  - [x] Show token status for all corporations
  - [x] Display error statistics and breakdowns
  - [x] Repeated failure detection and alerts
  - [x] Error details modal with full stack traces
  - [x] Token refresh functionality from UI

**Files created:**
- ✅ `/src/lib/sync-error-logger.ts` - Comprehensive error logging service with:
  - SyncErrorLogger singleton class
  - Error categorization (esi_api, database, auth, network, validation, unknown)
  - Error statistics and analytics
  - Repeated failure detection
  - Error rate calculation
  - React hook (`useSyncErrors`) for UI integration
  - KV storage persistence (max 500 errors)
  - Specialized logging methods for different error types

- ✅ `/src/components/tabs/SyncMonitoring.tsx` - Full monitoring dashboard with:
  - Sync health overview with status indicators
  - Real-time error statistics
  - Error breakdown by type and process
  - Repeated failure alerts
  - Corporation token status display
  - Token refresh controls
  - Recent error log viewer (last 20)
  - Error detail modal with full information
  - Error clearing functionality
  - Mobile-responsive design

**Files modified:**
- ✅ `/src/lib/sync-executor.ts` - Integrated error logging:
  - Automatic error logging on sync failures
  - Error type detection and categorization
  - Detailed error context capture

- ✅ `/src/App.tsx` - Added Sync Monitoring tab to main navigation
- ✅ `/src/lib/types.ts` - Added 'sync-monitoring' to TabType
- ✅ `/src/lib/roles.ts` - Added access control for sync-monitoring tab
- ✅ `/src/lib/sync-state-manager.ts` - Enhanced state exports for monitoring

**Implementation Details:**
- **Error Tracking**: All sync errors automatically logged with full context
- **Error Analytics**: Real-time statistics showing error rates, types, and patterns
- **Repeated Failure Detection**: Automatically identifies processes with 3+ failures
- **Token Monitoring**: Live status of all corporation ESI tokens with expiry tracking
- **Error Categories**: Intelligent categorization of errors for easier debugging
- **Health Status**: Overall sync health calculated from recent error rates
- **Detailed Diagnostics**: Click any error to see full details including stack traces
- **Data Retention**: Maintains last 500 errors with automatic cleanup options
- **Visual Indicators**: Color-coded status badges and progress bars
- **Access Control**: Only corp admins and super admins can access monitoring

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
