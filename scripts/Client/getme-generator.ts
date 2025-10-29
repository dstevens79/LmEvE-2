/**
 * GetMe Package Generator for React Component
 * This generates the complete "GetMe" package from the React interface
 */

export interface GetMeConfig {
  host: string;
  port: string;
  database: string;
  sudoUsername: string;
  sudoPassword: string;
  username: string;
  password: string;
  sdeSource: string;
}

export interface GetMePackage {
  mainScript: string;
  schemaSQL: string;
  readmeText: string;
  verifyScript: string;
}

/**
 * Simple template function to avoid escaping issues
 */
function createBashScript(config: GetMeConfig): string {
  const timestamp = new Date().toISOString();
  
  // Use a simple template approach instead of complex escaping
  return `#!/bin/bash
#
# LMeve "GetMe" Complete Setup Package
# Generated: ${timestamp}
# This script does EVERYTHING needed to set up LMeve database
#
# Usage: ./getme-lmeve.sh
#

set -euo pipefail

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
CYAN='\\033[0;36m'
NC='\\033[0m' # No Color

# Configuration from your web interface
DB_HOST="${config.host}"
DB_PORT="${config.port}"
DB_NAME="${config.database}"
MYSQL_ROOT_USER="${config.sudoUsername}"
MYSQL_ROOT_PASS="${config.sudoPassword}"
LMEVE_USER="${config.username}"
LMEVE_PASS="${config.password}"
SDE_SOURCE="${config.sdeSource}"

# Database names
LMEVE_DB="lmeve"
SDE_DB="EveStaticData"

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] \${BLUE}INFO:\${NC} $1"
}

success() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] \${GREEN}SUCCESS:\${NC} $1"
}

error() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] \${RED}ERROR:\${NC} $1"
    exit 1
}

warn() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] \${YELLOW}WARN:\${NC} $1"
}

# Banner
echo -e "\${CYAN}"
echo "=========================================="
echo "      LMeve GetMe Setup Package"
echo "=========================================="
echo -e "\${NC}"
echo "This script will:"
echo "  ✓ Create MySQL databases (lmeve, EveStaticData)"
echo "  ✓ Create MySQL user: $LMEVE_USER"
echo "  ✓ Import LMeve schema"
echo "  ✓ Download and import latest SDE data"
echo "  ✓ Verify everything works"
echo ""

# Show configuration
echo -e "\${BLUE}Configuration:\${NC}"
echo "  Database Host: $DB_HOST:$DB_PORT"
echo "  MySQL Root User: $MYSQL_ROOT_USER"
echo "  LMeve User: $LMEVE_USER"
echo "  SDE Source: $SDE_SOURCE"
echo ""

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    log "Running as root user"
elif sudo -n true 2>/dev/null; then
    log "Sudo access available"
else
    error "This script requires sudo access. Run with: sudo ./getme-lmeve.sh"
fi

# Step 1: Test MySQL connectivity
log "Testing MySQL connectivity as $MYSQL_ROOT_USER..."
if ! mysql -u"$MYSQL_ROOT_USER" -p"$MYSQL_ROOT_PASS" -h"$DB_HOST" -P"$DB_PORT" -e "SELECT 1;" >/dev/null 2>&1; then
    error "Cannot connect to MySQL as $MYSQL_ROOT_USER on $DB_HOST:$DB_PORT. Check your connection details and root password."
fi
success "MySQL connection successful"

# Step 2: Create databases
log "Creating databases..."
mysql -u"$MYSQL_ROOT_USER" -p"$MYSQL_ROOT_PASS" -h"$DB_HOST" -P"$DB_PORT" <<'DBCREATE_EOF'
CREATE DATABASE IF NOT EXISTS \`lmeve\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS \`EveStaticData\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DBCREATE_EOF
success "Databases created: $LMEVE_DB, $SDE_DB"

# Step 3: Create user and grant privileges
log "Creating user '$LMEVE_USER' and setting permissions..."
mysql -u"$MYSQL_ROOT_USER" -p"$MYSQL_ROOT_PASS" -h"$DB_HOST" -P"$DB_PORT" <<USERCREATE_EOF
-- Drop existing users to ensure clean state
DROP USER IF EXISTS '$LMEVE_USER'@'%';
DROP USER IF EXISTS '$LMEVE_USER'@'localhost';

-- Create users (compatible with MySQL 8+)
CREATE USER '$LMEVE_USER'@'%' IDENTIFIED WITH mysql_native_password BY '$LMEVE_PASS';
CREATE USER '$LMEVE_USER'@'localhost' IDENTIFIED WITH mysql_native_password BY '$LMEVE_PASS';

-- Grant privileges on both databases
GRANT ALL PRIVILEGES ON \`lmeve\`.* TO '$LMEVE_USER'@'%';
GRANT ALL PRIVILEGES ON \`lmeve\`.* TO '$LMEVE_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`EveStaticData\`.* TO '$LMEVE_USER'@'%';
GRANT ALL PRIVILEGES ON \`EveStaticData\`.* TO '$LMEVE_USER'@'localhost';

FLUSH PRIVILEGES;
USERCREATE_EOF
success "User '$LMEVE_USER' created with full privileges"

# Step 4: Import LMeve schema
log "Importing LMeve database schema..."
if [ -f "./lmeve-schema.sql" ]; then
    mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" "$LMEVE_DB" < "./lmeve-schema.sql"
    success "LMeve schema imported successfully"
else
    warn "lmeve-schema.sql not found in current directory, skipping schema import"
    warn "Make sure to import the schema manually later"
fi

# Step 5: Download and import SDE data
if [ "$SDE_SOURCE" = "fuzzwork" ]; then
    log "Downloading latest SDE data from Fuzzwork..."
    
    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    # Download SDE - try multiple sources
    log "Downloading SDE database (this may take several minutes)..."
    if wget -q --show-progress "https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2"; then
        log "Extracting SDE data..."
        if bunzip2 eve.db.bz2; then
            log "Importing SDE data into database..."
            if mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" "$SDE_DB" < eve.db; then
                success "SDE data imported successfully"
            else
                error "Failed to import SDE data"
            fi
        else
            error "Failed to extract SDE data"
        fi
    elif wget -q --show-progress "https://www.fuzzwork.co.uk/dump/mysql-latest.tar.bz2"; then
        log "Extracting MySQL SDE data..."
        if tar -xjf mysql-latest.tar.bz2; then
            # Find the SQL file
            SDE_SQL_FILE=$(find . -name "*.sql" -type f | head -n 1)
            if [ -n "$SDE_SQL_FILE" ]; then
                log "Importing SDE data from $SDE_SQL_FILE into database..."
                if mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" "$SDE_DB" < "$SDE_SQL_FILE"; then
                    success "SDE data imported successfully"
                else
                    error "Failed to import SDE data"
                fi
            else
                error "No SQL file found in SDE archive"
            fi
        else
            error "Failed to extract SDE data"
        fi
    else
        error "Failed to download SDE data from all sources"
    fi
    
    # Cleanup
    cd - >/dev/null
    rm -rf "$TEMP_DIR"
    
else
    warn "Custom SDE source specified but not implemented in this package"
    warn "You will need to import SDE data manually"
fi

# Step 6: Verify setup
log "Verifying database setup..."

# Check user exists
USER_COUNT=$(mysql -u"$MYSQL_ROOT_USER" -p"$MYSQL_ROOT_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT COUNT(*) FROM mysql.user WHERE user='$LMEVE_USER';")
if [ "$USER_COUNT" -lt 1 ]; then
    error "User $LMEVE_USER was not created properly"
fi
success "Found $USER_COUNT user entries for $LMEVE_USER"

# Test connection as lmeve user
if mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -e "USE $LMEVE_DB; SELECT 1;" >/dev/null 2>&1; then
    success "LMeve user can access $LMEVE_DB database"
else
    error "LMeve user cannot access $LMEVE_DB database"
fi

if mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -e "USE $SDE_DB; SELECT 1;" >/dev/null 2>&1; then
    success "LMeve user can access $SDE_DB database"
else
    error "LMeve user cannot access $SDE_DB database"
fi

# Check table counts
LMEVE_TABLES=$(mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$LMEVE_DB';" 2>/dev/null || echo "0")
SDE_TABLES=$(mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$SDE_DB';" 2>/dev/null || echo "0")

log "Database table counts:"
log "  $LMEVE_DB: $LMEVE_TABLES tables"
log "  $SDE_DB: $SDE_TABLES tables"

# Final summary
echo ""
echo -e "\${GREEN}=========================================="
echo "    🎉 SETUP COMPLETED SUCCESSFULLY!"
echo "==========================================\${NC}"
echo ""
echo "📋 Setup Summary:"
echo "   Database Host: $DB_HOST:$DB_PORT"
echo "   LMeve Database: $LMEVE_DB ($LMEVE_TABLES tables)"
echo "   SDE Database: $SDE_DB ($SDE_TABLES tables)"  
echo "   LMeve User: $LMEVE_USER"
echo "   Password: [hidden]"
echo ""
echo "✨ Your LMeve database is ready!"
echo "   Configure your LMeve application with these settings."
echo ""
echo "📝 Connection String:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT" 
echo "   Username: $LMEVE_USER"
echo "   Password: [your configured password]"
echo "   Database: $LMEVE_DB"
echo ""

exit 0`;
}

/**
 * Generates the complete GetMe package based on user configuration
 */
export function generateGetMePackage(config: GetMeConfig, schemaSQL: string): GetMePackage {
  const timestamp = new Date().toISOString();
  
  const mainScript = `#!/bin/bash
#
# LMeve "GetMe" Complete Setup Package
# Generated: ${timestamp}
# This script does EVERYTHING needed to set up LMeve database
#
# Usage: ./getme-lmeve.sh
#

set -euo pipefail

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
CYAN='\\033[0;36m'
NC='\\033[0m' # No Color

# Configuration from your web interface
DB_HOST="${config.host}"
DB_PORT="${config.port}"
DB_NAME="${config.database}"
MYSQL_ROOT_USER="${config.sudoUsername}"
MYSQL_ROOT_PASS="${config.sudoPassword}"
LMEVE_USER="${config.username}"
LMEVE_PASS="${config.password}"
SDE_SOURCE="${config.sdeSource}"

# Database names
LMEVE_DB="lmeve"
SDE_DB="EveStaticData"

log() {
    echo -e "[\\$(date '+%Y-%m-%d %H:%M:%S')] \\${BLUE}INFO:\\${NC} \\$1"
}

success() {
    echo -e "[\\$(date '+%Y-%m-%d %H:%M:%S')] \\${GREEN}SUCCESS:\\${NC} \\$1"
}

error() {
    echo -e "[\\$(date '+%Y-%m-%d %H:%M:%S')] \\${RED}ERROR:\\${NC} \\$1"
    exit 1
}

warn() {
    echo -e "[\\$(date '+%Y-%m-%d %H:%M:%S')] \\${YELLOW}WARN:\\${NC} \\$1"
}

# Banner
echo -e "\\${CYAN}"
echo "=========================================="
echo "      LMeve GetMe Setup Package"
echo "=========================================="
echo -e "\\${NC}"
echo "This script will:"
echo "  ✓ Create MySQL databases (lmeve, EveStaticData)"
echo "  ✓ Create MySQL user: \\$LMEVE_USER"
echo "  ✓ Import LMeve schema"
echo "  ✓ Download and import latest SDE data"
echo "  ✓ Verify everything works"
echo ""

# Show configuration
echo -e "\\${BLUE}Configuration:\\${NC}"
echo "  Database Host: \\$DB_HOST:\\$DB_PORT"
echo "  MySQL Root User: \\$MYSQL_ROOT_USER"
echo "  LMeve User: \\$LMEVE_USER"
echo "  SDE Source: \\$SDE_SOURCE"
echo ""

# Check if running as root or with sudo
if [[ \\$EUID -eq 0 ]]; then
    log "Running as root user"
elif sudo -n true 2>/dev/null; then
    log "Sudo access available"
else
    error "This script requires sudo access. Run with: sudo ./getme-lmeve.sh"
fi

# Step 1: Test MySQL connectivity
log "Testing MySQL connectivity as \\$MYSQL_ROOT_USER..."
if ! mysql -u"\\$MYSQL_ROOT_USER" -p"\\$MYSQL_ROOT_PASS" -h"\\$DB_HOST" -P"\\$DB_PORT" -e "SELECT 1;" >/dev/null 2>&1; then
    error "Cannot connect to MySQL as \\$MYSQL_ROOT_USER on \\$DB_HOST:\\$DB_PORT. Check your connection details and root password."
fi
success "MySQL connection successful"

# Step 2: Create databases
log "Creating databases..."
mysql -u"\\$MYSQL_ROOT_USER" -p"\\$MYSQL_ROOT_PASS" -h"\\$DB_HOST" -P"\\$DB_PORT" <<EOF
CREATE DATABASE IF NOT EXISTS \\\\\\`\\$LMEVE_DB\\\\\\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS \\\\\\`\\$SDE_DB\\\\\\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF
success "Databases created: \\$LMEVE_DB, \\$SDE_DB"

# Step 3: Create user and grant privileges
log "Creating user '\\$LMEVE_USER' and setting permissions..."
mysql -u"\\$MYSQL_ROOT_USER" -p"\\$MYSQL_ROOT_PASS" -h"\\$DB_HOST" -P"\\$DB_PORT" <<EOF
-- Drop existing users to ensure clean state
DROP USER IF EXISTS '\\$LMEVE_USER'@'%';
DROP USER IF EXISTS '\\$LMEVE_USER'@'localhost';

-- Create users (compatible with MySQL 8+)
CREATE USER '\\$LMEVE_USER'@'%' IDENTIFIED WITH mysql_native_password BY '\\$LMEVE_PASS';
CREATE USER '\\$LMEVE_USER'@'localhost' IDENTIFIED WITH mysql_native_password BY '\\$LMEVE_PASS';

-- Grant privileges on both databases
GRANT ALL PRIVILEGES ON \\\\\\`\\$LMEVE_DB\\\\\\`.* TO '\\$LMEVE_USER'@'%';
GRANT ALL PRIVILEGES ON \\\\\\`\\$LMEVE_DB\\\\\\`.* TO '\\$LMEVE_USER'@'localhost';
GRANT ALL PRIVILEGES ON \\\\\\`\\$SDE_DB\\\\\\`.* TO '\\$LMEVE_USER'@'%';
GRANT ALL PRIVILEGES ON \\\\\\`\\$SDE_DB\\\\\\`.* TO '\\$LMEVE_USER'@'localhost';

FLUSH PRIVILEGES;
EOF
success "User '\\$LMEVE_USER' created with full privileges"

# Step 4: Import LMeve schema
log "Importing LMeve database schema..."
if [ -f "./lmeve-schema.sql" ]; then
    mysql -u"\\$LMEVE_USER" -p"\\$LMEVE_PASS" -h"\\$DB_HOST" -P"\\$DB_PORT" "\\$LMEVE_DB" < "./lmeve-schema.sql"
    success "LMeve schema imported successfully"
else
    warn "lmeve-schema.sql not found in current directory, skipping schema import"
    warn "Make sure to import the schema manually later"
fi

# Step 5: Download and import SDE data
if [ "\\$SDE_SOURCE" = "fuzzwork" ]; then
    log "Downloading latest SDE data from Fuzzwork..."
    
    # Create temp directory
    TEMP_DIR=\\$(mktemp -d)
    cd "\\$TEMP_DIR"
    
    # Download SDE - try multiple sources
    log "Downloading SDE database (this may take several minutes)..."
    if wget -q --show-progress "https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2"; then
        log "Extracting SDE data..."
        if bunzip2 eve.db.bz2; then
            log "Importing SDE data into database..."
            if mysql -u"\\$LMEVE_USER" -p"\\$LMEVE_PASS" -h"\\$DB_HOST" -P"\\$DB_PORT" "\\$SDE_DB" < eve.db; then
                success "SDE data imported successfully"
            else
                error "Failed to import SDE data"
            fi
        else
            error "Failed to extract SDE data"
        fi
    elif wget -q --show-progress "https://www.fuzzwork.co.uk/dump/mysql-latest.tar.bz2"; then
        log "Extracting MySQL SDE data..."
        if tar -xjf mysql-latest.tar.bz2; then
            # Find the SQL file
            SDE_SQL_FILE=\\$(find . -name "*.sql" -type f | head -n 1)
            if [ -n "\\$SDE_SQL_FILE" ]; then
                log "Importing SDE data from \\$SDE_SQL_FILE into database..."
                if mysql -u"\\$LMEVE_USER" -p"\\$LMEVE_PASS" -h"\\$DB_HOST" -P"\\$DB_PORT" "\\$SDE_DB" < "\\$SDE_SQL_FILE"; then
                    success "SDE data imported successfully"
                else
                    error "Failed to import SDE data"
                fi
            else
                error "No SQL file found in SDE archive"
            fi
        else
            error "Failed to extract SDE data"
        fi
    else
        error "Failed to download SDE data from all sources"
    fi
    
    # Cleanup
    cd - >/dev/null
    rm -rf "\\$TEMP_DIR"
    
else
    warn "Custom SDE source specified but not implemented in this package"
    warn "You will need to import SDE data manually"
fi

# Step 6: Verify setup
log "Verifying database setup..."

# Check user exists
USER_COUNT=\\$(mysql -u"\\$MYSQL_ROOT_USER" -p"\\$MYSQL_ROOT_PASS" -h"\\$DB_HOST" -P"\\$DB_PORT" -sN -e "SELECT COUNT(*) FROM mysql.user WHERE user='\\$LMEVE_USER';")
if [ "\\$USER_COUNT" -lt 1 ]; then
    error "User \\$LMEVE_USER was not created properly"
fi
success "Found \\$USER_COUNT user entries for \\$LMEVE_USER"

# Test connection as lmeve user
if mysql -u"\\$LMEVE_USER" -p"\\$LMEVE_PASS" -h"\\$DB_HOST" -P"\\$DB_PORT" -e "USE \\$LMEVE_DB; SELECT 1;" >/dev/null 2>&1; then
    success "LMeve user can access \\$LMEVE_DB database"
else
    error "LMeve user cannot access \\$LMEVE_DB database"
fi

if mysql -u"\\$LMEVE_USER" -p"\\$LMEVE_PASS" -h"\\$DB_HOST" -P"\\$DB_PORT" -e "USE \\$SDE_DB; SELECT 1;" >/dev/null 2>&1; then
    success "LMeve user can access \\$SDE_DB database"
else
    error "LMeve user cannot access \\$SDE_DB database"
fi

# Check table counts
LMEVE_TABLES=\\$(mysql -u"\\$LMEVE_USER" -p"\\$LMEVE_PASS" -h"\\$DB_HOST" -P"\\$DB_PORT" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='\\$LMEVE_DB';" 2>/dev/null || echo "0")
SDE_TABLES=\\$(mysql -u"\\$LMEVE_USER" -p"\\$LMEVE_PASS" -h"\\$DB_HOST" -P"\\$DB_PORT" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='\\$SDE_DB';" 2>/dev/null || echo "0")

log "Database table counts:"
log "  \\$LMEVE_DB: \\$LMEVE_TABLES tables"
log "  \\$SDE_DB: \\$SDE_TABLES tables"

# Final summary
echo ""
echo -e "\\${GREEN}=========================================="
echo "    🎉 SETUP COMPLETED SUCCESSFULLY!"
echo "==========================================\\${NC}"
echo ""
echo "📋 Setup Summary:"
echo "   Database Host: \\$DB_HOST:\\$DB_PORT"
echo "   LMeve Database: \\$LMEVE_DB (\\$LMEVE_TABLES tables)"
echo "   SDE Database: \\$SDE_DB (\\$SDE_TABLES tables)"  
echo "   LMeve User: \\$LMEVE_USER"
echo "   Password: [hidden]"
echo ""
echo "✨ Your LMeve database is ready!"
echo "   Configure your LMeve application with these settings."
echo ""
echo "📝 Connection String:"
echo "   Host: \\$DB_HOST"
echo "   Port: \\$DB_PORT" 
echo "   Username: \\$LMEVE_USER"
echo "   Password: [your configured password]"
echo "   Database: \\$LMEVE_DB"
echo ""

exit 0`;

  const verifyScript = `#!/bin/bash
#
# LMeve Setup Verification Script
# Generated: ${timestamp}
# Run this to verify your database setup is working
#

DB_HOST="${config.host}"
DB_PORT="${config.port}"
LMEVE_USER="${config.username}"
LMEVE_PASS="${config.password}"

echo "Verifying LMeve database setup..."
echo "=================================="
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $LMEVE_USER"
echo ""

# Test lmeve database
echo -n "Testing lmeve database access... "
if mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -e "USE lmeve; SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='lmeve';" >/dev/null 2>&1; then
    LMEVE_TABLES=$(mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='lmeve';" 2>/dev/null || echo "0")
    echo "✓ OK ($LMEVE_TABLES tables)"
else
    echo "✗ FAILED"
fi

# Test SDE database
echo -n "Testing EveStaticData database access... "
if mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -e "USE EveStaticData; SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='EveStaticData';" >/dev/null 2>&1; then
    SDE_TABLES=$(mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='EveStaticData';" 2>/dev/null || echo "0")
    echo "✓ OK ($SDE_TABLES tables)"
else
    echo "✗ FAILED"
fi

# Test specific SDE tables
echo -n "Testing key SDE tables... "
if mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -e "SELECT COUNT(*) FROM EveStaticData.invTypes LIMIT 1;" >/dev/null 2>&1; then
    echo "✓ OK"
else
    echo "✗ FAILED (SDE data may not be imported)"
fi

echo ""
echo "Database connection string for LMeve:"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "Username: $LMEVE_USER"
echo "Password: [hidden]"
echo "Database: lmeve"
echo ""
echo "If all tests show ✓ OK, your database is ready!"`;

  const readmeText = `LMeve GetMe Setup Package
========================

Generated: ${timestamp}

Configuration:
  Database Host: ${config.host}:${config.port}  
  MySQL Root User: ${config.sudoUsername}
  LMeve User: ${config.username}
  SDE Source: ${config.sdeSource}

QUICK START:
-----------
1. Upload this entire folder to your database server
2. Make the script executable: chmod +x getme-lmeve.sh
3. Run: sudo ./getme-lmeve.sh

That's it! The script will:
✓ Create databases (lmeve, EveStaticData)
✓ Create user: ${config.username}  
✓ Import LMeve schema
✓ Download and import latest SDE data
✓ Verify everything works

PACKAGE CONTENTS:
----------------
- getme-lmeve.sh     : Main setup script (run this!)
- lmeve-schema.sql   : LMeve database schema
- verify-setup.sh    : Verification script (optional)
- README.txt         : This file

REQUIREMENTS:
------------
- MySQL/MariaDB server running
- Root/admin access to MySQL
- Internet connection (for SDE download)
- Sufficient disk space (~500MB for SDE data)
- Linux/Unix environment with bash

TROUBLESHOOTING:
---------------
- Make sure MySQL is running and accessible
- Verify the root password is correct
- Check firewall settings if connecting to remote MySQL
- Ensure sufficient disk space for SDE data
- Run verify-setup.sh to test the installation

MANUAL STEPS (if automated script fails):
----------------------------------------
1. Create databases:
   CREATE DATABASE lmeve;
   CREATE DATABASE EveStaticData;

2. Create user:
   CREATE USER '${config.username}'@'%' IDENTIFIED BY '[password]';
   GRANT ALL ON lmeve.* TO '${config.username}'@'%';
   GRANT ALL ON EveStaticData.* TO '${config.username}'@'%';

3. Import schema:
   mysql -u ${config.username} -p lmeve < lmeve-schema.sql

4. Download and import SDE:
   wget https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2
   bunzip2 eve.db.bz2
   mysql -u ${config.username} -p EveStaticData < eve.db

VERIFICATION:
------------
After running the setup script, you can verify everything works by:
1. Running: ./verify-setup.sh
2. Or manually testing the database connection
3. Check that both databases have tables

SUPPORT:
-------
- Check the LMeve documentation
- Verify your MySQL configuration  
- Test network connectivity to database server
- Ensure all passwords are correct

Generated by LMeve Database Setup Tool
Visit: https://github.com/dstevens79/LmEvE-2`;

  return {
    mainScript,
    schemaSQL,
    readmeText, 
    verifyScript
  };
}

/**
 * Creates a downloadable ZIP package with all files
 */
export async function createGetMeZipPackage(config: GetMeConfig, schemaSQL: string): Promise<Blob> {
  // This would require jszip library
  // For now, return a combined script as text
  const packageData = generateGetMePackage(config, schemaSQL);
  
  // Create a simple combined package for download
  const combined = `#!/bin/bash
# LMeve GetMe Package - Combined Script
# Extract the individual files from this script

echo "Extracting LMeve GetMe Package..."

# Create package directory
mkdir -p lmeve-getme-package
cd lmeve-getme-package

# Extract main script
cat > getme-lmeve.sh << 'MAIN_SCRIPT_EOF'
${packageData.mainScript}
MAIN_SCRIPT_EOF

# Extract schema
cat > lmeve-schema.sql << 'SCHEMA_EOF'
${packageData.schemaSQL}
SCHEMA_EOF

# Extract verify script
cat > verify-setup.sh << 'VERIFY_SCRIPT_EOF'
${packageData.verifyScript}
VERIFY_SCRIPT_EOF

# Extract README
cat > README.txt << 'README_EOF'
${packageData.readmeText}
README_EOF

# Make scripts executable
chmod +x getme-lmeve.sh verify-setup.sh

echo "Package extracted to: lmeve-getme-package/"
echo ""
echo "To use:"
echo "  cd lmeve-getme-package"
echo "  sudo ./getme-lmeve.sh"
echo ""
`;

  return new Blob([combined], { type: 'text/plain' });
}