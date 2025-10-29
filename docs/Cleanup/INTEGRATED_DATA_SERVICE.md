# Integrated Data Service Documentation

## Overview

The LMeve application uses a sophisticated dual-source data architecture that seamlessly integrates EVE Online's ESI API with a persistent database. This provides users with real-time data when available, while maintaining access to historical data and offline functionality.

## Architecture

### Data Flow

```
User Request
    ↓
useIntegratedData Hook
    ↓
IntegratedDataService
    ↓
┌─────────────────────────────────────┐
│  1. Check Cache (if enabled)        │
│  2. Try ESI API (if token available)│
│  3. Fallback to Database             │
│  4. Return combined result           │
└─────────────────────────────────────┘
    ↓
Component Receives:
  - data: T[]
  - loading: boolean
  - error: string | null
  - source: { esi, database, cache }
  - timestamp: string | null
```

### Data Sources

#### 1. ESI API (Primary Source)
- **When Used**: User has valid ESI access token
- **Advantages**: Real-time data, always current
- **Limitations**: Rate limits, requires authentication, network dependent
- **Visual Indicator**: Globe icon with accent color

#### 2. Database (Fallback Source)
- **When Used**: ESI unavailable or fails, offline mode
- **Advantages**: Historical data, offline access, no rate limits
- **Limitations**: May be stale, requires sync
- **Visual Indicator**: Database icon with primary color

#### 3. Cache (Performance Layer)
- **When Used**: Recent data available (default 5 minutes)
- **Advantages**: Instant response, no API calls
- **Limitations**: Short-lived, may be slightly stale
- **Visual Indicator**: Archive icon with muted color

## Usage

### Basic Hook Usage

```typescript
import { useIntegratedData } from '@/hooks/useIntegratedData';

function MyComponent() {
  const { 
    members,           // { data, loading, error, source, timestamp }
    fetchMembers,      // Function to fetch members
    refreshAll        // Refresh all data sources
  } = useIntegratedData();

  useEffect(() => {
    fetchMembers(); // Fetch on mount
  }, [fetchMembers]);

  return (
    <div>
      {members.loading && <LoadingSpinner />}
      {members.error && <ErrorMessage error={members.error} />}
      
      {/* Show data source */}
      <DataSourceIndicator 
        source={members.source}
        timestamp={members.timestamp}
        error={members.error}
      />
      
      {/* Render data */}
      {members.data.map(member => (
        <MemberCard key={member.id} member={member} />
      ))}
    </div>
  );
}
```

### Advanced Options

```typescript
// Force ESI fetch (bypass cache and database)
fetchMembers({ forceESI: true });

// Force database fetch (bypass ESI and cache)
fetchMembers({ forceDB: true });

// Disable cache
fetchMembers({ useCache: false });

// Refresh all data sources
refreshAll({ useCache: false });

// Clear specific cache
clearCache('members');

// Clear all cache
clearCache();
```

## Available Data Endpoints

### Members
```typescript
const { members, fetchMembers } = useIntegratedData();

// Fetches corporation members from ESI or database
await fetchMembers();

// Data structure:
interface Member {
  id: string;
  characterId: number;
  characterName: string;
  corporationId: number;
  corporationName: string;
  role: string;
  // ... additional fields
}
```

### Assets
```typescript
const { assets, fetchAssets } = useIntegratedData();

// Fetches corporation assets from ESI or database
await fetchAssets();

// Data structure:
interface Asset {
  id: string;
  typeId: number;
  typeName: string;
  quantity: number;
  location: string;
  locationId: number;
  hangar?: string;
  // ... additional fields
}
```

### Manufacturing Jobs
```typescript
const { manufacturing, fetchManufacturingJobs } = useIntegratedData();

// Fetches industry jobs from ESI or database
await fetchManufacturingJobs();
```

### Wallet Data
```typescript
const { 
  walletDivisions, 
  walletTransactions,
  fetchWalletDivisions,
  fetchWalletTransactions 
} = useIntegratedData();

// Fetch wallet balances
await fetchWalletDivisions();

// Fetch transactions (optionally filtered by division)
await fetchWalletTransactions(); // All divisions
await fetchWalletTransactions(1); // Division 1 only
```

## Visual Components

### DataSourceIndicator

Shows users where their data is coming from:

```typescript
<DataSourceIndicator 
  source={walletDivisions.source}
  timestamp={walletDivisions.timestamp}
  error={walletDivisions.error}
  showDetails={true} // Show timestamp (default: true)
/>
```

### ConnectionStatus

Shows overall ESI and database connectivity:

```typescript
<ConnectionStatus 
  esiConnected={!!user?.accessToken && esiOnline}
  databaseConnected={isDatabaseConnected}
/>
```

## Integration Points

### ESI Integration

The service automatically uses ESI when:
1. User is authenticated via ESI
2. Valid access token is available
3. Token is not expired
4. Network connection is available

ESI endpoints used:
- `/corporations/{corporation_id}/members/` - Member list
- `/corporations/{corporation_id}/assets/` - Asset inventory
- `/corporations/{corporation_id}/industry/jobs/` - Manufacturing jobs
- `/corporations/{corporation_id}/wallets/` - Wallet balances
- `/corporations/{corporation_id}/wallets/{division}/transactions/` - Transactions

### Database Integration

Database tables queried:
- `characters` - Member data
- `assets` - Asset inventory
- `industry_jobs` - Manufacturing jobs
- `wallet_divisions` - Wallet balances
- `wallet_transactions` - Transaction history

## Error Handling

The service handles errors gracefully:

1. **ESI Failure**: Automatically falls back to database
2. **Database Failure**: Shows error, keeps cached data if available
3. **Rate Limiting**: Respects ESI rate limits with retry logic
4. **Token Expiration**: Clear error message, prompts re-authentication

## Performance Considerations

### Caching Strategy
- Default cache duration: 5 minutes
- Configurable per-request
- Automatic cache invalidation on explicit refresh
- Manual cache clearing available

### Rate Limit Management
- Respects ESI rate limits (100 requests/second)
- Exponential backoff on 429 responses
- Retry logic with max 3 attempts
- Falls back to database on persistent failures

### Database Optimization
- Connection pooling
- Query optimization
- Prepared statements
- Index usage for common queries

## Best Practices

1. **Always show data source**: Use `DataSourceIndicator` to maintain transparency
2. **Handle loading states**: Show appropriate loading UI while fetching
3. **Display errors clearly**: Use error boundaries and error messages
4. **Provide refresh option**: Let users manually refresh when needed
5. **Cache appropriately**: Use cache for frequently accessed, slowly changing data
6. **Consider user context**: ESI-authenticated users get real-time data priority

## Testing

### Test ESI Connection
```typescript
// Check if ESI is available
const canUseESI = user?.accessToken && !isTokenExpired();

// Test fetch with ESI forced
await fetchMembers({ forceESI: true });
```

### Test Database Fallback
```typescript
// Force database usage
await fetchMembers({ forceDB: true });
```

### Test Cache
```typescript
// First fetch (populates cache)
await fetchMembers();

// Second fetch (uses cache)
await fetchMembers({ useCache: true });

// Clear and refetch
clearCache('members');
await fetchMembers({ useCache: false });
```

## Troubleshooting

### "No data source available"
- Check user authentication
- Verify database connection
- Ensure at least one source is configured

### "ESI fetch failed"
- Check access token validity
- Verify network connection
- Check ESI status at status.eveonline.com
- Review rate limit errors

### "Database fetch failed"
- Verify database connection settings
- Check database credentials
- Ensure tables exist and are accessible
- Review database logs

### Stale data
- Manually refresh: `fetchMembers({ useCache: false })`
- Clear cache: `clearCache()`
- Check timestamp in data source indicator
