# Data Integration Audit Report
**Date:** 2024
**Project:** LMeve EVE Online Corporation Management

## Executive Summary

This audit examines the current state of data integration across all active tabs in the LMeve application. The goal is to ensure that all components use legitimate ESI (EVE Swagger Interface) and database data rather than placeholder/mock data, and that data fetching is consistent across the application.

### Overall Status: ⚠️ NEEDS ATTENTION

**Key Findings:**
- ✅ **Good**: Unified auth system with proper ESI token management
- ⚠️ **Issue**: Multiple competing data service implementations
- ⚠️ **Issue**: Mix of ESI-integrated and mock data across tabs
- ⚠️ **Issue**: Inconsistent data fetching patterns
- ✅ **Good**: Database abstraction layer exists

---

## Tab-by-Tab Analysis

### 1. Dashboard Tab ✅ MOSTLY GOOD
**File:** `src/components/tabs/Dashboard.tsx`

**Data Sources:**
- Uses `useLMeveData()` context hook
- Has fallback to mock data when no dashboard stats available
- Properly checks EVE Online API status via ESI health endpoint

**Issues:**
- Lines 95-106: Falls back to hardcoded stats when `dashboardStats` is null
- Should show "no data" state instead of mock values

**Recommendation:**
```typescript
// REPLACE lines 95-106 with:
const stats = dashboardStats || {
  totalMembers: 0,
  activeMembers: 0,
  totalAssets: 0,
  totalAssetsValue: 0,
  activeJobs: 0,
  completedJobsThisMonth: 0,
  miningOperationsThisMonth: 0,
  miningValueThisMonth: 0,
  corpWalletBalance: 0,
  recentActivity: []
};

// Add loading/empty state UI when all values are 0
```

---

### 2. Members Tab ⚠️ PARTIAL ESI
**File:** `src/components/tabs/Members.tsx`

**Data Sources:**
- Uses `useLMeveData()` context with `members` array
- Calls `refreshMembers()` to fetch data

**Issues:**
- No direct ESI integration visible - relies entirely on `LMeveDataContext`
- Line 107: Login prompt disabled with `&& false` - debug code left in
- No indicator of whether data is from ESI, DB, or mock

**Recommendation:**
- Remove the `&& false` debug code on line 107
- Add data source indicator (ESI/DB/Mock)
- Verify `LMeveDataContext.refreshMembers()` properly fetches from ESI

---

### 3. Assets Tab ✅ GOOD ESI INTEGRATION
**File:** `src/components/tabs/Assets.tsx`

**Data Sources:**
- Uses `useLMeveData()` with proper ESI refresh
- Has loading states and refresh button (lines 235-244)
- Explicit ESI data refresh with toast notifications

**Issues:**
- None major - this is a good example of proper integration

**Good Patterns:**
- Clear loading states with spinner
- Explicit "Refresh ESI Data" button
- Empty state messaging prompts user to refresh
- Toast notifications for user feedback

---

### 4. Manufacturing Tab ⚠️ DUAL MODE (ESI + MOCK)
**File:** `src/components/tabs/Manufacturing.tsx`

**Data Sources:**
- Has both ESI and mock data modes (line 79: `useMockData` state)
- Lines 116-189: `loadESIManufacturingData()` - proper ESI integration
- Lines 260-464: Mock data initialization for fallback

**Issues:**
- **Dual mode complexity**: Maintains parallel ESI and mock systems
- Mock data initializes member list even when ESI user authenticated (lines 269-333)
- Sample tasks created unnecessarily (lines 336-463)

**Recommendation:**
```typescript
// REFACTOR: Remove mock data initialization entirely
// Keep loadESIManufacturingData() function
// Show proper empty states when no ESI data available
// Remove lines 260-464 (mock data initialization)
```

**Good Patterns:**
- Lines 617-622: Shows clear warning when using mock data with ESI user
- Proper ESI job conversion (lines 192-246)
- Database caching (lines 140-146)

---

### 5. Market Tab ❌ PURE MOCK DATA
**File:** `src/components/tabs/Market.tsx`

**Data Sources:**
- Lines 82-100+: All mock data, no ESI integration
- Comments mention ESI endpoints (lines 79-81) but not implemented

**Issues:**
- **NO ESI INTEGRATION AT ALL**
- Uses hardcoded `mockOrders` array
- No database or API calls

**Required ESI Endpoints:**
```
GET /v1/corporations/{corporation_id}/orders/
GET /v1/corporations/{corporation_id}/orders/history/
```

**Recommendation:**
- Create `useMarketData` hook or extend `useLMeveData`
- Implement ESI market orders fetching
- Add database caching layer
- Remove all mock data

**Priority:** HIGH

---

### 6. Wallet Tab ⚠️ MIXED INTEGRATION
**File:** `src/components/tabs/Wallet.tsx`

**Data Sources:**
- Lines 76-82: Uses `useIntegratedData()` hook - GOOD
- Has `fetchWalletDivisions()` and `fetchWalletTransactions()` 
- Lines 96-100: Mock divisions defined as fallback

**Issues:**
- Lines 88-93: Fetches data but doesn't check if fetch succeeded
- Still defines mock data (line 96+)
- No indication whether using real or mock data

**Recommendation:**
- Remove mock divisions entirely
- Add data source indicator
- Show loading/empty states properly

---

### 7. Planetary Interaction Tab ❌ PURE MOCK DATA
**File:** `src/components/tabs/PlanetaryInteraction.tsx`

**Data Sources:**
- Lines 80-100+: Component tier definitions (static, OK)
- Appears to use only KV storage for assignments/deliveries
- No ESI or database integration visible

**Issues:**
- **NO ESI INTEGRATION**
- All data stored only in client-side KV storage
- No corporation-wide PI tracking from ESI

**Recommendation:**
- PI data is complex - may be acceptable to keep as local/manual tracking
- Could add ESI planet/colony fetching as enhancement
- Document that this is manual tracking system, not ESI-synced

**Priority:** MEDIUM (acceptable for MVP)

---

## Data Service Layer Analysis

### Multiple Competing Implementations ⚠️

**Found 3+ different data fetching patterns:**

1. **`LMeveDataContext.tsx`** (Primary)
   - Centralized context provider
   - Has database integration
   - Has ESI fetching for members/assets
   - Used by: Dashboard, Members, Assets, PI

2. **`useIntegratedData` hook** 
   - Separate integration layer
   - Uses `integrated-data-service.ts`
   - Used by: Wallet tab

3. **`ESIDataFetchService` class**
   - Low-level ESI fetching with retries
   - Used by: Manufacturing tab directly

4. **Direct KV storage**
   - Used by: Manufacturing (tasks), PI (assignments)
   - Bypasses all data services

### Issues:
- **No single source of truth** for data fetching
- **Duplicate code** for ESI calls across services
- **Inconsistent patterns** - some tabs use context, others use hooks, others use direct service calls
- **No unified caching strategy**

---

## Recommendations by Priority

### 🔴 HIGH PRIORITY

1. **Market Tab - Add ESI Integration**
   - Currently 100% mock data
   - Implement corporation market orders/history fetching
   - Add to `LMeveDataContext` or create dedicated service

2. **Unify Data Service Layer**
   - Choose ONE pattern: Either `LMeveDataContext` or `useIntegratedData`
   - Migrate all tabs to use the chosen pattern
   - Deprecate other implementations
   - Suggested: Expand `LMeveDataContext` to cover all use cases

3. **Remove All Mock Data Fallbacks**
   - Dashboard: Remove hardcoded stats (lines 95-106)
   - Manufacturing: Remove mock task initialization (lines 260-464)
   - Market: Remove mock orders
   - Wallet: Remove mock divisions
   - Replace with proper empty states and user prompts

### 🟡 MEDIUM PRIORITY

4. **Add Data Source Indicators**
   - Show users whether viewing ESI, Database, or cached data
   - Add last-sync timestamps
   - Pattern exists in Manufacturing tab - replicate elsewhere

5. **Standardize Loading States**
   - Create shared loading component
   - Ensure all tabs show loading spinners during ESI fetches
   - Assets tab is good example to follow

6. **Database Caching Layer**
   - Ensure all ESI data is cached to database
   - Manufacturing tab does this well (lines 140-146)
   - Implement for Market and other tabs

### 🟢 LOW PRIORITY

7. **PI Tab Enhancement**
   - Consider adding ESI colony fetching
   - Or document as manual tracking feature
   - Not critical for MVP

8. **Error Handling Standardization**
   - Create unified error handling pattern
   - Show user-friendly error messages
   - Add retry mechanisms

---

## Data Flow Architecture Recommendation

### Proposed Unified Pattern:

```
┌─────────────────────────────────────────────────────────┐
│                    React Component                       │
│                   (Dashboard, Members, etc)              │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Uses hook
                     ▼
┌─────────────────────────────────────────────────────────┐
│              useLMeveData() Hook                         │
│         (Single source of truth for all data)            │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Coordinates
                     ▼
┌─────────────────────────────────────────────────────────┐
│           LMeveDataService / IntegratedDataService       │
│              (Business logic layer)                      │
└────┬───────────────────────────────────────┬────────────┘
     │                                       │
     │ Fetches from                         │ Caches to
     ▼                                       ▼
┌─────────────────┐              ┌──────────────────────┐
│  ESI API        │              │  Database Manager    │
│  (eveApi.ts)    │              │  (DatabaseContext)   │
└─────────────────┘              └──────────────────────┘
```

### Implementation Steps:

1. **Extend LMeveDataContext** to include:
   - Market orders/history
   - Wallet divisions/transactions
   - PI colonies (optional)
   - Any other missing data types

2. **Migrate all tabs** to use `useLMeveData()`:
   ```typescript
   const { 
     members, 
     assets, 
     marketOrders,
     walletDivisions,
     loading,
     refreshMembers,
     refreshAssets,
     refreshMarket,
     refreshWallet
   } = useLMeveData();
   ```

3. **Remove alternative implementations**:
   - Delete or deprecate `useIntegratedData`
   - Move `ESIDataFetchService` inside `LMeveDataContext`
   - Standardize on one pattern

---

## Code Quality Issues Found

### Debug Code Left In Production
- `Members.tsx` line 107: `&& false` disabling login prompt
- Should be removed

### Inconsistent TypeScript Types
- Some files use `Member` type from `types.ts`
- Others define inline interfaces
- Should consolidate to shared types

### Console.log Statements
- Excessive debug logging throughout
- Should use proper logging service or remove for production

---

## Testing Recommendations

1. **ESI Integration Tests**
   - Mock ESI responses
   - Test token expiration handling
   - Test rate limiting (429 responses)

2. **Data Flow Tests**
   - Verify data flows from ESI → Database → Context → Component
   - Test cache invalidation
   - Test offline/error scenarios

3. **Loading State Tests**
   - Ensure all tabs show loading indicators
   - Test empty states
   - Test error states

---

## Conclusion

### Summary of Required Work:

| Component | Current State | Required Action | Effort |
|-----------|--------------|-----------------|--------|
| Dashboard | Mostly good | Remove mock fallback | Small |
| Members | Partial ESI | Remove debug code, add indicator | Small |
| Assets | ✅ Good | None | None |
| Manufacturing | Dual mode | Remove mock system | Medium |
| Market | ❌ No ESI | Full ESI implementation | Large |
| Wallet | Mixed | Remove mocks, verify fetching | Medium |
| PI | Manual only | Document or add ESI (optional) | Medium |
| **Data Services** | **Fragmented** | **Unify to single pattern** | **Large** |

### Total Estimated Effort:
- **Critical Path**: 2-3 days (Market ESI + Service unification)
- **Complete Cleanup**: 4-5 days (All recommendations)

### Next Steps:
1. Start with Market tab ESI integration
2. Unify data service layer
3. Remove all mock data fallbacks
4. Add comprehensive data source indicators
5. Update documentation

---

## Files That Need Modification

### High Priority:
- [ ] `src/components/tabs/Market.tsx` - Add ESI integration
- [ ] `src/lib/LMeveDataContext.tsx` - Extend for market/wallet
- [ ] `src/components/tabs/Manufacturing.tsx` - Remove mock system
- [ ] `src/components/tabs/Dashboard.tsx` - Remove mock fallback
- [ ] `src/components/tabs/Members.tsx` - Remove debug code

### Medium Priority:
- [ ] `src/components/tabs/Wallet.tsx` - Remove mocks
- [ ] `src/hooks/useIntegratedData.ts` - Deprecate or merge
- [ ] `src/lib/integrated-data-service.ts` - Consolidate
- [ ] `src/lib/esi-data-service.ts` - Integrate into unified service

### Documentation:
- [ ] Create data architecture documentation
- [ ] Document ESI endpoints used
- [ ] Add troubleshooting guide for data sync issues

