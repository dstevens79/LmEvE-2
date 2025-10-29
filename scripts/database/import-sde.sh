#!/bin/bash
#
# LMeve SDE Import Script
# This script imports EVE Static Data Export (SDE) SQL dump into the database
# Must be run with sudo privileges on the database host
#
# Usage: sudo ./import-sde.sh [sde_file_path] [mysql_root_password] [lmeve_user_password] [lmeve_username]
#

set -euo pipefail

# Configuration
SDE_FILE="${1:-}"
MYSQL_ROOT_PASS="${2:-}"
LMEVE_PASS="${3:-lmpassword}"
LMEVE_USER="${4:-lmeve}"
SDE_DB="EveStaticData"
TEMP_DIR="/tmp/lmeve_sde"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2
}

# Error handling
error_exit() {
    log "ERROR: $1"
    cleanup
    exit 1
}

# Cleanup function
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        log "Cleaning up temporary directory..."
        rm -rf "$TEMP_DIR"
    fi
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error_exit "This script must be run as root (use sudo)"
fi

# Check if SDE file is provided
if [ -z "$SDE_FILE" ]; then
    error_exit "Usage: $0 <sde_file_path> [mysql_root_password] [lmeve_user_password] [lmeve_username]"
fi

log "Starting SDE import process..."
log "SDE file: $SDE_FILE"

# Check if SDE file exists
if [ ! -f "$SDE_FILE" ]; then
    error_exit "SDE file not found: $SDE_FILE"
fi

# Test MySQL connectivity - use array for safe password handling
log "Testing MySQL connectivity..."
MYSQL_CMD=(mysql -u root)
if [ -n "$MYSQL_ROOT_PASS" ]; then
    MYSQL_CMD+=(-p"$MYSQL_ROOT_PASS")
fi

if ! "${MYSQL_CMD[@]}" -e "SELECT 1;" >/dev/null 2>&1; then
    error_exit "Cannot connect to MySQL. Please check if MySQL is running and credentials are correct."
fi

log "MySQL connection successful"

# Check if database exists
if ! "${MYSQL_CMD[@]}" -e "USE $SDE_DB;" >/dev/null 2>&1; then
    error_exit "Database $SDE_DB does not exist. Please run create-db.sh first."
fi

# Create temporary directory
mkdir -p "$TEMP_DIR"
trap cleanup EXIT

# Handle different file types
FILE_EXT=$(echo "$SDE_FILE" | tr '[:upper:]' '[:lower:]')
SQL_FILE=""

if [[ "$FILE_EXT" == *.sql ]]; then
    log "SQL file detected, using directly"
    SQL_FILE="$SDE_FILE"
elif [[ "$FILE_EXT" == *.tar.bz2 ]]; then
    log "Tar.bz2 archive detected, extracting..."
    if ! tar -xjf "$SDE_FILE" -C "$TEMP_DIR" --wildcards --no-anchored '*.sql' --strip-components=1 2>/dev/null; then
        error_exit "Failed to extract SQL files from archive"
    fi
    
    # Find the main SQL file (usually largest or named sde.sql/staticdata.sql)
    SQL_FILE=$(find "$TEMP_DIR" -name "*.sql" -type f | head -1)
    if [ -z "$SQL_FILE" ]; then
        error_exit "No SQL file found in the archive"
    fi
    log "Found SQL file: $SQL_FILE"
elif [[ "$FILE_EXT" == *.tar.gz ]] || [[ "$FILE_EXT" == *.tgz ]]; then
    log "Tar.gz archive detected, extracting..."
    if ! tar -xzf "$SDE_FILE" -C "$TEMP_DIR" --wildcards --no-anchored '*.sql' --strip-components=1 2>/dev/null; then
        error_exit "Failed to extract SQL files from archive"
    fi
    
    SQL_FILE=$(find "$TEMP_DIR" -name "*.sql" -type f | head -1)
    if [ -z "$SQL_FILE" ]; then
        error_exit "No SQL file found in the archive"
    fi
    log "Found SQL file: $SQL_FILE"
else
    error_exit "Unsupported file format. Supported: .sql, .tar.bz2, .tar.gz"
fi

# Check SQL file size and warn if very large
FILE_SIZE=$(stat -f%z "$SQL_FILE" 2>/dev/null || stat -c%s "$SQL_FILE" 2>/dev/null || echo "0")
if [ "$FILE_SIZE" -gt 1073741824 ]; then  # 1GB
    log "WARNING: Large SQL file detected ($(( FILE_SIZE / 1024 / 1024 ))MB). This may take a while..."
fi

# Clear existing SDE data
log "Clearing existing SDE data..."
"${MYSQL_CMD[@]}" -e "DROP DATABASE IF EXISTS \`$SDE_DB\`; CREATE DATABASE \`$SDE_DB\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Grant permissions to lmeve user
log "Setting up permissions..."
"${MYSQL_CMD[@]}" <<EOF
GRANT ALL PRIVILEGES ON \`$SDE_DB\`.* TO '$LMEVE_USER'@'%';
GRANT ALL PRIVILEGES ON \`$SDE_DB\`.* TO '$LMEVE_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

# Import the SDE data
log "Starting SDE data import (this may take several minutes)..."
if ! "${MYSQL_CMD[@]}" "$SDE_DB" < "$SQL_FILE"; then
    error_exit "Failed to import SDE data"
fi

log "SDE data import completed successfully!"

# Verify import
log "Verifying import..."
TABLE_COUNT=$("${MYSQL_CMD[@]}" -s -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$SDE_DB';")
log "Imported $TABLE_COUNT tables into $SDE_DB database"

if [ "$TABLE_COUNT" -eq 0 ]; then
    error_exit "Import verification failed - no tables found"
fi

# Test access with lmeve user
log "Testing lmeve user access..."
LMEVE_CMD=(mysql -u "$LMEVE_USER" -p"$LMEVE_PASS")
if ! "${LMEVE_CMD[@]}" -e "USE $SDE_DB; SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$SDE_DB';" >/dev/null 2>&1; then
    error_exit "LMeve user cannot access the SDE database"
fi

log "SDE import process completed successfully!"
log "Database: $SDE_DB contains $TABLE_COUNT tables"
log "LMeve user has full access to the SDE data"

exit 0