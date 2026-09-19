#!/bin/bash
# scripts/import-sde.sh
# Downloads and imports the EVE Static Data Export (SDE) from Fuzzwork into MySQL.
# Reads connection parameters from environment variables:
#   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, SDE_DB (default: EveStaticData)
# Writes progress output to stdout (redirected to a log file by the caller).

set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
SDE_DB="${SDE_DB:-EveStaticData}"
# DB_PASSWORD is read from environment

echo "=== SDE Import Started: $(date) ==="
echo "Host: ${DB_HOST}:${DB_PORT}"
echo "User: ${DB_USER}"
echo "Target DB: ${SDE_DB}"

# Verify mysql client is available
if ! command -v mysql >/dev/null 2>&1; then
    echo "ERROR: mysql client not found in PATH"
    exit 1
fi

# Build auth args
AUTH_ARGS=(-u "${DB_USER}" -h "${DB_HOST}" -P "${DB_PORT}")
if [ -n "${DB_PASSWORD:-}" ]; then
    AUTH_ARGS+=(-p"${DB_PASSWORD}")
fi

# Ensure target database exists
echo "Creating database ${SDE_DB} if not exists..."
mysql "${AUTH_ARGS[@]}" -e "CREATE DATABASE IF NOT EXISTS \`${SDE_DB}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "Database ready."

# Download SDE dump from Fuzzwork
SDE_URL="https://www.fuzzwork.co.uk/dump/mysql-latest.tar.bz2"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "${TEMP_DIR}"' EXIT
cd "${TEMP_DIR}"

echo "Downloading from: ${SDE_URL}"
echo "This may take several minutes..."
if ! wget --show-progress="${SDE_URL}" -O mysql-latest.tar.bz2 2>&1; then
    echo "ERROR: SDE download failed"
    exit 1
fi
echo "Download complete."

# Extract .sql files (strip directory structure)
echo "Extracting SDE archive..."
if ! tar -xjf mysql-latest.tar.bz2 --wildcards --no-anchored '*.sql' --strip-components=1; then
    echo "ERROR: SDE extraction failed"
    exit 1
fi

# Find the SQL file
SQL_FILE=$(find . -maxdepth 1 -name "*.sql" -type f | head -n 1)
if [ -z "${SQL_FILE}" ]; then
    echo "ERROR: No .sql file found in archive"
    echo "Archive contents:"
    ls -lah
    exit 1
fi

echo "Found SQL file: $(basename "${SQL_FILE}")"

# Import into the target database
echo "Importing SDE into ${SDE_DB}..."
echo "This may take several minutes..."
if command -v pv >/dev/null 2>&1; then
    if pv -pteb "${SQL_FILE}" | mysql "${AUTH_ARGS[@]}" "${SDE_DB}"; then
        echo "SDE import completed successfully."
    else
        echo "ERROR: SDE import failed"
        exit 1
    fi
else
    echo "Importing (pv not installed)..."
    if mysql "${AUTH_ARGS[@]}" "${SDE_DB}" < "${SQL_FILE}"; then
        echo "SDE import completed successfully."
    else
        echo "ERROR: SDE import failed"
        exit 1
    fi
fi

echo "=== SDE Import Completed: $(date) ==="
