// Database schemas for LMeve - Complete database structure definitions
// Based on the original LMeve project database architecture

export interface DatabaseSchema {
  tableName: string;
  columns: ColumnDefinition[];
  indexes?: IndexDefinition[];
  foreignKeys?: ForeignKeyDefinition[];
  engine?: string;
  charset?: string;
  collation?: string;
}

export interface ColumnDefinition {
  name: string;
  type: string;
  size?: number;
  nullable: boolean;
  defaultValue?: any;
  autoIncrement?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  comment?: string;
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  type: 'INDEX' | 'UNIQUE' | 'FULLTEXT';
}

export interface ForeignKeyDefinition {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
}

// Core LMeve database schemas
export const lmeveSchemas: DatabaseSchema[] = [
  // Users table - Core authentication and user management
  {
    tableName: 'users',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'username', type: 'VARCHAR', size: 255, nullable: true, unique: true },
      { name: 'password', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'character_id', type: 'BIGINT', nullable: true, unique: true },
      { name: 'character_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'corporation_id', type: 'BIGINT', nullable: true },
      { name: 'corporation_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'alliance_id', type: 'BIGINT', nullable: true },
      { name: 'alliance_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'auth_method', type: 'ENUM', nullable: false, defaultValue: "'manual'", comment: "Values: 'manual', 'esi'" },
      { name: 'role', type: 'ENUM', nullable: false, defaultValue: "'corp_member'", comment: "Values: 'super_admin', 'corp_admin', 'corp_director', 'corp_manager', 'corp_member', 'guest'" },
      { name: 'access_token', type: 'TEXT', nullable: true },
      { name: 'refresh_token', type: 'TEXT', nullable: true },
      { name: 'token_expiry', type: 'DATETIME', nullable: true },
      { name: 'scopes', type: 'TEXT', nullable: true },
      { name: 'last_login', type: 'DATETIME', nullable: true },
      { name: 'session_expiry', type: 'DATETIME', nullable: true },
      { name: 'is_active', type: 'BOOLEAN', nullable: false, defaultValue: true },
      { name: 'created_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'updated_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_character_id', columns: ['character_id'], type: 'INDEX' },
      { name: 'idx_corporation_id', columns: ['corporation_id'], type: 'INDEX' },
      { name: 'idx_auth_method', columns: ['auth_method'], type: 'INDEX' },
      { name: 'idx_role', columns: ['role'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Corporations table - Corporation data and configuration
  {
    tableName: 'corporations',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'corporation_id', type: 'BIGINT', nullable: false, unique: true },
      { name: 'corporation_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'ticker', type: 'VARCHAR', size: 10, nullable: false },
      { name: 'alliance_id', type: 'BIGINT', nullable: true },
      { name: 'alliance_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'member_count', type: 'INT', nullable: false, defaultValue: 0 },
      { name: 'tax_rate', type: 'DECIMAL', size: 5, nullable: false, defaultValue: 0.0 },
      { name: 'ceo_id', type: 'BIGINT', nullable: true },
      { name: 'ceo_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'url', type: 'VARCHAR', size: 500, nullable: true },
      { name: 'founded', type: 'DATETIME', nullable: true },
      { name: 'home_station_id', type: 'BIGINT', nullable: true },
      { name: 'home_station_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'wallet_balance', type: 'DECIMAL', size: 20, nullable: true, defaultValue: 0.0 },
      { name: 'esi_client_id', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'esi_client_secret', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'registered_scopes', type: 'TEXT', nullable: true },
      { name: 'is_active', type: 'BOOLEAN', nullable: false, defaultValue: true },
      { name: 'registration_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'last_token_refresh', type: 'DATETIME', nullable: true },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_corporation_id', columns: ['corporation_id'], type: 'UNIQUE' },
      { name: 'idx_alliance_id', columns: ['alliance_id'], type: 'INDEX' },
      { name: 'idx_ticker', columns: ['ticker'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Members table - Corporation member data
  {
    tableName: 'members',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'character_id', type: 'BIGINT', nullable: false },
      { name: 'character_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'corporation_id', type: 'BIGINT', nullable: false },
      { name: 'corporation_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'alliance_id', type: 'BIGINT', nullable: true },
      { name: 'alliance_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'roles', type: 'JSON', nullable: true },
      { name: 'titles', type: 'JSON', nullable: true },
      { name: 'last_login', type: 'DATETIME', nullable: true },
      { name: 'location_id', type: 'BIGINT', nullable: true },
      { name: 'location_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'ship_type_id', type: 'INT', nullable: true },
      { name: 'ship_type_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'logon_duration', type: 'BIGINT', nullable: true },
      { name: 'start_date_time', type: 'DATETIME', nullable: true },
      { name: 'logoff_date_time', type: 'DATETIME', nullable: true },
      { name: 'is_online', type: 'BOOLEAN', nullable: false, defaultValue: false },
      { name: 'is_active', type: 'BOOLEAN', nullable: false, defaultValue: true },
      { name: 'access_level', type: 'ENUM', nullable: false, defaultValue: "'member'", comment: "Values: 'member', 'director', 'ceo'" },
      { name: 'joined_date', type: 'DATETIME', nullable: true },
      { name: 'total_skill_points', type: 'BIGINT', nullable: true },
      { name: 'security_status', type: 'DECIMAL', size: 10, nullable: true },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_character_id', columns: ['character_id'], type: 'INDEX' },
      { name: 'idx_corporation_id', columns: ['corporation_id'], type: 'INDEX' },
      { name: 'idx_alliance_id', columns: ['alliance_id'], type: 'INDEX' },
      { name: 'idx_is_active', columns: ['is_active'], type: 'INDEX' },
      { name: 'idx_is_online', columns: ['is_online'], type: 'INDEX' }
    ],
    foreignKeys: [
      { name: 'fk_members_corporation', column: 'corporation_id', referencedTable: 'corporations', referencedColumn: 'corporation_id', onDelete: 'CASCADE' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Assets table - Corporation assets and inventory
  {
    tableName: 'assets',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'item_id', type: 'BIGINT', nullable: false },
      { name: 'type_id', type: 'INT', nullable: false },
      { name: 'type_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'category_id', type: 'INT', nullable: true },
      { name: 'category_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'group_id', type: 'INT', nullable: true },
      { name: 'group_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'quantity', type: 'BIGINT', nullable: false },
      { name: 'location_id', type: 'BIGINT', nullable: false },
      { name: 'location_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'location_type', type: 'ENUM', nullable: false, defaultValue: "'station'", comment: "Values: 'station', 'structure', 'ship', 'container'" },
      { name: 'location_flag', type: 'VARCHAR', size: 100, nullable: true },
      { name: 'owner_id', type: 'BIGINT', nullable: false },
      { name: 'owner_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'estimated_value', type: 'DECIMAL', size: 20, nullable: true, defaultValue: 0.0 },
      { name: 'estimated_price', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'is_singleton', type: 'BOOLEAN', nullable: false, defaultValue: false },
      { name: 'is_blueprint_copy', type: 'BOOLEAN', nullable: true },
      { name: 'blueprint_runs', type: 'INT', nullable: true },
      { name: 'material_efficiency', type: 'INT', nullable: true },
      { name: 'time_efficiency', type: 'INT', nullable: true },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_item_id', columns: ['item_id'], type: 'INDEX' },
      { name: 'idx_type_id', columns: ['type_id'], type: 'INDEX' },
      { name: 'idx_category_id', columns: ['category_id'], type: 'INDEX' },
      { name: 'idx_location_id', columns: ['location_id'], type: 'INDEX' },
      { name: 'idx_owner_id', columns: ['owner_id'], type: 'INDEX' },
      { name: 'idx_location_type', columns: ['location_type'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Manufacturing jobs table - Industry and manufacturing tracking
  {
    tableName: 'manufacturing_jobs',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'job_id', type: 'BIGINT', nullable: true, unique: true },
      { name: 'installer_id', type: 'BIGINT', nullable: false },
      { name: 'installer_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'facility_id', type: 'BIGINT', nullable: false },
      { name: 'facility_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'station_id', type: 'BIGINT', nullable: true },
      { name: 'blueprint_id', type: 'BIGINT', nullable: false },
      { name: 'blueprint_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'blueprint_type_id', type: 'INT', nullable: true },
      { name: 'blueprint_type_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'blueprint_location_id', type: 'BIGINT', nullable: true },
      { name: 'output_location_id', type: 'BIGINT', nullable: true },
      { name: 'runs', type: 'INT', nullable: false },
      { name: 'cost', type: 'DECIMAL', size: 20, nullable: false, defaultValue: 0.0 },
      { name: 'licensed_runs', type: 'INT', nullable: true },
      { name: 'probability', type: 'DECIMAL', size: 5, nullable: true },
      { name: 'product_type_id', type: 'INT', nullable: false },
      { name: 'product_type_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'product_quantity', type: 'INT', nullable: false },
      { name: 'status', type: 'ENUM', nullable: false, defaultValue: "'active'", comment: "Values: 'active', 'paused', 'ready', 'delivered', 'cancelled', 'reverted', 'completed'" },
      { name: 'time_in_seconds', type: 'BIGINT', nullable: true },
      { name: 'duration', type: 'BIGINT', nullable: false },
      { name: 'start_date', type: 'DATETIME', nullable: false },
      { name: 'end_date', type: 'DATETIME', nullable: false },
      { name: 'pause_date', type: 'DATETIME', nullable: true },
      { name: 'completed_date', type: 'DATETIME', nullable: true },
      { name: 'completed_character_id', type: 'BIGINT', nullable: true },
      { name: 'successful_runs', type: 'INT', nullable: true },
      { name: 'activity_id', type: 'INT', nullable: true },
      { name: 'activity_name', type: 'VARCHAR', size: 100, nullable: true },
      { name: 'priority', type: 'ENUM', nullable: false, defaultValue: "'normal'", comment: "Values: 'low', 'normal', 'high', 'urgent'" },
      { name: 'profit_margin', type: 'DECIMAL', size: 10, nullable: true },
      { name: 'estimated_profit', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'material_efficiency', type: 'INT', nullable: false, defaultValue: 0 },
      { name: 'time_efficiency', type: 'INT', nullable: false, defaultValue: 0 },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_job_id', columns: ['job_id'], type: 'UNIQUE' },
      { name: 'idx_installer_id', columns: ['installer_id'], type: 'INDEX' },
      { name: 'idx_facility_id', columns: ['facility_id'], type: 'INDEX' },
      { name: 'idx_product_type_id', columns: ['product_type_id'], type: 'INDEX' },
      { name: 'idx_status', columns: ['status'], type: 'INDEX' },
      { name: 'idx_start_date', columns: ['start_date'], type: 'INDEX' },
      { name: 'idx_end_date', columns: ['end_date'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Blueprints table - Blueprint inventory and specifications
  {
    tableName: 'blueprints',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'item_id', type: 'BIGINT', nullable: true },
      { name: 'type_id', type: 'INT', nullable: false },
      { name: 'type_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'location_id', type: 'BIGINT', nullable: false },
      { name: 'location_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'location_flag', type: 'VARCHAR', size: 100, nullable: true },
      { name: 'quantity', type: 'INT', nullable: false, defaultValue: 1 },
      { name: 'material_efficiency', type: 'INT', nullable: false, defaultValue: 0 },
      { name: 'time_efficiency', type: 'INT', nullable: false, defaultValue: 0 },
      { name: 'runs', type: 'INT', nullable: false, defaultValue: 0 },
      { name: 'max_runs', type: 'INT', nullable: true },
      { name: 'is_copy', type: 'BOOLEAN', nullable: false, defaultValue: false },
      { name: 'is_original', type: 'BOOLEAN', nullable: false, defaultValue: true },
      { name: 'category_id', type: 'INT', nullable: true },
      { name: 'category_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'group_id', type: 'INT', nullable: true },
      { name: 'group_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'meta_level', type: 'INT', nullable: true },
      { name: 'tech_level', type: 'INT', nullable: true },
      { name: 'estimated_value', type: 'DECIMAL', size: 20, nullable: true, defaultValue: 0.0 },
      { name: 'product_type_id', type: 'INT', nullable: false },
      { name: 'product_type_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'product_quantity', type: 'INT', nullable: true },
      { name: 'base_time', type: 'BIGINT', nullable: false },
      { name: 'manufacturing_time', type: 'BIGINT', nullable: true },
      { name: 'job_type', type: 'VARCHAR', size: 50, nullable: false },
      { name: 'owner_id', type: 'BIGINT', nullable: true },
      { name: 'owner_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_type_id', columns: ['type_id'], type: 'INDEX' },
      { name: 'idx_location_id', columns: ['location_id'], type: 'INDEX' },
      { name: 'idx_product_type_id', columns: ['product_type_id'], type: 'INDEX' },
      { name: 'idx_is_copy', columns: ['is_copy'], type: 'INDEX' },
      { name: 'idx_owner_id', columns: ['owner_id'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Material requirements table - Manufacturing material tracking
  {
    tableName: 'material_requirements',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'blueprint_id', type: 'INT', nullable: false },
      { name: 'job_id', type: 'INT', nullable: true },
      { name: 'type_id', type: 'INT', nullable: false },
      { name: 'type_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'quantity', type: 'BIGINT', nullable: false },
      { name: 'quantity_available', type: 'BIGINT', nullable: true },
      { name: 'quantity_needed', type: 'BIGINT', nullable: true },
      { name: 'total_value', type: 'DECIMAL', size: 20, nullable: true, defaultValue: 0.0 },
      { name: 'estimated_cost', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'unit_price', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'priority', type: 'ENUM', nullable: false, defaultValue: "'normal'", comment: "Values: 'critical', 'high', 'normal', 'low'" },
      { name: 'source', type: 'ENUM', nullable: false, defaultValue: "'inventory'", comment: "Values: 'inventory', 'market', 'manufacturing', 'mining'" },
      { name: 'category', type: 'VARCHAR', size: 100, nullable: true },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_blueprint_id', columns: ['blueprint_id'], type: 'INDEX' },
      { name: 'idx_job_id', columns: ['job_id'], type: 'INDEX' },
      { name: 'idx_type_id', columns: ['type_id'], type: 'INDEX' },
      { name: 'idx_priority', columns: ['priority'], type: 'INDEX' },
      { name: 'idx_source', columns: ['source'], type: 'INDEX' }
    ],
    foreignKeys: [
      { name: 'fk_materials_blueprint', column: 'blueprint_id', referencedTable: 'blueprints', referencedColumn: 'id', onDelete: 'CASCADE' },
      { name: 'fk_materials_job', column: 'job_id', referencedTable: 'manufacturing_jobs', referencedColumn: 'id', onDelete: 'CASCADE' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Production plans table - Manufacturing planning
  {
    tableName: 'production_plans',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'plan_id', type: 'VARCHAR', size: 100, nullable: false, unique: true },
      { name: 'name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'target_product_type_id', type: 'INT', nullable: false },
      { name: 'target_product_type_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'target_quantity', type: 'INT', nullable: false },
      { name: 'estimated_cost', type: 'DECIMAL', size: 20, nullable: true, defaultValue: 0.0 },
      { name: 'estimated_profit', type: 'DECIMAL', size: 20, nullable: true, defaultValue: 0.0 },
      { name: 'estimated_duration', type: 'BIGINT', nullable: true },
      { name: 'priority', type: 'ENUM', nullable: false, defaultValue: "'normal'", comment: "Values: 'low', 'normal', 'high', 'urgent'" },
      { name: 'status', type: 'ENUM', nullable: false, defaultValue: "'draft'", comment: "Values: 'draft', 'approved', 'in_progress', 'completed', 'cancelled'" },
      { name: 'created_by', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'created_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'assigned_to', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'start_date', type: 'DATETIME', nullable: true },
      { name: 'completion_date', type: 'DATETIME', nullable: true },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_plan_id', columns: ['plan_id'], type: 'UNIQUE' },
      { name: 'idx_target_product_type_id', columns: ['target_product_type_id'], type: 'INDEX' },
      { name: 'idx_status', columns: ['status'], type: 'INDEX' },
      { name: 'idx_priority', columns: ['priority'], type: 'INDEX' },
      { name: 'idx_created_by', columns: ['created_by'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Income records table - Income and profit tracking
  {
    tableName: 'income_records',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'record_id', type: 'VARCHAR', size: 100, nullable: false, unique: true },
      { name: 'date', type: 'DATE', nullable: false },
      { name: 'pilot_id', type: 'BIGINT', nullable: false },
      { name: 'pilot_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'activity_type', type: 'ENUM', nullable: false, comment: "Values: 'manufacturing', 'mining', 'research', 'invention', 'reactions'" },
      { name: 'job_id', type: 'BIGINT', nullable: true },
      { name: 'item_type_id', type: 'INT', nullable: false },
      { name: 'item_type_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'quantity', type: 'INT', nullable: false },
      { name: 'hours_worked', type: 'DECIMAL', size: 10, nullable: false },
      { name: 'rate_per_hour', type: 'DECIMAL', size: 20, nullable: false },
      { name: 'total_earned', type: 'DECIMAL', size: 20, nullable: false },
      { name: 'status', type: 'ENUM', nullable: false, defaultValue: "'pending'", comment: "Values: 'pending', 'approved', 'paid'" },
      { name: 'approved_by', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'approved_date', type: 'DATETIME', nullable: true },
      { name: 'paid_date', type: 'DATETIME', nullable: true },
      { name: 'notes', type: 'TEXT', nullable: true },
      { name: 'completed_date', type: 'DATETIME', nullable: true },
      { name: 'job_type', type: 'VARCHAR', size: 100, nullable: true },
      { name: 'product_type_id', type: 'INT', nullable: true },
      { name: 'product_type_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'product_quantity', type: 'INT', nullable: true },
      { name: 'profit', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'total_cost', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'market_value', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'profit_margin', type: 'DECIMAL', size: 10, nullable: true },
      { name: 'runs', type: 'INT', nullable: true },
      { name: 'material_cost', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_record_id', columns: ['record_id'], type: 'UNIQUE' },
      { name: 'idx_pilot_id', columns: ['pilot_id'], type: 'INDEX' },
      { name: 'idx_activity_type', columns: ['activity_type'], type: 'INDEX' },
      { name: 'idx_date', columns: ['date'], type: 'INDEX' },
      { name: 'idx_status', columns: ['status'], type: 'INDEX' },
      { name: 'idx_job_id', columns: ['job_id'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Mining operations table - Mining activity tracking
  {
    tableName: 'mining_operations',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'operation_id', type: 'VARCHAR', size: 100, nullable: false, unique: true },
      { name: 'date', type: 'DATE', nullable: false },
      { name: 'miner_id', type: 'BIGINT', nullable: false },
      { name: 'miner_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'system_id', type: 'BIGINT', nullable: false },
      { name: 'system_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'station_id', type: 'BIGINT', nullable: true },
      { name: 'station_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'ore_type_id', type: 'INT', nullable: false },
      { name: 'ore_type_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'quantity', type: 'BIGINT', nullable: false },
      { name: 'estimated_value', type: 'DECIMAL', size: 20, nullable: true, defaultValue: 0.0 },
      { name: 'refined', type: 'BOOLEAN', nullable: false, defaultValue: false },
      { name: 'refined_by', type: 'BIGINT', nullable: true },
      { name: 'refined_by_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'refined_date', type: 'DATETIME', nullable: true },
      { name: 'notes', type: 'TEXT', nullable: true },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_operation_id', columns: ['operation_id'], type: 'UNIQUE' },
      { name: 'idx_miner_id', columns: ['miner_id'], type: 'INDEX' },
      { name: 'idx_system_id', columns: ['system_id'], type: 'INDEX' },
      { name: 'idx_ore_type_id', columns: ['ore_type_id'], type: 'INDEX' },
      { name: 'idx_date', columns: ['date'], type: 'INDEX' },
      { name: 'idx_refined', columns: ['refined'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Mining minerals table - Refined minerals from mining operations
  {
    tableName: 'mining_minerals',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'operation_id', type: 'INT', nullable: false },
      { name: 'type_id', type: 'INT', nullable: false },
      { name: 'type_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'quantity', type: 'BIGINT', nullable: false },
      { name: 'value', type: 'DECIMAL', size: 20, nullable: true, defaultValue: 0.0 },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_operation_id', columns: ['operation_id'], type: 'INDEX' },
      { name: 'idx_type_id', columns: ['type_id'], type: 'INDEX' }
    ],
    foreignKeys: [
      { name: 'fk_minerals_operation', column: 'operation_id', referencedTable: 'mining_operations', referencedColumn: 'id', onDelete: 'CASCADE' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Market prices table - Market data tracking
  {
    tableName: 'market_prices',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'type_id', type: 'INT', nullable: false },
      { name: 'type_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'region_id', type: 'BIGINT', nullable: false },
      { name: 'region_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'buy_price', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'sell_price', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'average_price', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'adjusted_price', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'volume', type: 'BIGINT', nullable: true, defaultValue: 0 },
      { name: 'order_count', type: 'INT', nullable: true, defaultValue: 0 },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_type_id_region_id', columns: ['type_id', 'region_id'], type: 'UNIQUE' },
      { name: 'idx_type_id', columns: ['type_id'], type: 'INDEX' },
      { name: 'idx_region_id', columns: ['region_id'], type: 'INDEX' },
      { name: 'idx_last_update', columns: ['last_update'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Market price history table - Historical market data
  {
    tableName: 'market_price_history',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'type_id', type: 'INT', nullable: false },
      { name: 'region_id', type: 'BIGINT', nullable: false },
      { name: 'date', type: 'DATE', nullable: false },
      { name: 'volume', type: 'BIGINT', nullable: false, defaultValue: 0 },
      { name: 'order_count', type: 'INT', nullable: false, defaultValue: 0 },
      { name: 'lowest', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'highest', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'average', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_type_id_region_id_date', columns: ['type_id', 'region_id', 'date'], type: 'UNIQUE' },
      { name: 'idx_type_id', columns: ['type_id'], type: 'INDEX' },
      { name: 'idx_region_id', columns: ['region_id'], type: 'INDEX' },
      { name: 'idx_date', columns: ['date'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Killmails table - Combat loss tracking
  {
    tableName: 'killmails',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'killmail_id', type: 'BIGINT', nullable: false, unique: true },
      { name: 'killmail_hash', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'timestamp', type: 'DATETIME', nullable: false },
      { name: 'system_id', type: 'BIGINT', nullable: false },
      { name: 'system_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'region_id', type: 'BIGINT', nullable: false },
      { name: 'region_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'victim_character_id', type: 'BIGINT', nullable: true },
      { name: 'victim_character_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'victim_corporation_id', type: 'BIGINT', nullable: false },
      { name: 'victim_corporation_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'victim_alliance_id', type: 'BIGINT', nullable: true },
      { name: 'victim_alliance_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'victim_ship_type_id', type: 'INT', nullable: false },
      { name: 'victim_ship_type_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'victim_damage_taken', type: 'INT', nullable: false },
      { name: 'attacker_count', type: 'INT', nullable: false },
      { name: 'total_value', type: 'DECIMAL', size: 20, nullable: true, defaultValue: 0.0 },
      { name: 'is_corp_loss', type: 'BOOLEAN', nullable: false, defaultValue: false },
      { name: 'is_corp_kill', type: 'BOOLEAN', nullable: false, defaultValue: false },
      { name: 'zkb_url', type: 'VARCHAR', size: 500, nullable: true },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_killmail_id', columns: ['killmail_id'], type: 'UNIQUE' },
      { name: 'idx_timestamp', columns: ['timestamp'], type: 'INDEX' },
      { name: 'idx_system_id', columns: ['system_id'], type: 'INDEX' },
      { name: 'idx_victim_corporation_id', columns: ['victim_corporation_id'], type: 'INDEX' },
      { name: 'idx_is_corp_loss', columns: ['is_corp_loss'], type: 'INDEX' },
      { name: 'idx_is_corp_kill', columns: ['is_corp_kill'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Killmail participants table - Attackers and participants in killmails
  {
    tableName: 'killmail_participants',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'killmail_id', type: 'INT', nullable: false },
      { name: 'character_id', type: 'BIGINT', nullable: true },
      { name: 'character_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'corporation_id', type: 'BIGINT', nullable: false },
      { name: 'corporation_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'alliance_id', type: 'BIGINT', nullable: true },
      { name: 'alliance_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'faction_id', type: 'BIGINT', nullable: true },
      { name: 'faction_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'ship_type_id', type: 'INT', nullable: false },
      { name: 'ship_type_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'weapon_type_id', type: 'INT', nullable: true },
      { name: 'weapon_type_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'damage_done', type: 'INT', nullable: true },
      { name: 'final_blow', type: 'BOOLEAN', nullable: false, defaultValue: false },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_killmail_id', columns: ['killmail_id'], type: 'INDEX' },
      { name: 'idx_character_id', columns: ['character_id'], type: 'INDEX' },
      { name: 'idx_corporation_id', columns: ['corporation_id'], type: 'INDEX' },
      { name: 'idx_final_blow', columns: ['final_blow'], type: 'INDEX' }
    ],
    foreignKeys: [
      { name: 'fk_participants_killmail', column: 'killmail_id', referencedTable: 'killmails', referencedColumn: 'id', onDelete: 'CASCADE' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Killmail items table - Items destroyed in killmails
  {
    tableName: 'killmail_items',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'killmail_id', type: 'INT', nullable: false },
      { name: 'type_id', type: 'INT', nullable: false },
      { name: 'type_name', type: 'VARCHAR', size: 255, nullable: false },
      { name: 'quantity', type: 'INT', nullable: false },
      { name: 'singleton', type: 'BOOLEAN', nullable: false, defaultValue: false },
      { name: 'flag', type: 'INT', nullable: false },
      { name: 'destroyed', type: 'BOOLEAN', nullable: false, defaultValue: true },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_killmail_id', columns: ['killmail_id'], type: 'INDEX' },
      { name: 'idx_type_id', columns: ['type_id'], type: 'INDEX' },
      { name: 'idx_destroyed', columns: ['destroyed'], type: 'INDEX' }
    ],
    foreignKeys: [
      { name: 'fk_items_killmail', column: 'killmail_id', referencedTable: 'killmails', referencedColumn: 'id', onDelete: 'CASCADE' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Activity log table - System and user activity tracking
  {
    tableName: 'activity_log',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'log_id', type: 'VARCHAR', size: 100, nullable: false, unique: true },
      { name: 'timestamp', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'type', type: 'ENUM', nullable: false, comment: "Values: 'login', 'logout', 'manufacturing', 'mining', 'asset_update', 'market', 'killmail', 'system'" },
      { name: 'member_id', type: 'BIGINT', nullable: true },
      { name: 'member_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'description', type: 'TEXT', nullable: false },
      { name: 'details', type: 'JSON', nullable: true },
      { name: 'severity', type: 'ENUM', nullable: false, defaultValue: "'low'", comment: "Values: 'low', 'medium', 'high', 'critical'" },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_log_id', columns: ['log_id'], type: 'UNIQUE' },
      { name: 'idx_timestamp', columns: ['timestamp'], type: 'INDEX' },
      { name: 'idx_type', columns: ['type'], type: 'INDEX' },
      { name: 'idx_member_id', columns: ['member_id'], type: 'INDEX' },
      { name: 'idx_severity', columns: ['severity'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // System settings table - Application configuration
  {
    tableName: 'system_settings',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'setting_key', type: 'VARCHAR', size: 255, nullable: false, unique: true },
      { name: 'setting_value', type: 'TEXT', nullable: true },
      { name: 'setting_type', type: 'ENUM', nullable: false, defaultValue: "'string'", comment: "Values: 'string', 'number', 'boolean', 'json', 'encrypted'" },
      { name: 'category', type: 'VARCHAR', size: 100, nullable: true },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'is_editable', type: 'BOOLEAN', nullable: false, defaultValue: true },
      { name: 'created_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'updated_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_setting_key', columns: ['setting_key'], type: 'UNIQUE' },
      { name: 'idx_category', columns: ['category'], type: 'INDEX' },
      { name: 'idx_setting_type', columns: ['setting_type'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Wallet journal - ISK transaction tracking
  {
    tableName: 'wallet_journal',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'ref_id', type: 'BIGINT', nullable: false, unique: true },
      { name: 'wallet_division', type: 'INT', nullable: false, defaultValue: 1 },
      { name: 'ref_type_id', type: 'INT', nullable: false },
      { name: 'amount', type: 'DECIMAL', size: 20, nullable: false },
      { name: 'balance', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'reason', type: 'VARCHAR', size: 500, nullable: true },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'tax_receiver_id', type: 'BIGINT', nullable: true },
      { name: 'first_party_id', type: 'BIGINT', nullable: true },
      { name: 'first_party_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'second_party_id', type: 'BIGINT', nullable: true },
      { name: 'second_party_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'date', type: 'DATETIME', nullable: false },
      { name: 'created_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_ref_id', columns: ['ref_id'], type: 'UNIQUE' },
      { name: 'idx_wallet_division', columns: ['wallet_division'], type: 'INDEX' },
      { name: 'idx_ref_type', columns: ['ref_type_id'], type: 'INDEX' },
      { name: 'idx_date', columns: ['date'], type: 'INDEX' },
      { name: 'idx_first_party', columns: ['first_party_id'], type: 'INDEX' },
      { name: 'idx_second_party', columns: ['second_party_id'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Wallet transactions - Market transaction tracking
  {
    tableName: 'wallet_transactions',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'transaction_id', type: 'BIGINT', nullable: false, unique: true },
      { name: 'wallet_division', type: 'INT', nullable: false, defaultValue: 1 },
      { name: 'client_id', type: 'BIGINT', nullable: false },
      { name: 'client_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'location_id', type: 'BIGINT', nullable: false },
      { name: 'location_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'type_id', type: 'INT', nullable: false },
      { name: 'type_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'quantity', type: 'BIGINT', nullable: false },
      { name: 'unit_price', type: 'DECIMAL', size: 20, nullable: false },
      { name: 'total_price', type: 'DECIMAL', size: 20, nullable: false },
      { name: 'is_buy', type: 'BOOLEAN', nullable: false },
      { name: 'is_personal', type: 'BOOLEAN', nullable: false, defaultValue: false },
      { name: 'journal_ref_id', type: 'BIGINT', nullable: true },
      { name: 'date', type: 'DATETIME', nullable: false },
      { name: 'created_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_transaction_id', columns: ['transaction_id'], type: 'UNIQUE' },
      { name: 'idx_wallet_division', columns: ['wallet_division'], type: 'INDEX' },
      { name: 'idx_client_id', columns: ['client_id'], type: 'INDEX' },
      { name: 'idx_location_id', columns: ['location_id'], type: 'INDEX' },
      { name: 'idx_type_id', columns: ['type_id'], type: 'INDEX' },
      { name: 'idx_date', columns: ['date'], type: 'INDEX' },
      { name: 'idx_is_buy', columns: ['is_buy'], type: 'INDEX' }
    ],
    foreignKeys: [
      { name: 'fk_wallet_journal', column: 'journal_ref_id', referencedTable: 'wallet_journal', referencedColumn: 'ref_id', onDelete: 'SET NULL' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Contracts - Corporation contracts tracking
  {
    tableName: 'contracts',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'contract_id', type: 'BIGINT', nullable: false, unique: true },
      { name: 'issuer_id', type: 'BIGINT', nullable: false },
      { name: 'issuer_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'issuer_corporation_id', type: 'BIGINT', nullable: false },
      { name: 'assignee_id', type: 'BIGINT', nullable: true },
      { name: 'assignee_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'acceptor_id', type: 'BIGINT', nullable: true },
      { name: 'acceptor_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'start_location_id', type: 'BIGINT', nullable: true },
      { name: 'start_location_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'end_location_id', type: 'BIGINT', nullable: true },
      { name: 'end_location_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'type', type: 'ENUM', nullable: false, comment: "Values: 'unknown', 'item_exchange', 'auction', 'courier', 'loan'" },
      { name: 'status', type: 'ENUM', nullable: false, comment: "Values: 'outstanding', 'in_progress', 'finished_issuer', 'finished_contractor', 'finished', 'cancelled', 'rejected', 'failed', 'deleted', 'reversed'" },
      { name: 'title', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'for_corporation', type: 'BOOLEAN', nullable: false, defaultValue: false },
      { name: 'availability', type: 'ENUM', nullable: false, comment: "Values: 'public', 'personal', 'corporation', 'alliance'" },
      { name: 'date_issued', type: 'DATETIME', nullable: false },
      { name: 'date_expired', type: 'DATETIME', nullable: true },
      { name: 'date_accepted', type: 'DATETIME', nullable: true },
      { name: 'date_completed', type: 'DATETIME', nullable: true },
      { name: 'days_to_complete', type: 'INT', nullable: true },
      { name: 'price', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'reward', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'collateral', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'buyout', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'volume', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'created_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'updated_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_contract_id', columns: ['contract_id'], type: 'UNIQUE' },
      { name: 'idx_issuer_id', columns: ['issuer_id'], type: 'INDEX' },
      { name: 'idx_assignee_id', columns: ['assignee_id'], type: 'INDEX' },
      { name: 'idx_acceptor_id', columns: ['acceptor_id'], type: 'INDEX' },
      { name: 'idx_type', columns: ['type'], type: 'INDEX' },
      { name: 'idx_status', columns: ['status'], type: 'INDEX' },
      { name: 'idx_date_issued', columns: ['date_issued'], type: 'INDEX' },
      { name: 'idx_date_expired', columns: ['date_expired'], type: 'INDEX' },
      { name: 'idx_for_corporation', columns: ['for_corporation'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Contract items - Items included in contracts
  {
    tableName: 'contract_items',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'contract_id', type: 'BIGINT', nullable: false },
      { name: 'record_id', type: 'BIGINT', nullable: false },
      { name: 'type_id', type: 'INT', nullable: false },
      { name: 'type_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'quantity', type: 'BIGINT', nullable: false },
      { name: 'raw_quantity', type: 'BIGINT', nullable: true },
      { name: 'singleton', type: 'BOOLEAN', nullable: false, defaultValue: false },
      { name: 'is_included', type: 'BOOLEAN', nullable: false, defaultValue: true },
      { name: 'created_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_contract_id', columns: ['contract_id'], type: 'INDEX' },
      { name: 'idx_record_id', columns: ['record_id'], type: 'INDEX' },
      { name: 'idx_type_id', columns: ['type_id'], type: 'INDEX' },
      { name: 'idx_is_included', columns: ['is_included'], type: 'INDEX' }
    ],
    foreignKeys: [
      { name: 'fk_contract_items_contract', column: 'contract_id', referencedTable: 'contracts', referencedColumn: 'contract_id', onDelete: 'CASCADE' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Structures - Corporation-owned structures
  {
    tableName: 'structures',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'structure_id', type: 'BIGINT', nullable: false, unique: true },
      { name: 'corporation_id', type: 'BIGINT', nullable: false },
      { name: 'type_id', type: 'INT', nullable: false },
      { name: 'type_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'system_id', type: 'INT', nullable: false },
      { name: 'system_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'region_id', type: 'INT', nullable: true },
      { name: 'region_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'profile_id', type: 'INT', nullable: true },
      { name: 'fuel_expires', type: 'DATETIME', nullable: true },
      { name: 'next_reinforce_apply', type: 'DATETIME', nullable: true },
      { name: 'next_reinforce_hour', type: 'INT', nullable: true },
      { name: 'next_reinforce_day', type: 'INT', nullable: true },
      { name: 'state', type: 'ENUM', nullable: false, comment: "Values: 'anchor_vulnerable', 'anchoring', 'armor_reinforce', 'armor_vulnerable', 'fitting_invulnerable', 'hull_reinforce', 'hull_vulnerable', 'online_deprecated', 'onlining_vulnerable', 'shield_vulnerable', 'unanchored', 'unknown'" },
      { name: 'state_timer_start', type: 'DATETIME', nullable: true },
      { name: 'state_timer_end', type: 'DATETIME', nullable: true },
      { name: 'unanchors_at', type: 'DATETIME', nullable: true },
      { name: 'created_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'updated_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_structure_id', columns: ['structure_id'], type: 'UNIQUE' },
      { name: 'idx_corporation_id', columns: ['corporation_id'], type: 'INDEX' },
      { name: 'idx_type_id', columns: ['type_id'], type: 'INDEX' },
      { name: 'idx_system_id', columns: ['system_id'], type: 'INDEX' },
      { name: 'idx_state', columns: ['state'], type: 'INDEX' },
      { name: 'idx_fuel_expires', columns: ['fuel_expires'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Notifications - In-game notification tracking
  {
    tableName: 'notifications',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'notification_id', type: 'BIGINT', nullable: false, unique: true },
      { name: 'character_id', type: 'BIGINT', nullable: false },
      { name: 'sender_id', type: 'BIGINT', nullable: false },
      { name: 'sender_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'sender_type', type: 'ENUM', nullable: false, comment: "Values: 'character', 'corporation', 'alliance', 'faction', 'other'" },
      { name: 'type', type: 'VARCHAR', size: 100, nullable: false },
      { name: 'timestamp', type: 'DATETIME', nullable: false },
      { name: 'is_read', type: 'BOOLEAN', nullable: false, defaultValue: false },
      { name: 'text', type: 'TEXT', nullable: true },
      { name: 'created_date', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_notification_id', columns: ['notification_id'], type: 'UNIQUE' },
      { name: 'idx_character_id', columns: ['character_id'], type: 'INDEX' },
      { name: 'idx_sender_id', columns: ['sender_id'], type: 'INDEX' },
      { name: 'idx_type', columns: ['type'], type: 'INDEX' },
      { name: 'idx_timestamp', columns: ['timestamp'], type: 'INDEX' },
      { name: 'idx_is_read', columns: ['is_read'], type: 'INDEX' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Market orders - Corporation market orders tracking
  {
    tableName: 'market_orders',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'order_id', type: 'BIGINT', nullable: false, unique: true },
      { name: 'corporation_id', type: 'BIGINT', nullable: false },
      { name: 'type_id', type: 'INT', nullable: false },
      { name: 'type_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'location_id', type: 'BIGINT', nullable: false },
      { name: 'location_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'region_id', type: 'BIGINT', nullable: false },
      { name: 'region_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'price', type: 'DECIMAL', size: 20, nullable: false },
      { name: 'volume_total', type: 'BIGINT', nullable: false },
      { name: 'volume_remain', type: 'BIGINT', nullable: false },
      { name: 'min_volume', type: 'BIGINT', nullable: false, defaultValue: 1 },
      { name: 'duration', type: 'INT', nullable: false },
      { name: 'is_buy_order', type: 'BOOLEAN', nullable: false },
      { name: 'issued', type: 'DATETIME', nullable: false },
      { name: 'range', type: 'VARCHAR', size: 50, nullable: true },
      { name: 'wallet_division', type: 'INT', nullable: false, defaultValue: 1 },
      { name: 'escrow', type: 'DECIMAL', size: 20, nullable: true },
      { name: 'state', type: 'ENUM', nullable: false, defaultValue: "'active'", comment: "Values: 'active', 'closed', 'expired', 'cancelled'" },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_order_id', columns: ['order_id'], type: 'UNIQUE' },
      { name: 'idx_corporation_id', columns: ['corporation_id'], type: 'INDEX' },
      { name: 'idx_type_id', columns: ['type_id'], type: 'INDEX' },
      { name: 'idx_location_id', columns: ['location_id'], type: 'INDEX' },
      { name: 'idx_region_id', columns: ['region_id'], type: 'INDEX' },
      { name: 'idx_is_buy_order', columns: ['is_buy_order'], type: 'INDEX' },
      { name: 'idx_state', columns: ['state'], type: 'INDEX' },
      { name: 'idx_issued', columns: ['issued'], type: 'INDEX' }
    ],
    foreignKeys: [
      { name: 'fk_market_orders_corporation', column: 'corporation_id', referencedTable: 'corporations', referencedColumn: 'corporation_id', onDelete: 'CASCADE' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Mining ledger - Corporation mining activity tracking
  {
    tableName: 'mining_ledger',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'corporation_id', type: 'BIGINT', nullable: false },
      { name: 'character_id', type: 'BIGINT', nullable: false },
      { name: 'character_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'date', type: 'DATE', nullable: false },
      { name: 'type_id', type: 'INT', nullable: false },
      { name: 'type_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'quantity', type: 'BIGINT', nullable: false },
      { name: 'system_id', type: 'BIGINT', nullable: false },
      { name: 'system_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_corp_char_date_type', columns: ['corporation_id', 'character_id', 'date', 'type_id'], type: 'UNIQUE' },
      { name: 'idx_corporation_id', columns: ['corporation_id'], type: 'INDEX' },
      { name: 'idx_character_id', columns: ['character_id'], type: 'INDEX' },
      { name: 'idx_date', columns: ['date'], type: 'INDEX' },
      { name: 'idx_type_id', columns: ['type_id'], type: 'INDEX' },
      { name: 'idx_system_id', columns: ['system_id'], type: 'INDEX' }
    ],
    foreignKeys: [
      { name: 'fk_mining_ledger_corporation', column: 'corporation_id', referencedTable: 'corporations', referencedColumn: 'corporation_id', onDelete: 'CASCADE' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  },

  // Container logs - Asset container change tracking for PI/delivery tracking
  {
    tableName: 'container_logs',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, primaryKey: true, autoIncrement: true },
      { name: 'corporation_id', type: 'BIGINT', nullable: false },
      { name: 'logged_at', type: 'DATETIME', nullable: false },
      { name: 'location_id', type: 'BIGINT', nullable: false },
      { name: 'location_flag', type: 'VARCHAR', size: 100, nullable: true },
      { name: 'action', type: 'ENUM', nullable: false, comment: "Values: 'add', 'remove', 'move', 'assemble', 'repackage'" },
      { name: 'character_id', type: 'BIGINT', nullable: true },
      { name: 'character_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'type_id', type: 'INT', nullable: false },
      { name: 'type_name', type: 'VARCHAR', size: 255, nullable: true },
      { name: 'quantity', type: 'BIGINT', nullable: false },
      { name: 'last_update', type: 'DATETIME', nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ],
    indexes: [
      { name: 'idx_corporation_id', columns: ['corporation_id'], type: 'INDEX' },
      { name: 'idx_logged_at', columns: ['logged_at'], type: 'INDEX' },
      { name: 'idx_location_id', columns: ['location_id'], type: 'INDEX' },
      { name: 'idx_character_id', columns: ['character_id'], type: 'INDEX' },
      { name: 'idx_type_id', columns: ['type_id'], type: 'INDEX' },
      { name: 'idx_action', columns: ['action'], type: 'INDEX' }
    ],
    foreignKeys: [
      { name: 'fk_container_logs_corporation', column: 'corporation_id', referencedTable: 'corporations', referencedColumn: 'corporation_id', onDelete: 'CASCADE' }
    ],
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  }
];

// Default system settings for initial setup
export const defaultSystemSettings = [
  { key: 'corp_name', value: 'Sample Corporation', type: 'string', category: 'general', description: 'Corporation name' },
  { key: 'corp_ticker', value: 'CORP', type: 'string', category: 'general', description: 'Corporation ticker' },
  { key: 'corp_id', value: '', type: 'number', category: 'general', description: 'Corporation ID from EVE Online' },
  { key: 'timezone', value: 'UTC', type: 'string', category: 'general', description: 'Default timezone' },
  { key: 'language', value: 'en', type: 'string', category: 'general', description: 'Default language' },
  { key: 'session_timeout', value: 'true', type: 'boolean', category: 'general', description: 'Enable session timeout' },
  { key: 'esi_client_id', value: '', type: 'string', category: 'esi', description: 'ESI OAuth client ID' },
  { key: 'esi_client_secret', value: '', type: 'encrypted', category: 'esi', description: 'ESI OAuth client secret' },
  { key: 'esi_base_url', value: 'https://esi.evetech.net', type: 'string', category: 'esi', description: 'ESI base URL' },
  { key: 'esi_user_agent', value: 'LMeve/1.0', type: 'string', category: 'esi', description: 'ESI user agent string' },
  { key: 'sync_members_interval', value: '3600', type: 'number', category: 'sync', description: 'Member sync interval in seconds' },
  { key: 'sync_assets_interval', value: '7200', type: 'number', category: 'sync', description: 'Asset sync interval in seconds' },
  { key: 'sync_manufacturing_interval', value: '1800', type: 'number', category: 'sync', description: 'Manufacturing sync interval in seconds' },
  { key: 'sync_mining_interval', value: '3600', type: 'number', category: 'sync', description: 'Mining sync interval in seconds' },
  { key: 'sync_market_interval', value: '1800', type: 'number', category: 'sync', description: 'Market sync interval in seconds' },
  { key: 'sync_killmails_interval', value: '900', type: 'number', category: 'sync', description: 'Killmail sync interval in seconds' },
  { key: 'sync_wallet_journal_interval', value: '3600', type: 'number', category: 'sync', description: 'Wallet journal sync interval in seconds' },
  { key: 'sync_wallet_transactions_interval', value: '1800', type: 'number', category: 'sync', description: 'Wallet transaction sync interval in seconds' },
  { key: 'sync_contracts_interval', value: '7200', type: 'number', category: 'sync', description: 'Contract sync interval in seconds' },
  { key: 'sync_structures_interval', value: '14400', type: 'number', category: 'sync', description: 'Structure sync interval in seconds' },
  { key: 'sync_notifications_interval', value: '1800', type: 'number', category: 'sync', description: 'Notification sync interval in seconds' },
  { key: 'notifications_manufacturing', value: 'true', type: 'boolean', category: 'notifications', description: 'Enable manufacturing notifications' },
  { key: 'notifications_mining', value: 'true', type: 'boolean', category: 'notifications', description: 'Enable mining notifications' },
  { key: 'notifications_killmails', value: 'true', type: 'boolean', category: 'notifications', description: 'Enable killmail notifications' },
  { key: 'notifications_markets', value: 'true', type: 'boolean', category: 'notifications', description: 'Enable market notifications' },
  { key: 'notifications_wallet', value: 'true', type: 'boolean', category: 'notifications', description: 'Enable wallet notifications' },
  { key: 'notifications_contracts', value: 'true', type: 'boolean', category: 'notifications', description: 'Enable contract notifications' },
  { key: 'notifications_structures', value: 'true', type: 'boolean', category: 'notifications', description: 'Enable structure notifications' }
];

// Database schema validation functions
export function validateSchemaDefinition(schema: DatabaseSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate table name
  if (!schema.tableName?.trim()) {
    errors.push('Table name is required');
  }

  // Validate columns
  if (!schema.columns || schema.columns.length === 0) {
    errors.push('At least one column is required');
  } else {
    const primaryKeys = schema.columns.filter(col => col.primaryKey);
    if (primaryKeys.length === 0) {
      errors.push('At least one primary key column is required');
    }
    if (primaryKeys.length > 1) {
      errors.push('Multiple primary key columns found - composite keys not yet supported');
    }

    schema.columns.forEach((col, index) => {
      if (!col.name?.trim()) {
        errors.push(`Column ${index + 1}: name is required`);
      }
      if (!col.type?.trim()) {
        errors.push(`Column ${col.name || index + 1}: type is required`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

export function generateCreateTableSQL(schema: DatabaseSchema): string {
  const validation = validateSchemaDefinition(schema);
  if (!validation.valid) {
    throw new Error(`Invalid schema: ${validation.errors.join(', ')}`);
  }

  let sql = `CREATE TABLE \`${schema.tableName}\` (\n`;
  
  // Add columns
  const columnDefinitions = schema.columns.map(col => {
    let def = `  \`${col.name}\` ${col.type.toUpperCase()}`;
    
    if (col.size) {
      def += `(${col.size})`;
    }
    
    if (!col.nullable) {
      def += ' NOT NULL';
    }
    
    if (col.autoIncrement) {
      def += ' AUTO_INCREMENT';
    }
    
    if (col.defaultValue !== undefined && col.defaultValue !== null) {
      if (typeof col.defaultValue === 'string' && col.defaultValue.includes('CURRENT_TIMESTAMP')) {
        def += ` DEFAULT ${col.defaultValue}`;
      } else {
        def += ` DEFAULT ${col.defaultValue}`;
      }
    }
    
    if (col.unique && !col.primaryKey) {
      def += ' UNIQUE';
    }
    
    if (col.comment) {
      def += ` COMMENT '${col.comment}'`;
    }
    
    return def;
  });
  
  sql += columnDefinitions.join(',\n');
  
  // Add primary key
  const primaryKeyColumns = schema.columns.filter(col => col.primaryKey);
  if (primaryKeyColumns.length > 0) {
    sql += `,\n  PRIMARY KEY (\`${primaryKeyColumns.map(col => col.name).join('`, `')}\`)`;
  }
  
  // Add indexes
  if (schema.indexes && schema.indexes.length > 0) {
    schema.indexes.forEach(index => {
      sql += `,\n  ${index.type} \`${index.name}\` (\`${index.columns.join('`, `')}\`)`;
    });
  }
  
  // Add foreign keys
  if (schema.foreignKeys && schema.foreignKeys.length > 0) {
    schema.foreignKeys.forEach(fk => {
      sql += `,\n  CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.referencedTable}\` (\`${fk.referencedColumn}\`)`;
      if (fk.onDelete) {
        sql += ` ON DELETE ${fk.onDelete}`;
      }
      if (fk.onUpdate) {
        sql += ` ON UPDATE ${fk.onUpdate}`;
      }
    });
  }
  
  sql += '\n)';
  
  // Add engine and charset
  if (schema.engine) {
    sql += ` ENGINE=${schema.engine}`;
  }
  if (schema.charset) {
    sql += ` DEFAULT CHARSET=${schema.charset}`;
  }
  if (schema.collation) {
    sql += ` COLLATE=${schema.collation}`;
  }
  
  sql += ';';
  
  return sql;
}

// Function to generate all table creation SQL
export function generateAllCreateTableSQL(): string {
  return lmeveSchemas.map(schema => generateCreateTableSQL(schema)).join('\n\n');
}

// Function to get table names
export function getTableNames(): string[] {
  return lmeveSchemas.map(schema => schema.tableName);
}

// Function to get schema by table name
export function getSchemaByTableName(tableName: string): DatabaseSchema | undefined {
  return lmeveSchemas.find(schema => schema.tableName === tableName);
}