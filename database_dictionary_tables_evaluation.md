# Database Dictionary Tables Evaluation Report

## Executive Summary

**Status:** ❌ **MISSING CRITICAL DICTIONARY TABLES**

The current database schema creation scripts in `database-schemas.ts` are **missing all EVE Online static dictionary tables**. The schema only defines operational/transactional tables but lacks the reference/dictionary tables needed for lookups.

---

## Current State

### ✅ What Exists (Operational Tables)
The schema correctly defines 31 operational tables for runtime data:
- `users`, `corporations`, `members`
- `assets`, `blueprints`, `manufacturing_jobs`
- `wallet_journal`, `wallet_transactions`
- `market_prices`, `market_orders`
- `contracts`, `killmails`
- `notifications`, `structures`
- And others...

### ❌ What's Missing (Dictionary/Reference Tables)

The schema is **completely missing** all EVE static data dictionary tables that should come from the SDE (Static Data Export). These are critical for name resolution and data enrichment:

#### **Missing Critical Dictionary Tables:**

1. **`invTypes`** - Item type definitions (type_id → type_name)
   - **Impact:** Cannot resolve item names from type IDs
   - **Used by:** Assets, Manufacturing, Market, Wallet transactions
   - **Example:** type_id `34` should resolve to "Tritanium"

2. **`invGroups`** - Item group definitions (group_id → group_name)
   - **Impact:** Cannot categorize items by group
   - **Used by:** Assets, Blueprint filtering, Manufacturing
   - **Example:** Ships, Ammunition, Minerals

3. **`invCategories`** - Item category definitions (category_id → category_name)
   - **Impact:** Cannot categorize items at highest level
   - **Used by:** Asset organization, Manufacturing filters
   - **Example:** Ship, Module, Charge, Blueprint

4. **`mapSolarSystems`** - Solar system information (system_id → system_name, security)
   - **Impact:** Cannot resolve system names from IDs
   - **Used by:** Mining ledger, Killmails, Structures, PI
   - **Example:** system_id `30000142` → "Jita"

5. **`mapRegions`** - Region information (region_id → region_name)
   - **Impact:** Cannot resolve region names
   - **Used by:** Market prices, Structures
   - **Example:** region_id `10000002` → "The Forge"

6. **`staStations`** - NPC station information (station_id → station_name)
   - **Impact:** Cannot resolve NPC station names
   - **Used by:** Assets, Manufacturing jobs
   - **Example:** station_id `60003760` → "Jita IV - Moon 4 - Caldari Navy Assembly Plant"

7. **`invMarketGroups`** - Market group hierarchy (marketGroupID → marketGroupName)
   - **Impact:** Cannot organize items by market categories
   - **Used by:** Market interface, Item browsing
   - **Example:** Ammunition & Charges → Frequency Crystals

8. **`industryActivityMaterials`** - Manufacturing material requirements
   - **Impact:** Cannot calculate manufacturing costs
   - **Used by:** Manufacturing planning, Cost calculations
   - **Example:** What materials are needed for a Thorax blueprint

9. **`industryActivityProducts`** - Manufacturing outputs
   - **Impact:** Cannot determine what blueprint produces
   - **Used by:** Manufacturing planning
   - **Example:** Blueprint → Product mapping

10. **`blueprintTypes`** / **`industryActivity`** - Blueprint definitions
    - **Impact:** Cannot determine ME/TE bonuses, activity types
    - **Used by:** Manufacturing calculations

11. **`dgmTypeAttributes`** - Item attributes (volume, mass, etc.)
    - **Impact:** Cannot calculate cargo space, determine item properties
    - **Used by:** Asset management, Logistics

12. **`chrFactions`** - Faction information
    - **Impact:** Cannot resolve faction names
    - **Used by:** Killmails, Warfare tracking

13. **`crpNPCCorporations`** - NPC corporation information
    - **Impact:** Cannot identify NPC corporations
    - **Used by:** Member filtering, Market analysis

---

## Architecture Issues

### Current Implementation Problem

The current schema approach stores **denormalized names directly** in operational tables:

```typescript
// Current approach in assets table:
{
  type_id: 34,
  type_name: 'Tritanium',  // ❌ Stored directly - gets stale
  category_id: 4,
  category_name: 'Material',  // ❌ Stored directly - gets stale
  group_id: 18,
  group_name: 'Mineral'  // ❌ Stored directly - gets stale
}
```

**Problems with this approach:**
- Data duplication across millions of records
- Names become stale when CCP updates them
- Increased storage requirements
- No single source of truth
- Cannot easily update all references when CCP renames items

### Proper Dictionary Table Architecture

Should use **normalized foreign keys** with dictionary lookups:

```typescript
// Operational table (assets):
{
  item_id: 123456789,
  type_id: 34,  // FK to invTypes
  quantity: 1000000,
  location_id: 60003760  // FK to staStations
}

// Dictionary table (invTypes):
{
  typeID: 34,
  typeName: 'Tritanium',
  groupID: 18,  // FK to invGroups
  volume: 0.01,
  marketGroupID: 1857
}

// Dictionary table (invGroups):
{
  groupID: 18,
  groupName: 'Mineral',
  categoryID: 4  // FK to invCategories
}

// Dictionary table (staStations):
{
  stationID: 60003760,
  stationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
  solarSystemID: 30000142
}
```

**Benefits:**
- Single source of truth
- Easy updates when CCP releases new SDE
- Reduced storage (name stored once, not millions of times)
- Query flexibility (JOIN when needed, omit when not)
- Data integrity via foreign keys

---

## Impact Analysis

### Current Functionality Affected

**1. Assets Tab**
- ❌ Cannot resolve type names if only type_id is available
- ❌ Cannot filter by category/group without hardcoded values
- ❌ Cannot determine item volumes for cargo calculations
- ⚠️ Relies on pre-stored names that may be outdated

**2. Manufacturing Tab**
- ❌ Cannot calculate material requirements (no industryActivityMaterials)
- ❌ Cannot determine blueprint outputs (no industryActivityProducts)
- ❌ Cannot validate blueprint efficiency bonuses
- ⚠️ Material cost calculations incomplete

**3. Market Tab**
- ❌ Cannot organize items by market groups
- ❌ Cannot determine proper item hierarchies
- ⚠️ Market price lookups rely on denormalized data

**4. Wallet Tab**
- ❌ Cannot resolve item names in transactions if missing
- ❌ Cannot identify NPC corporations vs player corps
- ⚠️ Station names may be missing for structures

**5. Planetary Interaction Tab**
- ❌ Cannot resolve planet types
- ❌ Cannot determine PI commodity relationships
- ⚠️ System names may be missing

**6. Buyback Tab**
- ❌ Cannot validate item types
- ❌ Cannot calculate refined mineral values
- ⚠️ Price calculations incomplete

---

## SDE Integration Status

### What's Currently Implemented

1. **SDE Service** (`sdeService.ts`) ✅
   - Download manager
   - Version checking
   - Import progress tracking
   - BUT: No table schema definitions

2. **Database Setup Scripts** (`database-setup-scripts.ts`) ✅
   - SQL generation
   - Remote execution
   - Progress tracking
   - BUT: Only creates operational tables

3. **Database Schemas** (`database-schemas.ts`) ✅
   - Complete operational schema
   - SQL generation functions
   - Validation
   - BUT: Zero dictionary tables defined

### What's Missing

1. **No SDE table schemas** - Dictionary table definitions not included
2. **No import mapping** - No code to map SDE SQL to our schema
3. **No update mechanism** - Cannot update dictionary data when SDE updates
4. **No validation** - Cannot verify SDE data integrity after import

---

## Recommendations

### Immediate Actions Required

#### 1. Add Dictionary Table Schemas to `database-schemas.ts`

Create a separate export for SDE dictionary schemas:

```typescript
// Add to database-schemas.ts
export const sdeDictionarySchemas: DatabaseSchema[] = [
  {
    tableName: 'invTypes',
    columns: [
      { name: 'typeID', type: 'INT', nullable: false, primaryKey: true },
      { name: 'typeName', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'groupID', type: 'INT', nullable: false },
      { name: 'volume', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'capacity', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'mass', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'marketGroupID', type: 'INT', nullable: true },
      { name: 'description', type: 'TEXT', nullable: true }
    ],
    indexes: [
      { name: 'idx_groupID', columns: ['groupID'], type: 'INDEX' },
      { name: 'idx_marketGroupID', columns: ['marketGroupID'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },
  // Add all other dictionary tables...
];
```

#### 2. Update Database Setup to Create Dictionary Tables

```typescript
// Modify database-setup-scripts.ts
export function generateSDEDatabaseSetup(): string {
  return sdeDictionarySchemas.map(schema => 
    generateCreateTableSQL(schema)
  ).join('\n\n');
}
```

#### 3. Create SDE Import Service

```typescript
// Create new file: sde-import-service.ts
export class SDEImportService {
  async importSDEDatabase(progressCallback?: (progress: number) => void) {
    // 1. Download SDE from Fuzzwork
    // 2. Extract archive
    // 3. Create dictionary tables
    // 4. Import SQL data
    // 5. Create indexes
    // 6. Validate import
  }
  
  async validateSDEData(): Promise<{ valid: boolean; errors: string[] }> {
    // Check table counts
    // Verify critical records exist
    // Check foreign key integrity
  }
}
```

#### 4. Update Operational Tables

Remove redundant name columns, keep only IDs:

```typescript
// BEFORE:
{ name: 'type_name', type: 'VARCHAR', size: 255, nullable: false }

// AFTER:
// Remove type_name column entirely
// Always JOIN to invTypes when name is needed
```

#### 5. Add Migration Support

Create migration to handle existing data:

```typescript
// Create migration script
export async function migrateToNormalizedSchema() {
  // 1. Create dictionary tables
  // 2. Import SDE data
  // 3. Verify all type_ids have matches in invTypes
  // 4. Drop redundant name columns
  // 5. Add foreign key constraints
}
```

---

## Required Dictionary Tables (Priority Order)

### **Priority 1: Critical (Cannot function without)**
1. `invTypes` - Type ID to name resolution
2. `invGroups` - Group categorization
3. `invCategories` - Category classification
4. `mapSolarSystems` - System name resolution
5. `mapRegions` - Region name resolution
6. `staStations` - NPC station names

### **Priority 2: Important (Limited functionality without)**
7. `invMarketGroups` - Market organization
8. `industryActivityMaterials` - Manufacturing materials
9. `industryActivityProducts` - Manufacturing products
10. `dgmTypeAttributes` - Item attributes

### **Priority 3: Enhanced Features**
11. `chrFactions` - Faction information
12. `crpNPCCorporations` - NPC corp identification
13. `mapConstellations` - Constellation data
14. `planetSchematics` - PI production chains
15. `invMetaTypes` - Tech level information

---

## Testing Requirements

### Post-Implementation Tests

1. **Schema Creation Test**
   - Verify all 31 operational tables created
   - Verify all 15+ dictionary tables created
   - Verify foreign key constraints work

2. **SDE Import Test**
   - Download and extract SDE
   - Import to dictionary tables
   - Verify record counts match expected

3. **Data Resolution Test**
   - Query asset with type_id, verify name lookup works
   - Query system_id, verify system name resolved
   - Verify JOINs perform acceptably

4. **Update Test**
   - Simulate CCP renaming an item
   - Update invTypes table
   - Verify all references now use new name

---

## Conclusion

The database schema is **fundamentally incomplete** for EVE Online data. While operational tables are well-designed, the complete absence of dictionary tables means:

- ❌ Name resolution relies on potentially stale cached data
- ❌ No proper normalization for EVE static data
- ❌ Cannot update when CCP releases new content
- ❌ Manufacturing calculations incomplete
- ❌ Market organization impossible
- ❌ System/region lookups will fail

**This must be fixed before the application can be considered production-ready.**

### Recommended Approach

1. **Week 1:** Add all dictionary table schemas to `database-schemas.ts`
2. **Week 2:** Update database setup to create dictionary tables in `EveStaticData` database
3. **Week 3:** Implement SDE download and import service
4. **Week 4:** Create migration for existing installations
5. **Week 5:** Update all tabs to use JOINs instead of denormalized names
6. **Week 6:** Testing and validation

**Estimated Effort:** 4-6 weeks for full implementation and testing

---

## Files That Need Changes

1. `/src/lib/database-schemas.ts` - Add dictionary table schemas
2. `/src/lib/database-setup-scripts.ts` - Update to create dictionary tables
3. `/src/lib/sdeService.ts` - Complete import functionality
4. `/src/lib/data-retrieval-service.ts` - Update queries to use JOINs
5. All tab components - Update to handle dictionary lookups

---

*Report Generated: 2024*
*Evaluated Files: database-schemas.ts, database-setup-scripts.ts, sdeService.ts*
