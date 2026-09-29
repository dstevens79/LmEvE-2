#!/bin/bash
# Download the current Fuzzwork MySQL SDE and import it into EveStaticData.
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-lmeve}"
SDE_DB="${SDE_DB:-EveStaticData}"
SDE_URL="https://www.fuzzwork.co.uk/dump/latest-mysql.sql.gz"
TEMP_DIR=""

finish() {
    status=$?
    if [ -n "$TEMP_DIR" ]; then rm -rf "$TEMP_DIR"; fi
    if [ "$status" -eq 0 ]; then
        echo "SDE import completed successfully."
        echo "LMEVE_SDE_STATUS=success"
    else
        echo "SDE import failed (exit $status)."
        echo "LMEVE_SDE_STATUS=failed"
    fi
}
trap finish EXIT

for command_name in mysql wget gzip; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "ERROR: $command_name is not installed on the app server"
        exit 1
    fi
done

export MYSQL_PWD="${DB_PASSWORD:-}"
AUTH_ARGS=(-u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT")

echo "SDE import started for ${SDE_DB} on ${DB_HOST}:${DB_PORT} as ${DB_USER}"
if ! mysql "${AUTH_ARGS[@]}" "$SDE_DB" -e 'SELECT 1' >/dev/null; then
    echo "ERROR: Database user cannot connect to ${SDE_DB}"
    exit 1
fi

TEMP_DIR=$(mktemp -d)
ARCHIVE="$TEMP_DIR/latest-mysql.sql.gz"
echo "Downloading ${SDE_URL}"
if ! wget --quiet -O "$ARCHIVE" "$SDE_URL"; then
    echo "ERROR: SDE download failed"
    exit 1
fi
if ! gzip -t "$ARCHIVE"; then
    echo "ERROR: SDE download is not a valid gzip file"
    exit 1
fi

echo "Importing compressed MySQL dump into ${SDE_DB}"
gzip -dc "$ARCHIVE" | mysql "${AUTH_ARGS[@]}" "$SDE_DB"
