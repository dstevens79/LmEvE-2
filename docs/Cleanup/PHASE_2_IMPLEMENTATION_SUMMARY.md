# Phase 2 Implementation Summary

## Status: IN PROGRESS ⚙️

### Objective
Remove all ESI fallbacks from data retrieval methods. Once "server config good" status is achieved (all LEDs green), all reads must come from the database with NO fallbacks to ESI.

**Data Flow**: ESI (pollers on schedule) → Database → Tabs (read-only from database)

## Changes Made

### ✅ Completed

#### 1. Updated `integrated-data-service.ts` - Partial
**File**: `/src/lib/integrated-data-service.ts`

Added setup status tracking:
- `loadSetupStatus()` - Load from localStorage
- `saveSetupStatus()` - Persist to localStorage  
- `updateSetupStatus()` - Update and persist, marks `hasEverBeenGreen` when fully configured
- `getSetupStatus()` - Get current status
- `shouldUseMockData()` - Returns `!hasEverBeenGreen`

Updated methods (database-first, no ESI fallback):
- ✅ `fetchMembers()` - Database → Mock (if never configured) → Empty
- ✅ `fetchAssets()` - Database → Mock (if never configured) → Empty
- ⚠️ `fetchManufacturingJobs()` - **NEEDS UPDATE** (still has ESI fallback)
- ⚠️ `fetchWalletTransactions()` - **NEEDS UPDATE** (still has ESI fallback)
- ⚠️ `fetchWalletBalance()` - **NEEDS UPDATE** (still has ESI fallback)

### 🔨 Remaining Work

#### 2. Complete `integrated-data-service.ts` Updates
**Status**: Partially complete
**Remaining methods to update**:
1. `fetchManufacturingJobs()` - Lines 306-399
2. `fetchWalletTransactions()` - Lines 401-482
3. `fetchWalletBalance()` - Lines 484-end

**Pattern to apply** (for each method):
```typescript
async fetchXXX(options: FetchOptions): Promise<FetchResult<XXX>> {
  const cacheKey = this.getCacheKey('xxx', options);
  const source: DataSource = { esi: false, database: false, cache: false, mock: false };

  // 1. Check cache (if enabled)
  if (options.useCache !== false) {
    const cached = this.getFromCache<XXX[]>(cacheKey);
    if (cached) {
      return { data: cached, source: { ...source, cache: true }, timestamp: new Date().toISOString() };
    }
  }

  // 2. Database first (once configured)
  if (this.dbManager && this.setupStatus.hasEverBeenGreen) {
    try {
      console.log('🗄️ Fetching XXX from database (Phase 2: database-first)...');
      const result = await this.dbManager.query('SELECT * FROM xxx WHERE corporation_id = ?', [options.corporationId]);
      
      if (result.success && result.data && result.data.length > 0) {
        this.setCache(cacheKey, result.data as XXX[]);
        return { data: result.data as XXX[], source: { ...source, database: true }, timestamp: new Date().toISOString() };
      }
      
      console.log('📭 No XXX in database - empty result (populated by sync)');
      return { data: [], source: { ...source, database: true }, timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('❌ Database fetch failed:', error);
      return { data: [], source, timestamp: new Date().toISOString(), error: error.message };
    }
  }

  // 3. Mock data ONLY if never configured
  if (this.shouldUseMockData()) {
    console.log('📝 Using mock XXX data (system not yet configured)');
    return { data: mockXXX, source: { ...source, mock: true }, timestamp: new Date().toISOString() };
  }

  // 4. Empty result
  return { data: [], source: { ...source, database: true }, timestamp: new Date().toISOString(), error: 'System not configured' };
}
```

#### 3. Update `Manufacturing.tsx`
**File**: `/src/components/tabs/Manufacturing.tsx`
**Status**: Not started

**Changes needed**:
1. Remove `import { ESIDataFetchService } from '@/lib/esi-data-service';` (line 40)
2. Remove `loadESIManufacturingData()` function (lines 116-189)
3. Remove `convertESIJobToTask()` function (lines 192-233)  
4. Remove `getActivityType()` function (lines 236-246)
5. Remove state: `esiDataLastSync`, `isLoadingESIData`, `useMockData`
6. Add `import { useLMeveData } from '@/lib/LMeveDataContext';`
7. Replace local state with context:
   ```typescript
   const { manufacturingJobs, loading, refreshManufacturing } = useLMeveData();
   ```
8. Update UI to use `manufacturingJobs` from context
9. Update refresh handlers to use `refreshManufacturing()`

#### 4. Update `Market.tsx`
**File**: `/src/components/tabs/Market.tsx`
**Status**: Not started

**Changes needed**:
1. Add `import { useLMeveData } from '@/lib/LMeveDataContext';`
2. Replace `useKV` with context:
   ```typescript
   const { marketOrders, loading, refreshMarketOrders } = useLMeveData();
   ```
3. Remove mock data definitions (lines 82-200+)
4. Update UI to use `marketOrders` from context

#### 5. Update `Wallet.tsx`
**File**: `/src/components/tabs/Wallet.tsx`
**Status**: Not started

**Changes needed**:
1. Replace `useIntegratedData()` with `useLMeveData()`:
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
2. Update refresh handlers
3. Remove `useIntegratedData` import

#### 6. Verify `PlanetaryInteraction.tsx`
**File**: `/src/components/tabs/PlanetaryInteraction.tsx`
**Status**: Not checked

**Action**: Verify it uses `useLMeveData()` and has no direct ESI calls

## Implementation Priority

### High Priority (Complete First)
1. ✅ **Phase 2 Documentation** - Complete understanding of changes
2. 🔨 **Complete `integrated-data-service.ts`** - Core data layer
   - Update remaining fetch methods (manufacturing, wallet)
   - Ensure all follow database-first pattern

### Medium Priority (After Core)
3. 🔨 **Update `Manufacturing.tsx`** - Most complex tab
   - Remove direct ESI integration
   - Switch to unified data context

### Low Priority (Polish)
4. 🔨 **Update `Market.tsx`** - Simpler conversion
5. 🔨 **Update `Wallet.tsx`** - Already close to correct pattern
6. ✅ **Verify `PlanetaryInteraction.tsx`** - May already be correct

## Testing Strategy

### Unit Tests
- [ ] `integrated-data-service.ts`
  - Test database-first logic
  - Test mock data only when `hasEverBeenGreen = false`
  - Test empty database returns empty array (not error)
  - Test cache behavior

### Integration Tests
- [ ] Full tab workflow
  - Pre-configuration: Shows mock data
  - Post-configuration: Shows database data
  - Empty database: Shows empty state with message
  - Database error: Shows error state

### Manual Tests
1. **Before Configuration** (Mock Mode)
   - [ ] All tabs show mock data
   - [ ] Data source indicator shows 📝 Mock
   - [ ] No ESI calls in network tab

2. **After Configuration** (Database Mode)
   - [ ] All tabs query database
   - [ ] Empty database shows 📭 Empty state
   - [ ] No ESI calls from tabs
   - [ ] Sync process populates data
   - [ ] Tabs refresh with real data

3. **Error Scenarios**
   - [ ] Database connection error → Error state
   - [ ] Database query error → Error state  
   - [ ] Empty database → Empty state (not error)

## Success Criteria

### Code Quality
- ✅ All data service methods follow database-first pattern
- ✅ No ESI imports in tab components
- ✅ All tabs use `useLMeveData()` hook
- ✅ Consistent error handling across all methods

### Functionality
- ✅ Mock data ONLY when `hasEverBeenGreen = false`
- ✅ Database-first once system configured
- ✅ No fallbacks to ESI from tabs
- ✅ Empty database returns empty arrays (not errors)
- ✅ Clear data source indicators on all tabs

### User Experience
- ✅ Fast page loads (database queries)
- ✅ Clear messaging when data is empty
- ✅ Obvious when viewing mock vs real data
- ✅ Sync process status visible

## Next Steps

1. Complete remaining `integrated-data-service.ts` methods
2. Update `Manufacturing.tsx` to use unified data context
3. Update `Market.tsx` to use unified data context
4. Update `Wallet.tsx` to use unified data context
5. Verify `PlanetaryInteraction.tsx`
6. Test all scenarios
7. Update documentation

## Notes

### Key Design Principle
**Once configured, NEVER fallback to ESI from tabs**. The pollers handle ESI communication on a schedule. Tabs are read-only consumers of database data.

### Exception
The one exception is: **Active character's personal data can update on login**. This is for real-time freshness of the logged-in user's own data.

### Data Flow
```
ESI API
  ↓ (Pollers on schedule)
Database
  ↓ (Read-only)
Tabs/UI
```

NOT:
```
Tabs → ESI (directly) ❌
```
