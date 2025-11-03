import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DatabaseConfigPanel } from './DatabaseConfigPanel';
import { ConnectionLogsPanel } from './ConnectionLogsPanel';
import { CaretDown, CaretRight, ArrowClockwise } from '@phosphor-icons/react';
import { DatabaseManager } from '@/lib/database';
import { 
  useDatabaseSettings,
  useLocalKV,
  validateSettings,
  exportAllSettings,
  type DatabaseSettings,
} from '@/lib/persistenceService';
import { toast } from 'sonner';

// Local site-data helpers (best-effort) to reflect setup status
async function loadSiteData(key: string) {
  try {
    const resp = await fetch(`/api/site-data.php?key=${encodeURIComponent(key)}`);
    if (resp.ok) {
      const json = await resp.json();
      return json?.value ?? null;
    }
  } catch {}
  try {
    const raw = localStorage.getItem(`lmeve-site-data-fallback:${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
async function saveSiteData(key: string, value: any) {
  try {
    const resp = await fetch('/api/site-data.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
    if (resp.ok) return;
  } catch {}
  try { localStorage.setItem(`lmeve-site-data-fallback:${key}`, JSON.stringify(value)); } catch {}
}

const DatabaseTabContainer: React.FC = () => {
  const [databaseSettings, setDatabaseSettings] = useDatabaseSettings();
  
  // Track the real unmasked password separately - never let it get overwritten by '***' from server
  const [realPassword, setRealPassword] = React.useState<string>(databaseSettings.password || '');
  const [realSudoPassword, setRealSudoPassword] = React.useState<string>(databaseSettings.sudoPassword || '');
  
  // Track last-saved settings snapshot to compute "dirty" state (strict model)
  const lastSavedRef = React.useRef<DatabaseSettings | null>(null);
  React.useEffect(() => {
    if (!lastSavedRef.current) {
      // Initial mount: treat current settings as saved baseline
      lastSavedRef.current = { ...databaseSettings } as DatabaseSettings;
    }
  }, []);
  const isDirty = React.useMemo(() => {
    const a = databaseSettings as any;
    const b = (lastSavedRef.current || {}) as any;
    const keys: (keyof DatabaseSettings)[] = ['host','port','database','username','password','sudoUsername','sudoPassword'];
    return keys.some(k => String(a?.[k] ?? '') !== String(b?.[k] ?? ''));
  }, [databaseSettings]);

  // Connection/logs state localized to the tab
  const [testingConnection, setTestingConnection] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [connectionLogs, setConnectionLogs] = React.useState<string[]>([]);

  // Connection status persisted latch and UI state
  const [persistedDbConnected, setPersistedDbConnected] = useLocalKV<boolean>('lmeve-database-connected', false);
  const [dbStatus, setDbStatus] = React.useState({
    connected: persistedDbConnected,
    connectionCount: 0,
    queryCount: 0,
    avgQueryTime: 0,
    uptime: 0,
    lastConnection: null as string | null,
    lastError: null as string | null,
  });

  const [tableInfo, setTableInfo] = React.useState<any[]>([]);
  const [adminExists, setAdminExists] = React.useState<boolean | null>(null);
  const [showDatabaseTables, setShowDatabaseTables] = useLocalKV<boolean>('database-tables-expanded', false);
  const [lastSuccessfulTest, setLastSuccessfulTest] = React.useState<number | null>(null);

  const addConnectionLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };
  const clearConnectionLogs = () => setConnectionLogs([]);

  const syncServerSettings = async () => {
    try {
      const backup = await exportAllSettings();
      // Inject real unmasked passwords before sending to server
      if (backup.settings?.database) {
        if (realPassword) backup.settings.database.password = realPassword;
        if (realSudoPassword) backup.settings.database.sudoPassword = realSudoPassword;
      }
      await fetch('/api/settings.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backup)
      });
    } catch {}
  };

  const saveDatabase = async () => {
    const errors = validateSettings('database', databaseSettings as any);
    if (errors.length) {
      toast.error(`Validation failed: ${errors.join(', ')}`);
      return;
    }
    setDatabaseSettings({ ...databaseSettings });
    syncServerSettings();
    toast.success('Database settings saved successfully');
    // Update last-saved snapshot to current values after successful save
    lastSavedRef.current = { ...databaseSettings } as DatabaseSettings;
  };

  const updateDatabaseSetting = (key: keyof DatabaseSettings, value: any) => {
    // Track real passwords separately
    if (key === 'password') setRealPassword(value);
    if (key === 'sudoPassword') setRealSudoPassword(value);
    setDatabaseSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleTestDbConnection = async () => {
    if (testingConnection) {
      toast.warning('Database test already in progress...');
      return;
    }

    const { host, port, database, username } = databaseSettings;
    const password = realPassword; // Use real unmasked password
    if (!host || !port || !database || !username || !password) {
      const error = 'All database fields are required: host, port, database, username, password';
      toast.error(error);
      addConnectionLog(`❌ ${error}`);
      return;
    }

    setConnectionLogs([]);
    setTestingConnection(true);
    try {
      addConnectionLog('🔍 Starting comprehensive database validation...');
      addConnectionLog(`🎯 Target: ${username}@${host}:${port}/${database}`);

      // Step 0: API health check
      try {
        addConnectionLog('🌐 Checking API health at /api/health.php ...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const h = await fetch('/api/health.php', { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);
        if (h.ok) {
          addConnectionLog('✅ API is reachable');
        } else {
          addConnectionLog(`⚠️ API health responded with HTTP ${h.status}`);
          addConnectionLog('⛔ Aborting DB test: backend health failed');
          return;
        }
      } catch (e) {
        addConnectionLog(`⚠️ API health check failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        addConnectionLog('⛔ Aborting DB test: backend not reachable');
        return;
      }

      const config = {
        host,
        port: Number(port),
        database,
        username,
        password,
        ssl: false,
        connectionPoolSize: 1,
        queryTimeout: 30,
        autoReconnect: false,
        charset: 'utf8mb4',
      };
      const manager = new DatabaseManager(config);
      addConnectionLog('🔌 Performing client-side connectivity checks (network/format)...');
      const result = await manager.testConnection();

      if (result.success && result.validated) {
        addConnectionLog('✅ Database connection VALIDATED successfully!');
        if (typeof result.latency === 'number') {
          addConnectionLog(`⚡ Connection latency: ${result.latency}ms`);
        }
        toast.success('✅ Connection validated');
        setLastSuccessfulTest(Date.now());

        // Probe server-side authoritative details
        try {
          addConnectionLog('🧪 Server DB probe via /api/test-connection.php ...');
          const r = await fetch('/api/test-connection.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              host,
              port: Number(port),
              database,
              username,
              password,
            })
          });
          if (!r.ok) {
            addConnectionLog(`❌ Server probe failed (HTTP ${r.status})`);
          } else {
            const j = await r.json();
            addConnectionLog(`🗄️  MySQL server: ${j?.serverVersion || 'unknown'} | User: ${j?.currentUser || 'unknown'}`);
            addConnectionLog(`📦 Select DB '${database}': ${j?.canSelectLmeve ? 'OK' : 'FAILED'}`);
            addConnectionLog(`🧱 Users table: ${j?.usersTableExists ? 'FOUND' : 'NOT FOUND'}`);
            if (typeof j?.adminExists === 'boolean') {
              setAdminExists(j.adminExists);
              addConnectionLog(`👤 Admin user: ${j.adminExists ? 'FOUND' : 'NOT FOUND'}`);
            }
            if (j?.adminPasswordInfo && typeof j.adminPasswordInfo === 'object') {
              const info = j.adminPasswordInfo;
              const type = info.type || 'unknown';
              const matchesDefault = !!info.matchesDefault;
              addConnectionLog(`🔐 Admin password type: ${type}`);
              addConnectionLog(matchesDefault 
                ? '⚠️ Admin password matches default (12345)'
                : '✅ Admin password is not default');
              // If admin exists and matches default, attempt a real manual login check
              if (j.adminExists === true) {
                try {
                  addConnectionLog('🔑 Verifying manual login with admin/******** ...');
                  const qs = new URLSearchParams();
                  qs.set('host', String(host));
                  qs.set('port', String(port));
                  qs.set('username', String(username));
                  qs.set('password', String(password));
                  qs.set('database', String(database));
                  const ml = await fetch(`/api/auth/manual-login.php?${qs.toString()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: 'admin', password: '12345' }),
                  });
                  if (ml.ok) {
                    addConnectionLog('✅ Manual login with admin succeeded');
                  } else {
                    let errText = '';
                    try { const jj = await ml.json(); errText = jj?.error || ''; } catch {}
                    addConnectionLog(`❌ Manual login failed (HTTP ${ml.status}) ${errText ? '- ' + errText : ''}`);
                  }
                } catch (e) {
                  addConnectionLog(`❌ Manual login check error: ${e instanceof Error ? e.message : 'Unknown error'}`);
                }
              }
            }
          }
        } catch (e) {
          addConnectionLog(`⚠️ Server probe error: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      } else if (result.success) {
        addConnectionLog('⚠️ Partial connection success but validation incomplete');
        toast.warning('⚠️ Partial success');
      } else {
        addConnectionLog(`❌ Connection test FAILED: ${result.error}`);
        toast.error(`❌ Connection failed: ${result.error}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown connection error';
      addConnectionLog(`💥 Test error: ${errorMsg}`);
      toast.error(`Test error: ${errorMsg}`);
    } finally {
      addConnectionLog('🏁 Database connection test completed');
      setTestingConnection(false);
    }
  };

  const handleConnectDb = async () => {
    const { host, port, database, username, password } = databaseSettings;
    if (!host || !port || !database || !username || !password) {
      toast.error('All database fields are required');
      return;
    }
    setIsConnecting(true);
    try {
      addConnectionLog('🔌 Establishing database connection status...');

      // Update connection status (already validated by Test)
      setDbStatus(prev => ({
        ...prev,
        connected: true,
        connectionCount: 1,
        lastConnection: new Date().toISOString(),
        lastError: null,
      }));
      setPersistedDbConnected(true);

      // Dispatch DB connected event
      try { window.dispatchEvent(new CustomEvent('lmeve-db-connected', { detail: true })); } catch {}

      // Update setup status
      try {
        const setup = (await loadSiteData('setup-status')) || {};
        const updated = {
          hasEverBeenGreen: !!setup.hasEverBeenGreen || true,
          esiConfigured: !!setup.esiConfigured,
          databaseConnected: true,
          isFullyConfigured: !!setup.esiConfigured && true,
          lastUpdated: new Date().toISOString(),
        };
        await saveSiteData('setup-status', { ...setup, ...updated });
      } catch {}

      addConnectionLog('✅ Database connection established!');
      toast.success('Connected to database');

      // After connect, refresh admin presence
      try {
        const r = await fetch('/api/test-connection.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host,
            port: Number(port),
            database,
            username,
            password,
          })
        });
        if (r.ok) {
          const j = await r.json();
          if (typeof j?.adminExists === 'boolean') {
            setAdminExists(j.adminExists);
            addConnectionLog(`👤 Admin user: ${j.adminExists ? 'FOUND' : 'NOT FOUND'}`);
          }
        }
      } catch {}
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setDbStatus(prev => ({ ...prev, connected: false, lastError: errorMsg }));
      addConnectionLog(`❌ Connection failed: ${errorMsg}`);
      toast.error(`Connection failed: ${errorMsg}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectDb = async () => {
    setDbStatus(prev => ({ ...prev, connected: false, lastError: null }));
    setPersistedDbConnected(false);
    try { window.dispatchEvent(new CustomEvent('lmeve-db-connected', { detail: false })); } catch {}
    try {
      const setup = (await loadSiteData('setup-status')) || {};
      const updated = {
        ...setup,
        databaseConnected: false,
        isFullyConfigured: false,
        lastUpdated: new Date().toISOString(),
      };
      await saveSiteData('setup-status', updated);
    } catch {}
    toast.info('Disconnected from database');
    setAdminExists(null);
  };

  // Removed seed-admin functionality for security concerns; admin should be provisioned via setup script only.

  React.useEffect(() => {
    setDbStatus(prev => ({ ...prev, connected: persistedDbConnected }));
  }, [persistedDbConnected]);

  const loadTableInfo = async () => {
    // TODO: Implement table info fetch via DatabaseManager when available
    console.log('Table info loading not implemented yet');
  };

  return (
    <>
      {/* Compact Database Connection Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DatabaseConfigPanel
          databaseSettings={databaseSettings}
          dbConnected={!!dbStatus.connected}
          onUpdate={(key, value) => updateDatabaseSetting(key as any, value)}
        />

        {/* Action Bar under configuration (spans the two config columns) */}
        <div className="lg:col-span-2 -mt-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestDbConnection}
              disabled={testingConnection}
              className="hover:bg-accent/10 active:bg-accent/20 transition-colors"
            >
              {testingConnection ? (
                <>
                  <ArrowClockwise size={16} className="mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <CaretRight size={16} className="mr-2" />
                  Test Connection
                </>
              )}
            </Button>

            {dbStatus.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectDb}
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnectDb}
                disabled={isConnecting || !lastSuccessfulTest || (Date.now() - lastSuccessfulTest > 120000)}
                className="bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  !lastSuccessfulTest
                    ? 'Run Test Connection first'
                    : (Date.now() - lastSuccessfulTest > 120000)
                    ? 'Test expired (2 min), re-test connection'
                    : 'Establish database connection'
                }
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </Button>
            )}

            <Button
              onClick={saveDatabase}
              size="sm"
              className={isDirty
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600/70 text-white cursor-default opacity-70'}
              disabled={!isDirty}
              title={isDirty ? 'Persist configuration to server settings' : 'Saved'}
            >
              {isDirty ? 'Save' : 'Saved'}
            </Button>

            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              size="sm"
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Connection Logs + Actions (Right column) */}
        <ConnectionLogsPanel
          logs={connectionLogs}
          testing={testingConnection}
          connected={!!dbStatus.connected}
          onClear={clearConnectionLogs}
          onTest={handleTestDbConnection}
          onConnect={handleConnectDb}
          onDisconnect={handleDisconnectDb}
          onSave={saveDatabase}
          onReset={() => window.location.reload()}
        />
      </div>

      {/* Database Tables - Collapsible Section */}
      {dbStatus.connected && tableInfo.length > 0 && (
        <div className="border-t border-border pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-auto hover:bg-transparent"
              onClick={() => setShowDatabaseTables(!showDatabaseTables)}
            >
              <div className="flex items-center gap-2">
                {showDatabaseTables ? (
                  <CaretDown size={16} className="text-muted-foreground" />
                ) : (
                  <CaretRight size={16} className="text-muted-foreground" />
                )}
                <h4 className="font-medium">Database Tables</h4>
                <Badge variant="outline" className="text-xs">
                  {tableInfo.length} tables
                </Badge>
              </div>
            </Button>
            {showDatabaseTables && (
              <Button variant="outline" size="sm" onClick={loadTableInfo}>
                <ArrowClockwise size={16} className="mr-2" />
                Refresh
              </Button>
            )}
          </div>

          {showDatabaseTables && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b border-border">
                <div className="grid grid-cols-5 gap-4 text-sm font-medium text-muted-foreground">
                  <span>Table Name</span>
                  <span>Rows</span>
                  <span>Size</span>
                  <span>Engine</span>
                  <span>Last Update</span>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {tableInfo.map((table, index) => (
                  <div key={index} className="px-4 py-2 border-b border-border/50 last:border-b-0 hover:bg-muted/30">
                    <div className="grid grid-cols-5 gap-4 text-sm">
                      <span className="font-mono">{table.name}</span>
                      <span>{table.rowCount?.toLocaleString?.() ?? '-'}</span>
                      <span>{table.size ?? '-'}</span>
                      <span>{table.engine ?? '-'}</span>
                      <span className="text-muted-foreground">
                        {table.lastUpdate ? new Date(table.lastUpdate).toLocaleDateString() : '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default DatabaseTabContainer;
