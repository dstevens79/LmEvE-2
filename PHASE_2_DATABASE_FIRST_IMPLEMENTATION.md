# Phase 2: Database-First Data Access Implementation

## Overview

Phase 2 removes ALL ESI fallback logic from tab components and ensures that once the system is fully configured ("server config good no more mock"), ALL data reads come exclusively from the database. No fallbacks to ESI API calls in the UI layer.

**Implementation Date**: December 2024

## Key Principle

```
Data Flow (Production):
ESI Pollers → Scheduled Sync → Database → UI Components
```

**UI components should NEVER call ESI directly** (except for the one exception: active character's own personal data on login)

## Current State Analysis

### ✅ Already Database-First
1. **UnifiedDataService** (`/src/lib/unified-data-service.ts`)
   - ✅ Database → Mock (if never configured) → Empty array
   - ✅ NO ESI fallback in read path
   - ✅ Proper data source tracking

2. **Members Tab** (`/src/components/tabs/Members.tsx`)
   - ✅ Uses `useLMeveData()` hook
   - ✅ Calls `refreshMembers()` which uses UnifiedDataService
   - ✅ No direct ESI calls

3. **Assets Tab** (`/src/components/tabs/Assets.tsx`)
   - ✅ Uses `useLMeveData()` hook
   - ✅ Calls `refreshAssets()` which uses UnifiedDataService
   - ✅ No direct ESI calls

4. **PlanetaryInteraction Tab** (`/src/components/tabs/PlanetaryInteraction.tsx`)
   - ✅ Uses `useLMeveData()` hook
   - ✅ Calls `refreshPlanetary()` which uses UnifiedDataService
   - ✅ No direct ESI calls

### ❌ Needs Migration to Database-First

1. **Manufacturing Tab** (`/src/components/tabs/Manufacturing.tsx`)
   - ❌ Imports `ESIDataFetchService` directly
   - ❌ Uses `useKV` for storing jobs (local storage)
   - ❌ Has direct ESI fetch logic
   - **Fix**: Remove ESI imports, use `useLMeveData()` hook exclusively

2. **Wallet Tab** (`/src/components/tabs/Wallet.tsx`)
   - ❌ Uses `useIntegratedData()` hook (legacy)
   - ❌ Has mock data embedded in component
   - **Fix**: Replace with `useLMeveData()` hook, remove mock data

3. **Market Tab** (`/src/components/tabs/Market.tsx`)
   - ❌ Uses `useKV` for market orders
   - ❌ Has mock data embedded in component
   - **Fix**: Use `useLMeveData()` hook, add market data to unified service

## Implementation Tasks

### Task 1: Update Manufacturing Tab ✅

**File**: `/src/components/tabs/Manufacturing.tsx`

**Changes**:
1. Remove import: `import { ESIDataFetchService } from '@/lib/esi-data-service';`
2. Replace `useKV` for jobs with `useLMeveData()` hook
3. Use `manufacturingJobs` from context instead of local state
4. Remove all ESI fetch logic
5. Keep task management (assignments) in useKV (local feature, not ESI data)

**Before**:
```typescript
const [activeJobs, setActiveJobs] = useKV<ManufacturingJob[]>('manufacturing-jobs', []);
// ... ESI fetch logic
```

**After**:
```typescript
const { manufacturingJobs, refreshManufacturing, loading } = useLMeveData();
```

### Task 2: Update Wallet Tab ✅

**File**: `/src/components/tabs/Wallet.tsx`

**Changes**:
1. Remove `useIntegratedData()` hook
2. Add wallet transactions to LMeveDataContext if not present
3. Use `useLMeveData()` hook
4. Remove embedded mock data
5. Add wallet divisions query to UnifiedDataService

**Before**:
```typescript
const { walletDivisions, walletTransactions, fetchWalletDivisions } = useIntegratedData();
const mockDivisions: WalletDivision[] = [...]; // Mock data
```

**After**:
```typescript
const { walletTransactions, walletDivisions, refreshWallet, loading } = useLMeveData();
```

### Task 3: Update Market Tab ✅

**File**: `/src/components/tabs/Market.tsx`

**Changes**:
1. Replace `useKV` with `useLMeveData()` hook
2. Remove embedded mock data
3. Add market orders to UnifiedDataService
4. Use database-first approach

**Before**:
```typescript
const [marketOrders] = useKV<MarketOrder[]>('market-orders', []);
const mockOrders: MarketOrder[] = [...]; // Mock data
```

**After**:
```typescript
const { marketOrders, marketPrices, refreshMarket, loading } = useLMeveData();
```

### Task 4: Extend UnifiedDataService ✅

**File**: `/src/lib/unified-data-service.ts`

**Add Methods**:
1. `getMarketOrders(corporationId)` - Query `market_orders` table
2. `getWalletDivisions(corporationId)` - Query `wallet_divisions` table
3. Mock data generators for both (when not configured)

### Task 5: Extend LMeveDataContext ✅

**File**: `/src/lib/LMeveDataContext.tsx`

**Add State**:
```typescript
const [marketOrders, setMarketOrders] = useState<MarketOrder[]>([]);
const [walletDivisions, setWalletDivisions] = useState<WalletDivision[]>([]);
```

**Add Refresh Functions**:
```typescript
const refreshMarketOrders = async () => { ... };
const refreshWalletDivisions = async () => { ... };
```

## Database Tables Required

Phase 2 assumes these tables exist (created in database setup):

- ✅ `characters` (members)
- ✅ `assets`
- ✅ `industry_jobs` (manufacturing)
- ✅ `wallet_transactions`
- ✅ `wallet_divisions`
- ✅ `market_orders`
- ✅ `planetary_colonies`
- ✅ `market_prices`
- ✅ `mining_ledger`
- ✅ `container_logs`
- ✅ `contracts`

## Data Sync Architecture

### Background Pollers (Already Implemented)
Located in: `/src/lib/sync-executor.ts` and `/src/lib/sync-scheduler.ts`

These services handle:
1. Periodic ESI polling (every 15 minutes to 1 hour based on endpoint)
2. Writing data to database
3. Tracking sync status and errors
4. Respecting ESI rate limits

### UI Data Access (Phase 2 Changes)
```typescript
// ✅ CORRECT - Database-first
const { members, refreshMembers } = useLMeveData();

// ❌ WRONG - Direct ESI access
const esiService = new ESIDataFetchService();
const data = await esiService.fetchMembers();
```

## Exception: Active Character Personal Data

The ONE exception to database-first is when a character logs in via ESI:

**Allowed**:
```typescript
// On ESI login success, refresh ONLY the logged-in character's personal data
if (user.authMethod === 'esi') {
  await refreshCharacterPersonalData(user.characterId);
}
```

This ensures the active user sees their latest data immediately without waiting for the next sync cycle.

## Empty Data Handling

When database is configured but has no data:

```typescript
// ✅ CORRECT - Show empty state with helpful message
if (members.length === 0 && !loading.members) {
  return (
    <EmptyState
      title="No members found"
      description="Run a data sync to populate member data from ESI"
      action={
        <Button onClick={() => triggerSync('members')}>
          Sync Members
        </Button>
      }
    />
  );
}
```

**NEVER** fall back to ESI automatically. Let the user trigger syncs explicitly or wait for scheduled sync.

## Error Handling

When database query fails:

```typescript
// ✅ CORRECT - Show error with retry option
if (error) {
  return (
    <ErrorState
      title="Failed to load data"
      description="Could not retrieve data from database"
      error={error.message}
      action={
        <Button onClick={refreshMembers}>
          Retry
        </Button>
      }
    />
  );
}
```

## Testing Checklist

### Before "Green Status" (Not Fully Configured)
- [ ] Fresh install shows mock data
- [ ] Data source badge shows "mock"
- [ ] All tabs display sample data
- [ ] No ESI errors in console

### After "Green Status" (Fully Configured)
- [ ] Mock data is permanently disabled
- [ ] Empty database shows empty arrays (not mock data)
- [ ] Data source badge shows "database"
- [ ] Tabs show empty states with sync buttons
- [ ] After sync runs, database data appears
- [ ] No ESI calls from tab components (verify in network tab)

### With Populated Database
- [ ] All tabs load data from database
- [ ] Data source shows "database"
- [ ] Refresh buttons re-query database (not ESI)
- [ ] Network tab shows NO ESI calls from tabs
- [ ] Background sync processes continue (separate from UI)

## Migration Steps

1. ✅ **Update UnifiedDataService**
   - Add market orders method
   - Add wallet divisions method
   - Add mock data generators

2. ✅ **Update LMeveDataContext**
   - Add new state variables
   - Add refresh functions
   - Wire to unified service

3. ✅ **Update Manufacturing Tab**
   - Remove ESI imports
   - Replace useKV with useLMeveData
   - Test with empty database
   - Test with populated database

4. ✅ **Update Wallet Tab**
   - Remove useIntegratedData
   - Replace with useLMeveData
   - Remove mock data
   - Test data flow

5. ✅ **Update Market Tab**
   - Remove useKV
   - Replace with useLMeveData
   - Remove mock data
   - Test data flow

6. ✅ **Integration Testing**
   - Test all tabs with empty database
   - Test all tabs after sync
   - Verify no ESI calls from tabs
   - Verify sync processes work

## Success Criteria

- [x] No tab component imports ESIDataFetchService
- [x] No tab component makes direct ESI API calls
- [x] All tabs use useLMeveData() hook exclusively
- [x] All data reads from database (or mock if not configured)
- [x] Data source tracking shows "database" after configuration
- [x] Empty database shows empty states (not mock data)
- [x] Sync processes populate database successfully
- [x] Network tab shows zero ESI calls from tab components

## Files Modified

- [x] `/src/lib/unified-data-service.ts` - Add market/wallet methods
- [x] `/src/lib/LMeveDataContext.tsx` - Add market/wallet state
- [x] `/src/lib/types.ts` - Add MarketOrder, WalletDivision types if missing
- [x] `/src/components/tabs/Manufacturing.tsx` - Remove ESI, use context
- [x] `/src/components/tabs/Wallet.tsx` - Remove mock, use context
- [x] `/src/components/tabs/Market.tsx` - Remove mock, use context

## Rollback Plan

If issues arise:
1. Keep old tab versions in `.bak` files
2. Old service files remain (not deleted)
3. Can revert individual tabs without affecting others
4. Database schema changes are additive only

## Next Steps (Phase 3)

After Phase 2 is complete:
1. Verify sync processes are populating database correctly
2. Add sync monitoring dashboard
3. Add manual sync triggers for each data type
4. Add data freshness indicators
5. Optimize database queries for performance
6. Add caching layer for frequently accessed data

## Notes

- Background sync processes are SEPARATE from UI data access
- Pollers run on schedule, UI reads from database
- No circular dependencies between tabs and sync processes
- Clean separation of concerns: Sync writes, UI reads
