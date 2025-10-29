# Phase 2: Database-First Implementation

## Overview
Phase 2 implements strict database-first data retrieval with **no ESI fallbacks** once the system is fully configured. The logic flow is:

1. **Pollers** fetch from ESI on schedule → Write to database
2. **Tabs** read from database only (no direct ESI calls)
3. **Exception**: Active character's personal data can update on login

## Current State Analysis

### ✅ Already Correct (No Changes Needed)
- **`unified-data-service.ts`**: Already implements Database → Mock (only if never configured)
- **`LMeveDataContext.tsx`**: Uses unified service correctly
- **Assets tab**: Uses `useLMeveData()` hook ✅
- **Members tab**: Uses `useLMeveData()` hook ✅
- **Dashboard tab**: Uses `useLMeveData()` hook ✅

### ❌ Requires Updates (ESI Fallbacks to Remove)

#### 1. `integrated-data-service.ts`
**Problem**: Has ESI fallback logic in all fetch methods
**Location**: Lines 88-122 (fetchMembers), similar patterns in other methods
**Fix**: Remove ESI fallback, only use database once configured

```typescript
// BEFORE (Current - Has ESI fallback)
async fetchMembers(options: FetchOptions): Promise<FetchResult<Member>> {
  // Try ESI first if token available
  if (options.accessToken && !options.forceDB) {
    try {
      const memberIds = await eveApi.getCorporationMembers(...);
      // Fetch from ESI
      return { data: members, source: { esi: true } };
    } catch (error) {
      console.warn('ESI fetch failed, falling back to database');
    }
  }
  
  // Fall back to database
  if (this.dbManager && !options.forceESI) {
    // Fetch from database
  }
}

// AFTER (Phase 2 - Database only)
async fetchMembers(options: FetchOptions): Promise<FetchResult<Member>> {
  // Check if system is configured
  const setupStatus = this.getSetupStatus();
  
  // Cache check (if enabled)
  if (options.useCache !== false) {
    const cached = this.getFromCache<Member[]>(cacheKey);
    if (cached) return cached;
  }
  
  // Database ONLY (once configured)
  if (this.dbManager && setupStatus.hasEverBeenGreen) {
    const result = await this.dbManager.query(...);
    if (result.success && result.data) {
      return { data: result.data, source: { database: true } };
    }
    
    // Database configured but empty - return empty, don't fallback to ESI
    console.log('📭 No members in database');
    return { data: [], source: { database: true } };
  }
  
  // Mock data ONLY if never been configured
  if (!setupStatus.hasEverBeenGreen) {
    return { data: mockMembers, source: { mock: true } };
  }
  
  return { data: [], source: { database: true } };
}
```

#### 2. `Manufacturing.tsx`
**Problem**: Lines 116-189 have direct ESI calls in `loadESIManufacturingData()`
**Fix**: Remove ESI data fetching, use `useLMeveData()` hook instead

```typescript
// REMOVE these lines (116-189):
const loadESIManufacturingData = async () => {
  // Direct ESI calls - DELETE THIS FUNCTION
  const esiService = new ESIDataFetchService();
  const result = await esiService.fetchIndustryJobsDetailed(...);
}

// REPLACE with useLMeveData hook:
import { useLMeveData } from '@/lib/LMeveDataContext';

export function Manufacturing({ onLoginClick, isMobileView }: ManufacturingProps) {
  const { manufacturingJobs, loading, refreshManufacturing } = useLMeveData();
  
  // Data comes from context (which uses unified service)
  // No direct ESI calls needed
}
```

#### 3. `Market.tsx`
**Problem**: Uses local mock data, not integrated with database
**Fix**: Add `useLMeveData()` hook for market orders

```typescript
// BEFORE
const [marketOrders] = useKV<MarketOrder[]>('market-orders', []);
const mockOrders: MarketOrder[] = [ /* ... */ ];

// AFTER
const { marketOrders, loading, refreshMarketOrders } = useLMeveData();
```

#### 4. `Wallet.tsx`
**Problem**: Uses `useIntegratedData()` which has ESI fallbacks
**Fix**: Switch to `useLMeveData()` hook

```typescript
// BEFORE
const { 
  walletDivisions, 
  walletTransactions, 
  fetchWalletDivisions, 
  fetchWalletTransactions 
} = useIntegratedData();

// AFTER
const { 
  walletDivisions, 
  walletTransactions,
  loading,
  refreshWallet,
  refreshWalletDivisions
} = useLMeveData();
```

#### 5. `PlanetaryInteraction.tsx`
**Check**: Verify it uses `useLMeveData()` and not direct ESI calls

## Implementation Steps

### Step 1: Update `integrated-data-service.ts`
1. Add setup status tracking (similar to unified-data-service)
2. Remove all ESI fallback logic from fetch methods
3. Implement strict database-first with mock-only-if-never-configured pattern
4. Update all methods:
   - `fetchMembers()`
   - `fetchAssets()`
   - `fetchManufacturingJobs()`
   - `fetchWalletTransactions()`
   - `fetchWalletDivisions()`
   - `fetchMarketOrders()`
   - `fetchPlanetaryColonies()`

### Step 2: Update `Manufacturing.tsx`
1. Remove `ESIDataFetchService` import
2. Remove `loadESIManufacturingData()` function
3. Remove `esiDataLastSync` and `isLoadingESIData` state
4. Remove `useMockData` state
5. Use `useLMeveData()` hook instead
6. Update UI to show data from context

### Step 3: Update `Market.tsx`
1. Replace `useKV` with `useLMeveData()` hook
2. Remove mock data definitions
3. Use context data for display

### Step 4: Update `Wallet.tsx`
1. Replace `useIntegratedData()` with `useLMeveData()` hook
2. Update refresh functions
3. Ensure all data comes from context

### Step 5: Verify `PlanetaryInteraction.tsx`
1. Check if it uses correct hooks
2. Ensure no direct ESI calls

### Step 6: Update Data Source Indicators
1. Update `DataSourceIndicator` component to show:
   - 🗄️ Database (green) - data from database
   - 📝 Mock (yellow) - mock data (system not configured)
   - 📭 Empty (gray) - database connected but no data
   - ❌ Error (red) - database error

## Testing Checklist

### Pre-Configuration (Mock Data Mode)
- [ ] All tabs show mock data with 📝 indicator
- [ ] No ESI calls are made
- [ ] Data is consistent across tabs

### Post-Configuration (Database Mode)
- [ ] All tabs show database data with 🗄️ indicator
- [ ] No ESI calls are made (verify in network tab)
- [ ] Empty database shows 📭 with helpful message
- [ ] Sync process populates database
- [ ] Tabs update with real data after sync

### Error Handling
- [ ] Database connection error shows error state
- [ ] Empty database (no sync yet) shows empty state
- [ ] Network errors don't trigger ESI fallback

## Success Criteria
- ✅ No direct ESI calls from tabs
- ✅ All tabs use `useLMeveData()` hook
- ✅ Mock data ONLY when `hasEverBeenGreen = false`
- ✅ Database-first once configured
- ✅ No fallbacks to ESI from tabs
- ✅ Empty database returns empty arrays (not errors)
- ✅ Data flows: ESI (pollers) → Database → Tabs
- ✅ Clear data source indicators on all tabs

## Files to Modify
1. `/src/lib/integrated-data-service.ts` - Remove ESI fallbacks
2. `/src/components/tabs/Manufacturing.tsx` - Remove direct ESI calls
3. `/src/components/tabs/Market.tsx` - Use useLMeveData hook
4. `/src/components/tabs/Wallet.tsx` - Use useLMeveData hook
5. `/src/components/tabs/PlanetaryInteraction.tsx` - Verify (no changes needed if already correct)

## Files Already Correct (No Changes)
1. `/src/lib/unified-data-service.ts` ✅
2. `/src/lib/LMeveDataContext.tsx` ✅
3. `/src/components/tabs/Assets.tsx` ✅
4. `/src/components/tabs/Members.tsx` ✅
5. `/src/components/tabs/Dashboard.tsx` ✅

## Migration Notes

### For Developers
- **Before**: Tabs could fetch from ESI if database was empty
- **After**: Tabs ONLY read from database (pollers handle ESI)
- **Exception**: Active character login can trigger personal data update

### For Users
- **Before**: First page load might be slow (ESI calls)
- **After**: Instant load from database (fast!)
- **Trade-off**: Data is only as fresh as last sync (but that's the design)

### For Admins
- Ensure sync processes are running on schedule
- Monitor sync logs for ESI errors
- Check database connectivity
- Verify "Server Config Good" status
