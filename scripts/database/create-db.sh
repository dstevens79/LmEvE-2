#!/bin/bash
#
# LMeve Database Creation Script
# This script creates the required databases and user for LMeve
# Must be run with sudo privileges on the database host
#
# Usage: sudo ./create-db.sh [mysql_root_password] [lmeve_user_password] [lmeve_username]
#

set -euo pipefail

# Configuration - now accepts username as third parameter
MYSQL_ROOT_PASS="${1:-}"
LMEVE_PASS="${2:-lmpassword}"
LMEVE_USER="${3:-lmeve}"   # default to 'lmeve' if not supplied
LMEVE_DB="lmeve"
SDE_DB="EveStaticData"

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
    error_exit "This script must be run with sudo (root privileges)"
fi

log "Starting LMeve database creation..."
log "Using database user: $LMEVE_USER"

# Test MySQL connectivity as root
log "Testing MySQL connectivity..."
if ! sudo mysql -e "SELECT 1;" >/dev/null 2>&1; then
    error_exit "Cannot connect to MySQL as root. Ensure MySQL is running."
fi
log "MySQL connection successful"

# Create databases
log "Creating databases..."
sudo mysql <<EOF
CREATE DATABASE IF NOT EXISTS \`$LMEVE_DB\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS \`$SDE_DB\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF
log "Databases created successfully"

# Create user and grant privileges
log "Creating user '$LMEVE_USER' and setting permissions..."
sudo mysql <<EOF
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
log "User created and privileges granted successfully"

# Verify user creation
log "Verifying user exists in mysql.user table..."
USER_CHECK=$(sudo mysql -sN -e "SELECT COUNT(*) FROM mysql.user WHERE user='$LMEVE_USER';")
if [ "$USER_CHECK" -lt 1 ]; then
    error_exit "User $LMEVE_USER was not created properly"
fi
log "Found $USER_CHECK user entries for $LMEVE_USER"

# Verify access with new user
log "Verifying database connection as '$LMEVE_USER'..."
if ! mysql -u "$LMEVE_USER" -p"$LMEVE_PASS" -e "USE $LMEVE_DB; SELECT 1;" >/dev/null 2>&1; then
    error_exit "Cannot connect to $LMEVE_DB as $LMEVE_USER"
fi
if ! mysql -u "$LMEVE_USER" -p"$LMEVE_PASS" -e "USE $SDE_DB; SELECT 1;" >/dev/null 2>&1; then
    error_exit "Cannot connect to $SDE_DB as $LMEVE_USER"
fi

log "Database setup completed successfully!"
log "Created databases: $LMEVE_DB, $SDE_DB"
log "Created user: $LMEVE_USER with full access to both databases"
log "Next step: Import the LMeve schema and SDE data"

exit 0