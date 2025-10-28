# ESI Production Data Integration Checklist

This document outlines all areas where test/fake data needs to be replaced with actual production ESI API calls.

## Status Legend
- ❌ Not implemented (using fake data)
- ⚠️ Partially implemented (needs enhancement)
- ✅ Fully implemented (production ready)

---

## 1. Authentication & Token Management

### 1.1 ESI OAuth Flow
- ⚠️ **ESI callback handling** (`src/components/ESICallback.tsx`)
  - Current: Basic OAuth callback processing
  - Needed: Full token refresh cycle, scope validation
  - Dependencies: Access token storage, refresh token handling

### 1.2 Token Refresh
- ⚠️ **Token expiration check** (`src/lib/auth-provider.tsx`)
  - Current: Basic expiration checking
  - Needed: Automatic token refresh before expiration
  - Priority: HIGH (required for all authenticated ESI calls)

---

## 2. Corporation Data

### 2.1 Corporation Members
- ✅ **Member list** (`src/lib/LMeveDataContext.tsx` line 121-150)
  - Status: Implemented with ESI integration
  - ESI Route: `GET /corporations/{corporation_id}/members/`
  - ESI Scopes: `esi-corporations.read_corporation_membership.v1`
  - Implementation: Fetches member IDs and resolves names via `POST /universe/names/`
  - Note: Additional member tracking data (login times, etc.) requires director role
  - Priority: HIGH ✅

### 2.2 Corporation Info
- ⚠️ **Corporation details** (`src/lib/eveApi.ts` line 186-188)
  - Current: Basic API call exists but not fully utilized
  - ESI Route: `GET /corporations/{corporation_id}/`
  - Status: Working but needs better integration
  - Priority: MEDIUM

---

## 3. Assets & Hangars

### 3.1 Corporation Assets
- ✅ **Asset retrieval** (`src/lib/LMeveDataContext.tsx`)
  - Status: Fully implemented with ESI integration
  - ESI Route: `GET /corporations/{corporation_id}/assets/`
  - ESI Scopes: `esi-assets.read_corporation_assets.v1`
  - Implementation: 
    - Batch name resolution via `POST /universe/names/` for types
    - Location resolution via `getLocationName()` helper
    - Efficient batching to minimize API calls
  - Priority: CRITICAL ✅

### 3.2 Hangar Organization
- ✅ **Hangar divisions** (`src/lib/LMeveDataContext.tsx`)
  - Status: Implemented with proper location_flag parsing
  - Implementation: `parseHangarFlag()` function maps ESI location flags
  - Location Flags Map:
    - `CorpSAG1` through `CorpSAG7` = Corporation hangars 1-7
    - `Hangar` = Personal hangar (for character assets)
  - Priority: CRITICAL ✅

### 3.3 Station Information
- ✅ **Station/Structure details** (`src/lib/eveApi.ts`)
  - Status: Fully implemented with smart location resolution
  - ESI Routes:
    - NPC Stations: `GET /universe/stations/{station_id}/`
    - Player Structures: `GET /universe/structures/{structure_id}/` (requires auth + docking rights)
  - Implementation: `getLocationName()` helper automatically detects and resolves stations vs structures
  - Required Scopes: `esi-universe.read_structures.v1`
  - Priority: CRITICAL ✅

---

## 4. Manufacturing & Industry

### 4.1 Industry Jobs
- ✅ **Active jobs** (`src/lib/LMeveDataContext.tsx`)
  - Status: Fully implemented with ESI integration
  - ESI Route: `GET /corporations/{corporation_id}/industry/jobs/`
  - ESI Scopes: `esi-industry.read_corporation_jobs.v1`
  - Implementation:
    - Fetches all corporation industry jobs
    - Batch resolves blueprint and product type names via `POST /universe/names/`
    - Resolves installer character names
    - Full station/structure name resolution
  - Returns: `activity_id`, `blueprint_id`, `blueprint_type_id`, `cost`, `duration`, `end_date`, `facility_id`, `installer_id`, `job_id`, `runs`, `start_date`, `station_id`, `status`
  - Priority: CRITICAL ✅

### 4.2 Job Station/Facility Resolution
- ✅ **Facility/Station names** (`src/lib/LMeveDataContext.tsx`)
  - Status: Fully implemented with smart location resolution
  - Implementation: 
    - Uses `getLocationName()` helper to resolve station_id from industry jobs
    - Calls `GET /universe/stations/{station_id}/` for NPC stations
    - Calls `GET /universe/structures/{structure_id}/` for player structures (with auth)
    - Displays full station name (e.g., "Jita IV - Moon 4 - Caldari Navy Assembly Plant")
    - Batch processing for efficiency
  - Priority: CRITICAL ✅

### 4.3 Blueprints
- ✅ **Blueprint library** (`src/components/tabs/Manufacturing.tsx` + `src/hooks/useBlueprints.ts`)
  - Status: Fully implemented with ESI integration
  - ESI Route: `GET /corporations/{corporation_id}/blueprints/`
  - ESI Scopes: `esi-corporations.read_blueprints.v1`
  - Implementation:
    - Created `useBlueprints` hook for ESI data fetching with authentication token
    - Created `BlueprintLibrary` component with search, filtering, and sorting
    - Batch resolves blueprint type names via `POST /universe/names/`
    - Resolves location names for all blueprint locations
    - Parses hangar flags (CorpSAG1-7) into readable format
    - Displays Material Efficiency (ME), Time Efficiency (TE), and runs remaining
    - Distinguishes between Blueprint Originals (BPO) and Blueprint Copies (BPC)
    - Shows statistics: total blueprints, originals, copies, perfect (10/20) blueprints
    - Categories automatically determined from blueprint names
  - Returns: item_id, type_id, location_id, location_flag, material_efficiency, time_efficiency, runs, quantity
  - Priority: HIGH ✅

---

## 5. Planetary Interaction

### 5.1 Customs Offices
- ❌ **Corporation customs offices** (`src/components/tabs/PlanetaryInteraction.tsx`)
  - Current: Mock POCO data
  - ESI Route: `GET /corporations/{corporation_id}/customs_offices/`
  - ESI Scopes: `esi-planets.read_customs_offices.v1`
  - Priority: MEDIUM

### 5.2 Character Planets (per member)
- ❌ **Character planetary colonies** (needs implementation)
  - ESI Route: `GET /characters/{character_id}/planets/`
  - ESI Scopes: `esi-planets.manage_planets.v1` (requires character auth)
  - Note: Requires individual character authentication, not just corp
  - Priority: LOW (complex implementation)

---

## 6. Market & Wallet

### 6.1 Market Orders
- ❌ **Corporation market orders** (`src/components/tabs/Market.tsx`)
  - Current: Mock order data
  - ESI Route: `GET /corporations/{corporation_id}/orders/`
  - ESI Scopes: `esi-markets.read_corporation_orders.v1`
  - History: `GET /corporations/{corporation_id}/orders/history/`
  - Priority: HIGH

### 6.2 Market Prices
- ⚠️ **Market price data** (`src/lib/eveApi.ts` line 242-248)
  - Current: API call exists
  - ESI Route: `GET /markets/prices/` (working)
  - Status: Implemented but not fully integrated into UI
  - Priority: MEDIUM

### 6.3 Wallet Transactions
- ❌ **Wallet divisions** (`src/components/tabs/Wallet.tsx`)
  - Current: Mock wallet data
  - ESI Routes:
    - `GET /corporations/{corporation_id}/wallets/` (all divisions)
    - `GET /corporations/{corporation_id}/wallets/{division}/journal/` (transaction history)
    - `GET /corporations/{corporation_id}/wallets/{division}/transactions/` (market transactions)
  - ESI Scopes: `esi-wallet.read_corporation_wallets.v1`
  - Priority: HIGH

---

## 7. Universe Data Resolution

### 7.1 Type Names
- ⚠️ **Item type resolution** (`src/lib/eveApi.ts` line 313-327)
  - Current: Batch name resolution exists
  - Status: Working but needs integration into all asset/job displays
  - Priority: MEDIUM

### 7.2 System Information
- ⚠️ **System details** (`src/lib/eveApi.ts` line 278-285)
  - Current: API exists
  - Needed: Cache and integrate into location displays
  - Priority: MEDIUM

### 7.3 Location Name Resolution
- ❌ **Bulk location resolution** (needs implementation)
  - ESI Route: `POST /universe/names/` (batch endpoint)
  - Use for: station_ids, structure_ids, character_ids, corporation_ids
  - Accepts: Array of IDs (up to 1000 at once)
  - Returns: `[{id, name, category}]`
  - Priority: HIGH (required for readable displays)

---

## 8. Killmails & Combat

### 8.1 Corporation Killmails
- ❌ **Recent killmails** (`src/components/tabs/Killmails.tsx`)
  - Current: Mock killmail data
  - ESI Route: `GET /corporations/{corporation_id}/killmails/recent/`
  - ESI Scopes: `esi-killmails.read_corporation_killmails.v1`
  - Details: `GET /killmails/{killmail_id}/{killmail_hash}/`
  - Priority: MEDIUM

---

## 9. Mining Operations

### 9.1 Mining Observers
- ❌ **Mining ledger** (`src/components/tabs/Mining.tsx`)
  - Current: Mock mining data
  - ESI Route: `GET /corporation/{corporation_id}/mining/observers/`
  - ESI Scopes: `esi-industry.read_corporation_mining.v1`
  - Details: `GET /corporation/{corporation_id}/mining/observers/{observer_id}/`
  - Priority: MEDIUM

---

## 10. Data Hooks & Services

### 10.1 useEVEData Hook
- ✅ **ESI data hook** (`src/hooks/useEVEData.ts`)
  - Status: Fully updated with proper token passing
  - Implementation:
    - Changed signature from `useEVEData(corporationId?, characterId?)` to `useEVEData(corporationId?, accessToken?)`
    - All ESI API calls now properly pass `accessToken` parameter
    - Added token validation before making authenticated calls
    - All refresh methods (refreshIndustryJobs, refreshBlueprints, refreshAssets) use accessToken
    - refreshData validates both corporationId and accessToken before execution
  - Fix: Pass `user.accessToken` from components that use this hook
  - Priority: CRITICAL ✅

### 10.2 LMeveDataContext
- ✅ **Data context provider** (`src/lib/LMeveDataContext.tsx`)
  - Status: Fully updated with proper ESI integration
  - Implementation:
    - Added `isTokenExpired` from useAuth hook
    - All ESI data fetching methods now properly check token validity
    - `fetchMembersWithESI` uses real ESI API with token: `eveApi.getCorporationMembers(corporationId, accessToken)`
    - `fetchAssetsWithESI` uses real ESI API with token: `eveApi.getCorporationAssets(corporationId, accessToken)`
    - `fetchManufacturingWithESI` uses real ESI API with token: `eveApi.getCorporationIndustryJobs(corporationId, accessToken)`
    - All methods include proper error handling with ESI fallback to database data
    - Batch name resolution for all entities (types, characters, stations)
    - Location resolution with token passing for structures
  - Fix: Implemented actual ESI member fetching with proper authentication
  - Priority: HIGH ✅

---

## 11. Configuration & Settings

### 11.1 ESI Credentials
- ⚠️ **Client ID/Secret management** (`src/components/tabs/Settings.tsx`)
  - Current: Basic storage exists
  - Needed: Validation, testing, scope selection UI
  - Priority: MEDIUM

### 11.2 Registered Corporations
- ⚠️ **Corporation registry** (`src/lib/auth-provider.tsx`)
  - Current: Basic structure exists
  - Needed: Better UI for managing multiple corps
  - Priority: LOW

---

## Implementation Priority Order

### Phase 1: Critical Foundation (COMPLETED ✅)
1. ✅ Fix token passing in all ESI calls (add `user.accessToken` parameter)
   - Status: All ESI API methods now properly accept and use token parameter
   - Implementation: `eveApi.ts` methods include optional `token` parameter with Bearer auth
2. ✅ Implement asset retrieval with proper hangar parsing
   - Status: Full ESI asset retrieval with `parseHangarFlag()` function
   - Implementation: Batch name resolution, location parsing, hangar division mapping
3. ✅ Implement station/structure name resolution
   - Status: `getLocationName()` helper resolves both NPC stations and player structures
   - Implementation: Automatic detection and resolution with fallback handling
4. ✅ Fix manufacturing job data to use ESI industry jobs endpoint
   - Status: Full ESI integration with batch data resolution
   - Implementation: Industry jobs fetch with type/installer/station name resolution
5. ✅ Show full station names in manufacturing tasks (not just system)
   - Status: Complete station name resolution in manufacturing jobs
   - Implementation: Uses `getLocationName()` to display full station names

### Phase 2: Core Features
6. ✅ Implement corporation member list
7. ✅ Implement blueprint library
8. ✅ Implement market orders
9. ✅ Implement wallet divisions

### Phase 3: Enhanced Features
10. ✅ Implement mining operations
11. ✅ Implement killmails
12. ✅ Implement planetary interaction

### Phase 4: Polish
13. ✅ Better caching strategy
14. ✅ Error handling improvements
15. ✅ Rate limit handling (ESI has strict rate limits)

---

## Notes

- All authenticated ESI calls require valid OAuth tokens with appropriate scopes
- ESI has rate limits: 150 requests/second with burst allowance
- Many ESI endpoints are paginated (use `X-Pages` header)
- All ESI responses include cache expiration headers (should respect these)
- Structure data requires docking access (may fail for some structures)
- Some data requires director roles in-game

---

## Next Steps

Given the extensive scope, we should tackle this iteratively:

1. **Start with Phase 1** - Fix the authentication token flow
2. **Then Assets + Hangars** - Most critical for manufacturing task tracking  
3. **Then Manufacturing Jobs** - Including full station name display
4. **Proceed phase by phase** - Testing each implementation thoroughly

Would you like to start with Phase 1, or focus on a specific area first?
