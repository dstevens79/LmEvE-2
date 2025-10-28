# Phase 1: Unified Data Service Implementation

## Overview

Phase 1 implements a unified data service that provides a single, authoritative source for all LMeve application data. This service manages the data priority hierarchy and intelligently handles mock data based on setup status.

## Implementation Date

**Completed**: December 2024

## Key Features

### 1. Single Data Service (`UnifiedDataService`)

**File**: `/src/lib/unified-data-service.ts`

The unified service provides:
- **Data Priority Hierarchy**: Database → ESI API → Cache → Mock (conditional)
- **Setup Status Tracking**: Monitors if LMeve has been fully configured
- **Smart Mock Data**: Only used when database has NEVER been fully set up
- **Permanent Mock Disabling**: Once fully configured, mock data is never used again

### 2. Mock Data Strategy

Mock data is ONLY used when:
- Database has **never** been fully configured (no "green status" ever achieved)
- Allows for demo/testing without full setup
- Enables creating demo sites for evaluation

Mock data is **permanently disabled** when:
- All setup indicators are green (database connected + ESI configured)
- The `hasEverBeenGreen` flag is set to `true`
- This flag is persisted in localStorage and never resets

### 3. Mock Data Scope

Small, ESI-compliant sample data:
- **Members**: 3 sample characters with realistic roles and activity
- **Assets**: 4 items (ships, minerals) with proper type IDs and locations
- **Manufacturing Jobs**: 3 jobs (active and completed) with proper ESI structure
- **Wallet Transactions**: 3 recent transactions with buy/sell data
- **Planetary Colonies**: 2 colonies with different planet types
- **Market Prices**: 3 common items with realistic price data
- **Dashboard Stats**: Computed from the above mock data

All mock data:
- Uses proper ESI data structures
- Includes realistic IDs, timestamps, and relationships
- Works with existing UI components without modification
- Is completely removed once setup is complete

### 4. Setup Status Tracking

**Structure**:
```typescript
interface SetupStatus {
  isFullyConfigured: boolean;      // All LEDs green
  databaseConnected: boolean;       // Database connection working
  esiConfigured: boolean;           // ESI client ID configured
  hasEverBeenGreen: boolean;        // Once true, mock data disabled forever
  timestamp: string;                // Last update time
}
```

**Persistence**: Stored in `localStorage` as `lmeve-setup-status`

**Update Logic**:
- Automatically detects when database and ESI are both configured
- Sets `isFullyConfigured = true` when all requirements met
- Permanently sets `hasEverBeenGreen = true` on first full configuration
- Clears all mock data from cache when transitioning to configured state

### 5. Data Source Tracking

Every data request returns:
```typescript
interface DataResult<T> {
  data: T;                    // The actual data
  source: DataSource;         // Where it came from
  timestamp: string;          // When it was retrieved
  fromCache?: boolean;        // Whether it was cached
}

type DataSource = 'database' | 'esi' | 'cache' | 'mock';
```

This allows:
- UI to show data source badges
- Debugging data flow issues
- Analytics on cache hit rates
- User awareness of data freshness

### 6. Updated LMeveDataContext

**File**: `/src/lib/LMeveDataContext.tsx`

Updated to use `UnifiedDataService`:
- Removed old `LMeveDataService` dependency
- Added setup status management
- Tracks data source for each data type
- Provides setup status update function for Settings panel
- Automatically loads data when service is ready

**New Context API**:
```typescript
interface LMeveDataContextType {
  // Services
  unifiedService: UnifiedDataService | null;
  dbManager: DatabaseManager | null;
  
  // Setup status
  setupStatus: {
    isFullyConfigured: boolean;
    databaseConnected: boolean;
    esiConfigured: boolean;
    hasEverBeenGreen: boolean;
  };
  updateSetupStatus: (status: Partial<SetupStatus>) => void;
  
  // Data with source tracking
  members: Member[];
  assets: Asset[];
  manufacturingJobs: ManufacturingJob[];
  walletTransactions: WalletTransaction[];
  planetaryColonies: PlanetaryColony[];
  // ... other data arrays
  
  // Data source indicators
  dataSource: {
    members: string;
    assets: string;
    manufacturing: string;
    wallet: string;
    planetary: string;
    market: string;
  };
  
  // Refresh functions (unchanged)
  refreshMembers: () => Promise<void>;
  // ... other refresh functions
}
```

## Mock Data Examples

### Members (3 sample characters)
```typescript
{
  id: 1,
  name: 'Sample Character Alpha',
  corporationId: 98000001,
  characterId: 90000001,
  title: 'CEO',
  roles: ['Director', 'Station_Manager', 'Accountant'],
  // ... realistic login times, locations, ships
}
```

### Assets (4 items)
```typescript
{
  id: 2,
  typeId: 34,
  typeName: 'Tritanium',
  quantity: 1000000,
  locationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
  value: 5500000
}
```

### Manufacturing Jobs (3 jobs)
```typescript
{
  id: 1,
  jobId: 500001,
  productTypeName: 'Raven',
  runs: 1,
  status: 'active',
  progress: 0.67,
  // ... realistic timestamps and installer info
}
```

## Integration Points

### Settings Panel Integration

The Settings panel should:
1. Display current setup status (all LED indicators)
2. Show if mock data is active (when `!hasEverBeenGreen`)
3. Call `updateSetupStatus()` when configuration changes
4. Show warning when using mock data
5. Celebrate when transitioning to "all green" (one-time)

### Tab Components Integration

All tab components should:
1. Use `useLMeveData()` hook for data access
2. Display data source badges (optional but recommended)
3. Show appropriate empty states when no real data
4. Not special-case mock vs real data (service handles it)

## Migration Impact

### Files Modified
- ✅ `/src/lib/unified-data-service.ts` - NEW
- ✅ `/src/lib/LMeveDataContext.tsx` - UPDATED
- ✅ `/src/lib/types.ts` - UPDATED (added WalletTransaction, PlanetaryColony)

### Files NOT Modified (Future Phases)
- `/src/lib/dataService.ts` - Will be deprecated in Phase 2
- `/src/lib/esi-data-service.ts` - Will be integrated in Phase 2
- Tab components - Will be updated in Phase 2

## Testing Strategy

### Manual Testing
1. **Fresh Install**:
   - Clear localStorage
   - Verify mock data appears
   - Verify data source shows as 'mock'

2. **Database Connection**:
   - Configure database settings
   - Verify mock data still appears (ESI not configured)
   - Data source should remain 'mock'

3. **Full Configuration**:
   - Configure both database and ESI
   - Verify mock data is cleared
   - Verify `hasEverBeenGreen` is set
   - Data source should show 'database' (empty arrays OK)

4. **Post-Configuration**:
   - Disconnect database
   - Verify mock data does NOT reappear
   - Empty arrays should be shown
   - Data source shows 'database' (failed)

### Automated Testing
```typescript
// Test mock data generation
const service = new UnifiedDataService();
const members = await service.getMembers();
expect(members.source).toBe('mock');
expect(members.data.length).toBe(3);

// Test setup status transition
service.updateSetupStatus({
  isFullyConfigured: true,
  databaseConnected: true,
  esiConfigured: true
});
expect(service.getSetupStatus().hasEverBeenGreen).toBe(true);

// Verify mock data disabled
const membersAfter = await service.getMembers();
expect(membersAfter.data.length).toBe(0);
expect(membersAfter.source).toBe('database');
```

## Benefits

1. **Better Demo Experience**: New users can explore full UI without setup
2. **Clear Data Source**: Always know where data comes from
3. **Permanent Transition**: Once configured, no accidental mock data
4. **Consistent Interface**: Same API whether using mock or real data
5. **Easy Testing**: Can reset setup status for testing (dev only)
6. **Future-Proof**: Ready for Phase 2 tab updates

## Known Limitations

1. **Mining/Killmails/Income**: Not yet in unified service (Phase 2)
2. **ESI Direct Calls**: Still in old contexts (will migrate Phase 2)
3. **No Sync Integration**: Sync processes don't populate database yet (Phase 3)
4. **No Admin Tools**: Can't manually trigger mock data clear (only automatic)

## Next Steps (Phase 2)

1. Update all tab components to use unified service
2. Remove direct ESI calls from tabs
3. Ensure all tabs respect data source
4. Add data source indicators to UI
5. Deprecate old `dataService.ts`
6. Integrate remaining data types (mining, killmails, income)

## Success Criteria

- ✅ Mock data appears on fresh install
- ✅ Mock data is ESI-compliant and realistic
- ✅ Setup status tracked correctly
- ✅ Mock data permanently disabled after full configuration
- ✅ Data source always tracked and available
- ✅ LMeveDataContext uses unified service
- ✅ No breaking changes to existing tabs
- ✅ Types updated for new data structures

## Rollback Plan

If issues arise:
1. Keep old `dataService.ts` intact (not deleted)
2. Revert `LMeveDataContext.tsx` to use old service
3. Remove `unified-data-service.ts` import
4. Types are additive only (safe to keep)

## Documentation

Updated files:
- ✅ This file (PHASE_1_UNIFIED_DATA_SERVICE.md)
- ⏳ README.md - Add section on mock data
- ⏳ DATA_SERVICE_UNIFICATION_REPORT.md - Mark Phase 1 complete
