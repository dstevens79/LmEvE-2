# LMeve GetMe Package - Browser-Based Database Setup

This directory contains the GetMe package system for automated LMeve database setup.

## Overview

The GetMe system provides a **browser-based** solution to generate and deploy database setup scripts. All configuration happens in the LMeve web interface, making it simple and user-friendly.

## How It Works

### From the LMeve Web App:

1. **Configure Settings** - Go to Settings → Database Setup tab
2. **Enter Database Details** - Host, port, username, password, sudo credentials
3. **Download Package** - Click "Download GetMe Package" button
4. **Transfer to Database Server** - See transfer guide for options
5. **Run Script** - Execute with sudo on your database server

### What Gets Created:

The download button generates a **single bash script** (`getme-lmeve-YYYY-MM-DD.sh`) that:

- ✅ Tests MySQL connectivity
- ✅ Creates `lmeve` and `EveStaticData` databases
- ✅ Creates database user with proper permissions
- ✅ Downloads EVE SDE data from Fuzzwork
- ✅ Imports SDE into database
- ✅ Verifies all operations completed successfully

**All credentials are pre-configured** - no manual input required!

## Files in This Directory:

### Active Files:
- **`getme-lmeve.sh`** - Example/template of the generated setup script
- **`config.example.env`** - Example configuration (for reference)
- **`verify-setup.sh`** - Verification script to test setup
- **`generate-package.sh`** - Command-line generator (alternative to web UI)

### Configuration:
All configuration now happens in the **web interface** (Settings → Database Setup tab).

## Quick Start:

### Method 1: Web Interface (Recommended)

```bash
# 1. Open LMeve web app in browser
# 2. Go to Settings → Database Setup tab
# 3. Fill in database configuration
# 4. Click "Download GetMe Package"
# 5. Transfer to database server and run:
sudo ./getme-lmeve-*.sh
```

### Method 2: Direct Download on Database Server

If your database server has a GUI/browser:

```bash
# 1. On database server, open browser
# 2. Navigate to your LMeve app URL
# 3. Go to Settings → Database Setup
# 4. Click "Download GetMe Package" (downloads directly!)
# 5. Run:
cd ~/Downloads
sudo ./getme-lmeve-*.sh
```

### Method 3: Command Line (Advanced)

```bash
# 1. Copy and customize the config
cp config.example.env my-config.env
nano my-config.env  # Edit with your settings

# 2. Generate package
./generate-package.sh my-config.env

# 3. Transfer and run on database server
```

## Transfer Methods:

### SCP from Windows:
```powershell
scp C:\Users\YourName\Downloads\getme-lmeve-*.sh user@dbserver:/tmp/
```

### SCP from Linux:
```bash
scp ~/Downloads/getme-lmeve-*.sh user@dbserver:/tmp/
```

### Two-Hop Transfer:
```bash
# Windows → Web Host
scp getme-lmeve-*.sh user@webhost:/tmp/

# Web Host → Database Server
ssh user@webhost
scp /tmp/getme-lmeve-*.sh user@dbserver:/tmp/
```

## Verification:

After running the setup script, verify with:

```bash
cd scripts/Client
./verify-setup.sh <db-host> <username> <password>
```

## Architecture Notes:

This is a **browser-based solution**. The old approach of hosting via separate Node.js server (`host-server.js`) has been removed because:

- Browser apps can't open server ports
- Port restrictions in deployment environments
- Simpler user experience with direct download

The current approach is more reliable and works across all deployment scenarios.

## Support:

For issues or questions, check the main LMeve documentation or the Settings tab in the web interface for detailed transfer instructions.
cd /tmp
tar -xzf lmeve-getme-*.tar.gz
cd lmeve-getme-*
sudo ./getme-lmeve.sh
```

### Option 2: Use Environment Variables
```bash
export MYSQL_ROOT_PASS="your-root-password"
export LMEVE_PASS="your-lmeve-password"
export DB_HOST="192.168.1.100"
export LMEVE_USER="myuser"

./generate-package.sh
```

### Option 3: Manual Configuration
```bash
# Edit the getme-lmeve.sh script directly to set your configuration
nano getme-lmeve.sh

# Then run it on your database server
sudo ./getme-lmeve.sh
```

## Quick Start (Web Interface):

The React web interface (`getme-generator.ts`) provides functions to generate the complete package from a web form. The user:

1. Fills out the database configuration form
2. Clicks "Download GetMe Package" 
3. Gets a zip file with all scripts customized for their setup
4. Uploads to their database server and runs one command

## What the GetMe Package Does:

1. **Tests MySQL connectivity** with provided credentials
2. **Creates databases**: `lmeve` and `EveStaticData`
3. **Creates MySQL user** with the specified username/password
4. **Grants permissions** on both databases
5. **Imports LMeve schema** (if lmeve-schema.sql is present)
6. **Downloads SDE data** from Fuzzwork automatically
7. **Imports SDE data** into the EveStaticData database
8. **Verifies everything works** by testing connections and counting tables
9. **Provides summary** with connection details

## Requirements:

- Linux/Unix system with bash
- MySQL or MariaDB server
- Root/admin access to MySQL
- Internet connection (for SDE download)
- ~500MB free disk space (for SDE data)

## Troubleshooting:

- Run `./verify-setup.sh` to check if everything is working
- Check MySQL is running: `systemctl status mysql`
- Verify passwords are correct
- Check disk space: `df -h`
- Review the script output for specific error messages

## Manual Steps (if script fails):

```sql
-- Create databases
CREATE DATABASE lmeve;
CREATE DATABASE EveStaticData;

-- Create user (replace 'lmeve' and 'password' with your values)
CREATE USER 'lmeve'@'%' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON lmeve.* TO 'lmeve'@'%';
GRANT ALL PRIVILEGES ON EveStaticData.* TO 'lmeve'@'%';
FLUSH PRIVILEGES;
```

```bash
# Import schema
mysql -u lmeve -p lmeve < lmeve-schema.sql

# Download and import SDE
wget https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2
bunzip2 eve.db.bz2
mysql -u lmeve -p EveStaticData < eve.db
```

## Security Notes:

- The generated scripts contain your passwords in plain text
- Only transfer them over secure connections (SSH/SFTP)
- Delete the scripts after use if they contain sensitive passwords
- Consider using MySQL configuration files instead of command-line passwords

## Support:

- Check the main LMeve documentation
- Verify your MySQL server configuration
- Test network connectivity between web server and database server
- Ensure all required ports are open (default MySQL port 3306)