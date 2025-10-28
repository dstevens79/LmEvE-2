# Phase 6 Implementation Guide: Data Retrieval Layer

## Overview

Phase 6 replaces all mock/hardcoded data with real database queries. The implementation provides:

1. **Real Database Queries** - Direct SQL queries to ESI data tables
2. **Data Freshness Tracking** - Monitors when data was last synced
3. **React Hooks** - Easy integration into components
4. **UI Components** - Visual indicators for data staleness

---

## Architecture

### Core Components

```
┌─────────────────────────────────────────┐
│        Tab Components (UI)              │
│  Dashboard, Members, Assets, etc.       │
└──────────────┬──────────────────────────┘
               │ uses hooks
               ▼
┌─────────────────────────────────────────┐
│    Data Retrieval Hooks                 │
│  useMembers(), useAssets(), etc.        │
└──────────────┬──────────────────────────┘
               │ calls service
               ▼
┌─────────────────────────────────────────┐
│   DataRetrievalService                  │
│  getMembers(), getAssets(), etc.        │
└──────────────┬──────────────────────────┘
               │ queries
               ▼
┌─────────────────────────────────────────┐
│         Database Manager                │
│  Executes SQL queries on MySQL          │
└─────────────────────────────────────────┘
```

---

## Files Created

### 1. `/src/lib/data-retrieval-service.ts`

**Purpose**: Core service that executes database queries

**Key Features**:
- Direct SQL queries to ESI data tables
- Freshness calculation for each data type
- Configurable staleness thresholds
- Error handling and fallback to empty data

**Methods**:
```typescript
class DataRetrievalService {
  getMembers(corporationId): Promise<{ data, freshness }>
  getAssets(corporationId): Promise<{ data, freshness }>
  getManufacturingJobs(corporationId): Promise<{ data, freshness }>
  getMarketOrders(corporationId): Promise<{ data, freshness }>
  getWalletTransactions(corporationId, division): Promise<{ data, freshness }>
  getMiningLedger(corporationId): Promise<{ data, freshness }>
  getDashboardStats(corporationId): Promise<DashboardStats>
  getDataFreshness(corporationId): Promise<Record<string, DataFreshnessInfo>>
}
```

**Staleness Thresholds**:
- Members: 120 minutes
- Assets: 60 minutes
- Manufacturing: 30 minutes
- Market: 60 minutes
- Wallet: 30 minutes
- Mining: 240 minutes

### 2. `/src/lib/data-retrieval-hooks.ts`

**Purpose**: React hooks for easy component integration

**Available Hooks**:
```typescript
// Individual data type hooks
useMembers() → { data, freshness, loading, error, refresh }
useAssets() → { data, freshness, loading, error, refresh }
useManufacturingJobs() → { data, freshness, loading, error, refresh }
useMarketOrders() → { data, freshness, loading, error, refresh }
useWalletTransactions(division) → { data, freshness, loading, error, refresh }
useMiningLedger() → { data, freshness, loading, error, refresh }

// Aggregate hooks
useDashboardStats() → { data, loading, error, refresh }
useDataFreshness() → { freshness, loading, refresh }
```

**Hook Features**:
- Automatic loading state management
- Error handling with error messages
- Manual refresh capability
- Auto-refresh on user/corporation change
- Returns freshness info with every query

### 3. `/src/components/DataFreshnessIndicator.tsx`

**Purpose**: Reusable UI components for showing data freshness

**Components**:

#### DataFreshnessIndicator
```typescript
<DataFreshnessIndicator
  freshness={freshness}
  onRefresh={() => refresh()}
  isRefreshing={loading}
  showRefreshButton={true}
  compact={false}
/>
```

**Features**:
- Shows "Updated X ago" badge
- Green badge when fresh, yellow when stale
- Optional refresh button
- Compact mode for space-constrained areas

#### DataFreshnessAlert
```typescript
<DataFreshnessAlert
  freshness={freshness}
  dataType="members"
  onSync={() => triggerSync()}
/>
```

**Features**:
- Shows warning banner when data is stale or missing
- Explains staleness with helpful message
- Provides sync action button
- Auto-hides when data is fresh

---

## Usage Examples

### Example 1: Members Tab (Basic Usage)

```typescript
import { useMembers } from '@/lib/data-retrieval-hooks';
import { DataFreshnessIndicator } from '@/components/DataFreshnessIndicator';

export function Members() {
  const { data: members, freshness, loading, error, refresh } = useMembers();

  if (loading) return <div>Loading members...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2>Corporation Members</h2>
        <DataFreshnessIndicator
          freshness={freshness}
          onRefresh={refresh}
          isRefreshing={loading}
        />
      </div>
      
      <Table>
        {members.map(member => (
          <TableRow key={member.id}>
            <TableCell>{member.name}</TableCell>
            <TableCell>{member.title}</TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}
```

### Example 2: Dashboard (Multiple Data Sources)

```typescript
import { useDashboardStats, useDataFreshness } from '@/lib/data-retrieval-hooks';

export function Dashboard() {
  const { data: stats, loading, error, refresh } = useDashboardStats();
  const { freshness } = useDataFreshness();

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <DataFreshnessIndicator
              freshness={freshness.members}
              compact
              showRefreshButton={false}
            />
          </CardHeader>
          <CardContent>
            <div className="text-3xl">{stats.totalMembers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets</CardTitle>
            <DataFreshnessIndicator
              freshness={freshness.assets}
              compact
              showRefreshButton={false}
            />
          </CardHeader>
          <CardContent>
            <div className="text-3xl">{stats.totalAssets}</div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={refresh}>Refresh All Stats</Button>
    </div>
  );
}
```

### Example 3: Manufacturing Tab (With Stale Warning)

```typescript
import { useManufacturingJobs } from '@/lib/data-retrieval-hooks';
import { DataFreshnessAlert, DataFreshnessIndicator } from '@/components/DataFreshnessIndicator';
import { SyncExecutor } from '@/lib/sync-executor';

export function Manufacturing() {
  const { data: jobs, freshness, loading, error, refresh } = useManufacturingJobs();
  const { user } = useAuth();

  const handleSync = async () => {
    if (!user?.corporationId || !user?.accessToken) return;
    
    const executor = new SyncExecutor();
    await executor.executeSyncProcess('manufacturing', {
      processId: 'industry_jobs',
      corporationId: user.corporationId,
      accessToken: user.accessToken
    });
    
    refresh(); // Refresh data after sync
  };

  return (
    <div>
      <DataFreshnessAlert
        freshness={freshness}
        dataType="manufacturing jobs"
        onSync={handleSync}
      />

      <div className="flex justify-between items-center mb-4">
        <h2>Manufacturing Jobs</h2>
        <DataFreshnessIndicator
          freshness={freshness}
          onRefresh={refresh}
          isRefreshing={loading}
        />
      </div>

      {/* Job list... */}
    </div>
  );
}
```

---

## Integration Checklist

To integrate Phase 6 into existing tabs, follow these steps:

### For Each Tab Component:

- [ ] Import the appropriate hook from `data-retrieval-hooks.ts`
- [ ] Import `DataFreshnessIndicator` and/or `DataFreshnessAlert`
- [ ] Replace existing data fetching with the hook
- [ ] Add freshness indicator to the header
- [ ] Add refresh button functionality
- [ ] Handle loading and error states
- [ ] Optional: Add stale data warning banner

### Example Migration Pattern:

**Before (Mock Data)**:
```typescript
export function Members() {
  const [members, setMembers] = useState<Member[]>([
    { id: 1, name: 'John', ... },
    { id: 2, name: 'Jane', ... }
  ]);
  
  return <Table>...</Table>;
}
```

**After (Real Data)**:
```typescript
export function Members() {
  const { data: members, freshness, loading, error, refresh } = useMembers();
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <div>
      <DataFreshnessIndicator freshness={freshness} onRefresh={refresh} />
      <Table>...</Table>
    </div>
  );
}
```

---

## Data Freshness System

### How It Works

1. **Last Updated Tracking**: Each table has a `last_updated` timestamp
2. **Staleness Calculation**: Compares current time vs last update
3. **Threshold Comparison**: Each data type has a freshness cutoff (in minutes)
4. **Visual Feedback**: UI shows green (fresh) or yellow (stale) indicators

### Freshness States

| State | Condition | Badge Color | User Action |
|-------|-----------|-------------|-------------|
| **Fresh** | Age < Threshold | Green | None needed |
| **Stale** | Age >= Threshold | Yellow | Consider syncing |
| **Missing** | No data | Gray | Must sync |

### Customizing Staleness Thresholds

Edit `/src/lib/data-retrieval-service.ts`:

```typescript
private staleCutoffMinutes: Record<string, number> = {
  members: 120,      // 2 hours
  assets: 60,        // 1 hour
  manufacturing: 30, // 30 minutes
  market: 60,        // 1 hour
  wallet: 30,        // 30 minutes
  mining: 240        // 4 hours
};
```

---

## Advanced Usage

### Manual Sync Trigger

Trigger a sync from any component:

```typescript
import { SyncExecutor } from '@/lib/sync-executor';
import { ESIDataFetchService } from '@/lib/esi-data-service';
import { ESIDataStorageService, getDatabaseService } from '@/lib/database';

async function triggerMembersSync() {
  const { user } = useAuth();
  
  const dbService = getDatabaseService();
  const storageService = new ESIDataStorageService(dbService);
  const fetchService = new ESIDataFetchService();
  const executor = new SyncExecutor();

  await executor.executeSyncProcess('members', {
    processId: 'corporation_members',
    corporationId: user.corporationId,
    accessToken: user.accessToken,
    storageService,
    fetchService
  });
}
```

### Periodic Auto-Refresh

Auto-refresh data in component:

```typescript
export function Members() {
  const { data, freshness, refresh } = useMembers();

  useEffect(() => {
    // Refresh every 5 minutes
    const interval = setInterval(() => {
      if (freshness.isStale) {
        refresh();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [freshness.isStale]);

  return <div>...</div>;
}
```

### Global Freshness Monitor

Monitor all data types:

```typescript
import { useDataFreshness } from '@/lib/data-retrieval-hooks';

export function GlobalSyncStatus() {
  const { freshness, loading } = useDataFreshness();

  const staleDataTypes = Object.entries(freshness)
    .filter(([_, info]) => info.isStale)
    .map(([type, _]) => type);

  if (staleDataTypes.length > 0) {
    return (
      <Alert variant="warning">
        The following data is stale: {staleDataTypes.join(', ')}
      </Alert>
    );
  }

  return null;
}
```

---

## Testing

### Unit Tests

```typescript
import { DataRetrievalService } from '@/lib/data-retrieval-service';
import { getDatabaseService } from '@/lib/database';

describe('DataRetrievalService', () => {
  it('fetches members from database', async () => {
    const service = new DataRetrievalService(getDatabaseService());
    const result = await service.getMembers(98000001);
    
    expect(result.data).toBeDefined();
    expect(result.freshness).toBeDefined();
    expect(result.freshness.freshnessCutoff).toBe(120);
  });

  it('calculates staleness correctly', async () => {
    const service = new DataRetrievalService(getDatabaseService());
    const result = await service.getMembers(98000001);
    
    if (result.freshness.lastUpdated) {
      expect(result.freshness.isStale).toBeDefined();
      expect(result.freshness.staleDuration).toBeGreaterThanOrEqual(0);
    }
  });
});
```

### Integration Tests

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { Members } from '@/components/tabs/Members';

describe('Members Tab Integration', () => {
  it('displays members from database', async () => {
    render(<Members />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    
    expect(screen.getByText(/members/i)).toBeInTheDocument();
  });

  it('shows freshness indicator', async () => {
    render(<Members />);
    
    await waitFor(() => {
      expect(screen.getByText(/updated/i)).toBeInTheDocument();
    });
  });
});
```

---

## Troubleshooting

### Issue: "No data" shown but sync completed

**Cause**: Data synced to database but component not refreshing

**Solution**: Call `refresh()` after sync completes
```typescript
await executor.executeSyncProcess('members', {...});
refresh(); // Add this
```

### Issue: Freshness always shows "stale"

**Cause**: `last_updated` column not being set during sync

**Solution**: Verify ESIDataStorageService sets `last_updated = NOW()` in INSERT/UPDATE queries

### Issue: Hook doesn't update when user changes

**Cause**: useEffect dependencies missing

**Solution**: Ensure `user?.corporationId` is in dependency array

---

## Performance Considerations

### Database Query Optimization

1. **Indexes**: Ensure `corporation_id` and `last_updated` columns are indexed
```sql
CREATE INDEX idx_corp_updated ON corporation_members(corporation_id, last_updated);
```

2. **Limit Results**: All queries use `LIMIT` to prevent large result sets
```typescript
LIMIT 500  // Manufacturing jobs
LIMIT 1000 // Assets
```

3. **Select Only Needed Columns**: Don't use `SELECT *`

### React Performance

1. **Memoization**: Use `useMemo` for expensive filtering
```typescript
const filteredMembers = useMemo(() => 
  members.filter(m => m.name.includes(search)),
  [members, search]
);
```

2. **Debounce Refresh**: Prevent rapid refresh calls
```typescript
const debouncedRefresh = useMemo(
  () => debounce(refresh, 1000),
  [refresh]
);
```

---

## Next Steps

After implementing Phase 6:

1. **Update All Tab Components** - Migrate from mock data to real hooks
2. **Test Data Flow** - Verify sync → database → UI flow works
3. **Add Global Sync Button** - Allow users to sync all data types at once
4. **Implement Background Sync** - Move to Phase 5 for automatic syncing
5. **Add Data Export** - Allow users to export queried data

---

## Summary

Phase 6 provides:
- ✅ Real database queries replacing mock data
- ✅ Data freshness tracking and visualization
- ✅ Easy-to-use React hooks
- ✅ Configurable staleness thresholds
- ✅ Professional UI components
- ✅ Type-safe implementation
- ✅ Error handling and loading states

All components can now display real EVE ESI data that was synced to the database!
