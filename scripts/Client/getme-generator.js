/**
 * GetMe Package Generator - Node.js Version  
 * Generates the complete "GetMe" package for database setup
 */

/**
 * Generates the complete GetMe package based on user configuration
 */
export function generateGetMePackage(config, schemaSQL) {
  const timestamp = new Date().toISOString();
  
  // Main setup script
  const mainScript = `#!/bin/bash
#
# LMeve "GetMe" Complete Setup Package  
# Generated: ${timestamp}
# This script does EVERYTHING needed to set up LMeve database
#
# Usage: sudo ./getme-lmeve.sh
#

set -euo pipefail

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
CYAN='\\033[0;36m'
NC='\\033[0m' # No Color

# Configuration
DB_HOST="${config.host || 'localhost'}"
DB_PORT="${config.port || '3306'}"
MYSQL_ROOT_PASS="${config.sudoPassword || 'root_password'}"
LMEVE_USER="${config.username || 'lmeve'}"
LMEVE_PASS="${config.password || 'lmeve_password'}"
SDE_URL="${config.sdeSource || 'https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2'}"

echo -e "\\n\${CYAN}🚀 LMeve Database Setup - GetMe Package\${NC}"
echo -e "\${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\${NC}"
echo -e "Target: \${YELLOW}\$DB_HOST:\$DB_PORT\${NC}"
echo -e "User: \${YELLOW}\$LMEVE_USER\${NC}"
echo ""

# Function to print step headers
print_step() {
    echo -e "\\n\${BLUE}▶ \$1\${NC}"
    echo -e "\${BLUE}────────────────────────────────────────────────────────────────\${NC}"
}

# Function to check if MySQL is accessible
check_mysql() {
    if mysql -u root -p"\$MYSQL_ROOT_PASS" -h "\$DB_HOST" -P "\$DB_PORT" -e "SELECT 1;" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Step 1: Test MySQL Connection
print_step "Testing MySQL Connection"
if check_mysql; then
    echo -e "\${GREEN}✅ MySQL connection successful\${NC}"
else
    echo -e "\${RED}❌ Cannot connect to MySQL\${NC}"
    echo "Please check:"
    echo "  - MySQL is running on \$DB_HOST:\$DB_PORT"
    echo "  - Root password is correct: [hidden]"
    echo "  - Network connectivity"
    exit 1
fi

# Step 2: Create Databases
print_step "Creating Databases"
mysql -u root -p"\$MYSQL_ROOT_PASS" -h "\$DB_HOST" -P "\$DB_PORT" << 'EOF'
CREATE DATABASE IF NOT EXISTS lmeve;
CREATE DATABASE IF NOT EXISTS EveStaticData;
EOF

if [ \$? -eq 0 ]; then
    echo -e "\${GREEN}✅ Databases created: lmeve, EveStaticData\${NC}"
else
    echo -e "\${RED}❌ Failed to create databases\${NC}"
    exit 1
fi

# Step 3: Create User
print_step "Creating MySQL User"
mysql -u root -p"\$MYSQL_ROOT_PASS" -h "\$DB_HOST" -P "\$DB_PORT" << EOF
DROP USER IF EXISTS '\$LMEVE_USER'@'%';
CREATE USER '\$LMEVE_USER'@'%' IDENTIFIED BY '\$LMEVE_PASS';
GRANT ALL PRIVILEGES ON lmeve.* TO '\$LMEVE_USER'@'%';
GRANT ALL PRIVILEGES ON EveStaticData.* TO '\$LMEVE_USER'@'%';
FLUSH PRIVILEGES;
EOF

if [ \$? -eq 0 ]; then
    echo -e "\${GREEN}✅ User '\$LMEVE_USER' created with full permissions\${NC}"
else
    echo -e "\${RED}❌ Failed to create user\${NC}"
    exit 1
fi

# Step 4: Import Schema (if available)
print_step "Importing LMeve Schema"
if [ -f "lmeve-schema.sql" ]; then
    if mysql -u "\$LMEVE_USER" -p"\$LMEVE_PASS" -h "\$DB_HOST" -P "\$DB_PORT" lmeve < lmeve-schema.sql; then
        echo -e "\${GREEN}✅ Schema imported successfully\${NC}"
    else
        echo -e "\${YELLOW}⚠️  Schema import had issues, but continuing...\${NC}"
    fi
else
    echo -e "\${YELLOW}⚠️  No lmeve-schema.sql found, skipping schema import\${NC}"
    echo "   You'll need to import your schema manually later"
fi

# Step 5: Download SDE
print_step "Downloading EVE Static Data"
echo "Downloading from: \$SDE_URL"

if wget -O eve.db.bz2 "\$SDE_URL"; then
    echo -e "\${GREEN}✅ SDE download completed\${NC}"
else
    echo -e "\${RED}❌ SDE download failed\${NC}"
    echo "Continuing anyway - you can import SDE manually later"
fi

# Step 6: Import SDE
if [ -f "eve.db.bz2" ]; then
    print_step "Importing EVE Static Data"
    echo "Extracting archive..."
    
    if bunzip2 eve.db.bz2; then
        echo -e "\${GREEN}✅ Archive extracted\${NC}"
        
        echo "Importing into EveStaticData database..."
        if mysql -u "\$LMEVE_USER" -p"\$LMEVE_PASS" -h "\$DB_HOST" -P "\$DB_PORT" EveStaticData < eve.db; then
            echo -e "\${GREEN}✅ SDE data imported successfully\${NC}"
            rm -f eve.db  # Clean up
        else
            echo -e "\${YELLOW}⚠️  SDE import had issues, but database is still usable\${NC}"
        fi
    else
        echo -e "\${YELLOW}⚠️  Could not extract SDE archive\${NC}"
    fi
fi

# Step 7: Verification
print_step "Verifying Installation"

echo -n "Testing lmeve database connection: "
if mysql -u"\$LMEVE_USER" -p"\$LMEVE_PASS" -h"\$DB_HOST" -P"\$DB_PORT" -e "USE lmeve; SELECT 1;" >/dev/null 2>&1; then
    echo -e "\${GREEN}✅ OK\${NC}"
else
    echo -e "\${RED}❌ FAILED\${NC}"
fi

echo -n "Testing EveStaticData database connection: "
if mysql -u"\$LMEVE_USER" -p"\$LMEVE_PASS" -h"\$DB_HOST" -P"\$DB_PORT" -e "USE EveStaticData; SELECT 1;" >/dev/null 2>&1; then
    echo -e "\${GREEN}✅ OK\${NC}"
else
    echo -e "\${RED}❌ FAILED\${NC}"
fi

echo -n "Checking SDE data: "
if mysql -u"\$LMEVE_USER" -p"\$LMEVE_PASS" -h"\$DB_HOST" -P"\$DB_PORT" -e "SELECT COUNT(*) FROM EveStaticData.invTypes LIMIT 1;" >/dev/null 2>&1; then
    echo -e "\${GREEN}✅ OK\${NC}"
else
    echo -e "\${YELLOW}⚠️  SDE data may not be imported\${NC}"
fi

# Success Summary
echo ""
echo -e "\${GREEN}🎉 LMeve Database Setup Complete!\${NC}"
echo -e "\${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\${NC}"
echo ""
echo "Database connection details for LMeve:"
echo -e "  Host: \${YELLOW}\$DB_HOST\${NC}"
echo -e "  Port: \${YELLOW}\$DB_PORT\${NC}"
echo -e "  Username: \${YELLOW}\$LMEVE_USER\${NC}"
echo -e "  Password: \${YELLOW}[configured]\${NC}"
echo -e "  Database: \${YELLOW}lmeve\${NC}"
echo ""
echo "Use these settings in your LMeve web application configuration."
echo ""`;

  // Verification script
  const verifyScript = `#!/bin/bash
#
# LMeve Database Verification Script
# Tests that the GetMe setup worked correctly
#

set -euo pipefail

# Colors
GREEN='\\033[0;32m'
RED='\\033[0;31m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

# Configuration (should match your setup)
DB_HOST="${config.host || 'localhost'}"
DB_PORT="${config.port || '3306'}"
LMEVE_USER="${config.username || 'lmeve'}"
LMEVE_PASS="${config.password || 'lmeve_password'}"

echo "🔍 Verifying LMeve Database Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test database connections
echo -n "✓ lmeve database connection: "
if mysql -u"\$LMEVE_USER" -p"\$LMEVE_PASS" -h"\$DB_HOST" -P"\$DB_PORT" -e "USE lmeve; SELECT 1;" >/dev/null 2>&1; then
    echo -e "\${GREEN}OK\${NC}"
else
    echo -e "\${RED}FAILED\${NC}"
fi

echo -n "✓ EveStaticData database connection: "
if mysql -u"\$LMEVE_USER" -p"\$LMEVE_PASS" -h"\$DB_HOST" -P"\$DB_PORT" -e "USE EveStaticData; SELECT 1;" >/dev/null 2>&1; then
    echo -e "\${GREEN}OK\${NC}"
else
    echo -e "\${RED}FAILED\${NC}"
fi

echo -n "✓ SDE data present: "
if mysql -u"\$LMEVE_USER" -p"\$LMEVE_PASS" -h"\$DB_HOST" -P"\$DB_PORT" -e "SELECT COUNT(*) FROM EveStaticData.invTypes LIMIT 1;" >/dev/null 2>&1; then
    echo -e "\${GREEN}OK\${NC}"
else
    echo -e "\${YELLOW}No SDE data found\${NC}"
fi

echo ""
echo "Database Details:"
echo "  Host: \$DB_HOST"
echo "  Port: \$DB_PORT"
echo "  Username: \$LMEVE_USER"
echo "  Databases: lmeve, EveStaticData"
echo ""`;

  // README text
  const readmeText = `LMeve GetMe Setup Package
========================

Generated: ${timestamp}

This package contains everything needed to set up your LMeve database server.

Configuration Used:
------------------
Database Host: ${config.host || 'localhost'}:${config.port || '3306'}
MySQL Root User: ${config.sudoUsername || 'root'}
LMeve User: ${config.username || 'lmeve'}
SDE Source: ${config.sdeSource || 'https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2'}

QUICK START:
-----------
1. Upload this entire package to your database server
2. Make the script executable: chmod +x getme-lmeve.sh
3. Run: sudo ./getme-lmeve.sh

That's it! The script will automatically:
✓ Create databases (lmeve, EveStaticData)
✓ Create user: ${config.username || 'lmeve'}
✓ Import LMeve schema (if present)
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

VERIFICATION:
------------
After running the setup script, you can verify everything works by:
1. Running: ./verify-setup.sh
2. Or manually testing the database connection
3. Check that both databases have tables

Generated by LMeve Database Setup Tool`;

  return {
    mainScript,
    schemaSQL: schemaSQL || '-- Schema placeholder',
    readmeText,
    verifyScript
  };
}