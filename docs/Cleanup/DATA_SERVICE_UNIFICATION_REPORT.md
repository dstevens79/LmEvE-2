# Data Service Unification Report

The LMeve applicatio

The LMeve application currently has **multiple competing data service implementations** that need to be unified into a single, coherent architecture. The poller/sync services are designed to fetch ESI data and store it in the database, but the tabs are not consistently using this database-first approach.

## Current Architecture Analysis

   - Has database query methods but th

1. **`dataService.ts`** - LMeveDataService class
   - Returns mock data
   - Has database query methods but they're not fully implemented
   - Used by: LMeveDataContext

2. **`esi-data-service.ts`** - ESIDataFetchService class
5. **`sync-executor.ts` + `sync-scheduler.ts`** - Poll
   - Comprehensive sync processes



- Mix ESI calls with database queries inconsistently
## Required Changes
### Phase 1: Unified Data 
Create a **single, authoritativ

3. **Fallback**: Cache (in-memory for performance)
### Phase 2: Update All Tabs to Use Unified Service
#### Tabs Requiring Updates:
1. **Members** (`src/components/
   - ❌ But LMeveData returns mock data, not database 

   - ✅ Already uses `useLMeveData()`
   - **Fix**: Make `refreshAssets()` query databa
3. **Manufacturing** (`src/components/tabs/Manufactu
   - ❌ Has direct ESI calls via `ESIDataFe

   - **Status**: Nee

5. **Market** (`src/components/tabs/Market.tsx`)
   - **Expected**: Likely using mock or direct ES

- Mix ESI calls with database queries inconsistently

## Required Changes





- ✅ `industry_jobs` (manufacturing)
- ✅ `wallet_transactions`
3. **Fallback**: Cache (in-memory for performance)

### Phase 2: Update All Tabs to Use Unified Service

#### Tabs Requiring Updates:

   - `syncMembers()` ✅
   - `syncManufacturing()` ✅
   - `syncWallet()` ✅
   - `syncContainerLogs()` ✅


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
    → dataService.getMembers()
```
**New (Correct) Flow:**
User opens Members tab

      → If empty + has token:

   


```
  Sync Scheduler triggers
      → Fetch members from
      → Update last_sync timestamp
      → Repeat above

```
  → Check database
    → Display immediately (fast!)
```
## Benefits of This Approach
1. **Performance**: Database queries are much faster than ESI A
3. **Offline Capability**: Can view cached data without ESI con
5. **Scalability**: Can handle large corporations with paginati


2. **Integration Tests**: Database ↔ ESI sync
4. **Manual Tests**:
   - Populated database (should use cached data)
   - Sync errors (should display gracefully)
## Rollout Plan
### Phase 1: Core Service (Week 1)
- Fix LMeveDataContext

- Members tab
- Dashboard
### Phase 3: Manufacturing & Jobs (Week 3)
- Verify sync processes working
### Phase 4: Financial & Market (Week 4)
- Wallet tab

- Planetary Interaction tab
- Killmails integration
### Phase 6: Polish & Monitoring (Week 6)
- Error logging dashboard



- Keep both old and new services temporarily
- E



- Allow users to browse with ESI fallback during

**Mitigation**:

- Limit concu
## Success Criteria
- [ ] All tabs load data from database first

- [ ] No mock data in productio
- [ ] Settings panel shows sync
- [ ] No ESI rate limit er
## Conclusion
Th
**Recommended Action**: Implement the unified data servi





























































    → dataService.getMembers()



**New (Correct) Flow:**
```
User opens Members tab



      → If empty + has token:




```






  Sync Scheduler triggers



      → Update last_sync timestamp

      → Repeat above
```




  → Check database

    → Display immediately (fast!)

```

## Benefits of This Approach











2. **Integration Tests**: Database ↔ ESI sync

4. **Manual Tests**:

   - Populated database (should use cached data)

   - Sync errors (should display gracefully)

## Rollout Plan

### Phase 1: Core Service (Week 1)

- Fix LMeveDataContext



- Members tab

- Dashboard

### Phase 3: Manufacturing & Jobs (Week 3)

- Verify sync processes working

### Phase 4: Financial & Market (Week 4)

- Wallet tab



- Planetary Interaction tab

- Killmails integration

### Phase 6: Polish & Monitoring (Week 6)

- Error logging dashboard







- Keep both old and new services temporarily






**Mitigation**:












## Success Criteria

- [ ] All tabs load data from database first









## Conclusion




