# Database Tables Missing Schema Definitions - FIXED

The database eva

The LMeve database has two separate sets of tables:

   - These ar

The LMeve database has two separate sets of tables:

1. **SDE (Static Data Export) Tables** - EVE Online static reference data (invTypes, mapSolarSystems, etc.)
   - These are 1:1 from the EVE SDE and should not be modified
   - These are NOT managed by our application - they come from CCP's SDE dumps
   
2. **LMeve Application Tables** - Corporation management operational data
   - These store the actual ESI-synced corporation data


**Purpose:** ESI-synced corporation member tracking data
**Key Columns:**
- `character_id` - Character identifier  
- `location_id` - Current location

- `title` - Corporation title

- Unique index 

- `corporation_id` → `corpor
### 2. `corporation_assets`

- `corporation_i
- `type_id` - Item type ID (references SDE 
- `location_id` - Storage location
- `location_type` - Type of locatio
- `is_blueprint_copy` - Whether bl

- Unique index on `(corporation_id, 

- `corporation_id` → `corpora
### 3. `industry_jobs`

- `corporati
- `installer_id` - Character who installed the job
- `activity_id` - Type of industry activity

- `runs` - Number
- `status` - Job status (active, paused, ready, delivered, e


- Unique index on `job_id`

- `corporation_i
## Database Schema Statistics (Updated)
- **Total Tables:** 21 (was 18)
- **Total Indexes:** 47 (was 37)



|-----------|-----------|----------------|---------|
| Members | `members` | ✅ Exists | Internal manageme
| Assets | `assets` | ✅ Exists | Internal managemen
| Jobs | `manufacturing_jobs` | ✅ Exis

2. Internal 



- Added `industry


- Updated index count 
- Added new section documenting the ESI Data Tables

All referenced t
```typescript
const tableMap: Record<string, stri
  assets: 'corporation_assets',          // ✅ Sche
  market: 'market_orders',               // ✅ S
  mining: 'mining_ledger'                //
```
## No SDE Tables Needed
The evaluation document mentioned missing SD
- `invGroups` - Item grou
- `mapRegions` - Regions

1. They are static reference da
3. They are external dependencies,



✅ Database validation will
✅ ESI sync processes can store data in proper tables




























































































