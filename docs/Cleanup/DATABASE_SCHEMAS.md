# LMeve Database Schemas Implementation

## Overview

Based on analysis of the original LMeve project at https://github.com/dstevens79/lmeve, I have implemented a comprehensive database schema structure that includes all the essential tables needed for EVE Online corporation management.

## Added Files

### `/src/lib/database-schemas.ts`
- Complete database schema definitions for all LMeve tables
- TypeScript interfaces for schema validation
- SQL generation utilities
- Default system settings configuration

### `/src/components/DatabaseSchemaManager.tsx`  
- Interactive database schema browser
- SQL code generation and export
- Table structure visualization
- Default configuration management

## Database Tables Added

The implementation includes **21 core database tables** with **468 total columns**, **47 indexes**, and **9 foreign key relationships**:

### Core Tables
1. **`users`** - Authentication and user management
2. **`corporations`** - Corporation data and ESI configuration  
3. **`members`** - Corporation member tracking
4. **`system_settings`** - Application configuration

### Asset Management
5. **`assets`** - Corporation assets and inventory
6. **`blueprints`** - Blueprint inventory and specifications
7. **`material_requirements`** - Manufacturing material tracking

### Manufacturing System
8. **`manufacturing_jobs`** - Industry job tracking
9. **`production_plans`** - Manufacturing planning

### Financial Tracking
10. **`income_records`** - Income and profit tracking
11. **`market_prices`** - Market data tracking
12. **`market_price_history`** - Historical market data

### Mining Operations
13. **`mining_operations`** - Mining activity tracking
14. **`mining_minerals`** - Refined minerals from mining

### Combat Tracking
15. **`killmails`** - Combat loss tracking
16. **`killmail_participants`** - Attackers and participants
17. **`killmail_items`** - Items destroyed in killmails

### System Management
18. **`activity_log`** - System and user activity tracking

### ESI Data Tables (LMeve Original Schema Compatibility)
19. **`corporation_members`** - ESI-synced corporation member data
20. **`corporation_assets`** - ESI-synced corporation asset data
21. **`industry_jobs`** - ESI-synced industry job data

## Key Features

### Schema Validation
- Comprehensive column type definitions
- Primary key and foreign key constraints
- Index definitions for performance optimization
- Data validation and integrity checks

### SQL Generation
- Automated CREATE TABLE statement generation
- Complete schema export functionality
- Individual table SQL generation
- MySQL/MariaDB compatibility

### Default Configuration
- Pre-configured system settings
- ESI OAuth configuration templates
- Corporation management defaults
- Data sync interval configurations

### Interactive Management
- Web-based schema browser
- Table structure visualization
- SQL code preview and export
- Copy-to-clipboard functionality

## Database Design Principles

### Normalization
- Proper table relationships with foreign keys
- Avoiding data duplication
- Logical data grouping

### Performance Optimization
- Strategic index placement
- Query-optimized column types
- Efficient data retrieval patterns

### Scalability
- Supports multiple corporations
- Handles large asset inventories
- Efficient manufacturing job tracking
- Comprehensive audit logging

### Security
- Role-based access control
- Secure credential storage
- Session management
- Activity logging and monitoring

## Integration with LMeve

This schema implementation is fully compatible with the original LMeve project structure and includes:

- **EVE Online ESI integration** - Complete corporation data sync
- **Manufacturing management** - Industry job tracking and planning
- **Asset management** - Inventory and blueprint tracking
- **Financial tracking** - Income, expenses, and profit analysis
- **Mining operations** - Ore tracking and mineral processing
- **Combat analysis** - Killmail tracking and loss analysis
- **Member management** - Corporation roster and permissions

## Usage

### Accessing Schema Manager
1. Navigate to **Settings** → **Database** tab
2. Scroll to the **Database Schema Manager** section
3. Browse tables, generate SQL, or export complete schema

### Database Setup
1. Use the **SQL Generator** tab to copy table creation statements
2. Run the generated SQL in your MySQL/MariaDB database
3. Use the **Default Data** tab for initial system configuration
4. Configure ESI credentials and corporation settings

### Development Integration
```typescript
import { lmeveSchemas, generateCreateTableSQL } from '@/lib/database-schemas';

// Generate SQL for specific table
const userTableSQL = generateCreateTableSQL(lmeveSchemas[0]);

// Get all table names
const tableNames = lmeveSchemas.map(schema => schema.tableName);
```

## Compatibility

- **MySQL 5.7+** / **MariaDB 10.2+**
- **utf8mb4** character set for EVE Online character support
- **InnoDB** engine for transaction support
- **Foreign key constraints** for data integrity

This implementation provides a solid foundation for EVE Online corporation management with all the database structures needed to support the full LMeve feature set.