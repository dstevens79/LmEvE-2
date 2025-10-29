# LMeve GetMe Package - Client Scripts

This directory contains all the files needed to create and run the "GetMe" package for LMeve database setup.

## Files:

### Main Scripts:
- **`getme-lmeve.sh`** - The main setup script that does everything
- **`generate-package.sh`** - Creates customized packages from config files
- **`verify-setup.sh`** - Verifies that the database setup worked correctly

### Configuration:
- **`config.example.env`** - Example configuration file
- **`getme-generator.ts`** - TypeScript functions for the React web interface

## Quick Start (Command Line):

### Option 1: Use with Configuration File
```bash
# 1. Copy and customize the config
cp config.example.env my-config.env
nano my-config.env  # Edit with your settings

# 2. Generate a personalized package
./generate-package.sh my-config.env

# 3. Transfer the generated package to your database server
scp lmeve-getme-*.tar.gz user@dbserver:/tmp/

# 4. On the database server:
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