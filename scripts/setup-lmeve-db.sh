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

# (Removed large banner to make room for a dynamic right-side panel and left pre-flight block)

# Utility: terminal width
term_cols() {
    if [ -n "$COLUMNS" ]; then echo "$COLUMNS"; return; fi
    if command -v tput >/dev/null 2>&1; then tput cols 2>/dev/null || echo 120; else echo 120; fi
}

# Right-side banner art (drawn with cursor positioning)
draw_right_panel() {
    local art=(
"┌────────────────────────────────────────────────────┐"
"│                                                    │"
"│   L      M   M  EEEEE  V   V  EEEEE        --      │"
"│   L      MM MM  E      V   V  E          /   |     │"
"│   L      M M M  EEEE    V V   EEEE   ==     /      │" 
"│   L      M   M  E        V    E           /        │"
"│   LLLLL  M   M  EEEEE    V    EEEEE      /____     │"
"│                                                    │"
"│                                                    │" 
"│          LmEvE v2 • Database Installer             │"
"│                                                    │"
"│  ⛭  1–7 edit fields   ↵  Enter to start  Q  quit   │"
"│                                                    │"
"└────────────────────────────────────────────────────┘"
    )
 
    local cols=$(term_cols)
    local art_width=52
    local art=(
    local start_col=$(( cols - art_width - margin ))
    if [ "$start_col" -lt 68 ]; then start_col=68; fi
"│     L      M   M  EEEEE  V   V  EEEEE        -  2222│"
"│     L      MM MM  E      V   V  E                 2 │"
"│     L      M M M  EEEE    V V   EEEE              2 │"
"│     L      M   M  E        V    E               2  2│"
"│     LLLLL  M   M  EEEEE    V    EEEEE          2222 │"
            tput cup $((start_row + i)) "$start_col" 2>/dev/null || true
            echo -e "${BLUE}${line}${NC}"
            i=$((i+1))
        done
    else
        local pad=""; local n=$start_col; while [ $n -gt 0 ]; do pad+=" "; n=$((n-1)); done
        for line in "${art[@]}"; do echo -e "${pad}${BLUE}${line}${NC}"; done
    fi
}

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

# -----------------------------------------------------
# Pre-flight dependency checks (read-only)
# -----------------------------------------------------
check_dep() {
    local name="$1"; shift
    local cmd="$1"; shift
    local ver_cmd="$1"; shift
    # Tight spacing to sit beside the right panel
    printf "checking dependency %-10s .. " "$name"
    if command -v "$cmd" >/dev/null 2>&1; then
        local ver
        if [ -n "$ver_cmd" ]; then
            ver=$(eval "$ver_cmd" 2>/dev/null | head -n1)
        fi
        case "$cmd" in
            curl)
                ver=$(echo "$ver" | awk '{print $1" "$2}')
                ;;
            wget)
                # Example: "GNU Wget 1.19.4 built on linux-gnu." -> "wget 1.19.4"
                ver=$(echo "$ver" | awk '{print "wget "$3}')
                ;;
            apache2)
                ver=$(echo "$ver" | sed 's/^Server version: //')
                ;;
            mysql)
                ver=$(echo "$ver" | awk '{print $1" "$2" "$3}')
                ;;
        esac
        echo -e "${GREEN}OK${NC}${ver:+ ($ver)}"
        return 0
    else
        echo -e "${YELLOW}MISSING${NC}"
        return 1
    fi
}

draw_preflight_header() {
    local title_left="${BLUE}LmEvE v2${NC}"
    local title_right="${GREEN}Pre-flight checks${NC}"
    local line_top="┌───────────────────────────────────────────────┐"
    local line_mid="│ ${title_left} , ${title_right} │"
    local line_bot="└───────────────────────────────────────────────┘"
    echo -e "${BLUE}${line_top}${NC}"
    echo -e "${line_mid}"
    echo -e "${BLUE}${line_bot}${NC}"
}

draw_preflight() {
    draw_preflight_header
    local MISSING_DEPS=0
    check_dep "curl"    curl   "curl --version"         || MISSING_DEPS=$((MISSING_DEPS+1))
    check_dep "wget"    wget   "wget --version"         || MISSING_DEPS=$((MISSING_DEPS+1))
    check_dep "bzip2"   bzip2  "bzip2 --version"        || MISSING_DEPS=$((MISSING_DEPS+1))
    check_dep "git"     git    "git --version"          || MISSING_DEPS=$((MISSING_DEPS+1))
    check_dep "ufw"     ufw    "ufw --version"          || true
    check_dep "mysql"   mysql  "mysql --version"        || true

    if [ "$MISSING_DEPS" -gt 0 ]; then
        echo -e "${YELLOW}Some components are missing and will be installed.${NC}"
    else
        echo -e "${GREEN}All required dependencies are present.${NC}"
    fi
}

# -----------------------------------------------------
# Upfront configuration menu (static redraw)
#  - Number press on Yes/No or 2-choice fields toggles immediately
#  - Number press on text fields prompts for new text
#  - Enter on an empty line starts installation; Q quits
# -----------------------------------------------------
DB_PORT=3306
CONFIG_FIREWALL=N
DB_CHOICE=1       # 1=MySQL, 2=MariaDB
REMOVE_EXISTING=N
INSTALL_WEBMIN=N 
DOWNLOAD_SDE=N

draw_menu() {
    clear 2>/dev/null || tput clear 2>/dev/null || true
    # Right-side panel first
    draw_right_panel
    # Move cursor back to top-left then draw pre-flight
    if command -v tput >/dev/null 2>&1; then tput cup 0 0 2>/dev/null || true; fi
    draw_preflight
    echo ""
    echo ""
    echo -e "${BLUE}Installer Options (press 1-6 to edit, Enter=Start, Q=Quit)${NC}"
    echo ""
    printf "  1) Database server        : %s\n" "$([[ "$DB_CHOICE" -eq 2 ]] && echo MariaDB || echo MySQL)"
    printf "  2) Database port          : %s\n" "$DB_PORT"
    printf "  3) Configure UFW firewall : %s\n" "$([[ "$CONFIG_FIREWALL" =~ ^[Yy]$ ]] && echo Yes || echo No)"
    printf "  4) Remove existing DB     : %s\n" "$([[ "$REMOVE_EXISTING" =~ ^[Yy]$ ]] && echo Yes || echo No)"
    printf "  5) Install Webmin         : %s\n" "$([[ "$INSTALL_WEBMIN" =~ ^[Yy]$ ]] && echo Yes || echo No)"
    printf "  6) Download & import SDE  : %s\n" "$([[ "$DOWNLOAD_SDE" =~ ^[Yy]$ ]] && echo Yes || echo No)"
    echo ""
}

while true; do
    draw_menu
    read -r -p "Select [1-6], Enter=Start, Q=Quit: " choice || true; echo ""
    choice_clean="${choice//[[:space:]]/}"
    if [ -z "$choice_clean" ]; then
        break
    fi
    case "${choice_clean^^}" in
        1)
            # Toggle MySQL/MariaDB
            if [ "$DB_CHOICE" -eq 1 ]; then DB_CHOICE=2; else DB_CHOICE=1; fi
            ;;
        2)
            read -r -p "Enter database port [${DB_PORT}]: " dp
            dp=${dp:-$DB_PORT}
            if [[ "$dp" =~ ^[0-9]{2,5}$ ]]; then DB_PORT=$dp; else echo -e "${YELLOW}Invalid port. Keeping ${DB_PORT}.${NC}"; sleep 1; fi
            ;;
        3)
            if [[ "$CONFIG_FIREWALL" =~ ^[Yy]$ ]]; then CONFIG_FIREWALL=N; else CONFIG_FIREWALL=Y; fi
            ;;
        4)
            if [[ "$REMOVE_EXISTING" =~ ^[Yy]$ ]]; then REMOVE_EXISTING=N; else REMOVE_EXISTING=Y; fi
            ;;
        5)
            if [[ "$INSTALL_WEBMIN" =~ ^[Yy]$ ]]; then INSTALL_WEBMIN=N; else INSTALL_WEBMIN=Y; fi
            ;;
        6)
            if [[ "$DOWNLOAD_SDE" =~ ^[Yy]$ ]]; then DOWNLOAD_SDE=N; else DOWNLOAD_SDE=Y; fi
            ;;
        Q)
            echo "Exiting installer."
            exit 0
            ;;
        *)
            ;;
    esac
done

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
if [[ "$CONFIG_FIREWALL" =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}Configuring UFW...${NC}"
    ufw allow OpenSSH
    ufw allow ${DB_PORT}/tcp
    echo "y" | ufw enable
    ufw status
    echo -e "${GREEN}✅ Firewall configured${NC}"
    echo -e "${CYAN}Allowed: SSH (22), MySQL/MariaDB (${DB_PORT})${NC}"
else
    echo -e "${YELLOW}Skipping firewall configuration${NC}"
fi

# Step 4: Database Server Selection
print_step "Database Server Selection"

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
if command_exists webmin || dpkg -l | grep -q "^ii  webmin "; then
    WEBMIN_INSTALLED=true
    INSTALL_WEBMIN=Y  # reflect installed status in summary
    echo -e "${GREEN}✅ Webmin is already installed${NC}"
    echo -e "${CYAN}Access Webmin at: https://$(hostname -I | awk '{print $1}'):10000${NC}"
else
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

# Get server's IP address for self-connections
SERVER_IP=$(hostname -I | awk '{print $1}')
echo -e "${CYAN}Server IP detected: ${SERVER_IP}${NC}"
echo -e "${CYAN}Creating user for: %, localhost, and ${SERVER_IP}${NC}"

mysql -u root -p"$MYSQL_ROOT_PASS" -h "$DB_HOST" -P "$DB_PORT" << SQLEOF
DROP USER IF EXISTS '${LMEVE_USER}'@'%';
DROP USER IF EXISTS '${LMEVE_USER}'@'localhost';
DROP USER IF EXISTS '${LMEVE_USER}'@'${SERVER_IP}';

CREATE USER '${LMEVE_USER}'@'%' IDENTIFIED WITH mysql_native_password BY '${LMEVE_PASS}';
CREATE USER '${LMEVE_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${LMEVE_PASS}';
CREATE USER '${LMEVE_USER}'@'${SERVER_IP}' IDENTIFIED WITH mysql_native_password BY '${LMEVE_PASS}';

GRANT ALL PRIVILEGES ON ${LMEVE_DB}.* TO '${LMEVE_USER}'@'%';
GRANT ALL PRIVILEGES ON ${LMEVE_DB}.* TO '${LMEVE_USER}'@'localhost';
GRANT ALL PRIVILEGES ON ${LMEVE_DB}.* TO '${LMEVE_USER}'@'${SERVER_IP}';

GRANT ALL PRIVILEGES ON ${SDE_DB}.* TO '${LMEVE_USER}'@'%';
GRANT ALL PRIVILEGES ON ${SDE_DB}.* TO '${LMEVE_USER}'@'localhost';
GRANT ALL PRIVILEGES ON ${SDE_DB}.* TO '${LMEVE_USER}'@'${SERVER_IP}';

FLUSH PRIVILEGES;
SQLEOF

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ User '$LMEVE_USER' created for:${NC}"
    echo -e "   ${GREEN}• Any host (%)${NC}"
    echo -e "   ${GREEN}• Localhost${NC}"
    echo -e "   ${GREEN}• Server IP (${SERVER_IP})${NC}"
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

# Create default admin user if not present (password will be upgraded to bcrypt on first login)
print_step "Creating default admin user (if missing)"
mysql -u "$LMEVE_USER" -p"$LMEVE_PASS" -h "$DB_HOST" -P "$DB_PORT" ${LMEVE_DB} << 'ADMIN_EOF'
INSERT INTO users (username, password, role, auth_method, is_active, created_date, updated_date)
SELECT 'admin', '12345', 'super_admin', 'manual', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username='admin');
ADMIN_EOF
echo -e "${GREEN}✅ Ensured default admin user exists (username: admin)${NC}"

# Step 5: Download and Import SDE (if requested)
if [[ "$DOWNLOAD_SDE" =~ ^[Yy]$ ]]; then
    print_step "Downloading EVE Static Data (MySQL Format)"
    
    # Use MySQL dump from Fuzzwork (original LMeve method)
    SDE_URL="https://www.fuzzwork.co.uk/dump/mysql-latest.tar.bz2"
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    echo -e "${CYAN}Downloading from: $SDE_URL${NC}"
    echo -e "${CYAN}This may take several minutes...${NC}\n"
    
    if wget --show-progress "$SDE_URL" -O mysql-latest.tar.bz2 2>&1; then
        echo -e "\n${GREEN}✅ SDE download completed${NC}"
        
        print_step "Extracting SDE Data"
        # Extract only .sql files from the archive, stripping the directory structure
        if tar -xjf mysql-latest.tar.bz2 --wildcards --no-anchored '*.sql' --strip-components=1; then
            echo -e "${GREEN}✅ Extraction completed${NC}"
            
            # Find the SQL file (should be a single combined file)
            SQL_FILE=$(find . -maxdepth 1 -name "*.sql" -type f | head -n 1)
            
            if [[ -z "$SQL_FILE" ]]; then
                echo -e "${RED}❌ No .sql file found in archive${NC}"
                echo -e "${YELLOW}Contents:${NC}"
                ls -lah
            else
                echo -e "${CYAN}Found SQL file: $(basename $SQL_FILE)${NC}"
                
                print_step "Importing EVE Static Data"
                echo -e "${CYAN}This will take 10-15 minutes...${NC}"
                echo -e "${CYAN}Importing SDE into ${SDE_DB} database...${NC}\n"
                
                # Import the SQL file directly into MySQL
                if mysql -u "$LMEVE_USER" -p"$LMEVE_PASS" -h "$DB_HOST" -P "$DB_PORT" ${SDE_DB} < "$SQL_FILE" 2>&1 | tee import.log; then
                    echo -e "\n${GREEN}✅ SDE data imported successfully${NC}"
                else
                    echo -e "\n${YELLOW}⚠️  Import completed with warnings (check import.log)${NC}"
                    echo -e "${CYAN}This is usually normal - checking for errors...${NC}"
                    
                    # Check if there are actual errors (not just warnings)
                    if grep -i "ERROR" import.log > /dev/null 2>&1; then
                        echo -e "${RED}❌ Import had errors${NC}"
                        tail -20 import.log
                    else
                        echo -e "${GREEN}✅ Import successful (warnings are normal)${NC}"
                    fi
                fi
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
