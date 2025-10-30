#!/bin/bash
#
# LMeve Complete Database Server Setup Script
# All-in-one installer for fresh Ubuntu/Debian systems
# 
# Usage: sudo bash setup-lmeve-db.sh
#
# This script will:
# - Install system requirements (wget, bzip2, etc.)
# - Configure firewall (UFW)
# - Install MySQL or MariaDB (your choice)
# - Optionally install Webmin
# - Create databases (lmeve, EveStaticData)
# - Create user with proper permissions
# - Download and import EVE SDE data
# - Verify everything works
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root (use sudo)${NC}" 
   exit 1
fi

# Banner
echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                            ║${NC}"
echo -e "${CYAN}║    LMeve Complete Database Server - All-in-One Installer  ║${NC}"
echo -e "${CYAN}║                                                            ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${YELLOW}This script will set up a complete LMeve database server${NC}"
echo -e "${YELLOW}on a fresh Ubuntu/Debian installation.${NC}\n"

# Function to print step headers
print_step() {
    echo -e "\n${BLUE}▶ $1${NC}"
    echo -e "${BLUE}────────────────────────────────────────────────────────────────${NC}"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect OS
print_step "Detecting Operating System"
if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
    echo -e "${GREEN}✅ Detected: $PRETTY_NAME${NC}"
else
    echo -e "${RED}❌ Cannot detect OS. This script supports Ubuntu/Debian.${NC}"
    exit 1
fi

if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
    echo -e "${YELLOW}⚠️  Warning: This script is designed for Ubuntu/Debian.${NC}"
    echo -e "${YELLOW}    It may work on $PRETTY_NAME but is not tested.${NC}"
    read -p "Continue anyway? [y/N]: " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Installation cancelled.${NC}"
        exit 0
    fi
fi

# Step 1: System Update
print_step "System Update"
echo -e "${YELLOW}Update system packages?${NC}"
read -p "Run apt update && apt upgrade? [Y/n]: " DO_UPDATE
DO_UPDATE=${DO_UPDATE:-Y}

if [[ "$DO_UPDATE" =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}Updating package lists...${NC}"
    apt update
    echo -e "${CYAN}Upgrading installed packages (this may take a while)...${NC}"
    DEBIAN_FRONTEND=noninteractive apt upgrade -y
    echo -e "${GREEN}✅ System updated${NC}"
else
    echo -e "${YELLOW}Skipping system update${NC}"
fi

# Step 2: Install Required Packages
print_step "Installing Required Packages"
echo -e "${CYAN}Installing essential packages: wget, bzip2, curl, git...${NC}"

PACKAGES="wget bzip2 curl git ufw"
MISSING_PACKAGES=""

for pkg in $PACKAGES; do
    if ! dpkg -l | grep -q "^ii  $pkg "; then
        MISSING_PACKAGES="$MISSING_PACKAGES $pkg"
    fi
done

if [[ -n "$MISSING_PACKAGES" ]]; then
    echo -e "${CYAN}Installing:$MISSING_PACKAGES${NC}"
    apt install -y $MISSING_PACKAGES
    echo -e "${GREEN}✅ Required packages installed${NC}"
else
    echo -e "${GREEN}✅ All required packages already installed${NC}"
fi

# Step 3: Firewall Configuration
print_step "Firewall Configuration (UFW)"

# Get port early for firewall config
echo -e "${YELLOW}Database Port Configuration:${NC}"
read -p "MySQL/MariaDB Port [3306]: " DB_PORT
DB_PORT=${DB_PORT:-3306}

echo -e "\n${YELLOW}Configure firewall settings?${NC}"
echo -e "  1) Disable UFW (not recommended)"
echo -e "  2) Configure UFW for database server (port ${DB_PORT})"
echo -e "  3) Skip firewall configuration"
read -p "Choice [2]: " UFW_CHOICE
UFW_CHOICE=${UFW_CHOICE:-2}

case $UFW_CHOICE in
    1)
        echo -e "${YELLOW}Disabling UFW...${NC}"
        ufw disable
        echo -e "${YELLOW}⚠️  Firewall disabled${NC}"
        ;;
    2)
        echo -e "${CYAN}Configuring UFW...${NC}"
        # Allow SSH (critical!)
        ufw allow OpenSSH
        # Allow MySQL/MariaDB on selected port
        ufw allow ${DB_PORT}/tcp
        # Enable UFW if not already enabled
        echo "y" | ufw enable
        ufw status
        echo -e "${GREEN}✅ Firewall configured${NC}"
        echo -e "${CYAN}Allowed: SSH (22), MySQL/MariaDB (${DB_PORT})${NC}"
        ;;
    3)
        echo -e "${YELLOW}Skipping firewall configuration${NC}"
        ;;
esac

# Step 4: Database Server Selection
print_step "Database Server Selection"
echo -e "${YELLOW}Choose your database server:${NC}"
echo -e "  1) MySQL (Oracle's MySQL Server)"
echo -e "  2) MariaDB (Community fork, fully compatible)"
read -p "Choice [1]: " DB_CHOICE
DB_CHOICE=${DB_CHOICE:-1}

DB_TYPE=""
DB_SERVICE=""

# Check if MySQL or MariaDB is already installed
MYSQL_INSTALLED=false
MARIADB_INSTALLED=false

if command_exists mysql && mysql --version | grep -qi "mysql"; then
    MYSQL_INSTALLED=true
fi

if command_exists mysql && mysql --version | grep -qi "mariadb"; then
    MARIADB_INSTALLED=true
fi

if [[ "$MYSQL_INSTALLED" = true ]] || [[ "$MARIADB_INSTALLED" = true ]]; then
    echo -e "${YELLOW}⚠️  A database server is already installed:${NC}"
    mysql --version
    read -p "Remove existing and install fresh? [y/N]: " REMOVE_EXISTING
    REMOVE_EXISTING=${REMOVE_EXISTING:-N}
    
    if [[ "$REMOVE_EXISTING" =~ ^[Yy]$ ]]; then
        echo -e "${CYAN}Removing existing database server...${NC}"
        systemctl stop mysql 2>/dev/null || systemctl stop mariadb 2>/dev/null || true
        apt purge -y mysql-server mysql-client mysql-common mariadb-server mariadb-client 2>/dev/null || true
        apt autoremove -y
        rm -rf /etc/mysql /var/lib/mysql
        echo -e "${GREEN}✅ Existing database server removed${NC}"
        # Continue with installation below
    else
        echo -e "${GREEN}✅ Using existing database server${NC}"
        if [[ "$MYSQL_INSTALLED" = true ]]; then
            DB_TYPE="MySQL"
            DB_SERVICE="mysql"
        else
            DB_TYPE="MariaDB"
            DB_SERVICE="mariadb"
        fi
    fi
fi

# Only install if we don't have DB_TYPE set (meaning no existing DB or user chose to remove it)
if [[ -z "$DB_TYPE" ]]; then
    case $DB_CHOICE in
        1)
            DB_TYPE="MySQL"
            DB_SERVICE="mysql"
            echo -e "${CYAN}Installing MySQL Server...${NC}"
            DEBIAN_FRONTEND=noninteractive apt install -y mysql-server
            systemctl enable mysql
            systemctl start mysql
            echo -e "${GREEN}✅ MySQL Server installed and started${NC}"
            ;;
        2)
            DB_TYPE="MariaDB"
            DB_SERVICE="mariadb"
            echo -e "${CYAN}Installing MariaDB Server...${NC}"
            DEBIAN_FRONTEND=noninteractive apt install -y mariadb-server
            systemctl enable mariadb
            systemctl start mariadb
            echo -e "${GREEN}✅ MariaDB Server installed and started${NC}"
            ;;
        *)
            echo -e "${RED}❌ Invalid choice${NC}"
            exit 1
            ;;
    esac
    
    # Run mysql_secure_installation equivalent
    echo -e "${CYAN}Securing $DB_TYPE installation...${NC}"
    
    echo -e "${YELLOW}You'll need to set a root password for $DB_TYPE${NC}"
    echo -e "${YELLOW}Please remember this password - you'll need it shortly!${NC}\n"
    
    mysql_secure_installation
    
    echo -e "${GREEN}✅ $DB_TYPE secured${NC}"
fi

# Configure database for remote access
print_step "Configuring Database for Remote Access"
echo -e "${CYAN}Configuring $DB_TYPE to accept remote connections...${NC}"

# Determine config file location
if [[ "$DB_TYPE" == "MySQL" ]]; then
    MYSQL_CNF="/etc/mysql/mysql.conf.d/mysqld.cnf"
else
    MYSQL_CNF="/etc/mysql/mariadb.conf.d/50-server.cnf"
fi

# Backup config
cp "$MYSQL_CNF" "${MYSQL_CNF}.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true

# Set bind-address to 0.0.0.0 to allow remote connections
if grep -q "^bind-address" "$MYSQL_CNF"; then
    sed -i "s/^bind-address.*/bind-address = 0.0.0.0/" "$MYSQL_CNF"
else
    # Add bind-address line after [mysqld] section
    sed -i "/^\[mysqld\]/a bind-address = 0.0.0.0" "$MYSQL_CNF"
fi

# Configure custom port if not default
if [ "$DB_PORT" != "3306" ]; then
    # Update port in config
    if grep -q "^port" "$MYSQL_CNF"; then
        sed -i "s/^port.*/port = ${DB_PORT}/" "$MYSQL_CNF"
    else
        # Add port line after [mysqld] section
        sed -i "/^\[mysqld\]/a port = ${DB_PORT}" "$MYSQL_CNF"
    fi
    echo -e "${GREEN}✅ $DB_TYPE configured for port ${DB_PORT}${NC}"
fi

# Restart database service to apply changes
systemctl restart ${DB_SERVICE}

echo -e "${GREEN}✅ $DB_TYPE configured to accept connections on 0.0.0.0:${DB_PORT}${NC}"
echo -e "${YELLOW}Note: Clients can connect remotely using port ${DB_PORT}${NC}"

# Step 5: Webmin Installation (Optional)
print_step "Webmin Installation (Optional)"

# Check if Webmin is already installed
WEBMIN_INSTALLED=false
INSTALL_WEBMIN=N
if command_exists webmin || dpkg -l | grep -q "^ii  webmin "; then
    WEBMIN_INSTALLED=true
    INSTALL_WEBMIN=Y  # Set to Y so summary shows it
    echo -e "${GREEN}✅ Webmin is already installed${NC}"
    echo -e "${CYAN}Access Webmin at: https://$(hostname -I | awk '{print $1}'):10000${NC}"
else
    echo -e "${YELLOW}Install Webmin for web-based server management?${NC}"
    echo -e "${CYAN}Webmin provides a GUI for managing MySQL/MariaDB, users, and system settings${NC}"
    read -p "Install Webmin? [Y/n]: " INSTALL_WEBMIN
    INSTALL_WEBMIN=${INSTALL_WEBMIN:-Y}

    if [[ "$INSTALL_WEBMIN" =~ ^[Yy]$ ]]; then
        echo -e "${CYAN}Installing Webmin...${NC}"
        
        # Add Webmin repository
        if [[ ! -f /etc/apt/sources.list.d/webmin.list ]]; then
            echo "deb http://download.webmin.com/download/repository sarge contrib" > /etc/apt/sources.list.d/webmin.list
            
            # Add GPG key
            wget -qO - http://www.webmin.com/jcameron-key.asc | apt-key add -
            
            apt update
        fi
        
        # Install Webmin
        apt install -y webmin
        
        # Allow Webmin through firewall if UFW is active
        if ufw status | grep -q "Status: active"; then
            ufw allow 10000/tcp
            echo -e "${GREEN}✅ Webmin port (10000) allowed through firewall${NC}"
        fi
        
        echo -e "${GREEN}✅ Webmin installed${NC}"
        echo -e "${CYAN}Access Webmin at: https://$(hostname -I | awk '{print $1}'):10000${NC}"
        echo -e "${CYAN}Login with your system root credentials${NC}"
    else
        echo -e "${YELLOW}Skipping Webmin installation${NC}"
    fi
fi

# Prompt for database configuration
print_step "LMeve Database Configuration"
echo -e "${YELLOW}Now let's configure your LMeve databases${NC}\n"

# Database host
read -p "Database Host [localhost]: " DB_HOST
DB_HOST=${DB_HOST:-localhost}

# Port was already configured earlier
echo -e "${CYAN}Using Database Port: ${DB_PORT}${NC}"

# MySQL root password
echo -e "\n${YELLOW}MySQL root credentials (for creating databases):${NC}"
read -sp "MySQL Root Password: " MYSQL_ROOT_PASS
echo

# LMeve username
echo -e "\n${YELLOW}LMeve database user (will be created):${NC}"
read -p "LMeve Username [lmeve]: " LMEVE_USER
LMEVE_USER=${LMEVE_USER:-lmeve}

# LMeve password
read -sp "LMeve Password: " LMEVE_PASS
echo
read -sp "Confirm LMeve Password: " LMEVE_PASS_CONFIRM
echo

if [[ "$LMEVE_PASS" != "$LMEVE_PASS_CONFIRM" ]]; then
    echo -e "\n${RED}❌ Passwords do not match!${NC}"
    exit 1
fi

# Database names
echo -e "\n${YELLOW}Database Names:${NC}"
read -p "Main database name [lmeve2]: " LMEVE_DB
LMEVE_DB=${LMEVE_DB:-lmeve2}

read -p "SDE database name [EveStaticData]: " SDE_DB
SDE_DB=${SDE_DB:-EveStaticData}

# SDE download option
echo -e "\n${YELLOW}EVE Static Data Export (SDE):${NC}"
echo -e "${CYAN}SDE provides item names, types, and other static EVE data.${NC}"
echo -e "${CYAN}Note: SDE import can take 10+ minutes and is optional.${NC}"
echo -e "${CYAN}You can import it later from the LMeve web interface.${NC}"
read -p "Download and import SDE now? [y/N]: " DOWNLOAD_SDE
DOWNLOAD_SDE=${DOWNLOAD_SDE:-N}

# Configuration summary
echo -e "\n${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}Configuration Summary:${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "  Database Host: ${YELLOW}$DB_HOST:$DB_PORT${NC}"
echo -e "  Main Database: ${YELLOW}$LMEVE_DB${NC}"
echo -e "  SDE Database: ${YELLOW}$SDE_DB${NC}"
echo -e "  LMeve Username: ${YELLOW}$LMEVE_USER${NC}"
echo -e "  LMeve Password: ${YELLOW}[hidden]${NC}"
echo -e "  Download SDE: ${YELLOW}${DOWNLOAD_SDE}${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}\n"

read -p "Proceed with installation? [Y/n]: " CONFIRM
CONFIRM=${CONFIRM:-Y}

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Installation cancelled.${NC}"
    exit 0
fi

# Step 1: Test MySQL Connection
print_step "Testing MySQL Connection"
if mysql -u root -p"$MYSQL_ROOT_PASS" -h "$DB_HOST" -P "$DB_PORT" -e "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ MySQL connection successful${NC}"
else
    echo -e "${RED}❌ Cannot connect to MySQL${NC}"
    echo "Please check your MySQL configuration and credentials"
    exit 1
fi

# Step 2: Create Databases
print_step "Creating Databases"
mysql -u root -p"$MYSQL_ROOT_PASS" -h "$DB_HOST" -P "$DB_PORT" << SQLEOF
CREATE DATABASE IF NOT EXISTS ${LMEVE_DB} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS ${SDE_DB} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SQLEOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Databases created: ${LMEVE_DB}, ${SDE_DB}${NC}"
else
    echo -e "${RED}❌ Failed to create databases${NC}"
    exit 1
fi

# Step 3: Create User
print_step "Creating MySQL User"
mysql -u root -p"$MYSQL_ROOT_PASS" -h "$DB_HOST" -P "$DB_PORT" << SQLEOF
DROP USER IF EXISTS '${LMEVE_USER}'@'%';
DROP USER IF EXISTS '${LMEVE_USER}'@'localhost';

CREATE USER '${LMEVE_USER}'@'%' IDENTIFIED WITH mysql_native_password BY '${LMEVE_PASS}';
CREATE USER '${LMEVE_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${LMEVE_PASS}';

GRANT ALL PRIVILEGES ON ${LMEVE_DB}.* TO '${LMEVE_USER}'@'%';
GRANT ALL PRIVILEGES ON ${LMEVE_DB}.* TO '${LMEVE_USER}'@'localhost';
GRANT ALL PRIVILEGES ON ${SDE_DB}.* TO '${LMEVE_USER}'@'%';
GRANT ALL PRIVILEGES ON ${SDE_DB}.* TO '${LMEVE_USER}'@'localhost';

FLUSH PRIVILEGES;
SQLEOF

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ User '$LMEVE_USER' created with full permissions${NC}"
else
    echo -e "${RED}❌ Failed to create user${NC}"
    exit 1
fi

# Step 4: Test new user connection
print_step "Testing User Connection"
if mysql -u "$LMEVE_USER" -p"$LMEVE_PASS" -h "$DB_HOST" -P "$DB_PORT" -e "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ User connection successful${NC}"
else
    echo -e "${RED}❌ User connection failed${NC}"
    exit 1
fi

# Step 4.5: Create LMeve Database Schema
print_step "Creating LMeve Database Schema"
echo -e "${CYAN}Setting up core tables in ${LMEVE_DB}...${NC}"

mysql -u "$LMEVE_USER" -p"$LMEVE_PASS" -h "$DB_HOST" -P "$DB_PORT" ${LMEVE_DB} << 'SCHEMA_EOF'
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
  `role` ENUM('super_admin', 'corp_admin', 'corp_director', 'corp_manager', 'corp_member', 'guest') NOT NULL DEFAULT 'corp_member',
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

-- Industry Jobs table
CREATE TABLE IF NOT EXISTS `industry_jobs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `job_id` BIGINT NOT NULL UNIQUE,
  `corporation_id` BIGINT NOT NULL,
  `installer_id` BIGINT NOT NULL,
  `facility_id` BIGINT NOT NULL,
  `activity_id` INT NOT NULL,
  `blueprint_type_id` INT NOT NULL,
  `product_type_id` INT,
  `runs` INT NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `duration` INT NOT NULL,
  `start_date` DATETIME NOT NULL,
  `end_date` DATETIME NOT NULL,
  `completed_date` DATETIME,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_blueprint_type_id` (`blueprint_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wallet Transactions table
CREATE TABLE IF NOT EXISTS `wallet_transactions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `transaction_id` BIGINT NOT NULL UNIQUE,
  `corporation_id` BIGINT NOT NULL,
  `division_id` INT,
  `client_id` BIGINT NOT NULL,
  `date` DATETIME NOT NULL,
  `is_buy` BOOLEAN NOT NULL,
  `is_personal` BOOLEAN NOT NULL DEFAULT FALSE,
  `journal_ref_id` BIGINT,
  `location_id` BIGINT NOT NULL,
  `quantity` BIGINT NOT NULL,
  `type_id` INT NOT NULL,
  `unit_price` DECIMAL(20,2) NOT NULL,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_date` (`date`),
  INDEX `idx_type_id` (`type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wallet Divisions table
CREATE TABLE IF NOT EXISTS `wallet_divisions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `corporation_id` BIGINT NOT NULL,
  `division_id` INT NOT NULL,
  `division_name` VARCHAR(255),
  `balance` DECIMAL(20,2) NOT NULL DEFAULT 0.0,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_corp_division` (`corporation_id`, `division_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Market Orders table
CREATE TABLE IF NOT EXISTS `market_orders` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT NOT NULL UNIQUE,
  `corporation_id` BIGINT NOT NULL,
  `type_id` INT NOT NULL,
  `region_id` BIGINT,
  `location_id` BIGINT NOT NULL,
  `volume_total` BIGINT NOT NULL,
  `volume_remain` BIGINT NOT NULL,
  `min_volume` INT,
  `price` DECIMAL(20,2) NOT NULL,
  `is_buy_order` BOOLEAN NOT NULL,
  `duration` INT NOT NULL,
  `issued` DATETIME NOT NULL,
  `state` VARCHAR(50),
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_type_id` (`type_id`),
  INDEX `idx_issued` (`issued`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Market Prices table
CREATE TABLE IF NOT EXISTS `market_prices` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `type_id` INT NOT NULL UNIQUE,
  `adjusted_price` DECIMAL(20,2),
  `average_price` DECIMAL(20,2),
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_type_id` (`type_id`)
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

-- Contracts table
CREATE TABLE IF NOT EXISTS `contracts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `contract_id` BIGINT NOT NULL UNIQUE,
  `corporation_id` BIGINT NOT NULL,
  `issuer_id` BIGINT NOT NULL,
  `assignee_id` BIGINT,
  `type` VARCHAR(50) NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255),
  `for_corporation` BOOLEAN NOT NULL DEFAULT FALSE,
  `availability` VARCHAR(50),
  `date_issued` DATETIME NOT NULL,
  `date_expired` DATETIME,
  `date_accepted` DATETIME,
  `date_completed` DATETIME,
  `price` DECIMAL(20,2),
  `reward` DECIMAL(20,2),
  `collateral` DECIMAL(20,2),
  `buyout` DECIMAL(20,2),
  `volume` DECIMAL(20,2),
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contract Items table
CREATE TABLE IF NOT EXISTS `contract_items` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `contract_id` BIGINT NOT NULL,
  `record_id` BIGINT NOT NULL,
  `type_id` INT NOT NULL,
  `quantity` BIGINT NOT NULL,
  `is_included` BOOLEAN NOT NULL DEFAULT TRUE,
  `is_singleton` BOOLEAN NOT NULL DEFAULT FALSE,
  INDEX `idx_contract_id` (`contract_id`),
  INDEX `idx_type_id` (`type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mining Ledger table
CREATE TABLE IF NOT EXISTS `mining_ledger` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `corporation_id` BIGINT NOT NULL,
  `character_id` BIGINT NOT NULL,
  `date` DATE NOT NULL,
  `type_id` INT NOT NULL,
  `quantity` BIGINT NOT NULL,
  `solar_system_id` BIGINT NOT NULL,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_unique_entry` (`corporation_id`, `character_id`, `date`, `type_id`, `solar_system_id`),
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Container Logs table
CREATE TABLE IF NOT EXISTS `container_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `corporation_id` BIGINT NOT NULL,
  `logged_at` DATETIME NOT NULL,
  `character_id` BIGINT NOT NULL,
  `container_id` BIGINT NOT NULL,
  `container_type_id` INT NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `location_id` BIGINT NOT NULL,
  `type_id` INT NOT NULL,
  `quantity` BIGINT NOT NULL,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_logged_at` (`logged_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Killmails table
CREATE TABLE IF NOT EXISTS `killmails` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `killmail_id` BIGINT NOT NULL UNIQUE,
  `killmail_hash` VARCHAR(255),
  `killmail_time` DATETIME NOT NULL,
  `solar_system_id` BIGINT NOT NULL,
  `victim_character_id` BIGINT,
  `victim_corporation_id` BIGINT,
  `victim_alliance_id` BIGINT,
  `victim_ship_type_id` INT NOT NULL,
  `victim_damage_taken` BIGINT NOT NULL,
  `total_value` DECIMAL(20,2),
  `is_npc_kill` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_solo_kill` BOOLEAN NOT NULL DEFAULT FALSE,
  `attacker_count` INT NOT NULL DEFAULT 0,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_killmail_time` (`killmail_time`),
  INDEX `idx_solar_system_id` (`solar_system_id`),
  INDEX `idx_victim_corporation_id` (`victim_corporation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Income Records table
CREATE TABLE IF NOT EXISTS `income_records` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `corporation_id` BIGINT NOT NULL,
  `character_id` BIGINT,
  `income_type` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(20,2) NOT NULL,
  `tax_amount` DECIMAL(20,2) DEFAULT 0.0,
  `date` DATETIME NOT NULL,
  `description` TEXT,
  `transaction_id` BIGINT,
  `reference_id` BIGINT,
  `source` VARCHAR(100),
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_corporation_id` (`corporation_id`),
  INDEX `idx_character_id` (`character_id`),
  INDEX `idx_income_type` (`income_type`),
  INDEX `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SCHEMA_EOF

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ LMeve schema created successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Schema creation had issues, but database may still be usable${NC}"
fi

# Step 5: Download and Import SDE (if requested)
if [[ "$DOWNLOAD_SDE" =~ ^[Yy]$ ]]; then
    print_step "Downloading EVE Static Data (SQLite Format)"
    
    # Install sqlite3 if not present
    if ! command_exists sqlite3; then
        echo -e "${CYAN}Installing SQLite3...${NC}"
        apt install -y sqlite3
    fi
    
    # Use SQLite dump from Fuzzwork (most reliable)
    SDE_URL="https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2"
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    echo -e "${CYAN}Downloading from: $SDE_URL${NC}"
    echo -e "${CYAN}This may take several minutes...${NC}\n"
    
    if wget --show-progress "$SDE_URL" -O eve.db.bz2 2>&1; then
        echo -e "\n${GREEN}✅ SDE download completed${NC}"
        
        print_step "Extracting SDE Data"
        if bunzip2 eve.db.bz2; then
            echo -e "${GREEN}✅ Extraction completed${NC}"
            
            print_step "Converting SQLite to MySQL and Importing"
            echo -e "${CYAN}This will take 10-15 minutes...${NC}\n"
            
            # Get list of tables from SQLite
            TABLES=$(sqlite3 eve.db "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null)
            
            TABLE_COUNT=0
            FAILED_TABLES=""
            
            for table in $TABLES; do
                echo -e "${CYAN}Processing table: $table${NC}"
                
                # Get CREATE TABLE statement from SQLite
                SCHEMA=$(sqlite3 eve.db ".schema $table" 2>/dev/null)
                
                # Convert SQLite types to MySQL types
                MYSQL_SCHEMA=$(echo "$SCHEMA" | \
                    sed 's/INTEGER PRIMARY KEY AUTOINCREMENT/INT AUTO_INCREMENT PRIMARY KEY/g' | \
                    sed 's/INTEGER PRIMARY KEY/INT PRIMARY KEY/g' | \
                    sed 's/INTEGER/INT/g' | \
                    sed 's/REAL/DOUBLE/g' | \
                    sed 's/TEXT/LONGTEXT/g' | \
                    sed 's/BLOB/LONGBLOB/g')
                
                # Create table in MySQL
                echo "$MYSQL_SCHEMA" | mysql -u "$LMEVE_USER" -p"$LMEVE_PASS" -h "$DB_HOST" -P "$DB_PORT" ${SDE_DB} 2>/dev/null
                
                if [[ $? -ne 0 ]]; then
                    echo -e "${YELLOW}  ⚠ Failed to create table${NC}"
                    FAILED_TABLES="${FAILED_TABLES}\n  - $table (schema)"
                    continue
                fi
                
                # Export data as CSV and import
                sqlite3 -csv -header eve.db "SELECT * FROM \`$table\`;" > "${table}.csv" 2>/dev/null
                
                if [[ -s "${table}.csv" ]] && [[ $(wc -l < "${table}.csv") -gt 1 ]]; then
                    # Get column names
                    COLUMNS=$(head -n 1 "${table}.csv")
                    
                    # Remove header from CSV
                    tail -n +2 "${table}.csv" > "${table}_data.csv"
                    
                    # Import CSV into MySQL using mysqlimport or LOAD DATA
                    mysql -u "$LMEVE_USER" -p"$LMEVE_PASS" -h "$DB_HOST" -P "$DB_PORT" --local-infile=1 ${SDE_DB} << MYSQL_EOF 2>/dev/null
LOAD DATA LOCAL INFILE '${TEMP_DIR}/${table}_data.csv'
INTO TABLE \`$table\`
FIELDS TERMINATED BY ','
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n';
MYSQL_EOF
                    
                    if [[ $? -eq 0 ]]; then
                        TABLE_COUNT=$((TABLE_COUNT + 1))
                        echo -e "${GREEN}  ✓ Imported successfully${NC}"
                    else
                        echo -e "${YELLOW}  ⚠ Data import failed, trying alternative method${NC}"
                        # Try INSERT method as fallback
                        while IFS=, read -r line; do
                            mysql -u "$LMEVE_USER" -p"$LMEVE_PASS" -h "$DB_HOST" -P "$DB_PORT" ${SDE_DB} -e "INSERT INTO \`$table\` VALUES ($line);" 2>/dev/null
                        done < "${table}_data.csv"
                        
                        if [[ $? -eq 0 ]]; then
                            TABLE_COUNT=$((TABLE_COUNT + 1))
                            echo -e "${GREEN}  ✓ Imported via INSERT method${NC}"
                        else
                            FAILED_TABLES="${FAILED_TABLES}\n  - $table (data)"
                        fi
                    fi
                else
                    echo -e "${YELLOW}  ⚠ No data to import${NC}"
                fi
                
                rm -f "${table}.csv" "${table}_data.csv"
            done
            
            echo ""
            if [[ $TABLE_COUNT -gt 0 ]]; then
                echo -e "${GREEN}✅ SDE data imported successfully (${TABLE_COUNT} tables)${NC}"
                if [[ -n "$FAILED_TABLES" ]]; then
                    echo -e "${YELLOW}Failed tables:${NC}"
                    echo -e "${YELLOW}${FAILED_TABLES}${NC}"
                fi
            else
                echo -e "${RED}❌ No tables were imported${NC}"
                echo -e "${CYAN}You can manually import SDE data later${NC}"
            fi
        else
            echo -e "${RED}❌ SDE extraction failed${NC}"
            echo -e "${CYAN}You can manually import SDE data later${NC}"
        fi
    else
        echo -e "${RED}❌ SDE download failed${NC}"
        echo -e "${CYAN}You can manually import SDE data later${NC}"
    fi
    
    # Cleanup
    cd - >/dev/null
    rm -rf "$TEMP_DIR"
else
    echo -e "${CYAN}Skipping SDE download as requested${NC}"
    echo -e "${CYAN}You can import SDE data manually later${NC}"
fi

# Step 6: Verification
print_step "Verifying Installation"
if mysql -u "$LMEVE_USER" -p"$LMEVE_PASS" -h "$DB_HOST" -P "$DB_PORT" -e "USE ${LMEVE_DB}; USE ${SDE_DB}; SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Database verification successful${NC}"
else
    echo -e "${RED}❌ Database verification failed${NC}"
fi

# Get table counts
LMEVE_TABLES=$(mysql -u "$LMEVE_USER" -p"$LMEVE_PASS" -h "$DB_HOST" -P "$DB_PORT" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${LMEVE_DB}';" 2>/dev/null || echo "0")
SDE_TABLES=$(mysql -u "$LMEVE_USER" -p"$LMEVE_PASS" -h "$DB_HOST" -P "$DB_PORT" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${SDE_DB}';" 2>/dev/null || echo "0")

# Success Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║   🎉 LMeve Database Server Setup Complete! 🎉             ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}Installation Summary:${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "  OS: ${YELLOW}$PRETTY_NAME${NC}"
if [[ -n "$DB_TYPE" ]]; then
    echo -e "  Database: ${YELLOW}$DB_TYPE${NC}"
fi
echo -e "  Host: ${YELLOW}$DB_HOST:$DB_PORT${NC}"
echo -e "  Username: ${YELLOW}$LMEVE_USER${NC}"
echo -e "  Password: ${YELLOW}$LMEVE_PASS${NC}"
echo -e "  LMeve DB: ${YELLOW}${LMEVE_DB}${NC} ($LMEVE_TABLES tables)"
echo -e "  SDE DB: ${YELLOW}${SDE_DB}${NC} ($SDE_TABLES tables)"
if [[ "$INSTALL_WEBMIN" =~ ^[Yy]$ ]]; then
    echo -e "  Webmin: ${YELLOW}https://$(hostname -I | awk '{print $1}'):10000${NC}"
fi
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Use these database settings in your LMeve web application"
echo -e "  2. Configure your LMeve instance to connect to this database"
if [[ "$INSTALL_WEBMIN" =~ ^[Yy]$ ]]; then
    echo -e "  3. Manage your database via Webmin at port 10000"
fi
echo ""
echo -e "${BLUE}Connection Test:${NC}"
echo -e "  Run this command to test the connection:"
echo -e "  ${CYAN}mysql -h $DB_HOST -P $DB_PORT -u $LMEVE_USER -p'$LMEVE_PASS' -e \"USE ${LMEVE_DB}; SHOW TABLES;\"${NC}"
echo ""
if [[ $SDE_TABLES -eq 0 ]]; then
    echo -e "${YELLOW}📝 Note: SDE data was not imported.${NC}"
    echo -e "${YELLOW}   You can import it later from the LMeve web interface:${NC}"
    echo -e "${YELLOW}   Settings → Database → Update SDE${NC}"
    echo ""
fi
echo -e "${GREEN}Database server is ready for LMeve!${NC}"
echo ""
