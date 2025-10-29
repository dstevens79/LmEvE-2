#!/usr/bin/env node
/**
 * GetMe Package Hosting Server
 * Simple HTTP server for hosting LMeve GetMe packages for quick download
 * 
 * Usage:
 *   node host-server.js [port]
 *   
 * Default port: 3456
 * 
 * Endpoints:
 *   GET /getme-latest          - Downloads the standard GetMe package
 *   POST /getme-custom         - Generate and download custom package
 *   GET /install               - Returns wget/curl command for easy sharing
 *   GET /health                - Health check
 */

import { createServer } from 'http';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateGetMePackage } from './getme-generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = process.argv[2] || 8080;  // Use 8080 (common HTTP alternative) or port 80 with sudo

// Default configuration for standard package
const DEFAULT_CONFIG = {
  host: 'localhost',
  port: 3306,
  username: 'lmeve',
  password: 'lmeve_password',
  sudoUsername: 'root',
  sudoPassword: 'root_password',
  sdeSource: 'https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2'
};

// Load schema SQL
let schemaSQL = '';
try {
  const schemaPath = join(__dirname, '../../database/lmeve-schema.sql');
  if (existsSync(schemaPath)) {
    schemaSQL = readFileSync(schemaPath, 'utf8');
  } else {
    schemaSQL = `-- LMeve Schema Placeholder
-- Place your actual lmeve-schema.sql file in scripts/database/
-- This is just a placeholder for the hosting server

CREATE DATABASE IF NOT EXISTS lmeve;
USE lmeve;

-- Your actual schema would go here
-- Tables for users, corporations, manufacturing jobs, etc.

-- Example placeholder table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;
  }
} catch (error) {
  console.warn('Warning: Could not load schema SQL, using placeholder');
  schemaSQL = '-- Schema placeholder - replace with actual schema';
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  
  // CORS headers for web interface
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  console.log(`${new Date().toISOString()} - ${req.method} ${url.pathname} - ${req.socket.remoteAddress}`);

  try {
    switch (url.pathname) {
      case '/health':
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          server: 'GetMe Package Host'
        }));
        break;

      case '/install':
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        const installCommand = `# LMeve GetMe Package - Quick Install
# Copy and paste this command on your database server:

wget http://localhost:${port}/getme-latest -O getme-lmeve.sh && chmod +x getme-lmeve.sh && sudo ./getme-lmeve.sh

# Or using curl:
curl -o getme-lmeve.sh http://localhost:${port}/getme-latest && chmod +x getme-lmeve.sh && sudo ./getme-lmeve.sh

# For custom configuration, use:
curl -X POST -H "Content-Type: application/json" \\
  -d '{"host":"your-db-host","username":"your-user","password":"your-pass"}' \\
  http://localhost:${port}/getme-custom -o getme-lmeve.sh

# Server: ${req.headers.host || `localhost:${port}`}
# Generated: ${new Date().toISOString()}`;
        res.end(installCommand);
        break;

      case '/getme-latest':
        const latestPackage = generateGetMePackage(DEFAULT_CONFIG, schemaSQL);
        res.writeHead(200, { 
          'Content-Type': 'application/x-shellscript',
          'Content-Disposition': 'attachment; filename="getme-lmeve.sh"'
        });
        res.end(latestPackage.mainScript);
        break;

      case '/getme-custom':
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'text/plain' });
          res.end('Method not allowed. Use POST with JSON config.');
          break;
        }

        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const customConfig = { ...DEFAULT_CONFIG, ...JSON.parse(body) };
            const customPackage = generateGetMePackage(customConfig, schemaSQL);
            
            res.writeHead(200, { 
              'Content-Type': 'application/x-shellscript',
              'Content-Disposition': 'attachment; filename="getme-lmeve-custom.sh"'
            });
            res.end(customPackage.mainScript);
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON configuration' }));
          }
        });
        break;

      case '/package-zip':
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'text/plain' });
          res.end('Method not allowed. Use POST with JSON config.');
          break;
        }

        let zipBody = '';
        req.on('data', chunk => { zipBody += chunk.toString(); });
        req.on('end', () => {
          try {
            const zipConfig = { ...DEFAULT_CONFIG, ...JSON.parse(zipBody) };
            const packageData = generateGetMePackage(zipConfig, schemaSQL);
            
            // Create a self-extracting package
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const extractorScript = `#!/bin/bash
# LMeve GetMe Package - Self Extracting Archive
# Generated: ${new Date().toISOString()}

echo "Extracting LMeve GetMe Package..."
mkdir -p lmeve-getme-${timestamp}
cd lmeve-getme-${timestamp}

# Extract main script
cat > getme-lmeve.sh << 'MAIN_SCRIPT_EOF'
${packageData.mainScript}
MAIN_SCRIPT_EOF

# Extract schema
cat > lmeve-schema.sql << 'SCHEMA_EOF'
${packageData.schemaSQL}
SCHEMA_EOF

# Extract verify script
cat > verify-setup.sh << 'VERIFY_SCRIPT_EOF'
${packageData.verifyScript}
VERIFY_SCRIPT_EOF

# Extract README
cat > README.txt << 'README_EOF'
${packageData.readmeText}
README_EOF

chmod +x getme-lmeve.sh verify-setup.sh

echo ""
echo "Package extracted to: lmeve-getme-${timestamp}/"
echo ""
echo "To setup your database:"
echo "  cd lmeve-getme-${timestamp}"
echo "  sudo ./getme-lmeve.sh"
echo ""
echo "To verify installation:"
echo "  ./verify-setup.sh"
echo ""
`;
            
            res.writeHead(200, { 
              'Content-Type': 'application/x-shellscript',
              'Content-Disposition': `attachment; filename="getme-lmeve-package-${timestamp}.sh"`
            });
            res.end(extractorScript);
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON configuration' }));
          }
        });
        break;

      default:
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`GetMe Package Host - Endpoint not found

Available endpoints:
  GET  /getme-latest     - Download standard GetMe package
  POST /getme-custom     - Generate custom package (send JSON config)
  POST /package-zip      - Generate self-extracting package
  GET  /install          - Show install commands
  GET  /health           - Health check

Example usage:
  wget http://localhost:${port}/getme-latest -O getme-lmeve.sh
  curl -o getme-lmeve.sh http://localhost:${port}/getme-latest
  
Server running on port ${port}`);
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(port, () => {
  console.log(`🚀 GetMe Package Host running on http://localhost:${port}`);
  console.log(`📦 Quick install command: wget http://localhost:${port}/getme-latest -O getme-lmeve.sh`);
  console.log(`🔧 Custom packages: POST to /getme-custom with JSON config`);
  console.log(`📋 Install guide: http://localhost:${port}/install`);
  console.log(`💚 Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down GetMe Package Host...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});