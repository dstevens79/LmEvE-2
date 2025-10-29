#!/bin/bash
#
# LMeve Setup Verification Script
# Run this to verify your database setup is working
#

# Configuration - set these to match your setup
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
LMEVE_USER="${LMEVE_USER:-lmeve}"
LMEVE_PASS="${LMEVE_PASS:-}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "LMeve Database Setup Verification"
echo "================================="
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $LMEVE_USER"
echo ""

# Get password if not set
if [ -z "$LMEVE_PASS" ]; then
    echo "Enter LMeve database password:"
    read -s LMEVE_PASS
fi

# Test lmeve database
echo -n "Testing lmeve database access... "
if mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -e "USE lmeve; SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='lmeve';" >/dev/null 2>&1; then
    LMEVE_TABLES=$(mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='lmeve';" 2>/dev/null || echo "0")
    echo -e "${GREEN}✓ OK${NC} ($LMEVE_TABLES tables)"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Test SDE database
echo -n "Testing EveStaticData database access... "
if mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -e "USE EveStaticData; SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='EveStaticData';" >/dev/null 2>&1; then
    SDE_TABLES=$(mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='EveStaticData';" 2>/dev/null || echo "0")
    echo -e "${GREEN}✓ OK${NC} ($SDE_TABLES tables)"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Test specific SDE tables
echo -n "Testing key SDE tables... "
if mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -e "SELECT COUNT(*) FROM EveStaticData.invTypes LIMIT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${YELLOW}⚠ WARNING${NC} (SDE data may not be imported)"
fi

# Test some key LMeve tables if they exist
echo -n "Testing LMeve tables... "
if mysql -u"$LMEVE_USER" -p"$LMEVE_PASS" -h"$DB_HOST" -P"$DB_PORT" -e "SHOW TABLES FROM lmeve;" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${YELLOW}⚠ WARNING${NC} (LMeve schema may not be imported)"
fi

echo ""
echo "Database connection string for LMeve:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Username: $LMEVE_USER"
echo "  Password: [hidden]"
echo "  Database: lmeve"
echo ""

if [ "$LMEVE_TABLES" -gt 0 ] && [ "$SDE_TABLES" -gt 0 ]; then
    echo -e "${GREEN}✓ Database setup looks good!${NC}"
else
    echo -e "${YELLOW}⚠ Some issues detected. Check the setup script output.${NC}"
fi