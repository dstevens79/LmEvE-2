-- LMeve 2 Schema — standalone, used by api/db-admin-actions.php schema action
-- Extracted from scripts/setup-lmeve-db.sh (SCHEMA_EOF heredoc)

-- Users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(255) UNIQUE,
  `password` VARCHAR(255),
  `character_id` BIGINT UNIQUE,
  `character_name` VARCHAR(255),
  `corporation_id` BIGINT,
  `corporation_name` VARCHAR(255),
  `alliance_id` BIGINT,
  `alliance_name` VARCHAR(255),
  `auth_method` ENUM('manual', 'esi') NOT NULL DEFAULT 'manual',
  `role` VARCHAR(64) NOT NULL DEFAULT 'corp_member',
  `access_token` TEXT,
  `refresh_token` TEXT,
  `token_expiry` DATETIME,
  `scopes` TEXT,
  `last_login` DATETIME,
  `session_expiry` DATETIME,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_character_id` (`character_id`),
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_auth_method` (`auth_method`),
  INDEX `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Corporations table
CREATE TABLE IF NOT EXISTS `corporations` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `corporation_id` BIGINT NOT NULL UNIQUE,
  `corporation_name` VARCHAR(255) NOT NULL,
  `ticker` VARCHAR(10) NOT NULL,
  `alliance_id` BIGINT,
  `alliance_name` VARCHAR(255),
  `member_count` INT NOT NULL DEFAULT 0,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.0,
  `ceo_id` BIGINT,
  `ceo_name` VARCHAR(255),
  `description` TEXT,
  `url` VARCHAR(500),
  `founded` DATETIME,
  `home_station_id` BIGINT,
  `home_station_name` VARCHAR(255),
  `wallet_balance` DECIMAL(20,2) DEFAULT 0.0,
  `esi_client_id` VARCHAR(255),
  `esi_client_secret` VARCHAR(255),
  `registered_scopes` TEXT,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `registration_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_token_refresh` DATETIME,
  `last_sync` DATETIME NULL DEFAULT NULL,
  `last_sync_process` VARCHAR(50) NULL DEFAULT NULL,
  `last_sync_items` INT NULL DEFAULT NULL,
  `last_sync_error` TEXT NULL,
  `last_update` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_alliance_id` (`alliance_id`),
  INDEX `idx_ticker` (`ticker`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Members table
CREATE TABLE IF NOT EXISTS `members` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `character_id` BIGINT NOT NULL,
  `character_name` VARCHAR(255) NOT NULL,
  `corporation_id` BIGINT NOT NULL,
  `corporation_name` VARCHAR(255),
  `alliance_id` BIGINT,
  `alliance_name` VARCHAR(255),
  `roles` JSON,
  `titles` JSON,
  `last_login` DATETIME,
  `location_id` BIGINT,
  `location_name` VARCHAR(255),
  `ship_type_id` INT,
  `ship_type_name` VARCHAR(255),
  `is_online` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `access_level` ENUM('member', 'director', 'ceo') NOT NULL DEFAULT 'member',
  `joined_date` DATETIME,
  `created_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_character_id` (`character_id`),
  INDEX `idx_corporation_id` (`corporation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Projects table
CREATE TABLE IF NOT EXISTS `projects` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `project_name` VARCHAR(255) NOT NULL,
  `project_type` ENUM('manufacturing', 'invention', 'reaction', 'research') NOT NULL DEFAULT 'manufacturing',
  `status` ENUM('planning', 'active', 'paused', 'completed', 'cancelled') NOT NULL DEFAULT 'planning',
  `priority` INT NOT NULL DEFAULT 0,
  `owner_id` INT,
  `owner_name` VARCHAR(255),
  `location_id` BIGINT,
  `location_name` VARCHAR(255),
  `notes` TEXT,
  `created_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `start_date` DATETIME,
  `completion_date` DATETIME,
  INDEX `idx_status` (`status`),
  INDEX `idx_owner_id` (`owner_id`),
  INDEX `idx_project_type` (`project_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Settings table
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(255) NOT NULL UNIQUE,
  `value` TEXT,
  `category` VARCHAR(100),
  `description` TEXT,
  `is_encrypted` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Assets table
CREATE TABLE IF NOT EXISTS `assets` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `item_id` BIGINT NOT NULL UNIQUE,
  `type_id` INT NOT NULL,
  `location_id` BIGINT NOT NULL,
  `location_type` VARCHAR(50),
  `location_flag` VARCHAR(50),
  `quantity` BIGINT NOT NULL DEFAULT 0,
  `is_singleton` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_blueprint_copy` BOOLEAN,
  `owner_id` BIGINT,
  `corporation_id` BIGINT,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_type_id` (`type_id`),
  INDEX `idx_location_id` (`location_id`),
  INDEX `idx_owner_id` (`owner_id`),
  INDEX `idx_corporation_id` (`corporation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Industry Jobs table (ESI /corporations/{id}/industry/jobs/)
CREATE TABLE IF NOT EXISTS `industry_jobs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `job_id` BIGINT NOT NULL UNIQUE,
  `corporation_id` BIGINT NOT NULL,
  `installer_id` BIGINT,
  `facility_id` BIGINT,
  `activity_id` INT,
  `blueprint_type_id` INT,
  `product_type_id` INT,
  `runs` INT NOT NULL DEFAULT 1,
  `cost` DECIMAL(20,2),
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `duration` INT NOT NULL DEFAULT 0,
  `start_date` DATETIME,
  `end_date` DATETIME,
  `completed_runs` INT,
  `completed_date` DATETIME,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_blueprint_type_id` (`blueprint_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wallet Transactions table (ESI /corporations/{id}/wallets/{div}/transactions/)
CREATE TABLE IF NOT EXISTS `wallet_transactions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `transaction_id` BIGINT NOT NULL UNIQUE,
  `corporation_id` BIGINT NOT NULL,
  `division` INT,
  `client_id` BIGINT,
  `client_name` VARCHAR(255) NULL DEFAULT NULL,
  `date` DATETIME,
  `is_buy` BOOLEAN NOT NULL DEFAULT FALSE,
  `journal_ref_id` BIGINT,
  `location_id` BIGINT,
  `location_name` VARCHAR(255) NULL DEFAULT NULL,
  `quantity` BIGINT NOT NULL DEFAULT 0,
  `type_id` INT NOT NULL,
  `type_name` VARCHAR(255) NULL DEFAULT NULL,
  `unit_price` DECIMAL(20,2) NOT NULL DEFAULT 0.0,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_date` (`date`),
  INDEX `idx_type_id` (`type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wallet Divisions table (ESI /corporations/{id}/wallets/ + /divisions/)
CREATE TABLE IF NOT EXISTS `wallet_divisions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `corporation_id` BIGINT NOT NULL,
  `division_id` INT NOT NULL,
  `division_name` VARCHAR(255),
  `balance` DECIMAL(20,2) NOT NULL DEFAULT 0.0,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_corp_division` (`corporation_id`, `division_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Market Orders table (ESI /corporations/{id}/orders/ — the corp's own orders)
CREATE TABLE IF NOT EXISTS `market_orders` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT NOT NULL UNIQUE,
  `corporation_id` BIGINT NOT NULL,
  `type_id` INT NOT NULL,
  `region_id` BIGINT,
  `location_id` BIGINT,
  `volume_total` BIGINT NOT NULL DEFAULT 0,
  `volume_remain` BIGINT,
  `min_volume` INT,
  `price` DECIMAL(20,2) NOT NULL DEFAULT 0.0,
  `is_buy_order` BOOLEAN NOT NULL DEFAULT FALSE,
  `duration` INT,
  `issued` DATETIME,
  `state` VARCHAR(50),
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_type_id` (`type_id`),
  INDEX `idx_issued` (`issued`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Market Prices table (ESI /markets/prices — public, no token)
CREATE TABLE IF NOT EXISTS `market_prices` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `type_id` INT NOT NULL UNIQUE,
  `adjusted_price` DECIMAL(20,4),
  `average_price` DECIMAL(20,4),
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_type_id` (`type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Market Order History table (ESI /corporations/{id}/orders/history — closed corp orders).
-- Feeds the Market page's completed-sales view; active orders live in market_orders.
CREATE TABLE IF NOT EXISTS `market_order_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT NOT NULL UNIQUE,
  `corporation_id` BIGINT NOT NULL,
  `type_id` INT NOT NULL DEFAULT 0,
  `region_id` BIGINT,
  `location_id` BIGINT,
  `volume_total` BIGINT NOT NULL DEFAULT 0,
  `price` DECIMAL(20,2) NOT NULL DEFAULT 0.0,
  `is_buy_order` BOOLEAN NOT NULL DEFAULT FALSE,
  `issued` DATETIME,
  `state` VARCHAR(50),
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_state` (`state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Planetary Colonies table
CREATE TABLE IF NOT EXISTS `planetary_colonies` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `planet_id` BIGINT NOT NULL,
  `owner_id` BIGINT NOT NULL,
  `corporation_id` BIGINT,
  `solar_system_id` BIGINT NOT NULL,
  `planet_type` VARCHAR(50),
  `upgrade_level` INT NOT NULL DEFAULT 0,
  `num_pins` INT NOT NULL DEFAULT 0,
  `last_update` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_planet_owner` (`planet_id`, `owner_id`),
  INDEX `idx_corporation_id` (`corporation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Corporation Members table (alternative to members)
CREATE TABLE IF NOT EXISTS `corporation_members` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `character_id` BIGINT NOT NULL UNIQUE,
  `character_name` VARCHAR(255) NOT NULL,
  `corporation_id` BIGINT NOT NULL,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contracts table (ESI /corporations/{id}/contracts + /contracts/{id}/items).
-- Stores corporation contracts where the corp is issuer OR assignee/acceptor.
CREATE TABLE IF NOT EXISTS `contracts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `contract_id` BIGINT NOT NULL UNIQUE,
  `corporation_id` BIGINT NOT NULL,
  `issuer_id` BIGINT,
  `assignee_id` BIGINT,
  `acceptor_id` BIGINT,
  `type` VARCHAR(50) NOT NULL DEFAULT '',
  `status` VARCHAR(50) NOT NULL DEFAULT '',
  `title` VARCHAR(255),
  `for_corporation` BOOLEAN NOT NULL DEFAULT FALSE,
  `availability` VARCHAR(50),
  `date_issued` DATETIME,
  `date_expired` DATETIME,
  `date_accepted` DATETIME,
  `date_completed` DATETIME,
  `price` DECIMAL(20,2),
  `reward` DECIMAL(20,2),
  `collateral` DECIMAL(20,2),
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contract Items table (ESI /corporations/{id}/contracts/{contract_id}/items)
CREATE TABLE IF NOT EXISTS `contract_items` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `contract_id` BIGINT NOT NULL,
  `record_id` BIGINT NOT NULL,
  `type_id` INT NOT NULL DEFAULT 0,
  `quantity` BIGINT NOT NULL DEFAULT 0,
  `is_singleton` BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY `idx_contract_record` (`contract_id`, `record_id`),
  INDEX `idx_type_id` (`type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mining Ledger table (ESI /corporation/{id}/mining/observers — PI extraction rows)
CREATE TABLE IF NOT EXISTS `mining_ledger` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `corporation_id` BIGINT NOT NULL,
  `character_id` BIGINT NOT NULL,
  `date` DATE,
  `type_id` INT NOT NULL,
  `quantity` BIGINT NOT NULL DEFAULT 0,
  `solar_system_id` BIGINT,
  `system_name` VARCHAR(255) NULL DEFAULT NULL,
  `character_name` VARCHAR(255) NULL DEFAULT NULL,
  `type_name` VARCHAR(255) NULL DEFAULT NULL,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_unique_entry` (`corporation_id`, `character_id`, `date`, `type_id`, `solar_system_id`),
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Container Logs table (ESI /corporations/{id}/containers/logs)
CREATE TABLE IF NOT EXISTS `container_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `corporation_id` BIGINT NOT NULL,
  `logged_at` DATETIME,
  `character_id` BIGINT NOT NULL DEFAULT 0,
  `container_id` BIGINT NOT NULL,
  `container_type_id` INT NOT NULL DEFAULT 0,
  `action` VARCHAR(50) NOT NULL DEFAULT '',
  `location_flag` VARCHAR(50),
  `location_id` BIGINT NOT NULL DEFAULT 0,
  `type_id` INT NOT NULL DEFAULT 0,
  `quantity` BIGINT NOT NULL DEFAULT 0,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_logged_at` (`logged_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Killmails table (ESI /corporations/{id}/killmails/recent/ + public detail endpoint).
-- Stores corporation losses: victim_corporation_id = this corp.
CREATE TABLE IF NOT EXISTS `killmails` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `killmail_id` BIGINT NOT NULL UNIQUE,
  `killmail_hash` VARCHAR(255),
  `killmail_time` DATETIME,
  `solar_system_id` BIGINT,
  `victim_character_id` BIGINT,
  `victim_corporation_id` BIGINT,
  `victim_alliance_id` BIGINT,
  `victim_ship_type_id` INT,
  `victim_damage_taken` BIGINT,
  `final_blow_character_id` BIGINT,
  `total_value` DECIMAL(20,2),
  `attacker_count` INT NOT NULL DEFAULT 0,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_killmail_time` (`killmail_time`),
  INDEX `idx_solar_system_id` (`solar_system_id`),
  INDEX `idx_victim_corporation_id` (`victim_corporation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Income Records table. Derived at read time from completed industry jobs +
-- market prices by get-income.php (job revenue minus material costs); this
-- table caches the last derivation per (corp, job) via reference_id.
CREATE TABLE IF NOT EXISTS `income_records` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `corporation_id` BIGINT NOT NULL,
  `character_id` BIGINT,
  `job_id` BIGINT,
  `income_type` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(20,2) NOT NULL,
  `tax_amount` DECIMAL(20,2) DEFAULT 0.0,
  `date` DATETIME NOT NULL,
  `description` TEXT,
  `transaction_id` BIGINT,
  `reference_id` BIGINT,
  `source` VARCHAR(100),
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_unique_derived` (`corporation_id`, `income_type`, `date`, `reference_id`),
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_character_id` (`character_id`),
  INDEX `idx_income_type` (`income_type`),
  INDEX `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structures table (ESI /corporations/{id}/structures/)
CREATE TABLE IF NOT EXISTS `structures` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `structure_id` BIGINT NOT NULL UNIQUE,
  `corporation_id` BIGINT NOT NULL,
  `type_id` INT NOT NULL DEFAULT 0,
  `system_id` BIGINT,
  `status` VARCHAR(50) NULL DEFAULT NULL,
  `name` VARCHAR(255) NULL DEFAULT NULL,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_type_id` (`type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sync bookkeeping: per-run state for the cron poller + Data Sync settings page.
CREATE TABLE IF NOT EXISTS `corp_sync_log` (
  `corporation_id` BIGINT NOT NULL,
  `process_type` VARCHAR(50) NOT NULL,
  `last_run_at` DATETIME NULL DEFAULT NULL,
  `last_status` ENUM('success','error') NULL DEFAULT NULL,
  `last_items` INT NULL DEFAULT NULL,
  `last_error` TEXT NULL,
  `took_ms` INT NULL DEFAULT NULL,
  `updated_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`corporation_id`, `process_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-corporation, per-process sync schedule (minutes between runs).
CREATE TABLE IF NOT EXISTS `sync_process_config` (
  `corporation_id` BIGINT NOT NULL,
  `process_type` VARCHAR(50) NOT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `interval_minutes` INT NOT NULL DEFAULT 60,
  `updated_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`corporation_id`, `process_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ESI name-resolution cache (get-names.php — batch universe/system/character lookups).
CREATE TABLE IF NOT EXISTS `name_cache` (
  `entity_kind` VARCHAR(16) NOT NULL,
  `entity_id` BIGINT NOT NULL,
  `entity_name` VARCHAR(512) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`entity_kind`, `entity_id`),
  INDEX `idx_entity_id` (`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Site role definitions (roles as data). corporation_id NULL = global set shared by all corps.
-- The six built-in roles are seeded at first use by _lib/role-config-lib.php (idempotent);
-- custom roles and per-corp overrides are managed via /api/lmeve/role-definitions.php.
CREATE TABLE IF NOT EXISTS `role_definitions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `corporation_id` BIGINT NULL,
  `key` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `permissions_json` JSON NOT NULL,
  `is_builtin` TINYINT(1) NOT NULL DEFAULT 0,
  `created_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_corp_key` (`corporation_id`, `key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permission mappings: EVE corp role or corp title -> site role. corporation_id NULL = global fallback rule.
CREATE TABLE IF NOT EXISTS `permission_mappings` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `corporation_id` BIGINT NULL,
  `kind` ENUM('eve_role','title') NOT NULL,
  `source_name` VARCHAR(150) NOT NULL,
  `site_role_key` VARCHAR(64) NOT NULL DEFAULT 'corp_member',
  `priority` INT NOT NULL DEFAULT 0,
  `updated_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_corp_kind_source` (`corporation_id`, `kind`, `source_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;