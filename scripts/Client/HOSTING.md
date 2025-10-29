# LMeve GetMe Package Hosting

This directory contains a complete hosting solution for LMeve GetMe packages, allowing users to quickly download and install database setup scripts with simple commands.

## 🚀 Quick Start

### For Package Hosts (you):

1. **Start the hosting server:**
   ```bash
   # Linux/Mac:
   ./start-host.sh [port]
   
   # Windows:
   start-host.bat [port]
   
   # Or directly with Node.js:
   node host-server.js [port]
   ```
   Default port is 3456.

2. **Share the install command with users:**
   ```bash
   wget http://your-host:3456/getme-latest -O getme-lmeve.sh
   ```

### For Database Server Users:

**One-line install command:**
```bash
# Download and run the standard package
wget http://your-host:3456/getme-latest -O getme-lmeve.sh && chmod +x getme-lmeve.sh && sudo ./getme-lmeve.sh

# Or with curl:
curl -o getme-lmeve.sh http://your-host:3456/getme-latest && chmod +x getme-lmeve.sh && sudo ./getme-lmeve.sh
```

## 📡 Server Endpoints

### GET `/getme-latest`
Downloads the standard GetMe package with default configuration.

**Example:**
```bash
wget http://localhost:3456/getme-latest -O getme-lmeve.sh
curl -o getme-lmeve.sh http://localhost:3456/getme-latest
```

### POST `/getme-custom`
Generates a custom package based on JSON configuration.

**Example:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"host":"db.example.com","username":"myuser","password":"mypass"}' \
  http://localhost:3456/getme-custom -o getme-lmeve-custom.sh
```

### POST `/package-zip`
Generates a self-extracting package with all files.

**Example:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"host":"db.example.com","username":"myuser"}' \
  http://localhost:3456/package-zip -o getme-package.sh
```

### GET `/install`
Returns installation instructions and examples.

### GET `/health`
Health check endpoint for monitoring.

## 🏗️ Architecture

```
User's Web Interface  →  Host Server  →  Database Server
     (React)              (Node.js)         (Linux)
        ↓                     ↓                ↓
   Fill out form        Generate package   Download & run
   Click "Host It"      Serve via HTTP     ./getme-lmeve.sh
```

## 🔧 Configuration

The server uses default configuration for standard packages:
```javascript
{
  host: 'localhost',
  port: 3306,
  username: 'lmeve',
  password: 'lmeve_password',
  sudoUsername: 'root',
  sudoPassword: 'root_password',
  sdeSource: 'https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2'
}
```

Custom packages can override any of these values via POST request.

## 💡 Use Cases

### Scenario 1: Standard Setup
User is sitting at both their web machine and database server:
1. Start hosting server on web machine: `./start-host.sh`
2. On database server: `wget http://192.168.1.100:3456/getme-latest -O setup.sh && sudo bash setup.sh`

### Scenario 2: Custom Configuration  
User needs specific database settings:
1. Use web interface to generate custom package
2. Or POST custom config to `/getme-custom` endpoint
3. Download and run on database server

### Scenario 3: Offline Package
User wants to prepare everything ahead of time:
1. Generate self-extracting package via `/package-zip`
2. Transfer to database server offline
3. Extract and run when ready

## 🛡️ Security Considerations

- **Local Network Only**: Host server should only be accessible on local network
- **Temporary Passwords**: Generated scripts contain passwords in plain text
- **HTTPS**: Use reverse proxy with SSL for production hosting
- **Firewall**: Limit access to trusted IP ranges
- **Clean Up**: Delete generated scripts after use

## 🚦 Example Commands

### Start Hosting Server
```bash
# Start on default port 3456
./start-host.sh

# Start on custom port
./start-host.sh 8080

# Windows
start-host.bat 8080
```

### User Download Commands
```bash
# Simple download and run
wget http://192.168.1.50:3456/getme-latest -O setup.sh && sudo bash setup.sh

# Custom configuration
curl -X POST -H "Content-Type: application/json" \
  -d '{"host":"mysql.company.com","username":"lmeve_prod","password":"secure123"}' \
  http://192.168.1.50:3456/getme-custom -o setup.sh && sudo bash setup.sh

# Get a complete package
curl -X POST -H "Content-Type: application/json" \
  -d '{"host":"db.internal","username":"lmeve"}' \
  http://192.168.1.50:3456/package-zip -o lmeve-complete.sh && bash lmeve-complete.sh
```

### Test the Server
```bash
# Health check
curl http://localhost:3456/health

# Get install instructions
curl http://localhost:3456/install

# Download standard package
wget http://localhost:3456/getme-latest -O test.sh
```

## 📂 Files in This Directory

- **`host-server.js`** - Main hosting server (Node.js)
- **`getme-generator.js`** - Package generation functions
- **`start-host.sh`** - Linux/Mac startup script
- **`start-host.bat`** - Windows startup script
- **`getme-lmeve.sh`** - Original standalone setup script
- **`generate-package.sh`** - Command-line package generator
- **`verify-setup.sh`** - Database verification script
- **`config.example.env`** - Configuration template

## 🔄 Integration with React Web Interface

The hosting server is designed to work alongside the React web interface:

1. User fills out database configuration form in React
2. React calls hosting server endpoints to generate packages
3. User gets download links or wget commands
4. User runs commands on their database server

This provides the best of both worlds:
- **Easy web interface** for configuration
- **Simple command-line execution** on the database server
- **No complex remote operations** or security issues

## 📞 Support

If the hosting server isn't working:
1. Check that Node.js is installed
2. Verify the server is accessible from database server
3. Check firewall settings
4. Use direct file transfer as fallback (see main README.md)

The hosting approach solves the "remote operations" problem by making it easy to transfer and run the setup scripts locally on the database server, where they have the proper permissions and access needed.