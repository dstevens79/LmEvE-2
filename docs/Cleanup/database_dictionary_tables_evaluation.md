# Database Dictionary Tables Evaluation Report

## Executive Summary

The current database schema creation scripts in `dat

## Current State

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
10. **`blueprintTypes`** / **`industryActivity`** - Blueprint defi

11. **`dgmTypeAttributes`** - Item attributes (volume, ma
    - **Used by:** Asset management, Logistics
12. **`chrFactions`** - Faction informat
    - **Used by:** Killmails, Warfare trackin

    - **Used by:** Member filtering, Market analysis
---
## Architecture Issues

The current schema approach stores **denormalized names directly**
```typescript
{

  category_name: 'Material',  // ❌ Stored d
  group_name: 'Mineral'  // ❌ Stored directly 
```

- Names become stale when CCP updates them
- No single source of truth




  item_id: 123456789,

}

  typeID: 34,

  marketGroup

{
  groupName: '
}
// Dictionary tab
  stationID: 60003760,
  solarSystemID
```
*
- E





- ❌ Cannot resolve type nam
- ❌ Cannot determine item volumes for cargo calculations

- ❌ Cannot calculate material requiremen



- ⚠️ Market p
**4. Wallet Tab**
-

- ❌ Cannot resolve planet types
- ⚠️ System names ma
**6. Buyback Tab**
-




   - Download manager
   - Import progress tracking

   - SQL generation
 

   - Complete operational schema
 


2. **No import mapping** - No code to m
4

## Recommendations
#
#### 1. Add Dictionary
Create a separate export for SDE dictionary schemas:
```typescript
e
   

      { name:
      { name: 'capacity'
      { name: 'marketGroupID', type: 'IN
    ],
      { name: 'idx_groupID', columns: ['groupID'], ty
    ],

  }



// Modify database-setup-scripts.t

  ).join('\n\n');
```
#### 3. Create SDE Import Service
```typescript
export class SDEImportService {

    // 3. Create diction
    // 5. Create indexes
  }
  async validateSDEData(): Promise<{ valid: bool
    // Verify critical records exist

```
#### 4. Update Operational Tables
Remove redundant name columns, keep only IDs
```typescript

// AFTER:
// Always JOIN to invTypes when name is needed



// Create migration script
  // 1. Create dictionary table
  // 3. Verify all type_ids have matches in inv
  // 5. Add foreign key constrai

---
## Required Dictionary Tables 
### **Priority 1: Critical (Cannot function
2. `invGroups` - Group categorizat

6. 

8. `industryActivityMater

### **Priority 3: Enhanced Featu

14. `planetSchematics` - PI production





   - Verify foreign key constraints work
2. **SDE Import Tes
   - Import to dictio

   - Query asset with type_id, verify nam

4. **Update Test**
   - Update invTypes table




- ❌ No proper norm

- ❌ System/region lookups will fail
**This must be fixed before the application can be considered p
### Recommended Approach
1. **Week 1:** Add all dictionary table schemas to `database-schemas

5. 





4. `/src/lib/data-retrieval-service.ts` - Update queries to u






















































































































































































