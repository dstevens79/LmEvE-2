# Database Script Testing Guide

This guide helps you verify that the MySQL 8+ fixes are working correctly.

## Prerequisites

- Root access to database server
- MySQL 8.0+ installed
- Scripts installed via `install.sh`

## Test 1: Local Execution

Test the scripts directly on the database server:

```bash
# On database server as root
cd /usr/local/lmeve/

# Test create-db.sh
sudo ./create-db.sh "your_root_password" "test_lmeve_password"

# Expected output:
# [timestamp] Starting LMeve database creation...
# [timestamp] Testing MySQL connectivity...
# [timestamp] MySQL connection successful
# [timestamp] Creating databases...
# [timestamp] Databases created successfully
# [timestamp] Creating user and setting permissions...
# [timestamp] User created and permissions granted successfully
# [timestamp] Verifying user exists in mysql.user table...
# [timestamp] Found 2 user entries for lmeve
# [timestamp] Verifying database connection as lmeve...
# [timestamp] Database setup completed successfully!
```

## Test 2: Verify User Creation

Check that the lmeve user was created with correct authentication:

```bash
# On database server
sudo mysql -u root -p -e "SELECT user, host, plugin FROM mysql.user WHERE user='lmeve';"

# Expected output:
# +-------+-----------+-----------------------+
# | user  | host      | plugin                |
# +-------+-----------+-----------------------+
# | lmeve | %         | mysql_native_password |
# | lmeve | localhost | mysql_native_password |
# +-------+-----------+-----------------------+
```

**Key points:**
- Should see TWO entries (% and localhost)
- Plugin should be `mysql_native_password` (not `caching_sha2_password`)
- Both entries should exist

## Test 3: Verify User Access

Test that the lmeve user can connect and access databases:

```bash
# On database server
mysql -u lmeve -p

# Enter password when prompted
# Should successfully connect

# Inside MySQL shell:
USE lmeve;
SHOW TABLES;
USE EveStaticData;
SHOW TABLES;
```

## Test 4: Test with Special Characters in Password

Test password handling with special characters:

```bash
# Create test user with special characters
sudo ./create-db.sh "your_root_password" 'P@$$w0rd!&123'

# Verify login works
mysql -u lmeve -p'P@$$w0rd!&123' -e "SELECT 1;"

# Should return:
# +---+
# | 1 |
# +---+
# | 1 |
# +---+
```

## Test 5: Remote Execution via SSH

Test script execution over SSH (from web application server):

```bash
# From web application server
ssh -i ~/.ssh/lmeve_ops opsuser@db-server "sudo /usr/local/lmeve/create-db.sh 'rootpass' 'lmevepass'"

# Should:
# - NOT prompt for password
# - Execute successfully
# - Return all log output
# - Exit with code 0
```

## Test 6: Sudoers Configuration

Verify NOPASSWD is configured correctly:

```bash
# On database server
sudo -u opsuser sudo -l

# Expected output should include:
# User opsuser may run the following commands on this host:
#     (ALL) NOPASSWD: /usr/local/lmeve/create-db.sh
#     (ALL) NOPASSWD: /usr/local/lmeve/import-sde.sh
#     (ALL) NOPASSWD: /usr/local/lmeve/import-schema.sh
```

## Test 7: Import Schema (if available)

Test schema import:

```bash
# Copy schema file to database server
scp /path/to/lmeve-schema.sql opsuser@db-server:/tmp/

# Run import via SSH
ssh -i ~/.ssh/lmeve_ops opsuser@db-server \
  "sudo /usr/local/lmeve/import-schema.sh /tmp/lmeve-schema.sql 'rootpass' 'lmevepass'"

# Verify tables created
mysql -u lmeve -p -e "USE lmeve; SHOW TABLES;"
```

## Common Issues and Quick Fixes

### Issue: "User verification failed"

```bash
# Check user exists
sudo mysql -u root -p -e "SELECT user, host FROM mysql.user WHERE user='lmeve';"

# If user exists but can't connect, check plugin
sudo mysql -u root -p -e "SELECT user, host, plugin FROM mysql.user WHERE user='lmeve';"

# If plugin is wrong, fix it:
sudo mysql -u root -p <<EOF
ALTER USER 'lmeve'@'%' IDENTIFIED WITH mysql_native_password BY 'lmevepass';
ALTER USER 'lmeve'@'localhost' IDENTIFIED WITH mysql_native_password BY 'lmevepass';
FLUSH PRIVILEGES;
EOF
```

### Issue: "Cannot connect to MySQL"

```bash
# Check MySQL is running
systemctl status mysql

# Check if root uses auth_socket
sudo mysql -u root -e "SELECT user, plugin FROM mysql.user WHERE user='root';"

# If auth_socket, you MUST use sudo mysql, not mysql -u root -p
# Update script call:
sudo ./create-db.sh "" "lmevepass"  # Empty string for root password
```

### Issue: "Permission denied" on SSH

```bash
# Check opsuser can sudo
sudo -u opsuser sudo -l

# Check script permissions
ls -la /usr/local/lmeve/*.sh
# Should be: -rwx------ root root

# Check sudoers file exists and is valid
sudo visudo -c -f /etc/sudoers.d/lmeve_ops
```

## Success Criteria

All tests pass if:

1. ✅ create-db.sh completes without errors
2. ✅ Two lmeve user entries exist (% and localhost)
3. ✅ Both entries use `mysql_native_password` plugin
4. ✅ lmeve user can connect and access both databases
5. ✅ Passwords with special characters work correctly
6. ✅ Remote SSH execution works without password prompt
7. ✅ Sudoers configuration shows NOPASSWD for all scripts

## Cleanup (if testing multiple times)

To reset and test again:

```bash
# On database server
sudo mysql -u root -p <<EOF
DROP DATABASE IF EXISTS lmeve;
DROP DATABASE IF EXISTS EveStaticData;
DROP USER IF EXISTS 'lmeve'@'%';
DROP USER IF EXISTS 'lmeve'@'localhost';
EOF

# Now run tests again
```

## Integration Testing

Once local tests pass, test from LMeve web application:

1. Navigate to Settings > Database
2. Configure remote database connection
3. Click "Create Databases"
4. Monitor real-time progress
5. Verify success message
6. Check database tables are accessible

## Reporting Issues

If tests fail, gather this information:

```bash
# MySQL version
mysql --version

# OS version
cat /etc/os-release

# Script permissions
ls -la /usr/local/lmeve/

# Sudoers configuration
sudo cat /etc/sudoers.d/lmeve_ops

# MySQL user table
sudo mysql -u root -p -e "SELECT user, host, plugin FROM mysql.user;"

# Error logs
sudo journalctl -u mysql -n 50
```
