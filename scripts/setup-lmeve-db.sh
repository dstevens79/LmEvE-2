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

# Configure custom port if not default
if [ "$DB_PORT" != "3306" ]; then
    print_step "Configuring Custom Database Port"
    echo -e "${CYAN}Configuring $DB_TYPE to listen on port ${DB_PORT}...${NC}"
    
    # Determine config file location
    if [[ "$DB_TYPE" == "MySQL" ]]; then
        MYSQL_CNF="/etc/mysql/mysql.conf.d/mysqld.cnf"
    else
        MYSQL_CNF="/etc/mysql/mariadb.conf.d/50-server.cnf"
    fi
    
    # Backup config
    cp "$MYSQL_CNF" "${MYSQL_CNF}.backup"
    
    # Update port in config
    if grep -q "^port" "$MYSQL_CNF"; then
        sed -i "s/^port.*/port = ${DB_PORT}/" "$MYSQL_CNF"
    else
        # Add port line after [mysqld] section
        sed -i "/^\[mysqld\]/a port = ${DB_PORT}" "$MYSQL_CNF"
    fi
    
    # Restart database service
    systemctl restart ${DB_SERVICE}
    
    echo -e "${GREEN}✅ $DB_TYPE configured for port ${DB_PORT}${NC}"
    echo -e "${YELLOW}Note: Clients must connect using port ${DB_PORT}${NC}"
fi

# Step 5: Webmin Installation (Optional)
print_step "Webmin Installation (Optional)"

# Check if Webmin is already installed
WEBMIN_INSTALLED=false
if command_exists webmin || dpkg -l | grep -q "^ii  webmin "; then
    WEBMIN_INSTALLED=true
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
read -p "Download and import SDE? [Y/n]: " DOWNLOAD_SDE
DOWNLOAD_SDE=${DOWNLOAD_SDE:-Y}

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

# Step 5: Download and Import SDE (if requested)
if [[ "$DOWNLOAD_SDE" =~ ^[Yy]$ ]]; then
    print_step "Downloading EVE Static Data"
    
    SDE_URL="https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2"
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    echo -e "${CYAN}Downloading from: $SDE_URL${NC}"
    echo -e "${CYAN}This may take several minutes...${NC}\n"
    
    if wget --show-progress "$SDE_URL" -O eve.db.bz2; then
        echo -e "\n${GREEN}✅ SDE download completed${NC}"
        
        print_step "Extracting SDE Data"
        if bunzip2 eve.db.bz2; then
            echo -e "${GREEN}✅ Extraction completed${NC}"
            
            print_step "Importing EVE Static Data"
            echo -e "${CYAN}This may take several minutes...${NC}\n"
            
            if mysql -u "$LMEVE_USER" -p"$LMEVE_PASS" -h "$DB_HOST" -P "$DB_PORT" ${SDE_DB} < eve.db 2>/dev/null; then
                echo -e "${GREEN}✅ SDE data imported successfully${NC}"
            else
                echo -e "${YELLOW}⚠️  SDE import had issues, but database is still usable${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  SDE extraction failed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  SDE download failed, continuing anyway${NC}"
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
echo -e "  Password: ${YELLOW}[configured]${NC}"
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
echo -e "${GREEN}Database server is ready for LMeve!${NC}"
echo ""
