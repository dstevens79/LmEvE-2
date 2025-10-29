#!/bin/bash
#
# LMeve Database Creation Script
# Works on MySQL 8+ / Ubuntu / Debian with or without root password
# Usage: sudo ./create-db.sh [mysql_root_password] [lmeve_user_password]
#

set -euo pipefail

MYSQL_ROOT_PASS="${1:-}"
LMEVE_PASS="${2:-lmpassword}"
LMEVE_USER="lmeve"
LMEVE_DB="lmeve"
SDE_DB="EveStaticData"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }
error_exit() { log "ERROR: $1"; exit 1; }

# Ensure root
if [[ $EUID -ne 0 ]]; then
    error_exit "Must run as root (sudo)"
fi

log "Starting LMeve database creation..."

# Determine root connection method
if [ -n "$MYSQL_ROOT_PASS" ]; then
    MYSQL_CMD=(mysql -u root -p"$MYSQL_ROOT_PASS")
else
    MYSQL_CMD=(sudo mysql)
fi

# Test connection
if ! "${MYSQL_CMD[@]}" -e "SELECT 1;" >/dev/null 2>&1; then
    error_exit "Cannot connect to MySQL as root. Check MySQL service and credentials."
fi
log "MySQL connection OK"

# Create databases
log "Creating databases..."
"${MYSQL_CMD[@]}" <<EOF
CREATE DATABASE IF NOT EXISTS \`$LMEVE_DB\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS \`$SDE_DB\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF
log "Databases created"

# Drop user if exists to ensure clean slate
log "Dropping existing $LMEVE_USER user if exists..."
"${MYSQL_CMD[@]}" <<EOF
DROP USER IF EXISTS '$LMEVE_USER'@'%';
DROP USER IF EXISTS '$LMEVE_USER'@'localhost';
EOF

# Create user with mysql_native_password (ensures MySQL 8+ compatibility)
log "Creating user $LMEVE_USER..."
"${MYSQL_CMD[@]}" <<EOF
CREATE USER '$LMEVE_USER'@'%' IDENTIFIED WITH mysql_native_password BY '$LMEVE_PASS';
CREATE USER '$LMEVE_USER'@'localhost' IDENTIFIED WITH mysql_native_password BY '$LMEVE_PASS';
GRANT ALL PRIVILEGES ON \`$LMEVE_DB\`.* TO '$LMEVE_USER'@'%';
GRANT ALL PRIVILEGES ON \`$LMEVE_DB\`.* TO '$LMEVE_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`$SDE_DB\`.* TO '$LMEVE_USER'@'%';
GRANT ALL PRIVILEGES ON \`$SDE_DB\`.* TO '$LMEVE_USER'@'localhost';
FLUSH PRIVILEGES;
EOF
log "User created and permissions granted"

# Verify user exists
USER_COUNT=$("${MYSQL_CMD[@]}" -sN -e "SELECT COUNT(*) FROM mysql.user WHERE user='$LMEVE_USER';")
if [ "$USER_COUNT" -lt 1 ]; then
    error_exit "User $LMEVE_USER was not created"
fi
log "Verified $USER_COUNT user entries for $LMEVE_USER"

# Test connection as new user
LMEVE_CMD=(mysql -u "$LMEVE_USER" -p"$LMEVE_PASS")
for DB in "$LMEVE_DB" "$SDE_DB"; do
    if ! "${LMEVE_CMD[@]}" -e "USE $DB; SELECT 1;" >/dev/null 2>&1; then
        error_exit "User $LMEVE_USER cannot access $DB"
    fi
done

log "Database setup completed successfully!"
log "Created databases: $LMEVE_DB, $SDE_DB"
log "Created user: $LMEVE_USER"
log "Next step: Import the LMeve schema and SDE data"

exit 0
