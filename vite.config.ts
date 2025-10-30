import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'lmeve-api',
      configureServer(server: any) {
        // Register API middleware for MySQL connections
        server.middlewares.use(async (req: any, res: any, next: any) => {
          if (!req.url?.startsWith('/api/')) {
            return next();
          }

          // Lazy import mysql2 only when needed
          const mysql = await import('mysql2/promise');

          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.end();
            return;
          }

          // Parse POST body
          let body = '';
          if (req.method === 'POST') {
            req.on('data', (chunk: any) => { body += chunk.toString(); });
            await new Promise(resolve => req.on('end', resolve));
          }

          try {
            // Route: POST /api/database/test-connection
            if (req.url === '/api/database/test-connection' && req.method === 'POST') {
              const { host, port, username, password, database } = JSON.parse(body);

              console.log(`🔍 Testing MySQL connection to ${username}@${host}:${port}/${database}`);

              let connection;
              const startTime = Date.now();

              try {
                connection = await mysql.default.createConnection({
                  host,
                  port: parseInt(String(port)),
                  user: username,
                  password: password || '',
                  database,
                  connectTimeout: 10000,
                });

                await connection.query('SELECT 1');

                const [userRows] = await connection.query(
                  'SELECT user, host FROM mysql.user WHERE user = ? LIMIT 1',
                  [username]
                );

                const latency = Date.now() - startTime;
                console.log(`✅ MySQL connection successful (${latency}ms)`);

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: true,
                  latency,
                  userExists: Array.isArray(userRows) && userRows.length > 0,
                  message: `Connected to ${host}:${port}/${database} successfully`
                }));

              } catch (error: any) {
                const latency = Date.now() - startTime;
                console.error(`❌ MySQL connection failed: ${error.message}`);

                let errorMessage = error.message;
                
                if (error.code === 'ER_ACCESS_DENIED_ERROR') {
                  errorMessage = `Access denied for user '${username}'@'${host}' (using password: ${password ? 'YES' : 'NO'})`;
                } else if (error.code === 'ECONNREFUSED') {
                  errorMessage = `Connection refused to ${host}:${port}`;
                } else if (error.code === 'ETIMEDOUT') {
                  errorMessage = `Connection timeout to ${host}:${port}`;
                } else if (error.code === 'ER_BAD_DB_ERROR') {
                  errorMessage = `Database '${database}' does not exist`;
                }

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  error: errorMessage,
                  errorCode: error.code,
                  latency
                }));

              } finally {
                if (connection) {
                  try {
                    await connection.end();
                  } catch (e) {}
                }
              }
              return;
            }

            // Route: GET /api/health
            if (req.url === '/api/health' && req.method === 'GET') {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                status: 'ok',
                timestamp: new Date().toISOString()
              }));
              return;
            }

            // Route not found
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'API endpoint not found' }));

          } catch (error: any) {
            console.error('API middleware error:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error.message }));
          }
        });
      }
    },
    react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  }
});
