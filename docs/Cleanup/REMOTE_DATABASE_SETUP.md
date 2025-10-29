# LMeve Remote Database Setup Guide

## Overview

LMeve includes a sophisticated remote database operations system that allows secure, automated database setup and maintenance across separate servers. This system was designed to overcome browser security limitations while maintaining strong security practices.

## Architecture

The system consists of three main components:

1. **Web Application** - Provides the user interface and API bridge
2. **Database Server** - Runs MySQL/MariaDB and hosts secure operation scripts
3. **SSH Bridge** - Secure communication channel between web app and database server

```
┌─────────────────────────┐    SSH + Sudo    ┌─────────────────────────┐
│   LMeve Web App         │◄─────────────────►│   Database Server       │
│   ┌─────────────────┐   │                   │   ┌─────────────────┐   │
│   │ Settings UI     │   │                   │   │ MySQL/MariaDB   │   │
│   │ API Bridge      │   │                   │   │ Secure Scripts  │   │
│   │ SSH Client      │   │                   │   │ opsuser Account │   │
│   └─────────────────┘   │                   │   └─────────────────┘   │
└─────────────────────────┘                   └─────────────────────────┘
```

## Installation Guide

### Step 1: Database Server Setup

On your database server (as root):

```bash
# Download the setup files
wget https://your-domain.com/scripts/database-setup.tar.gz
tar -xzf database-setup.tar.gz
cd database-setup/

# Run the installer
chmod +x install.sh
sudo ./install.sh opsuser

# This will:
# - Create /usr/local/lmeve/ directory
# - Install operation scripts with secure permissions
# - Create 'opsuser' account
# - Configure sudoers for limited script execution
```

### Step 2: SSH Key Configuration

On your web application server:

```bash
# Generate dedicated SSH key for database operations
ssh-keygen -t ed25519 -f ~/.ssh/lmeve_ops -C "LMeve database operations"

# Copy public key to database server
ssh-copy-id -i ~/.ssh/lmeve_ops.pub opsuser@your-db-server

# Test the connection
ssh -i ~/.ssh/lmeve_ops opsuser@your-db-server
```

### Step 3: LMeve Configuration

In LMeve Settings → Database tab:

1. **Configure Database Connection:**
   - Host: Your database server IP/hostname
   - Port: MySQL port (default 3306)
   - Username: `lmeve` (will be created)
   - Password: Your chosen password

2. **Configure Sudo Database Connection:**
   - Host: Same as above
   - Username: `root` (or privileged MySQL user)
   - Password: MySQL root password

3. **Test Remote Connection:**
   - Click "Test Connection" in Remote Operations section
   - Should show "Connected" status

## Available Operations

### 1. Create Databases
**Purpose:** Creates the `lmeve` and `EveStaticData` databases with proper user permissions.

**What it does:**
- Creates database structures
- Creates `lmeve` MySQL user
- Grants necessary permissions
- Validates setup

**Requirements:** Configured sudo database access

### 2. Import LMeve Schema
**Purpose:** Imports the LMeve application database schema.

**What it does:**
- Imports application tables
- Sets up indexes and relationships
- Validates import completion

**Requirements:** Schema SQL file (optional - can use built-in)

### 3. Import EVE Static Data
**Purpose:** Imports EVE Online reference data.

**What it does:**
- Handles multiple file formats (.sql, .tar.bz2, .tar.gz)
- Clears existing data safely
- Imports new SDE data
- Validates completion

**Requirements:** SDE file (optional - can auto-download)

## Security Features

### Privilege Isolation
- Scripts run as root but can only be executed via `opsuser`
- Sudoers configuration restricts to specific scripts only
- No shell access or arbitrary command execution

### Secure Communication
- All communication via SSH with key-based authentication
- No passwords transmitted over network
- Connection timeout and retry protection

### Audit Trail
- All operations logged with timestamps
- Real-time progress feedback
- Error logging and reporting
- Connection attempt tracking

### File Security
- Scripts owned by root, only executable by root
- Temporary files cleaned up automatically
- No sensitive data stored in logs

## Troubleshooting

### Connection Issues

**Problem:** "SSH connection failed"
```bash
# Test SSH manually
ssh -i ~/.ssh/lmeve_ops -v opsuser@db-server

# Check key permissions
chmod 600 ~/.ssh/lmeve_ops
chmod 644 ~/.ssh/lmeve_ops.pub

# Verify authorized_keys on database server
cat /home/opsuser/.ssh/authorized_keys
```

**Problem:** "Permission denied"
```bash
# Check sudoers configuration
sudo visudo -c -f /etc/sudoers.d/lmeve_ops

# Test sudo access manually
ssh -i ~/.ssh/lmeve_ops opsuser@db-server sudo -l
```

### Database Issues

**Problem:** "MySQL connection refused"
```bash
# Check MySQL is running
systemctl status mysql

# Check MySQL configuration
mysql -u root -p -e "SHOW VARIABLES LIKE 'bind_address';"

# Allow remote connections (if needed)
# Edit /etc/mysql/mysql.conf.d/mysqld.cnf
# Comment out: bind-address = 127.0.0.1
```

**Problem:** "Access denied for user"
```bash
# Check MySQL root access
mysql -u root -p -e "SELECT user, host FROM mysql.user WHERE user='root';"

# Grant root access from app server if needed
mysql -u root -p -e "GRANT ALL PRIVILEGES ON *.* TO 'root'@'app-server-ip' IDENTIFIED BY 'password';"
```

### File Upload Issues

**Problem:** "File upload failed"
- Check file size limits (default: 100MB)
- Verify disk space on database server
- Ensure /tmp directory is writable

**Problem:** "Unsupported file format"
- Supported formats: .sql, .tar.bz2, .tar.gz
- SDE files should contain SQL dump
- Schema files must be plain SQL

## Maintenance

### Regular Tasks

**Update Scripts:**
```bash
# On database server
cd /usr/local/lmeve/
sudo wget -O create-db.sh https://your-domain.com/scripts/create-db.sh
sudo chmod 700 create-db.sh
sudo chown root:root create-db.sh
```

**Rotate SSH Keys:**
```bash
# Generate new key
ssh-keygen -t ed25519 -f ~/.ssh/lmeve_ops_new

# Test new key
ssh -i ~/.ssh/lmeve_ops_new opsuser@db-server

# Update LMeve configuration
# Remove old key from database server
```

**Monitor Logs:**
- Check LMeve connection logs for failures
- Monitor database server logs for security events
- Review operation task history

### Backup Considerations

**Before Operations:**
- Backup existing databases
- Test backup restoration
- Document current configuration

**After Operations:**
- Verify operation success
- Test application connectivity
- Update documentation

## Advanced Configuration

### Custom SSH Configuration

Create `~/.ssh/config`:
```
Host lmeve-db
    HostName your-db-server.com
    User opsuser
    IdentityFile ~/.ssh/lmeve_ops
    ConnectTimeout 10
    ServerAliveInterval 60
```

### Firewall Configuration

**Database Server:**
```bash
# Allow SSH from web application server
ufw allow from APP_SERVER_IP to any port 22

# Allow MySQL from web application server
ufw allow from APP_SERVER_IP to any port 3306
```

**Web Application Server:**
```bash
# Allow outbound SSH to database server
ufw allow out to DB_SERVER_IP port 22

# Allow outbound MySQL to database server
ufw allow out to DB_SERVER_IP port 3306
```

## Support

### Getting Help

1. **Check Connection Logs:** LMeve Settings → Database → View logs
2. **Test Components:** Use individual test buttons in the interface
3. **Manual Verification:** SSH and test scripts manually
4. **Review Documentation:** This guide and script comments

### Common Solutions

- **Restart Services:** SSH daemon, MySQL, web application
- **Check Permissions:** File ownership, sudoers, SSH keys
- **Network Connectivity:** Firewalls, routing, DNS resolution
- **Disk Space:** Database server storage, temporary directories

### Reporting Issues

When reporting problems, include:
- LMeve version and configuration
- Database server OS and MySQL version
- Error messages from connection logs
- Manual test command results
- Network topology (if complex)

This system provides enterprise-grade database operations while maintaining strong security boundaries. Follow this guide carefully for optimal setup and operation.