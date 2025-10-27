# ESI Routes for Planetary Interaction Delivery Tracking

## Overview
Yes! There are several ESI routes that can help monitor delivery hangar inputs to match pilots and items to assigned PI components.

## Primary ESI Routes for PI Tracking

### 1. **Corporation Assets** (RECOMMENDED)
```
GET /corporations/{corporation_id}/assets/
Version: v5 (current)
Scope: esi-assets.read_corporation_assets.v1
```

**How it works:**
- Returns ALL corporation assets including items in delivery hangars
- Each asset includes:
  - `type_id` - The item type (matches PI component typeId)
  - `location_id` - Where the item is located
  - `location_flag` - Specific location like "CorpDeliveries"
  - `quantity` - How many items
  - `item_id` - Unique instance identifier

**Key advantage:** 
- Can filter by `location_flag: "CorpDeliveries"` to see ONLY delivery hangar items
- Perfect for tracking PI component deliveries

### 2. **Corporation Asset Names**
```
POST /corporations/{corporation_id}/assets/names/
Version: v1
Scope: esi-assets.read_corporation_assets.v1
```

**How it works:**
- Get names/labels for specific assets
- Useful if items are packaged or renamed

### 3. **Corporation Asset Locations**
```
POST /corporations/{corporation_id}/assets/locations/
Version: v2
Scope: esi-assets.read_corporation_assets.v1
```

**How it works:**
- Get precise location data (station, structure, etc.)
- Useful to know WHERE deliveries are being made

## Tracking Strategy

### Option A: Snapshot Comparison (RECOMMENDED)
1. **Take periodic snapshots** of corporation delivery hangar contents
2. **Compare snapshots** to detect new items
3. **Match type_id** to assigned PI components
4. **Calculate delta** to determine delivered quantity
5. **Track item_id** to avoid double-counting

```typescript
interface DeliverySnapshot {
  timestamp: string;
  items: {
    item_id: number;
    type_id: number;
    quantity: number;
    location_id: number;
  }[];
}

// Compare snapshots to find new deliveries
function detectNewDeliveries(
  oldSnapshot: DeliverySnapshot, 
  newSnapshot: DeliverySnapshot
): Delivery[] {
  const deliveries: Delivery[] = [];
  
  newSnapshot.items.forEach(newItem => {
    const oldItem = oldSnapshot.items.find(i => i.item_id === newItem.item_id);
    
    if (!oldItem) {
      // New item appeared - this is a delivery
      deliveries.push({
        type_id: newItem.type_id,
        quantity: newItem.quantity,
        timestamp: newSnapshot.timestamp
      });
    } else if (newItem.quantity > oldItem.quantity) {
      // Quantity increased - additional delivery
      deliveries.push({
        type_id: newItem.type_id,
        quantity: newItem.quantity - oldItem.quantity,
        timestamp: newSnapshot.timestamp
      });
    }
  });
  
  return deliveries;
}
```

### Option B: Wallet Journal (Indirect Tracking)
```
GET /corporations/{corporation_id}/wallets/{division}/journal/
Version: v4
Scope: esi-wallet.read_corporation_wallets.v1
```

**How it works:**
- Track when corp SELLS PI materials
- Indirect way to track what was delivered
- Not reliable if items aren't sold immediately

### Option C: Contracts (For Contract Deliveries)
```
GET /corporations/{corporation_id}/contracts/
Version: v1
Scope: esi-contracts.read_corporation_contracts.v1
```

**How it works:**
- If pilots deliver via contracts instead of direct hangar
- Can track item courier or item exchange contracts
- More complex to implement

## Matching Pilot to Delivery

### Challenge
ESI assets endpoint does NOT directly show who placed items in delivery hangar.

### Solutions

#### Solution 1: Character Assets Before/After (COMPLEX)
Track individual character assets before delivery:
```
GET /characters/{character_id}/assets/
Version: v5
Scope: esi-assets.read_assets.v1
```

**Process:**
1. Poll each pilot's personal assets
2. Detect when PI items decrease
3. Compare timing with corp hangar increase
4. Match by type_id and quantity

**Drawback:** Requires authenticated access to each character

#### Solution 2: Self-Reporting + ESI Verification (RECOMMENDED)
1. **Pilot reports delivery** via UI (manual entry)
2. **ESI verifies** the items exist in corp hangar
3. **System confirms** delivery based on:
   - Correct item type
   - Sufficient quantity available
   - Timing matches

**Implementation:**
```typescript
async function verifyPIDelivery(
  characterId: string,
  componentTypeId: number,
  claimedQuantity: number
): Promise<{ verified: boolean; actualQuantity?: number }> {
  // 1. Get corp delivery hangar snapshot
  const corpAssets = await getCorpAssets();
  const deliveryItems = corpAssets.filter(
    asset => asset.location_flag === 'CorpDeliveries'
  );
  
  // 2. Find matching component type
  const matchingItems = deliveryItems.filter(
    item => item.type_id === componentTypeId
  );
  
  // 3. Calculate total available
  const totalAvailable = matchingItems.reduce(
    (sum, item) => sum + item.quantity, 
    0
  );
  
  // 4. Verify claimed amount is reasonable
  if (totalAvailable >= claimedQuantity) {
    return { 
      verified: true, 
      actualQuantity: totalAvailable 
    };
  }
  
  return { verified: false };
}
```

#### Solution 3: Contract-Based Tracking (MOST ACCURATE)
**Force pilots to deliver via contracts:**

1. Pilot creates item exchange contract
2. Contract metadata includes:
   - `issuer_id` (pilot character ID)
   - `type` (item_exchange)
   - Items included with `type_id` and `quantity`
3. ESI provides complete audit trail

```
GET /corporations/{corporation_id}/contracts/
GET /corporations/{corporation_id}/contracts/{contract_id}/items/
```

**Advantages:**
- Guaranteed pilot attribution
- Complete audit trail
- Can automate acceptance
- Built-in verification

## Recommended Implementation

### Phase 1: Manual Entry + ESI Verification
```typescript
interface PIDeliveryRecord {
  pilot_id: string;
  pilot_name: string;
  component_type_id: number;
  component_name: string;
  claimed_quantity: number;
  delivery_timestamp: string;
  esi_verified: boolean;
  verification_details?: {
    total_in_hangar: number;
    snapshot_timestamp: string;
    verification_passed: boolean;
  };
}

// Pilot submits delivery claim
async function submitPIDelivery(
  pilotId: string,
  componentTypeId: number,
  quantity: number
): Promise<PIDeliveryRecord> {
  // 1. Record the claim
  const claim: PIDeliveryRecord = {
    pilot_id: pilotId,
    pilot_name: await getPilotName(pilotId),
    component_type_id: componentTypeId,
    component_name: await getComponentName(componentTypeId),
    claimed_quantity: quantity,
    delivery_timestamp: new Date().toISOString(),
    esi_verified: false
  };
  
  // 2. Verify against ESI
  const verification = await verifyAgainstCorpAssets(
    componentTypeId, 
    quantity
  );
  
  claim.esi_verified = verification.verified;
  claim.verification_details = verification;
  
  // 3. Save record
  await saveDeliveryRecord(claim);
  
  return claim;
}
```

### Phase 2: Automated Snapshot Tracking
Run periodic background job:

```typescript
// Every 15 minutes
async function trackDeliveryHangarChanges() {
  const currentSnapshot = await getDeliveryHangarSnapshot();
  const previousSnapshot = await getLastSnapshot();
  
  if (previousSnapshot) {
    const newDeliveries = detectNewDeliveries(
      previousSnapshot, 
      currentSnapshot
    );
    
    // Alert about unattributed deliveries
    for (const delivery of newDeliveries) {
      await notifyUnattributedDelivery(delivery);
    }
  }
  
  await saveSnapshot(currentSnapshot);
}
```

### Phase 3: Contract-Based Automation (Future)
1. Require contract deliveries
2. Auto-process accepted contracts
3. Automatic payout calculation
4. Full audit trail

## Implementation in Current Code

### Add to esi-routes.ts
```typescript
delivery_hangar: {
  path: '/corporations/{corporation_id}/assets/',
  versions: ['v3', 'v4', 'v5'],
  currentVersion: 'v5',
  description: 'Corporation assets including delivery hangar',
  scopes: ['esi-assets.read_corporation_assets.v1']
},
character_assets: {
  path: '/characters/{character_id}/assets/',
  versions: ['v3', 'v4', 'v5'],
  currentVersion: 'v5',
  description: 'Character personal assets',
  scopes: ['esi-assets.read_assets.v1']
},
contracts: {
  path: '/corporations/{corporation_id}/contracts/',
  versions: ['v1'],
  currentVersion: 'v1',
  description: 'Corporation contracts for delivery tracking',
  scopes: ['esi-contracts.read_corporation_contracts.v1']
}
```

### Add to PlanetaryInteraction.tsx
```typescript
// Add ESI verification to delivery recording
const handleRecordDelivery = async () => {
  // ... existing validation ...
  
  // ESI Verification step
  const verification = await verifyPIDeliveryViaESI(
    assignment.componentTypeId,
    newDelivery.quantity
  );
  
  const delivery: PIDelivery = {
    // ... existing fields ...
    verifiedByESI: verification.verified,
    esi_snapshot_time: verification.timestamp,
    esi_hangar_total: verification.totalInHangar
  };
  
  // ... rest of delivery logic ...
};
```

## Summary

**Best Approach for LMeve PI Tracking:**

1. **Primary:** Use Corporation Assets API with `location_flag: "CorpDeliveries"`
2. **Attribution:** Combination of manual reporting + ESI verification
3. **Automation:** Periodic snapshots to detect new items
4. **Future:** Move to contract-based system for full automation

**Required ESI Scope:**
- `esi-assets.read_corporation_assets.v1` (ESSENTIAL)

**Optional Scopes for Enhanced Tracking:**
- `esi-contracts.read_corporation_contracts.v1` (for contract tracking)
- `esi-assets.read_assets.v1` (per-character asset tracking)

This provides a robust system for tracking PI deliveries with reasonable ESI verification while avoiding over-complicated polling of individual character assets.
