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
    const resp = await fetch(`/api/site-data.php?key=${encodeURIComponent(key)}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
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
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
    if (resp.ok) return;
  } catch {}
  try { localStorage.setItem(`lmeve-site-data-fallback:${key}`, JSON.stringify(value)); } catch {}
}

const DatabaseTabContainer: React.FC = () => {
  const [databaseSettings, setDatabaseSettings] = useDatabaseSettings();
  
  // Track real unmasked passwords entered by user (persisted in sessionStorage for this session)
  // Initialize from sessionStorage if available, otherwise null
  const [realPassword, setRealPassword] = React.useState<string | null>(() => {
    try {
      const stored = sessionStorage.getItem('lmeve-temp-db-password');
      return stored || null;
    } catch {
      return null;
    }
  });
  const [realSudoPassword, setRealSudoPassword] = React.useState<string | null>(() => {
    try {
      const stored = sessionStorage.getItem('lmeve-temp-sudo-password');
      return stored || null;
    } catch {
      return null;
    }
  });
  
  // Computed effective password: use user-entered if available, otherwise server value
  const effectivePassword = realPassword !== null ? realPassword : (databaseSettings.password || '');
  const effectiveSudoPassword = realSudoPassword !== null ? realSudoPassword : (databaseSettings.sudoPassword || '');
  
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
      // Inject real unmasked passwords before sending to server (only if user entered new ones)
      if (backup.settings?.database) {
        if (realPassword !== null) backup.settings.database.password = realPassword;
        if (realSudoPassword !== null) backup.settings.database.sudoPassword = realSudoPassword;
      }
      const resp = await fetch('/api/settings.php', {
        method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(backup)
            });
            if (!resp.ok) {
              console.warn('syncServerSettings failed', resp.status);
              toast.error('Failed to save database settings to server');
            }
          } catch (err) {
            console.warn('syncServerSettings error', err);
            toast.error('Failed to save database settings to server');
          }
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
    // Track real passwords separately and persist for this session
    if (key === 'password') {
      setRealPassword(value);
      try {
        sessionStorage.setItem('lmeve-temp-db-password', value);
      } catch {
        // Ignore storage errors
      }
    }
    if (key === 'sudoPassword') {
      setRealSudoPassword(value);
      try {
        sessionStorage.setItem('lmeve-temp-sudo-password', value);
      } catch {
        // Ignore storage errors
      }
    }
    setDatabaseSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleTestDbConnection = async () => {
      if (testingConnection) return;

      const { host, port, database, username } = databaseSettings;
      const password = effectivePassword;
    
      if (!host || !port || !database || !username || !password) {
        toast.error('All database fields are required');
        return;
      }
    
      if (password === '***') {
        toast.error('Please enter the database password');
        return;
      }

      // Test only: no save, no connect latch, no login, no page reload.
      setTestingConnection(true);
      setLastSuccessfulTest(null);
    
      try {
        addConnectionLog('Starting database connection test (no save)...');
        addConnectionLog(`Target: ${username}@${host}:${port}/${database}`);

        addConnectionLog('Server probe via /api/test-connection.php ...');
        const r = await fetch('/api/test-connection.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            host,
            port: Number(port),
            database,
            username,
            password,
          }),
        });

        if (!r.ok) {
          let errText = `HTTP ${r.status}`;
          try {
            const j = await r.json();
            if (j?.error) errText = String(j.error);
            else if (j?.mysqlError) errText = String(j.mysqlError);
          } catch {}
          addConnectionLog(`Connection test FAILED: ${errText}`);
          toast.error(`Connection failed: ${errText}`);
          return;
        }

        const j = await r.json();
        if (j?.ok === false) {
          const errText = j?.mysqlError || j?.error || 'Connection failed';
          addConnectionLog(`Connection test FAILED: ${errText}`);
          toast.error(`Connection failed: ${errText}`);
          return;
        }

        if (typeof j?.latencyMs === 'number') {
          addConnectionLog(`Latency: ${j.latencyMs}ms`);
        }
        addConnectionLog(`MySQL: ${j?.serverVersion || 'unknown'} | User: ${j?.currentUser || 'unknown'}`);
        addConnectionLog(`Select DB '${database}': ${j?.canSelectLmeve ? 'OK' : 'FAILED'}`);
        addConnectionLog(`Users table: ${j?.usersTableExists ? 'FOUND' : 'NOT FOUND'}`);
        if (typeof j?.adminExists === 'boolean') {
          setAdminExists(j.adminExists);
          addConnectionLog(`Admin user: ${j.adminExists ? 'FOUND' : 'NOT FOUND'}`);
        }
        if (j?.adminPasswordInfo && typeof j.adminPasswordInfo === 'object') {
          const info = j.adminPasswordInfo;
          addConnectionLog(`Admin password type: ${info.type || 'unknown'}`);
          addConnectionLog(
            info.matchesDefault
              ? 'Admin password matches default (12345)'
              : 'Admin password is not default'
          );
        }

        addConnectionLog('Connection test succeeded. Click Save to persist settings.');
        toast.success('Connection test succeeded');
        setLastSuccessfulTest(Date.now());
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown connection error';
        addConnectionLog(`Test error: ${errorMsg}`);
        toast.error(`Test error: ${errorMsg}`);
      } finally {
        addConnectionLog('Database connection test completed');
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
          credentials: 'include',
          body: JSON.stringify({})
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
    
    // Clear session-stored passwords
    try {
      sessionStorage.removeItem('lmeve-temp-db-password');
      sessionStorage.removeItem('lmeve-temp-sudo-password');
    } catch {
      // Ignore storage errors
    }
    setRealPassword(null);
    setRealSudoPassword(null);
    
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
