#!/bin/bash
#
# LMeve Schema Import Script
# This script imports the LMeve application schema into the lmeve database
# Must be run with sudo privileges on the database host
#
# Usage: sudo ./import-schema.sh [schema_file_path] [mysql_root_password] [lmeve_user_password]
#

set -euo pipefail

# Configuration
SCHEMA_FILE="${1:-}"
MYSQL_ROOT_PASS="${2:-}"
LMEVE_PASS="${3:-lmpassword}"
LMEVE_USER="lmeve"
LMEVE_DB="lmeve"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error_exit "This script must be run as root (use sudo)"
fi

# Check if schema file is provided
if [ -z "$SCHEMA_FILE" ]; then
    error_exit "Usage: $0 <schema_file_path> [mysql_root_password] [lmeve_user_password]"
fi

log "Starting LMeve schema import..."
log "Schema file: $SCHEMA_FILE"

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    error_exit "Schema file not found: $SCHEMA_FILE"
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
if ! "${MYSQL_CMD[@]}" -e "USE $LMEVE_DB;" >/dev/null 2>&1; then
    error_exit "Database $LMEVE_DB does not exist. Please run create-db.sh first."
fi

# Import the schema
log "Importing LMeve schema..."
if ! "${MYSQL_CMD[@]}" "$LMEVE_DB" < "$SCHEMA_FILE"; then
    error_exit "Failed to import LMeve schema"
fi

log "Schema import completed successfully!"

# Verify import
log "Verifying schema import..."
TABLE_COUNT=$("${MYSQL_CMD[@]}" -s -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$LMEVE_DB';")
log "Created $TABLE_COUNT tables in $LMEVE_DB database"

if [ "$TABLE_COUNT" -eq 0 ]; then
    error_exit "Schema import verification failed - no tables found"
fi

# Test access with lmeve user
log "Testing lmeve user access..."
LMEVE_CMD=(mysql -u "$LMEVE_USER" -p"$LMEVE_PASS")
if ! "${LMEVE_CMD[@]}" -e "USE $LMEVE_DB; SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$LMEVE_DB';" >/dev/null 2>&1; then
    error_exit "LMeve user cannot access the lmeve database"
fi

log "LMeve schema import completed successfully!"
log "Database: $LMEVE_DB contains $TABLE_COUNT tables"
log "LMeve application is ready to use"

exit 0