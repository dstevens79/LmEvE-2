# Corporation Projects - Hangar Delivery Tracking

## Overview

The Corporation Projects system provides a comprehensive solution for tracking material deliveries and project progress using EVE Online's corporation hangar system. This feature integrates with ESI (EVE Swagger Interface) to monitor hangar deliveries in real-time.

## How It Works

### Corporation Hangars in EVE Online

EVE Online corporations have 7 division hangars (Hangar 1 through Hangar 7) that can be used to organize assets. Each hangar can be renamed and configured with access permissions.

### Project Hangar Assignment

When creating a project, you designate which corporation hangar division will receive deliveries for that project. For example:
- **Hangar 1**: "Industry Deliveries" - For manufacturing materials
- **Hangar 2**: "T2 Production" - For Tech 2 module production
- **Hangar 3**: "Capital Projects" - For capital ship construction

### ESI Integration

The system uses multiple ESI endpoints to track deliveries:

#### 1. Corporation Assets (`/corporations/{corporation_id}/assets/`)
- **Purpose**: Get current hangar contents
- **Scope**: `esi-assets.read_corporation_assets.v1`
- **Usage**: Verifies current quantities of items in designated project hangars

#### 2. Container Logs (`/corporations/{corporation_id}/containers/logs/`)
- **Purpose**: Track who added/removed items from hangars
- **Scope**: `esi-corporations.read_container_logs.v1`
- **Usage**: Identifies deliveries by character, timestamp, item type, and quantity

#### 3. Asset Locations (`/corporations/{corporation_id}/assets/locations/`)
- **Purpose**: Get detailed location information for assets
- **Scope**: `esi-assets.read_corporation_assets.v1`
- **Usage**: Confirms items are in the correct hangar division

## Delivery Detection Process

### 1. Define Project Requirements
When setting up a project, administrators define:
- Item Type ID (EVE's unique identifier for items)
- Quantity Required
- Unit Value (for tracking delivered value)
- Priority Level

### 2. Hangar Scanning
The "Scan Hangar" feature performs the following:

```typescript
1. Fetch container logs since last scan or project creation
2. Filter logs for:
   - Action: 'add' (items being placed in hangar)
   - Location: Matches project's designated hangar division
   - Type ID: Matches any project requirement
3. Match deliveries to requirements
4. Update quantities and track who delivered what
5. Calculate total value delivered
```

### 3. ESI Verification
Each delivery is verified through ESI by:
- Confirming the character ID exists
- Verifying the timestamp is valid
- Checking the item was added to the correct hangar
- Matching quantity and item type

## Project Workflow

### Creating a Project

1. **Define Basic Information**
   - Project Name (e.g., "Thanatos Construction")
   - Description
   - Target Completion Date
   - Priority Level

2. **Select Delivery Hangar**
   - Choose which corporation hangar division (1-7)
   - This is where members will deliver materials

3. **Add Requirements**
   - Item Type ID or Name
   - Quantity Needed
   - Unit Value (ISK)
   - Priority (high/normal/low)

### Tracking Progress

The project dashboard shows:
- **Overall Completion %**: Percentage of total requirements fulfilled
- **Individual Requirements**: Each with its own completion status
- **Recent Deliveries**: Who delivered what and when
- **Total Value**: ISK value of materials delivered

### Scanning for Deliveries

Click "Scan Hangar" to:
1. Query ESI for recent container log entries
2. Match entries to project requirements
3. Auto-create delivery records
4. Update requirement quantities
5. Flag deliveries as "ESI Verified"

## Data Structures

### CorporationProject
```typescript
{
  id: string;
  name: string;
  description: string;
  hangarId: number;              // 1-7
  hangarName: string;            // e.g., "Industry Deliveries"
  hangarDivision: number;        // 1-7
  status: 'active' | 'paused' | 'completed';
  priority: 'low' | 'normal' | 'high' | 'critical';
  requirements: ProjectRequirement[];
  deliveries: ProjectDelivery[];
  estimatedValue: number;        // Total ISK value expected
  actualValue: number;           // Total ISK value delivered
}
```

### ProjectRequirement
```typescript
{
  id: string;
  typeId: number;                // EVE item type ID
  typeName: string;
  quantityRequired: number;
  quantityDelivered: number;
  unitValue: number;             // ISK per unit
  priority: 'low' | 'normal' | 'high';
}
```

### ProjectDelivery
```typescript
{
  id: string;
  projectId: string;
  requirementId: string;
  typeId: number;
  typeName: string;
  quantity: number;
  deliveredBy: string;           // Character name
  deliveredByCharacterId: number;
  deliveryDate: string;
  verifiedByESI: boolean;        // True if confirmed via ESI
  locationId: number;
  locationName: string;
  flagId: number;
  flagName: string;              // e.g., "CorpSAG2"
  value: number;                 // quantity * unitValue
}
```

## ESI Scopes Required

To use the Projects feature, your ESI application needs these scopes:
- `esi-assets.read_corporation_assets.v1` - Read corporation assets
- `esi-corporations.read_container_logs.v1` - Read hangar access logs
- `esi-corporations.read_divisions.v1` - Read hangar division names

## Best Practices

### 1. Dedicated Hangars
- Use specific hangars for specific project types
- Rename hangars to match their purpose
- Set appropriate access permissions

### 2. Regular Scanning
- Scan hangars daily or after expected deliveries
- Container logs are retained for limited time by CCP
- Frequent scanning ensures no deliveries are missed

### 3. Value Tracking
- Set accurate unit values for ISK tracking
- Update values if market prices change significantly
- Use for member compensation or reimbursement

### 4. Member Communication
- Clearly communicate which hangar to use
- Specify exact item types needed
- Set deadlines for critical deliveries

### 5. Project Organization
- Use priority levels to focus effort
- Set realistic target completion dates
- Assign specific members to projects

## Limitations

### ESI Rate Limits
- ESI has rate limits per application and per character
- Excessive scanning can trigger rate limiting
- Implement reasonable scan intervals

### Container Log Retention
- CCP retains container logs for limited duration
- Scan regularly to avoid missing deliveries
- Historical data older than retention period is lost

### Manual Entry Fallback
- Not all deliveries may be auto-detected
- Manual delivery entry option available
- Useful for special cases or ESI downtime

## Future Enhancements

### Potential Improvements
1. **Automatic Scanning**: Background job to scan hangars periodically
2. **Delivery Notifications**: Alert when requirements are met
3. **Member Contributions**: Track individual member delivery totals
4. **Income Integration**: Auto-pay members based on deliveries
5. **Contract Integration**: Track contract-based deliveries
6. **Blueprint Requirements**: Auto-calculate BPO material needs
7. **Multi-Project View**: See all active projects at once
8. **Export Reports**: Generate delivery reports for accounting

## Troubleshooting

### No Deliveries Detected
1. Verify ESI scopes are granted
2. Check hangar division matches project setting
3. Confirm items are in corporation hangar (not personal)
4. Ensure container logs haven't expired

### Incorrect Quantities
1. Verify item Type ID matches exactly
2. Check for multiple deliveries of same item
3. Confirm unit quantities (packaged vs. unpackaged)

### ESI Authentication Errors
1. Refresh ESI token
2. Verify corporation roles include asset viewing
3. Check ESI application is not disabled
4. Confirm scopes were approved during SSO

## Example Use Case

**Scenario**: Building a Thanatos carrier

1. Create project "Thanatos Construction"
2. Set hangar division to "Hangar 1 - Industry Deliveries"
3. Add requirements:
   - Capital Ship Assembly Array (1 unit)
   - Capital Construction Parts (5000 units)
   - Enriched Uranium (15000 units)
   - Other materials...

4. Members deliver materials to Hangar 1
5. Scan hangar to detect deliveries
6. System matches items to requirements
7. Track progress to 100% completion
8. Monitor total value delivered

This provides visibility into project status and member contributions without manual tracking.
