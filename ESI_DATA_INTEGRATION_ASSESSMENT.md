# ESI / Database Data Integration Assessment

## Executive Summary

After thorough code review, the application has a **partially implemented** ESI/Database integration architecture. The foundational infrastructure exists but many tabs are using **mock data instead of live ESI/database queries**. This requires systematic fixes across the application.

---

## Current State Analysis

### ✅ PROPERLY IMPLEMENTED

#### 1. **Corporations Tab** (`/src/components/Corporations.tsx`)
- **Status:** ✅ FUNCTIONAL
- **ESI Integration:** Properly uses `useAuth()` hook to access ESI config and registered corporations
- **Data Flow:** 
  - Retrieves registered corporations via `getRegisteredCorporations()`
  - Shows ESI authentication status
  - Allows corporation registration for directors/CEOs
  - Displays character/corporation images from EVE CDN
- **Database:** Reads/writes corporation registration data
- **Verdict:** This tab is correctly implemented ✓

#### 2. **Members Tab** (`/src/components/tabs/Members.tsx`)
- **Status:** ✅ MOSTLY FUNCTIONAL
- **ESI Integration:** Uses `useLMeveData()` context
- **Data Flow:**
  - Calls `refreshMembers()` to fetch from database/ESI
  - Uses `LMeveDataContext` which integrates with `DataRetrievalService`
  - Has proper loading states
- **Issues:** 
  - Falls back to mock data if database empty
  - Needs verification that sync is populating database
- **Verdict:** Correctly structured, needs sync verification ⚠️

#### 3. **Data Sync Infrastructure**
- **Status:** ✅ ARCHITECTURE EXISTS
- **Components:**
  - `sync-executor.ts` - Orchestrates sync processes
  - `sync-scheduler.ts` - Manages cron schedules  
  - `sync-state-manager.ts` - Tracks sync progress
  - `esi-data-service.ts` - Fetches from ESI with caching/retries
  - `data-retrieval-service.ts` - Retrieves from database
  - `LMeveDataContext.tsx` - React context for data access
- **Verdict:** Well-architected foundation exists ✓

---

### ❌ USING MOCK DATA (NEEDS FIXES)

#### 1. **Assets Tab** (`/src/components/tabs/Assets.tsx`)
- **Status:** ❌ MOCK DATA ONLY
- **Current Implementation:**
  - Lines 82-91: `MOCK_STATIONS` hardcoded array
  - Lines 93-101: `MOCK_HANGARS` hardcoded array  
  - Lines 103-109: `MOCK_SUPPLY_NEEDS` hardcoded array
  - Lines 111-185: `generateMockItems()` function
- **What Should Happen:**
  ```typescript
  // Should use:
  const { assets, loading, refreshAssets } = useLMeveData();
  // Filter assets by station/hangar from database
  ```
- **Dependency:** Requires database tables:
  - `corporation_assets` - Asset data from ESI
  - `stations` - Station/structure data
  - `manufacturing_tasks` - For supply needs calculation
- **Priority:** 🔴 HIGH

#### 2. **Manufacturing Tab** (`/src/components/tabs/Manufacturing.tsx`)
- **Status:** ❌ PARTIAL MOCK DATA
- **Current Implementation:**
  - Uses `useKV` for local storage (manufacturing-jobs, blueprints-library, etc.)
  - Lines 107-250: Creates sample members/pilots locally
  - No integration with ESI industry jobs endpoint
  - No integration with database blueprints table
- **What Should Happen:**
  ```typescript
  // Should use:
  const { manufacturingJobs, loading, refreshManufacturing } = useLMeveData();
  // Get jobs from database which syncs from ESI /corporations/{id}/industry/jobs/
  ```
- **Dependency:** Requires database tables:
  - `corporation_industry_jobs` - Industry jobs from ESI
  - `blueprints` - Blueprint library
  - `manufacturing_tasks` - Assigned tasks (custom table)
- **Priority:** 🔴 HIGH

#### 3. **Wallet Tab** (`/src/components/tabs/Wallet.tsx`)
- **Status:** ❌ MOCK DATA ONLY
- **Current Implementation:**
  - Lines 68-76: `mockDivisions` hardcoded
  - Lines 78-132: `mockTransactions` hardcoded
  - No ESI wallet integration
  - No database queries
- **What Should Happen:**
  ```typescript
  // Should use:
  const { walletDivisions, walletTransactions } = useLMeveData();
  // Get from database synced via ESI /corporations/{id}/wallets/
  ```
- **Dependency:** Requires database tables:
  - `corporation_wallets` - Wallet divisions
  - `wallet_journal` - Wallet transactions
  - `wallet_transactions` - Market transactions
- **Priority:** 🟡 MEDIUM

#### 4. **Market Tab** (needs verification)
- **Status:** ⚠️ UNKNOWN (file not fully reviewed)
- **Action:** Needs code review to check if using ESI market data
- **Priority:** 🟡 MEDIUM

#### 5. **Dashboard Tab** (needs verification)
- **Status:** ⚠️ UNKNOWN (file not fully reviewed)
- **Action:** Needs code review for stats aggregation source
- **Priority:** 🟢 LOW (typically aggregates from other tabs)

#### 6. **Planetary Interaction Tab** (needs verification)
- **Status:** ⚠️ UNKNOWN (file not fully reviewed)
- **Action:** Check if using ESI PI endpoints
- **Priority:** 🟡 MEDIUM

#### 7. **Projects Tab** (needs verification)
- **Status:** ⚠️ UNKNOWN (file not fully reviewed)
- **Action:** Verify data source
- **Priority:** 🟢 LOW (may be custom feature)

#### 8. **Notifications Tab** (needs verification)
- **Status:** ⚠️ UNKNOWN (file not fully reviewed)
- **Action:** Check notification source
- **Priority:** 🟢 LOW

---

## Root Cause Analysis

### Why Mock Data Exists

1. **Development Workflow:** Tabs were likely built UI-first with mock data for rapid prototyping
2. **Sync Not Complete:** Data sync system exists but may not be fully wired to all endpoints
3. **Database Schema:** Some tables may not exist or be properly populated
4. **Migration Path:** App is mid-migration from mock → real data

### Key Integration Points Missing

1. **Assets Tab:** Not calling `useLMeveData()` hook
2. **Manufacturing Tab:** Using local `useKV` instead of database context
3. **Wallet Tab:** No ESI wallet service calls
4. **Supply Calculation:** Manufacturing supply needs not linked to asset inventory

---

## Recommended Fix Strategy

### Option A: Quick Iterative Fixes (RECOMMENDED)
Fix tabs one-by-one with small, testable changes. Good for maintaining working app during fixes.

### Option B: Comprehensive Refactor  
Rewrite all data access at once. Higher risk but faster if successful.

**Recommendation:** Option A - Iterative approach

---

## Proposed Implementation Plan

### PHASE 1: Verification & Foundation (Small Fixes)
**Goal:** Confirm sync system works end-to-end

1. **Verify Database Schema**
   - Check that all required tables exist
   - Verify sync is writing to tables correctly
   - Test manual sync run for each endpoint

2. **Fix Members Tab Data Flow**
   - Ensure `refreshMembers()` properly populates
   - Remove fallback mock data once verified
   - Test with real ESI data

3. **Document Current Sync Coverage**
   - List which ESI endpoints are being synced
   - List which are missing
   - Create sync endpoint checklist

**Estimated Complexity:** 🟢 LOW (1-2 hours)

---

### PHASE 2: Assets Tab Integration (Medium Fix)
**Goal:** Connect Assets tab to database

1. **Database Query Service**
   - Add `getAssetsByStation()` to `DataRetrievalService`
   - Add `getCorpHangars()` method
   - Add `getStationsWithAssets()` method

2. **Update Assets Component**
   - Replace mock stations with database query
   - Replace mock hangars with database query  
   - Replace mock items with real asset data
   - Keep UI/UX exactly the same

3. **Supply Needs Calculation**
   - Cross-reference manufacturing tasks with asset inventory
   - Calculate actual shortages
   - Display real supply needs

**Estimated Complexity:** 🟡 MEDIUM (2-3 hours)

---

### PHASE 3: Manufacturing Tab Integration (Medium-Large Fix)
**Goal:** Connect Manufacturing tab to ESI industry jobs

1. **ESI Industry Jobs Sync**
   - Verify sync-executor has manufacturing sync
   - Ensure database stores industry jobs
   - Add job status tracking

2. **Blueprint Library Integration**
   - Connect to database blueprints table
   - Remove local mock blueprints
   - Sync blueprint ME/TE from ESI

3. **Task Assignment System**
   - Keep custom task assignment logic
   - Link to real industry jobs via job_id
   - Track job progress from ESI data

4. **Member/Pilot Integration**
   - Use real corp members from Members tab data
   - Remove local mock pilots
   - Link assignments to real characters

**Estimated Complexity:** 🟡 MEDIUM-HIGH (3-4 hours)

---

### PHASE 4: Wallet Tab Integration (Small-Medium Fix)
**Goal:** Show real wallet data

1. **ESI Wallet Sync**
   - Verify wallet sync in sync-executor
   - Ensure journal/transactions syncing

2. **Wallet Component Update**
   - Add wallet queries to DataRetrievalService
   - Replace mock divisions with real data
   - Replace mock transactions with database query
   - Add pagination for transaction history

**Estimated Complexity:** 🟢 MEDIUM (1-2 hours)

---

### PHASE 5: Remaining Tabs (Variable)
**Goal:** Complete integration for all tabs

1. **Market Tab**
   - Review current implementation
   - Connect to market data sync
   - Integrate ESI market orders/prices

2. **Dashboard Tab**  
   - Aggregate from real data sources
   - Remove any mock statistics
   - Add real-time refresh

3. **Planetary Interaction**
   - Connect to ESI PI endpoints
   - Sync planet/colony data

4. **Notifications**
   - Integrate notification sync
   - Use real notification data

**Estimated Complexity:** 🟡 VARIABLE (2-6 hours total)

---

## Data Flow Architecture (Target State)

```
┌─────────────────────────────────────────────────────────────┐
│                     EVE ESI API                              │
│  /corporations/{id}/members/                                 │
│  /corporations/{id}/assets/                                  │
│  /corporations/{id}/industry/jobs/                           │
│  /corporations/{id}/wallets/                                 │
│  /corporations/{id}/wallets/{division}/journal/             │
│  /markets/{region}/orders/                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Scheduled Sync (cron)
                     ▼
         ┌───────────────────────┐
         │   sync-executor.ts     │
         │  - Fetches via ESI     │
         │  - Handles retries     │
         │  - Manages ETags       │
         └───────────┬───────────┘
                     │
                     │ Stores Data
                     ▼
         ┌───────────────────────┐
         │   MySQL Database       │
         │  - corporation_members │
         │  - corporation_assets  │
         │  - industry_jobs       │
         │  - wallet_journal      │
         │  - blueprints          │
         └───────────┬───────────┘
                     │
                     │ Query via DataRetrievalService
                     ▼
         ┌───────────────────────┐
         │  LMeveDataContext      │
         │  - Caches in React     │
         │  - Provides refresh    │
         │  - Loading states      │
         └───────────┬───────────┘
                     │
                     │ useContext hook
                     ▼
         ┌───────────────────────┐
         │   React Components     │
         │  - Assets Tab          │
         │  - Manufacturing Tab   │
         │  - Members Tab         │
         │  - Wallet Tab          │
         └───────────────────────┘
```

---

## Critical Integration Checklist

### Database Tables Required

- [?] `corporation_members` - Synced from ESI
- [?] `corporation_assets` - Synced from ESI
- [?] `corporation_industry_jobs` - Synced from ESI  
- [?] `corporation_wallets` - Synced from ESI
- [?] `wallet_journal` - Synced from ESI
- [?] `wallet_transactions` - Synced from ESI
- [?] `blueprints` - Synced from ESI
- [?] `stations` - Resolved from ESI Universe
- [?] `manufacturing_tasks` - Custom assignment table
- [?] `market_orders` - Synced from ESI (if needed)
- [?] `mining_ledger` - Synced from ESI
- [?] `killmails` - Synced from ESI (if needed)

### ESI Sync Endpoints Required

- [?] `/corporations/{id}/members/` → corporation_members
- [?] `/corporations/{id}/assets/` → corporation_assets
- [?] `/corporations/{id}/industry/jobs/` → corporation_industry_jobs
- [?] `/corporations/{id}/wallets/` → corporation_wallets  
- [?] `/corporations/{id}/wallets/{div}/journal/` → wallet_journal
- [?] `/corporations/{id}/wallets/{div}/transactions/` → wallet_transactions
- [?] `/corporations/{id}/blueprints/` → blueprints
- [?] `/universe/structures/{id}/` → stations (for citadels)
- [?] `/markets/{region}/orders/` → market_orders (if needed)

### Component Integration Status

- [✅] Corporations Tab - Using ESI/Database
- [✅] Members Tab - Using LMeveDataContext  
- [❌] Assets Tab - Using mock data
- [❌] Manufacturing Tab - Using local storage
- [❌] Wallet Tab - Using mock data
- [?] Market Tab - Unknown
- [?] Dashboard Tab - Unknown
- [?] Planetary Interaction - Unknown
- [?] Projects Tab - Unknown
- [?] Notifications Tab - Unknown

---

## Recommendation

### Small Fixes (Can do now):
1. **Verify Members Tab** - Test that sync populates real data
2. **Check Database Schema** - Verify tables exist
3. **Test One Sync Run** - Manually trigger sync and verify data flow

### Medium Fixes (Requires focused work):
1. **Assets Tab** - Replace mock data with database queries (2-3 hours)
2. **Manufacturing Tab** - Connect to ESI industry jobs (3-4 hours)
3. **Wallet Tab** - Integrate wallet sync (1-2 hours)

### Large Project (Full integration):
Create a **phased implementation checklist** and work through each tab systematically over multiple sessions.

---

## Next Steps

**Your Choice:**

**Option 1: Quick Verification**  
→ I'll check database schema + test Members tab sync to verify foundation works

**Option 2: Fix Assets Tab**  
→ I'll refactor Assets tab to use real database data (medium effort)

**Option 3: Create Detailed Checklist**  
→ I'll make a comprehensive step-by-step implementation plan for all fixes

**Option 4: Fix Everything Now**  
→ I'll systematically fix all tabs (large effort, 6-10 hours of changes)

Which approach would you like to take?
