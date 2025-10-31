# LMeve Database Server Setup Script

**Complete all-in-one installer** for setting up an LMeve database server on a fresh Ubuntu/Debian installation.

## Features

✅ **Complete System Setup** - Works on fresh OS installations  
✅ **System Requirements** - Installs all needed packages (wget, bzip2, curl, git)  
✅ **Firewall Configuration** - UFW setup with proper ports  
✅ **Database Choice** - MySQL or MariaDB (your preference)  
✅ **Webmin Optional** - Web-based management GUI  
✅ **Fully Interactive** - Prompts for all configuration  
✅ **Database Creation** - Creates lmeve and EveStaticData databases  
✅ **User Management** - Creates dedicated user with proper permissions  
✅ **SDE Import** - Downloads and imports EVE static data  
✅ **Verification** - Tests everything works

## What It Installs

### System Packages
- `wget` - For downloading files
- `bzip2` - For extracting SDE data
- `curl` - For web requests
- `git` - Version control (useful for updates)
- `ufw` - Firewall management

### Database Server (Your Choice)
- **MySQL Server** - Oracle's MySQL (traditional choice)
- **MariaDB Server** - Community-driven fork (fully compatible, often preferred)

### Optional Components
- **Webmin** - Web-based server management interface (port 10000)

## Quick Start

### Fresh Ubuntu/Debian Server:

```bash
# Download the script
wget https://raw.githubusercontent.com/dstevens79/LmEvE-2/main/scripts/setup-lmeve-db.sh

# Make it executable
chmod +x setup-lmeve-db.sh

# Run it (requires sudo/root)
sudo ./setup-lmeve-db.sh
```

**That's it!** The script will guide you through:
1. System updates
2. Package installation
3. Firewall configuration
4. Database server selection (MySQL vs MariaDB)
5. Optional Webmin installation
6. Database and user creation
7. SDE data import

### If You Already Have MySQL/MariaDB:

The script detects existing installations and offers to use them.

## What The Script Does

### Phase 1: System Preparation
1. **OS Detection** - Verifies Ubuntu/Debian compatibility
2. **System Update** - Asks to run `apt update && apt upgrade`
3. **Package Installation** - Installs wget, bzip2, curl, git, ufw

### Phase 2: Firewall Configuration
Offers three options:
- **Disable UFW** - Not recommended but available
- **Configure UFW** - Opens SSH (22) and MySQL (3306) ports
- **Skip** - Leave firewall as-is

### Phase 3: Database Server Installation
Choose your database:
- **MySQL** - Oracle's official MySQL Server
- **MariaDB** - Community fork (recommended, fully compatible)

If already installed, offers to use existing installation.

Then runs `mysql_secure_installation` to:
- Set root password
- Remove anonymous users  
- Disallow remote root login
- Remove test database

### Phase 4: Optional Webmin
Optionally installs Webmin for web-based management:
- Adds Webmin repository
- Installs Webmin package
- Opens port 10000 through firewall
- Accessible at `https://your-server-ip:10000`

### Phase 5: LMeve Database Setup
Prompts for configuration:
- Database host (default: localhost)
- Database port (default: 3306)
- MySQL root password
- LMeve username (default: lmeve)
- LMeve password
- SDE download option

### Phase 6: Database Creation

- Test MySQL connection
- Create `lmeve` database
- Create `EveStaticData` database
- Create user with proper permissions
- Download EVE SDE from Fuzzwork (if requested)
- Import SDE data into database
- Verify everything works
- Display connection details

## Example Run

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║    LMeve Complete Database Server - All-in-One Installer  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

This script will set up a complete LMeve database server
on a fresh Ubuntu/Debian installation.

▶ Detecting Operating System
────────────────────────────────────────────────────────────────
✅ Detected: Ubuntu 20.04.6 LTS

▶ System Update
────────────────────────────────────────────────────────────────
Update system packages?
Run apt update && apt upgrade? [Y/n]: Y
Updating package lists...
Upgrading installed packages...
✅ System updated

▶ Installing Required Packages
────────────────────────────────────────────────────────────────
Installing essential packages: wget, bzip2, curl, git...
✅ Required packages installed

▶ Firewall Configuration (UFW)
────────────────────────────────────────────────────────────────
Configure firewall settings?
  1) Disable UFW (not recommended)
  2) Configure UFW for database server (MySQL/MariaDB port)
  3) Skip firewall configuration
Choice [2]: 2
Configuring UFW...
✅ Firewall configured
Allowed: SSH (22), MySQL/MariaDB (3306)

▶ Database Server Selection
────────────────────────────────────────────────────────────────
Choose your database server:
  1) MySQL (Oracle's MySQL Server)
  2) MariaDB (Community fork, fully compatible)
Choice [2]: 2
Installing MariaDB Server...
✅ MariaDB Server installed and started
Securing MariaDB installation...
✅ MariaDB secured

▶ Webmin Installation (Optional)
────────────────────────────────────────────────────────────────
Install Webmin for web-based server management?
Webmin provides a GUI for managing MySQL/MariaDB, users, and system settings
Install Webmin? [y/N]: y
Installing Webmin...
✅ Webmin installed
Access Webmin at: https://192.168.1.100:10000

▶ LMeve Database Configuration
────────────────────────────────────────────────────────────────
Now let's configure your LMeve databases

Database Host [localhost]: 
Database Port [3306]: 
MySQL Root Password: ********

LMeve database user (will be created):
LMeve Username [lmeve]: 
LMeve Password: ********
Confirm LMeve Password: ********

EVE Static Data Export (SDE):
Download and import SDE? [Y/n]: Y

═══════════════════════════════════════════════════════════
Configuration Summary:
═══════════════════════════════════════════════════════════
  OS: Ubuntu 20.04.6 LTS
  Database: MariaDB
  Database Host: localhost:3306
  LMeve Username: lmeve
  LMeve Password: [hidden]
  Download SDE: Y
═══════════════════════════════════════════════════════════

Proceed with installation? [Y/n]: Y

▶ Testing MySQL Connection
────────────────────────────────────────────────────────────────
✅ MySQL connection successful

▶ Creating Databases
────────────────────────────────────────────────────────────────
✅ Databases created: lmeve, EveStaticData

▶ Creating MySQL User
────────────────────────────────────────────────────────────────
✅ User 'lmeve' created with full permissions

▶ Testing User Connection
────────────────────────────────────────────────────────────────
✅ User connection successful

▶ Downloading EVE Static Data
────────────────────────────────────────────────────────────────
Downloading from: https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2
✅ SDE download completed

▶ Extracting SDE Data
────────────────────────────────────────────────────────────────
✅ Extraction completed

▶ Importing EVE Static Data
────────────────────────────────────────────────────────────────
✅ SDE data imported successfully

▶ Verifying Installation
────────────────────────────────────────────────────────────────
✅ Database verification successful

╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🎉 LMeve Database Server Setup Complete! 🎉             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════
Installation Summary:
═══════════════════════════════════════════════════════════
  OS: Ubuntu 20.04.6 LTS
  Database: MariaDB
  Host: localhost:3306
  Username: lmeve
  Password: [configured]
  LMeve DB: lmeve (0 tables)
  SDE DB: EveStaticData (243 tables)
  Webmin: https://192.168.1.100:10000
═══════════════════════════════════════════════════════════

Next Steps:
  1. Use these database settings in your LMeve web application
  2. Configure your LMeve instance to connect to this database
  3. Manage your database via Webmin at port 10000

Database server is ready for LMeve!
```

## Requirements

- **Ubuntu/Debian** Linux (tested on Ubuntu 20.04 LTS)
- **Root/sudo access** - Script must run as root
- **Internet connection** - For package downloads and SDE

**The script handles everything else!**

## What Gets Created

### System Components
- **UFW Firewall Rules** - SSH (22), MySQL/MariaDB (3306)
- **Database Server** - MySQL or MariaDB with secure configuration
- **Webmin (Optional)** - Port 10000 for web management

### Databases
- `lmeve` - Main LMeve application database
- `EveStaticData` - EVE Online static data export

### User
- Username: (your choice, default: lmeve)
- Permissions: Full access to both databases
- Authentication: mysql_native_password

### Tables
- LMeve database: Initially empty (populated by app)
- EveStaticData: ~243 tables (if SDE downloaded)

## Troubleshooting

### OS Not Supported
The script is designed for Ubuntu/Debian. On other distributions:
- CentOS/RHEL: Use `yum` instead of `apt` (script needs modification)
- Arch: Use `pacman` (script needs modification)

### Firewall Issues
If you lose SSH access after enabling UFW:
- The script allows OpenSSH by default
- If locked out, access via console and run: `sudo ufw allow OpenSSH`

### Database Already Installed
- Script detects existing MySQL/MariaDB
- Offers to use existing installation
- To start fresh: Remove database first with `sudo apt remove --purge mysql-server mariadb-server`

### "Cannot connect to MySQL"
- Verify MySQL is running: `systemctl status mysql`
- Check credentials are correct
- Ensure MySQL is listening on the specified port

### Webmin Installation Fails
If Webmin installation fails:
```bash
# Manual installation
wget http://www.webmin.com/download/deb/webmin-current.deb
sudo dpkg -i webmin-current.deb
sudo apt install -f  # Fix dependencies
```

### Port 3306 Already in Use

### SDE download fails
- Check internet connection
- Try downloading manually:
  ```bash
  wget https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2
  ```
- You can skip SDE during setup and import later

## MySQL vs MariaDB - Which Should I Choose?

Both are fully compatible with LMeve. Here's the difference:

### MySQL
- ✅ Oracle's official version
- ✅ Widely documented
- ✅ Traditional choice
- ⚠️  Corporate backing (Oracle)

### MariaDB (Recommended)
- ✅ Community-driven fork of MySQL
- ✅ Fully compatible drop-in replacement
- ✅ Often faster performance
- ✅ More open development
- ✅ Default choice in many Linux distributions
- ✅ No corporate control concerns

**Either works perfectly with LMeve!** Choose based on your preference.

## Advanced: Remote Database Access

By default, the script creates a user accessible from anywhere (`'user'@'%'`). For added security on production:

### Restrict to Specific IP
```sql
# Connect to MySQL/MariaDB
sudo mysql -u root -p

# Create user for specific IP only
DROP USER IF EXISTS 'lmeve'@'%';
CREATE USER 'lmeve'@'192.168.1.50' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON lmeve.* TO 'lmeve'@'192.168.1.50';
GRANT ALL PRIVILEGES ON EveStaticData.* TO 'lmeve'@'192.168.1.50';
FLUSH PRIVILEGES;
```

### Allow Remote Connections
Edit MySQL configuration:
```bash
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
# or
sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf

# Change:
bind-address = 127.0.0.1
# To:
bind-address = 0.0.0.0

sudo systemctl restart mysql  # or mariadb
```

## Webmin Quick Guide

After installation, access Webmin at `https://your-server-ip:10000`

### First Login
- **Username**: root (or your sudo user)
- **Password**: Your system password
- Accept the self-signed SSL certificate

### Useful Webmin Modules
- **Servers → MySQL Database Server** - Manage databases, users, tables
- **System → Users and Groups** - System user management  
- **Networking → Firewall** - UFW configuration
- **System → Software Package Updates** - System updates

## Security Best Practices

1. **Use Strong Passwords** - Especially for MySQL root and LMeve user
2. **Keep UFW Enabled** - Only open necessary ports
3. **Regular Updates** - Run `apt update && apt upgrade` regularly
4. **Restrict Database Access** - Limit to specific IPs if possible
5. **Backup Regularly** - Schedule database backups
6. **Monitor Logs** - Check `/var/log/mysql/` or `/var/log/mariadb/`
7. **Webmin HTTPS Only** - Never use HTTP for Webmin access

## Security Notes

- Script requires MySQL root password to create databases
- Passwords are not logged or stored
- Script cleans up temporary files
- User created with mysql_native_password authentication
- Firewall configured with minimal required ports
- Webmin uses HTTPS with self-signed certificate

## Comparison: Old vs New Setup

### Old GetMe Package System ❌
- Complex hosting infrastructure
- Backend API required
- Multi-step transfer procedures  
- SSH configuration needed
- Pre-embedded credentials
- 3-machine complexity
- Difficult to troubleshoot

### New All-in-One Script ✅
- **One file, one command**
- No hosting needed
- No SSH required
- Fully interactive prompts
- Works on fresh OS install
- Handles all dependencies
- Complete system setup
- Easy to understand and modify

## What's Different from Manual Setup?

The manual setup in the main README requires:
- Installing packages one by one
- Configuring UFW manually
- Running mysql_secure_installation
- Creating databases via SQL commands
- Downloading SDE manually
- Multiple configuration steps

This script automates **all of that** in one go!

## Contributing

Found a bug or have a suggestion? Please open an issue on GitHub!

## License

This script is part of the LMeve-2 project.
