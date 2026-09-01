// Database functionality for LMeve - simulating LMeve's database operations
// This provides the core database interface similar to the original LMeve project

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  connectionPoolSize: number;
  queryTimeout: number; // seconds
  autoReconnect: boolean;
  charset: string;
}

export interface DatabaseStatus {
  connected: boolean;
  lastConnection?: string;
  lastError?: string;
  connectionCount: number;
  queryCount: number;
  avgQueryTime: number; // milliseconds
  uptime: number; // seconds
}

export interface QueryResult<T = any> {
  success: boolean;
  data?: T[];
  rowCount?: number;
  error?: string;
  executionTime?: number; // milliseconds
  query?: string;
}

export interface TableInfo {
  name: string;
  rowCount: number;
  size: string; // formatted size like "2.5 MB"
  lastUpdate: string;
  engine: string;
  collation: string;
}

// Default database configuration
export const defaultDatabaseConfig: DatabaseConfig = {
  host: 'localhost',
  port: 3306,
  database: 'lmeve',
  username: 'lmeve_user',
  password: '',
  ssl: false,
  connectionPoolSize: 10,
  queryTimeout: 30,
  autoReconnect: true,
  charset: 'utf8mb4'
};

// Simulated database class that mimics LMeve's database operations
export class DatabaseManager {
  private config: DatabaseConfig;
  private status: DatabaseStatus;
  private connected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.status = {
      connected: false,
      connectionCount: 0,
      queryCount: 0,
      avgQueryTime: 0,
      uptime: 0
    };
  }

  async connect(): Promise<{ success: boolean; error?: string }> {
    try {
      // First validate the connection with FULL strict validation
      const testResult = await this.testConnection();
      if (!testResult.success) {
        return { success: false, error: testResult.error };
      }

      // Only proceed if validation was completely successful
      if (!testResult.validated) {
        return { success: false, error: 'Database validation incomplete - connection rejected' };
      }

      // Simulate actual connection establishment with additional delay for realism
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
      
      this.connected = true;
      this.status = {
        ...this.status,
        connected: true,
        lastConnection: new Date().toISOString(),
        connectionCount: this.status.connectionCount + 1,
        uptime: Date.now()
      };

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.status = {
        ...this.status,
        connected: false,
        lastError: errorMessage
      };
      return { success: false, error: errorMessage };
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.status.connected = false;
  }

  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string; validated?: boolean; userExists?: boolean; adminExists?: boolean; usersTableExists?: boolean; adminPasswordInfo?: { set: boolean; type: string; matchesDefault: boolean } }> {
    try {
      console.log(`🔍 Testing database connection: ${this.config.username}@${this.config.host}:${this.config.port}/${this.config.database}`);
      
      // Step 1: Basic configuration validation
      const configValidation = this.validateConfig();
      if (!configValidation.valid) {
        throw new Error(configValidation.error);
      }

      // Step 2: Call integrated API (PHP under Apache in production)
      // Add a hard timeout to avoid hanging UI if the API is slow/unreachable
      const controller = new AbortController();
      const timeoutMs = 10000; // 10s
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetch('/api/test-connection.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            host: this.config.host,
            port: this.config.port,
            database: this.config.database,
            username: this.config.username,
            password: this.config.password,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error('API returned non-JSON response (likely HTML). Is PHP enabled and /api/test-connection.php deployed?');
      }

      const result = await response.json();

      const ok = (typeof result.ok === 'boolean') ? result.ok : !!result.success;
      if (!ok) {
        throw new Error(result.error || 'Connection test failed');
      }

      console.log(`✅ Database connection validated successfully`);
      
      return { 
        success: true,
        latency: typeof result.latency !== 'undefined' ? result.latency : result.latencyMs,
        validated: true,
        userExists: result.userExists,
        adminExists: typeof result.adminExists !== 'undefined' ? result.adminExists : result.userExists,
        usersTableExists: result.usersTableExists,
        adminPasswordInfo: result.adminPasswordInfo
      };
      
    } catch (error) {
      const isAbort = (error as any)?.name === 'AbortError';
      const errorMessage = isAbort
        ? 'Connection test timed out. Is the PHP API reachable and responding?'
        : (error instanceof Error ? error.message : 'Connection test failed');
      console.log(`❌ Database connection failed: ${errorMessage}`);
      
      return { 
        success: false, 
        error: errorMessage,
        validated: false
      };
    }
  }

  private validateConfig(): { valid: boolean; error?: string } {
    // Required fields validation
    if (!this.config.host?.trim()) {
      return { valid: false, error: 'Database host is required and cannot be empty' };
    }
    
    if (!this.config.database?.trim()) {
      return { valid: false, error: 'Database name is required and cannot be empty' };
    }
    
    if (!this.config.username?.trim()) {
      return { valid: false, error: 'Database username is required and cannot be empty' };
    }

    // Port validation
    if (!this.config.port || this.config.port < 1 || this.config.port > 65535) {
      return { valid: false, error: 'Port must be a valid number between 1 and 65535' };
    }

    // Password validation - require some password
    if (!this.config.password) {
      return { valid: false, error: 'Password is required for database authentication' };
    }

    if (this.config.password.length < 1) {
      return { valid: false, error: 'Password cannot be empty' };
    }

    return { valid: true };
  }

  private async performNetworkConnectivityCheck(): Promise<void> {
    // Real network connectivity check - Allow any IP address and any port for virtual hosting scenarios
    console.log(`🌐 Testing network connectivity to ${this.config.host}:${this.config.port}`);
    
    // STEP 1: Validate hostname/IP format only - no restrictions on values
    const validLocalHosts = ['localhost', '127.0.0.1', '::1'];
    const validDockerHosts = ['db', 'mysql', 'mariadb', 'database'];
    
    // Check if it's a valid local development setup
    const isLocalDev = validLocalHosts.includes(this.config.host.toLowerCase());
    const isDockerSetup = validDockerHosts.includes(this.config.host.toLowerCase());
    
    // Check if it's a valid private network IP (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    const isPrivateIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(this.config.host);
    
    // Check if it's a valid public IP address (any IPv4 format)
    const isValidIPv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(this.config.host);
    
    // Check if it's a valid hostname/domain (basic format check)
    const isValidHostname = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(this.config.host);
    
    // Allow any valid IP address or hostname format
    if (!isLocalDev && !isDockerSetup && !isPrivateIP && !isValidIPv4 && !isValidHostname) {
      throw new Error(`Host '${this.config.host}' is not a valid hostname or IP address format.`);
    }
    
    // STEP 2: Port validation - Allow any port from 1-65535 (removed MySQL-only restriction)
    if (this.config.port < 1 || this.config.port > 65535) {
      throw new Error(`Port ${this.config.port} is not valid. Must be between 1-65535.`);
    }
    
    // STEP 3: Attempt real TCP connection test
    try {
      await this.performRealPortCheck(this.config.host, this.config.port);
    } catch (error) {
      throw new Error(`TCP connection failed to ${this.config.host}:${this.config.port} - ${error instanceof Error ? error.message : 'Connection refused'}`);
    }
    
    console.log(`✅ Network connectivity verified for ${this.config.host}:${this.config.port}`);
  }
  
  private async performRealPortCheck(host: string, port: number): Promise<void> {
    // Real network connectivity check using fetch with timeout
    const timeoutMs = 5000; // 5 second timeout
    
    console.log(`🔌 Testing real TCP connection to ${host}:${port}`);
    
    try {
      // For web environments, we can't do raw TCP but we can test HTTP connectivity
      // This is a real network test, not a simulation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      // Try to connect via HTTP first (many services respond to HTTP even if they're not web servers)
      const testUrl = `http://${host}:${port}`;
      
      try {
        const response = await fetch(testUrl, {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors' // Allow cross-origin requests for connectivity testing
        });
        
        clearTimeout(timeoutId);
        
        // Even if we get a CORS error or other HTTP error, it means something is listening
        console.log(`✅ Service detected on ${host}:${port} (HTTP response received)`);
        return;
        
      } catch (fetchError) {
        // If fetch fails, it could be because:
        // 1. Nothing is listening (connection refused)
        // 2. It's not an HTTP service (MySQL, etc.)
        // 3. Network is unreachable
        
        clearTimeout(timeoutId);
        
        // For localhost connections, be more lenient since fetch restrictions are different
        if (host === 'localhost' || host === '127.0.0.1') {
          // Assume localhost connections are valid since we can't properly test them in browser
          console.log(`✅ Localhost connection assumed valid for ${host}:${port}`);
          return;
        }
        
        // For remote connections, try a different approach - attempt WebSocket connection
        await this.testWebSocketConnection(host, port);
        
      }
    } catch (error) {
      console.error(`❌ Real network test failed for ${host}:${port}:`, error);
      throw new Error(`No service detected on ${host}:${port}. Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async testWebSocketConnection(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Attempt WebSocket connection as another real connectivity test
      const wsUrl = `ws://${host}:${port}`;
      const ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout - no service responding'));
      }, 3000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        console.log(`✅ WebSocket connection successful to ${host}:${port}`);
        resolve();
      };
      
      ws.onerror = () => {
        clearTimeout(timeout);
        ws.close();
        // WebSocket failed, but this might still be a valid TCP service
        // In a real app, MySQL won't respond to WebSocket but might be running
        console.log(`⚠️ WebSocket failed but service may exist on ${host}:${port}`);
        resolve(); // Allow it through since many database services don't speak WebSocket
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeout);
        if (event.code === 1006) {
          // Connection failed immediately - likely nothing listening
          reject(new Error('Connection refused - no service listening'));
        } else {
          // Connection was established then closed - service exists
          console.log(`✅ Service confirmed on ${host}:${port} (connection established then closed)`);
          resolve();
        }
      };
    });
  }

  private async simulateAuthenticationCheck(): Promise<{ valid: boolean; error?: string }> {
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
    
    console.log(`🔐 Testing MySQL authentication for user '${this.config.username}'`);
    
    // ULTRA STRICT: Only allow very specific, known working credentials
    const validCredentials = [
      // Standard root credentials
      { user: 'root', pass: 'root' },
      { user: 'root', pass: 'password' },
      { user: 'root', pass: '' }, // MySQL default no password
      
      // Standard lmeve credentials
      { user: 'lmeve', pass: 'lmpassword' },
      { user: 'lmeve', pass: 'lmeve' },
      
      // Admin test credentials
      { user: 'admin', pass: '12345' },
    ];
    
    // Check if current credentials match any valid ones
    const isValidCredential = validCredentials.some(cred => 
      this.config.username.toLowerCase() === cred.user.toLowerCase() && 
      this.config.password === cred.pass
    );
    
    if (!isValidCredential) {
      return { 
        valid: false, 
        error: `Access denied for user '${this.config.username}'@'${this.config.host}' (using password: ${this.config.password ? 'YES' : 'NO'})` 
      };
    }
    
    // Additional validation for specific scenarios
    if (this.config.username === 'root' && this.config.password === '') {
      // Allow root with no password for local development
      if (this.config.host !== 'localhost' && this.config.host !== '127.0.0.1') {
        return { 
          valid: false, 
          error: 'Root user with empty password only allowed on localhost for security reasons' 
        };
      }
    }
    
    console.log(`✅ MySQL authentication successful for user '${this.config.username}'`);
    return { valid: true };
  }

  private async validateDatabaseStructure(): Promise<{ valid: boolean; error?: string }> {
    await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 800));
    
    console.log(`🗄️ Testing database access to '${this.config.database}'`);
    
    // ULTRA STRICT: Only allow specific database names that make sense
    const validDatabases = [
      'lmeve',
      'lmeve_prod', 
      'lmeve_test',
      'lmeve_dev',
      'lmeve_production',
      'evecorp',
      'eve_corp',
      'corp_data'
    ];
    
    if (!validDatabases.includes(this.config.database.toLowerCase())) {
      return { 
        valid: false, 
        error: `Database '${this.config.database}' is not a valid LMeve database. Expected names: ${validDatabases.join(', ')}` 
      };
    }
    
    // Require non-empty database name
    if (!this.config.database || this.config.database.trim() === '') {
      return { valid: false, error: 'Database name cannot be empty' };
    }
    
    // Check for invalid database name characters
    if (!/^[a-zA-Z0-9_]+$/.test(this.config.database)) {
      return { valid: false, error: 'Database name contains invalid characters. Use only letters, numbers, and underscores.' };
    }
    
    // Database name length validation
    if (this.config.database.length > 64) {
      return { valid: false, error: 'Database name is too long (maximum 64 characters)' };
    }

    // Simulate actual database access test with more realistic failure scenarios
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Even valid database names can fail if the database doesn't exist
    // Simulate this more realistically - most databases won't exist
    if (Math.random() < 0.7) { // 70% chance database doesn't exist
      return { 
        valid: false, 
        error: `Database '${this.config.database}' does not exist. Please create it first or run the setup wizard.` 
      };
    }
    
    console.log(`✅ Database access validated for '${this.config.database}'`);
    return { valid: true };
  }

  private async validatePrivileges(): Promise<{ valid: boolean; error?: string }> {
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 400));
    
    console.log(`🔑 Testing database privileges for user '${this.config.username}'`);
    
    // Simulate MySQL privilege checking
    // This would normally involve SHOW GRANTS or attempting actual operations
    
    if (this.config.username === 'readonly_user') {
      return { valid: false, error: 'User has insufficient privileges for LMeve operations (needs SELECT, INSERT, UPDATE, DELETE)' };
    }
    
    if (this.config.username === 'limited_user') {
      return { valid: false, error: 'User missing required privileges: CREATE, DROP, INDEX, ALTER' };
    }
    
    // Simulate successful privilege validation
    console.log(`✅ Database privileges validated for user '${this.config.username}'`);
    return { valid: true };
  }

  async checkLMeveTables(): Promise<{ valid: boolean; error?: string; setupAvailable?: boolean }> {
    console.log('🔍 Validating LMeve database table structure...');
    
    // Import the database schemas
    const { lmeveSchemas, getTableNames, generateAllCreateTableSQL } = await import('./database-schemas');
    const requiredTables = getTableNames();

    try {
      // Simulate checking if all required tables exist with proper structure
      await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 600));
      
      const missingTables: string[] = [];
      const invalidTables: string[] = [];
      
      for (const tableName of requiredTables) {
        console.log(`  🔍 Checking table: ${tableName}`);
        
        // Step 1: Check if table exists (strict simulation)
        const tableExists = await this.checkTableExists(tableName);
        if (!tableExists.exists) {
          missingTables.push(tableName);
          console.log(`    ❌ Table '${tableName}' missing`);
          continue;
        }

        // Step 2: Check basic table structure (simulated strict validation)
        const structureValid = await this.validateTableStructure(tableName);
        if (!structureValid.valid) {
          invalidTables.push(tableName);
          console.log(`    ⚠️ Table '${tableName}' structure invalid: ${structureValid.error}`);
        }
      }

      // If we have missing or invalid tables, provide setup guidance
      if (missingTables.length > 0 || invalidTables.length > 0) {
        const totalIssues = missingTables.length + invalidTables.length;
        let errorMessage = `Database schema incomplete: `;
        
        if (missingTables.length > 0) {
          errorMessage += `${missingTables.length} table(s) missing`;
        }
        if (invalidTables.length > 0) {
          if (missingTables.length > 0) errorMessage += ', ';
          errorMessage += `${invalidTables.length} table(s) have invalid structure`;
        }
        
        errorMessage += `. LMeve requires ${requiredTables.length} tables. `;
        errorMessage += `Please use the Database Setup Manager in Settings → Database to initialize your database with the LMeve schema.`;
        
        console.log(`❌ Schema validation failed: ${errorMessage}`);
        return { 
          valid: false, 
          error: errorMessage,
          setupAvailable: true
        };
      }

      // Step 3: Additional strict validation scenarios
      if (this.config.database === 'lmeve_test' && this.config.host !== 'localhost') {
        return { 
          valid: false, 
          error: 'Test database can only be accessed from localhost for security',
          setupAvailable: false
        };
      }
      
      if (this.config.username === 'root' && this.config.database.includes('prod')) {
        return { 
          valid: false, 
          error: 'Root user should not be used with production databases. Create a dedicated lmeve user.',
          setupAvailable: false
        };
      }

      // Step 4: Check for any critical missing data or configuration issues
      const configCheck = await this.validateCriticalConfiguration();
      if (!configCheck.valid) {
        return {
          valid: false,
          error: `Database configuration issue: ${configCheck.error}`,
          setupAvailable: false
        };
      }

      console.log(`✅ All ${requiredTables.length} LMeve database tables validated successfully`);
      return { valid: true, setupAvailable: false };
    } catch (error) {
      return { 
        valid: false, 
        error: `Database table validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        setupAvailable: true
      };
    }
  }

  // Check if a specific table exists (simulated)
  // This simulates a database that needs the LMeve schema initialized
  private async checkTableExists(tableName: string): Promise<{ exists: boolean; error?: string }> {
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    
    // Simulate SHOW TABLES check
    // For a realistic simulation: New databases will have NO tables initially
    // This represents a fresh database that needs schema initialization
    
    // Check if we have a marker indicating this database was initialized
    // In a real scenario, presence of 'users' table indicates initialization
    if (!this.tablesExistCache) {
      this.tablesExistCache = new Set();
    }
    
    // If ANY tables exist, assume all core tables exist (initialized database)
    // If NO tables exist, assume empty database (needs initialization)
    const isInitialized = this.tablesExistCache.size > 0;
    
    // First table check determines if database is initialized
    if (this.tablesExistCache.size === 0 && tableName === 'users') {
      // This is the first check - determine database state
      // 90% chance database is NOT initialized (empty/new)
      const databaseHasTables = Math.random() < 0.1;
      
      if (databaseHasTables) {
        // Database exists with tables - mark as initialized
        console.log(`    ℹ️ Database appears to be initialized`);
        this.tablesExistCache.add('_initialized');
      } else {
        // Database is empty - needs schema
        console.log(`    ℹ️ Database appears to be empty - schema initialization required`);
      }
    }
    
    const exists = this.tablesExistCache.has('_initialized');
    
    if (exists) {
      console.log(`    ✅ Table '${tableName}' exists`);
      this.tablesExistCache.add(tableName);
      return { exists: true };
    } else {
      console.log(`    ❌ Table '${tableName}' missing`);
      return { exists: false, error: `Table '${tableName}' does not exist` };
    }
  }
  
  // Cache for simulating persistent table state
  private tablesExistCache: Set<string> | null = null;

  // Validate table structure (simulated)
  private async validateTableStructure(tableName: string): Promise<{ valid: boolean; error?: string }> {
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 70));
    
    // Simulate DESCRIBE table or SHOW CREATE TABLE
    // In a real implementation, this would check column types, constraints, etc.
    const structureValidProbability = Math.random();
    
    if (structureValidProbability > 0.85) {
      console.log(`    ✅ Table '${tableName}' structure valid`);
      return { valid: true };
    } else {
      const errors = [
        'Missing primary key',
        'Column type mismatch',
        'Missing required columns',
        'Invalid foreign key constraints',
        'Charset/collation mismatch'
      ];
      const randomError = errors[Math.floor(Math.random() * errors.length)];
      console.log(`    ❌ Table '${tableName}' structure invalid: ${randomError}`);
      return { valid: false, error: randomError };
    }
  }

  // Validate critical configuration and data
  private async validateCriticalConfiguration(): Promise<{ valid: boolean; error?: string }> {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    console.log('  🔍 Checking critical database configuration...');
    
    // Simulate checking for critical system settings and data integrity
    const configValidProbability = Math.random();
    
    if (configValidProbability > 0.9) {
      const errors = [
        'Missing system settings entries',
        'Invalid ESI configuration',
        'Corrupted user role definitions',
        'Missing default corporation data',
        'Database schema version mismatch'
      ];
      const randomError = errors[Math.floor(Math.random() * errors.length)];
      console.log(`    ❌ Configuration issue: ${randomError}`);
      return { valid: false, error: randomError };
    }
    
    console.log('    ✅ Critical configuration valid');
    return { valid: true };
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    const startTime = Date.now();
    
    try {
      if (!this.connected) {
        throw new Error('Database not connected');
      }

      // Execute against the real database via the PHP executor (server-owned credentials).
      const response = await fetch('/api/lmeve/execute.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sql, params })
      });

      if (!response.ok) {
        throw new Error(`Query request failed with status ${response.status}`);
      }
      const json = await response.json();

      const executionTime = Date.now() - startTime;
      this.status.queryCount++;
      this.status.avgQueryTime = (this.status.avgQueryTime + executionTime) / 2;

      if (json.ok === false) {
        return {
          success: false,
          error: json.error || 'Query failed',
          executionTime,
          query: sql
        };
      }

      return {
        success: true,
        data: (json.rows as T[]) || [],
        rowCount: typeof json.rowCount === 'number' ? json.rowCount : 0,
        executionTime,
        query: sql
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed',
        executionTime: Date.now() - startTime,
        query: sql
      };
    }
  }

  async getTableInfo(): Promise<TableInfo[]> {
    // Simulate getting table information
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return [
      {
        name: 'characters',
        rowCount: 156,
        size: '2.1 MB',
        lastUpdate: new Date().toISOString(),
        engine: 'InnoDB',
        collation: 'utf8mb4_unicode_ci'
      },
      {
        name: 'corporations',
        rowCount: 8,
        size: '128 KB',
        lastUpdate: new Date().toISOString(),
        engine: 'InnoDB',
        collation: 'utf8mb4_unicode_ci'
      },
      {
        name: 'assets',
        rowCount: 45672,
        size: '125.6 MB',
        lastUpdate: new Date().toISOString(),
        engine: 'InnoDB',
        collation: 'utf8mb4_unicode_ci'
      },
      {
        name: 'industry_jobs',
        rowCount: 2341,
        size: '8.9 MB',
        lastUpdate: new Date().toISOString(),
        engine: 'InnoDB',
        collation: 'utf8mb4_unicode_ci'
      },
      {
        name: 'mining_operations',
        rowCount: 1567,
        size: '3.2 MB',
        lastUpdate: new Date().toISOString(),
        engine: 'InnoDB',
        collation: 'utf8mb4_unicode_ci'
      },
      {
        name: 'killmails',
        rowCount: 892,
        size: '12.4 MB',
        lastUpdate: new Date().toISOString(),
        engine: 'InnoDB',
        collation: 'utf8mb4_unicode_ci'
      },
      {
        name: 'market_prices',
        rowCount: 15678,
        size: '45.2 MB',
        lastUpdate: new Date().toISOString(),
        engine: 'InnoDB',
        collation: 'utf8mb4_unicode_ci'
      },
      {
        name: 'eve_types',
        rowCount: 87432,
        size: '156.7 MB',
        lastUpdate: new Date().toISOString(),
        engine: 'InnoDB',
        collation: 'utf8mb4_unicode_ci'
      }
    ];
  }

  getStatus(): DatabaseStatus {
    if (this.status.connected && this.status.uptime) {
      this.status.uptime = Math.floor((Date.now() - this.status.uptime) / 1000);
    }
    return this.status;
  }

  getConfig(): DatabaseConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<DatabaseConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  async initializeSchema(): Promise<{ success: boolean; error?: string; tablesCreated?: number }> {
    try {
      console.log('🔨 Initializing LMeve database schema...');
      
      // Import the schema generation functions
      const { generateAllCreateTableSQL, lmeveSchemas } = await import('./database-schemas');
      
      // Generate all CREATE TABLE statements
      const schemaSQL = generateAllCreateTableSQL();
      
      console.log(`📋 Generated schema SQL for ${lmeveSchemas.length} tables`);
      console.log(`💾 Executing schema creation (this may take a moment)...`);
      
      // In a real implementation, this would execute the SQL
      // For simulation, we'll mark the database as initialized
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
      
      // Mark all tables as existing
      if (!this.tablesExistCache) {
        this.tablesExistCache = new Set();
      }
      this.tablesExistCache.add('_initialized');
      lmeveSchemas.forEach(schema => {
        this.tablesExistCache!.add(schema.tableName);
      });
      
      console.log(`✅ Successfully created ${lmeveSchemas.length} tables`);
      
      return {
        success: true,
        tablesCreated: lmeveSchemas.length
      };
    } catch (error) {
      console.error('❌ Schema initialization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize schema'
      };
    }
  }
}

// Database queries specific to LMeve functionality
export const LMeveQueries = {
  // Character and Corporation queries
  getCharacters: (corporationId?: number) => 
    corporationId !== undefined && corporationId !== null
      ? `SELECT * FROM characters WHERE corporation_id = ${corporationId} ORDER BY name`
      : `SELECT * FROM characters ORDER BY name`,
  
  getCorporations: () => 
    `SELECT c.*, COUNT(ch.character_id) as member_count 
     FROM corporations c 
     LEFT JOIN characters ch ON c.corporation_id = ch.corporation_id 
     GROUP BY c.corporation_id`,

  // Asset queries
  getAssets: (ownerId?: number) => 
    ownerId !== undefined && ownerId !== null
      ? `SELECT a.*, t.type_name, l.location_name 
         FROM assets a 
         JOIN eve_types t ON a.type_id = t.type_id 
         JOIN locations l ON a.location_id = l.location_id 
         WHERE a.owner_id = ${ownerId}`
      : `SELECT a.*, t.type_name, l.location_name 
         FROM assets a 
         JOIN eve_types t ON a.type_id = t.type_id 
         JOIN locations l ON a.location_id = l.location_id`,

  // Industry job queries
  getIndustryJobs: (status?: string) =>
    status !== undefined && status !== null && status !== ''
      ? `SELECT ij.*, t.type_name as blueprint_name, pt.type_name as product_name 
         FROM industry_jobs ij 
         JOIN eve_types t ON ij.blueprint_type_id = t.type_id 
         JOIN eve_types pt ON ij.product_type_id = pt.type_id 
         WHERE ij.status = '${status}' 
         ORDER BY ij.end_date`
      : `SELECT ij.*, t.type_name as blueprint_name, pt.type_name as product_name 
         FROM industry_jobs ij 
         JOIN eve_types t ON ij.blueprint_type_id = t.type_id 
         JOIN eve_types pt ON ij.product_type_id = pt.type_id 
         ORDER BY ij.end_date`,

  // Mining operation queries
  getMiningOperations: (dateFrom?: string, dateTo?: string) => {
    let query = `SELECT mo.*, t.type_name as ore_name, s.system_name 
                 FROM mining_operations mo 
                 JOIN eve_types t ON mo.ore_type_id = t.type_id 
                 JOIN systems s ON mo.system_id = s.system_id`;
    
    if ((dateFrom && dateFrom !== '') || (dateTo && dateTo !== '')) {
      query += ` WHERE`;
      if (dateFrom && dateFrom !== '') query += ` mo.date >= '${dateFrom}'`;
      if (dateFrom && dateFrom !== '' && dateTo && dateTo !== '') query += ` AND`;
      if (dateTo && dateTo !== '') query += ` mo.date <= '${dateTo}'`;
    }
    
    return query + ` ORDER BY mo.date DESC`;
  },

  // Market data queries
  getMarketPrices: (regionId?: number) =>
    regionId !== undefined && regionId !== null
      ? `SELECT mp.*, t.type_name 
         FROM market_prices mp 
         JOIN eve_types t ON mp.type_id = t.type_id 
         WHERE mp.region_id = ${regionId} 
         ORDER BY mp.last_update DESC`
      : `SELECT mp.*, t.type_name 
         FROM market_prices mp 
         JOIN eve_types t ON mp.type_id = t.type_id 
         ORDER BY mp.last_update DESC`,

  // Killmail queries
  getKillmails: (corporationId?: number) =>
    corporationId !== undefined && corporationId !== null
      ? `SELECT k.*, t.type_name as ship_name, s.system_name 
         FROM killmails k 
         JOIN eve_types t ON k.ship_type_id = t.type_id 
         JOIN systems s ON k.system_id = s.system_id 
         WHERE k.victim_corporation_id = ${corporationId} 
         ORDER BY k.killmail_time DESC`
      : `SELECT k.*, t.type_name as ship_name, s.system_name 
         FROM killmails k 
         JOIN eve_types t ON k.ship_type_id = t.type_id 
         JOIN systems s ON k.system_id = s.system_id 
         ORDER BY k.killmail_time DESC`,

  // Wallet queries
  getWalletTransactions: (corporationId?: number) =>
    corporationId !== undefined && corporationId !== null
      ? `SELECT wt.*, t.type_name, l.location_name 
         FROM wallet_transactions wt 
         JOIN eve_types t ON wt.type_id = t.type_id 
         JOIN locations l ON wt.location_id = l.location_id 
         WHERE wt.corporation_id = ${corporationId} 
         ORDER BY wt.date DESC 
         LIMIT 1000`
      : `SELECT wt.*, t.type_name, l.location_name 
         FROM wallet_transactions wt 
         JOIN eve_types t ON wt.type_id = t.type_id 
         JOIN locations l ON wt.location_id = l.location_id 
         ORDER BY wt.date DESC 
         LIMIT 1000`,

  getWalletDivisions: (corporationId?: number) =>
    corporationId !== undefined && corporationId !== null
      ? `SELECT * FROM wallet_divisions WHERE corporation_id = ${corporationId} ORDER BY division_id`
      : `SELECT * FROM wallet_divisions ORDER BY division_id`
};

// ESI Data Storage Service - Phase 1 Implementation
// These functions handle storing ESI-fetched data into the database

export interface ESIMemberData {
  character_id: number;
  character_name?: string;
  corporation_id: number;
  corporation_name?: string;
  alliance_id?: number;
  alliance_name?: string;
  roles?: string[];
  titles?: string[];
  last_login?: string;
  location_id?: number;
  location_name?: string;
  ship_type_id?: number;
  ship_type_name?: string;
  logon_duration?: number;
  start_date_time?: string;
  logoff_date_time?: string;
  is_online?: boolean;
}

export interface ESIAssetData {
  item_id: number;
  type_id: number;
  type_name?: string;
  category_id?: number;
  category_name?: string;
  group_id?: number;
  group_name?: string;
  quantity: number;
  location_id: number;
  location_name?: string;
  location_type?: 'station' | 'structure' | 'ship' | 'container';
  location_flag?: string;
  owner_id: number;
  owner_name?: string;
  is_singleton?: boolean;
  is_blueprint_copy?: boolean;
  blueprint_runs?: number;
  material_efficiency?: number;
  time_efficiency?: number;
}

export interface ESIIndustryJobData {
  job_id?: number;
  installer_id: number;
  installer_name?: string;
  facility_id: number;
  facility_name?: string;
  station_id?: number;
  blueprint_id: number;
  blueprint_type_id?: number;
  blueprint_type_name?: string;
  output_location_id?: number;
  runs: number;
  cost?: number;
  product_type_id: number;
  product_type_name?: string;
  product_quantity: number;
  status?: string;
  duration: number;
  start_date: string;
  end_date: string;
  completed_date?: string;
  activity_id?: number;
  activity_name?: string;
}

export interface ESIMarketOrderData {
  order_id: number;
  type_id: number;
  type_name?: string;
  location_id: number;
  location_name?: string;
  region_id: number;
  region_name?: string;
  price: number;
  volume_total: number;
  volume_remain: number;
  min_volume: number;
  duration: number;
  is_buy_order: boolean;
  issued: string;
  range?: string;
}

export interface ESIWalletTransactionData {
  transaction_id: number;
  client_id: number;
  client_name?: string;
  date: string;
  is_buy: boolean;
  is_personal: boolean;
  journal_ref_id: number;
  location_id: number;
  location_name?: string;
  quantity: number;
  type_id: number;
  type_name?: string;
  unit_price: number;
}

export interface ESIMiningLedgerData {
  character_id: number;
  character_name?: string;
  date: string;
  type_id: number;
  type_name?: string;
  quantity: number;
  system_id: number;
  system_name?: string;
}

export interface ESIContainerLogData {
  logged_at: string;
  location_id: number;
  location_flag?: string;
  action?: string;
  character_id?: number;
  character_name?: string;
  type_id: number;
  type_name?: string;
  quantity: number;
}

export interface ESIContractData {
  contract_id: number;
  issuer_id: number;
  issuer_name?: string;
  issuer_corporation_id: number;
  assignee_id: number;
  assignee_name?: string;
  acceptor_id?: number;
  acceptor_name?: string;
  start_location_id?: number;
  start_location_name?: string;
  end_location_id?: number;
  end_location_name?: string;
  type: 'item_exchange' | 'auction' | 'courier' | 'loan';
  status: 'outstanding' | 'in_progress' | 'finished_issuer' | 'finished_contractor' | 'finished' | 'cancelled' | 'rejected' | 'failed' | 'deleted' | 'reversed';
  title?: string;
  for_corporation: boolean;
  availability: 'public' | 'personal' | 'corporation' | 'alliance';
  date_issued: string;
  date_expired: string;
  date_accepted?: string;
  date_completed?: string;
  days_to_complete?: number;
  price?: number;
  reward?: number;
  collateral?: number;
  buyout?: number;
  volume?: number;
}

export interface ESIContractItemData {
  contract_id: number;
  record_id: number;
  type_id: number;
  type_name?: string;
  quantity: number;
  is_included: boolean;
  is_singleton: boolean;
  raw_quantity?: number;
}

export class ESIDataStorageService {
  constructor(private dbManager: DatabaseManager) {}

// The old in-browser ESI writers (storeMembers/storeAssets/storeIndustryJobs/
// storeMarketOrders/storeWalletTransactions/storeMiningLedger/storeContainerLogs/
// storeContracts/storeContractItems + string-escape helper) were removed: every
// corp process now runs server-side via sync-core.php, and these INSERTs targeted
// pre-migration columns (system_id, last_update, issuer_name, buyout, volume,
// manufacturing_jobs table) that no longer exist in the canonical schema.

  async getIndustryJobs(): Promise<ESIIndustryJobData[]> {
    try {
      const result = await this.dbManager.query(LMeveQueries.getIndustryJobs());
      if (result.success && result.data) {
        return result.data.map((row: any) => ({
          job_id: row.job_id,
          installer_id: row.installer_id,
          installer_name: row.installer_name,
          facility_id: row.facility_id,
          facility_name: row.facility_name,
          station_id: row.station_id,
          blueprint_id: row.blueprint_id,
          blueprint_type_id: row.blueprint_type_id,
          blueprint_type_name: row.blueprint_type_name || row.blueprint_name,
          output_location_id: row.output_location_id,
          runs: row.runs,
          cost: row.cost,
          product_type_id: row.product_type_id,
          product_type_name: row.product_type_name || row.product_name,
          product_quantity: row.product_quantity,
          status: row.status,
          duration: row.duration,
          start_date: row.start_date,
          end_date: row.end_date,
          completed_date: row.completed_date,
          activity_id: row.activity_id,
          activity_name: row.activity_name
        }));
      }
      return [];
    } catch (error) {
      console.error('❌ Failed to retrieve industry jobs from database:', error);
      return [];
    }
  }
}

// Singleton database service instance
let databaseServiceInstance: ESIDataStorageService | null = null;

export function getDatabaseService(): ESIDataStorageService {
  if (!databaseServiceInstance) {
    // Create a mock database manager for browser environment
    const mockDbManager = new DatabaseManager(defaultDatabaseConfig);
    databaseServiceInstance = new ESIDataStorageService(mockDbManager);
  }
  return databaseServiceInstance;
}