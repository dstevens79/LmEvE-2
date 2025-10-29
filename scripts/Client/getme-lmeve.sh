#!/bin/bash
#
# LMeve "GetMe" Complete Setup Package
# This script does EVERYTHING needed to set up LMeve database
#
# Usage: ./getme-lmeve.sh
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration - These will be populated by the web interface
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-lmeve}"
MYSQL_ROOT_USER="${MYSQL_ROOT_USER:-root}"
MYSQL_ROOT_PASS="${MYSQL_ROOT_PASS:-}"
LMEVE_USER="${LMEVE_USER:-lmeve}"
LMEVE_PASS="${LMEVE_PASS:-}"
SDE_SOURCE="${SDE_SOURCE:-fuzzwork}"

# Database names
LMEVE_DB="lmeve"
SDE_DB="EveStaticData"

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${BLUE}INFO:${NC} $1"
}

success() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}SUCCESS:${NC} $1"
}

error() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${RED}ERROR:${NC} $1"
    exit 1
}

warn() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${YELLOW}WARN:${NC} $1"
}

# Banner
echo -e "${CYAN}"
echo "=========================================="
echo "      LMeve GetMe Setup Package"
echo "=========================================="
echo -e "${NC}"
echo "This script will:"
echo "  ✓ Create MySQL databases (lmeve, EveStaticData)"
echo "  ✓ Create MySQL user: $LMEVE_USER"
echo "  ✓ Import LMeve schema"
echo "  ✓ Download and import latest SDE data"
echo "  ✓ Verify everything works"
echo ""

# Show configuration
echo -e "${BLUE}Configuration:${NC}"
echo "  Database Host: $DB_HOST:$DB_PORT"
echo "  MySQL Root User: $MYSQL_ROOT_USER"
echo "  LMeve User: $LMEVE_USER"
echo "  SDE Source: $SDE_SOURCE"
echo ""

# Check if configuration is provided
if [ -z "$MYSQL_ROOT_PASS" ] || [ -z "$LMEVE_PASS" ]; then
    error "Configuration not set. This script should be generated from the LMeve web interface."
fi

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
mysql -u"$MYSQL_ROOT_USER" -p"$MYSQL_ROOT_PASS" -h"$DB_HOST" -P"$DB_PORT" <<EOF
CREATE DATABASE IF NOT EXISTS \`$LMEVE_DB\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS \`$SDE_DB\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF
success "Databases created: $LMEVE_DB, $SDE_DB"

# Step 3: Create user and grant privileges
log "Creating user '$LMEVE_USER' and setting permissions..."
mysql -u"$MYSQL_ROOT_USER" -p"$MYSQL_ROOT_PASS" -h"$DB_HOST" -P"$DB_PORT" <<EOF
-- Drop existing users to ensure clean state
DROP USER IF EXISTS '$LMEVE_USER'@'%';
DROP USER IF EXISTS '$LMEVE_USER'@'localhost';

-- Create users (compatible with MySQL 8+)
CREATE USER '$LMEVE_USER'@'%' IDENTIFIED WITH mysql_native_password BY '$LMEVE_PASS';
CREATE USER '$LMEVE_USER'@'localhost' IDENTIFIED WITH mysql_native_password BY '$LMEVE_PASS';

-- Grant privileges on both databases
GRANT ALL PRIVILEGES ON \`$LMEVE_DB\`.* TO '$LMEVE_USER'@'%';
GRANT ALL PRIVILEGES ON \`$LMEVE_DB\`.* TO '$LMEVE_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`$SDE_DB\`.* TO '$LMEVE_USER'@'%';
GRANT ALL PRIVILEGES ON \`$SDE_DB\`.* TO '$LMEVE_USER'@'localhost';

FLUSH PRIVILEGES;
EOF
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
    
    # Download SDE
    log "Downloading SDE database (this may take several minutes)..."
    if ! wget -q --show-progress "https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2"; then
        warn "Failed to download SDE data from Fuzzwork, trying alternative..."
        if ! wget -q --show-progress "https://www.fuzzwork.co.uk/dump/mysql-latest.tar.bz2"; then
            error "Failed to download SDE data from all sources"
        fi
        
        log "Extracting MySQL SDE data..."
        if ! tar -xjf mysql-latest.tar.bz2; then
            error "Failed to extract SDE data"
        fi
        
        # Find the SQL file
        SDE_SQL_FILE=$(find . -name "*.sql" -type f | head -n 1)
        if [ -z "$SDE_SQL_FILE" ]; then
            error "No SQL file found in SDE archive"
        fi
        
        log "Importing SDE data from $SDE_SQL_FILE into database..."
        if mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" "$SDE_DB" < "$SDE_SQL_FILE"; then
            success "SDE data imported successfully"
        else
            error "Failed to import SDE data"
        fi
    else
        log "Extracting SDE data..."
        if ! bunzip2 eve.db.bz2; then
            error "Failed to extract SDE data"
        fi
        
        log "Importing SDE data into database..."
        if mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" "$SDE_DB" < eve.db; then
            success "SDE data imported successfully"
        else
            error "Failed to import SDE data"
        fi
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
echo -e "${GREEN}=========================================="
echo "    🎉 SETUP COMPLETED SUCCESSFULLY!"
echo "==========================================${NC}"
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

exit 0