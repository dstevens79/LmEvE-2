import type { Connect } from 'vite';
import mysql from 'mysql2/promise';

export function createApiMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    // Only handle API routes
    if (!req.url?.startsWith('/api/')) {
      return next();
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }

    // Parse JSON body for POST requests
    let body = '';
    if (req.method === 'POST') {
      req.on('data', chunk => {
        body += chunk.toString();
      });
      await new Promise(resolve => req.on('end', resolve));
    }

    try {
      // Route: POST /api/database/test-connection
      if (req.url === '/api/database/test-connection' && req.method === 'POST') {
        const { host, port, username, password, database } = JSON.parse(body);

        console.log(`🔍 Testing MySQL connection to ${username}@${host}:${port}/${database}`);

        if (!host || !port || !username || !database) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: 'Missing required fields: host, port, username, database'
          }));
          return;
        }

        let connection;
        const startTime = Date.now();

        try {
          // Attempt to create MySQL connection
          connection = await mysql.createConnection({
            host,
            port: parseInt(String(port)),
            user: username,
            password: password || '',
            database,
            connectTimeout: 10000,
          });

          // Test the connection
          await connection.query('SELECT 1');

          // Check if user exists
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
            errorMessage = `Connection refused to ${host}:${port} - MySQL server not accessible`;
          } else if (error.code === 'ETIMEDOUT') {
            errorMessage = `Connection timeout to ${host}:${port} - Check firewall and network settings`;
          } else if (error.code === 'ER_DBACCESS_DENIED_ERROR') {
            errorMessage = `User '${username}' does not have permission to access database '${database}'`;
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
            } catch (closeError) {
              console.error('Error closing connection:', closeError);
            }
          }
        }
        return;
      }

      // Route: POST /api/database/query
      if (req.url === '/api/database/query' && req.method === 'POST') {
        const { host, port, username, password, database, query } = JSON.parse(body);

        console.log(`📊 Executing query on ${database}: ${query.substring(0, 100)}...`);

        if (!host || !port || !username || !database || !query) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: 'Missing required fields'
          }));
          return;
        }

        let connection;

        try {
          connection = await mysql.createConnection({
            host,
            port: parseInt(String(port)),
            user: username,
            password: password || '',
            database,
            connectTimeout: 10000,
          });

          const [rows, fields] = await connection.query(query);

          console.log(`✅ Query executed successfully`);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            rows,
            fields: fields?.map((f: any) => ({
              name: f.name,
              type: f.type
            })),
            rowCount: Array.isArray(rows) ? rows.length : 0
          }));

        } catch (error: any) {
          console.error(`❌ Query failed: ${error.message}`);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: error.message,
            errorCode: error.code
          }));

        } finally {
          if (connection) {
            try {
              await connection.end();
            } catch (closeError) {
              console.error('Error closing connection:', closeError);
            }
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
          timestamp: new Date().toISOString(),
          service: 'lmeve-integrated-api'
        }));
        return;
      }

      // Route not found
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'API endpoint not found' }));

    } catch (error) {
      console.error('API middleware error:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }));
    }
  };
}
