import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Database, Trash, Download } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useDatabaseSettings, useLocalKV } from '@/lib/persistenceService';
import { DatabaseManager } from '@/lib/database';
import { useAuth } from '@/lib/auth-provider';
import { isLocalSiteAdmin } from '@/lib/roles';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
// Removed SDE controls and network info per request

interface DatabaseSettingsProps {
  isMobileView?: boolean;
}

export function DatabaseSettings({ isMobileView = false }: DatabaseSettingsProps) {
  const [databaseSettings, setDatabaseSettings] = useDatabaseSettings();

  // Local form state to avoid per-keystroke server syncs
  const [dbForm, setDbForm] = useState(databaseSettings);
  useEffect(() => {
    setDbForm(databaseSettings);
  }, [databaseSettings]);

  const updateDbForm = (updates: Partial<typeof dbForm>) => {
    setDbForm(current => ({ ...current, ...updates }));
  };

  // SDE settings and controls removed

  // Database connection state (persisted)
  const [isConnected, setIsConnected] = useLocalKV<boolean>('lmeve-database-connected', false);

  // Server-backed setup status helpers (site-relative) with graceful fallback
  const SITE_DATA_FALLBACK_PREFIX = 'lmeve-site-data-fallback:';
  const warnedSiteDataFailureRef = useRef(false);
  const loadSetupStatus = async (): Promise<any> => {
    try {
      const resp = await fetch('/api/site-data.php?key=setup-status', { credentials: 'include' });
      if (resp.ok) {
        const json = await resp.json();
        return json?.value ?? {};
      }
      try {
        const diag = await resp.json();
        if (!warnedSiteDataFailureRef.current) {
          console.warn('site-data.php load diagnostics:', diag);
          warnedSiteDataFailureRef.current = true;
        }
      } catch {}
    } catch {}
    try {
      const raw = localStorage.getItem(`${SITE_DATA_FALLBACK_PREFIX}setup-status`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  };
  const saveSetupStatus = async (value: any) => {
    try {
      const resp = await fetch('/api/site-data.php', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'setup-status', value }) });
      if (resp.ok) return;
      try {
        const diag = await resp.json();
        if (!warnedSiteDataFailureRef.current) {
          console.warn('site-data.php save diagnostics:', diag);
          warnedSiteDataFailureRef.current = true;
        }
      } catch {}
    } catch {}
    try { localStorage.setItem(`${SITE_DATA_FALLBACK_PREFIX}setup-status`, JSON.stringify(value)); } catch {}
  };

  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
  const [testingConnection, setTestingConnection] = useState(false);
  // Removed legacy setup progress/status state

  const { user: currentUser } = useAuth();

  // DB admin action state
  const [isRunningDbAction, setIsRunningDbAction] = useState(false);
  const [pendingDbAction, setPendingDbAction] = useState<'clear' | 'schema' | 'sde' | null>(null);
  const [sudoPasswordInput, setSudoPasswordInput] = useState('');

  // Ref for auto-scrolling logs
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Removed network info and system status state

  // Note: These will be instantiated with proper config when needed

  // Load settings on component mount
  useEffect(() => {
    // Load server-backed settings (if available) to hydrate local config for all users
    (async () => {
      try {
        const resp = await fetch('/api/settings.php', { method: 'GET', credentials: 'include', cache: 'no-store' });
        if (resp.ok) {
          const data = await resp.json();
          const srv = data?.settings?.database;
          if (srv && typeof srv === 'object') {
            // Hydrate only the local form; do not persist to server here
            setDbForm(current => ({
              ...current,
              host: srv.host ?? current?.host ?? '',
              port: srv.port ?? current?.port ?? 3306,
              database: srv.database ?? current?.database ?? 'lmeve2',
              username: srv.username ?? current?.username ?? 'lmeve',
              // Keep existing local secret if server returns masked '***'
              password: (srv.password && srv.password !== '***') ? srv.password : (current?.password ?? ''),
              sudoUsername: srv.sudoUsername ?? current?.sudoUsername ?? 'root',
              sudoPassword: (srv.sudoPassword && srv.sudoPassword !== '***') ? srv.sudoPassword : (current?.sudoPassword ?? ''),
            }));
          }
        }
      } catch {}
    })();
  }, []);
  

  // Auto-scroll logs to bottom when new logs are added
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [connectionLogs]);

  const addConnectionLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setConnectionLogs(prev => [...prev.slice(-199), logEntry]);
  };

  const handleTestConnection = async () => {
    if (!dbForm?.host || !dbForm?.port || !dbForm?.username || !dbForm?.password) {
      toast.error('Please fill in all database connection fields');
      return;
    }

    setTestingConnection(true);
    addConnectionLog('Starting database connection test...');
    try {
      const dbConfig = {
        host: dbForm.host,
        port: parseInt(String(dbForm.port)),
        username: dbForm.username,
        password: dbForm.password,
        database: dbForm.database || 'mysql',
        ssl: false,
        connectionPoolSize: 10,
        queryTimeout: 30,
        autoReconnect: true,
        charset: 'utf8mb4'
      };
      const manager = new DatabaseManager(dbConfig);
      const result = await manager.testConnection();

      if (result.success) {
        // Test only — do not save settings, mark connected, or mutate setup status.
        addConnectionLog('Database connection test successful (not saved)');
        if (typeof (result as any).usersTableExists !== 'undefined') {
          addConnectionLog(`Users table check: ${(result as any).usersTableExists ? 'FOUND' : 'NOT FOUND'}`);
        }
        if ((result as any).adminExists !== undefined) {
          addConnectionLog(`Admin user lookup: ${(result as any).adminExists ? 'FOUND' : 'NOT FOUND'}`);
        }
        if ((result as any).adminExists && (result as any).adminPasswordInfo) {
          const info = (result as any).adminPasswordInfo;
          addConnectionLog(`Admin password status: set=${info.set ? 'YES' : 'NO'}; type=${info.type}; matches default 12345=${info.matchesDefault ? 'YES' : 'NO'}`);
        } else if ((result as any).adminExists && !(result as any).adminPasswordInfo) {
          addConnectionLog('Admin password status: (no details reported by server)');
        } else {
          addConnectionLog('Admin account missing. Seed admin (admin/12345) to enable local sign-in');
        }
        toast.success('Database connection test successful — click Save to keep settings');
      } else {
        setIsConnected(false);
        addConnectionLog(`❌ Connection failed: ${result.error}`);
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (error) {
      setIsConnected(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addConnectionLog(`❌ Connection error: ${errorMessage}`);
      toast.error(`Connection error: ${errorMessage}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleConnect = async () => {
    if (!dbForm?.host || !dbForm?.port || 
        !dbForm?.username || !dbForm?.password) {
      toast.error('Please fill in all database connection fields');
      return;
    }

    setTestingConnection(true);
    addConnectionLog('Starting database connect...');
    try {
      const dbConfig = {
        host: dbForm.host,
        port: parseInt(String(dbForm.port)),
        username: dbForm.username,
        password: dbForm.password,
        database: dbForm.database || 'mysql',
        ssl: false,
        connectionPoolSize: 10,
        queryTimeout: 30,
        autoReconnect: true,
        charset: 'utf8mb4'
      };

      const databaseManager = new DatabaseManager(dbConfig);
      const result = await databaseManager.testConnection();

      if (result.success && result.validated) {
        setIsConnected(true);
        // Persist to server on successful validation
        try {
          await fetch('/api/settings.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ database: { ...databaseSettings, ...dbForm } })
          });
        } catch {}
        try {
          const setup = await loadSetupStatus();
          const updated = {
            hasEverBeenGreen: !!setup.hasEverBeenGreen || true,
            esiConfigured: !!setup.esiConfigured,
            databaseConnected: true,
            isFullyConfigured: !!setup.esiConfigured && true,
            lastUpdated: new Date().toISOString()
          };
          await saveSetupStatus({ ...setup, ...updated });
        } catch {}
        addConnectionLog('✅ Connected and locked settings');
        toast.success('Connected. Settings locked.');
      } else {
        addConnectionLog(`❌ Connect failed: ${result.error || 'Validation failed'}`);
        toast.error(`Connect failed: ${result.error || 'Validation failed'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addConnectionLog(`❌ Connect error: ${errorMessage}`);
      toast.error(`Connect error: ${errorMessage}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDisconnect = async () => {
    setIsConnected(false);
    try {
      const setup = await loadSetupStatus();
      const updated = {
        ...setup,
        databaseConnected: false,
        isFullyConfigured: false,
        lastUpdated: new Date().toISOString()
      };
      await saveSetupStatus(updated);
    } catch {}
    addConnectionLog('🔌 Disconnected. Settings unlocked');
    toast.info('Disconnected. You can edit settings again.');
  };

  const handleSaveSettings = async () => {
    try {
      // Force commit current settings to persistence
      if (databaseSettings) {
        setDatabaseSettings({ ...databaseSettings });
      }
      // Persist only on explicit save via settings hook (debounced server write)
      setDatabaseSettings({ ...dbForm });
      toast.success('Database settings saved successfully');
    } catch (error) {
      toast.error('Failed to save database settings');
    }
  };

  const handleDbAdminAction = (action: 'clear' | 'schema' | 'sde') => {
    const isAdmin = !!(currentUser && isLocalSiteAdmin(currentUser));
    if (!isAdmin) {
      toast.error('Admin privileges required');
      return;
    }
    setSudoPasswordInput('');
    setPendingDbAction(action);
  };

  const confirmDbAdminAction = async () => {
    if (!pendingDbAction) return;

    setIsRunningDbAction(true);
    const action = pendingDbAction;
    setPendingDbAction(null);

    addConnectionLog(`Requesting ${action} action on database "${dbForm.database || 'lmeve2'}"...`);

    try {
      const resp = await fetch('/api/db-admin-actions.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sudoPassword: sudoPasswordInput }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || data.ok === false) {
        const err = data.error || `HTTP ${resp.status}`;
        const mysqlErr = data.mysqlError ? ` (${data.mysqlError})` : '';
        addConnectionLog(`❌ ${action} failed: ${err}${mysqlErr}`);
        toast.error(`${action} failed: ${err}`);
      } else {
        if (data.started) {
          addConnectionLog(`✅ ${action} started in background. Log: ${data.logFile ?? 'sde-import.log'}`);
          toast.success(`${action} started — check logs for progress.`);
        } else {
          const detail = data.tablesCreated ? `${data.tablesCreated} tables` : (data.droppedTables ? `${data.droppedTables} tables dropped` : '');
          addConnectionLog(`✅ ${action} succeeded${detail ? ` — ${detail}` : ''}`);
          toast.success(`${action} succeeded${detail ? ` (${detail})` : ''}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addConnectionLog(`❌ ${action} error: ${msg}`);
      toast.error(`${action} error: ${msg}`);
    } finally {
      setIsRunningDbAction(false);
      setSudoPasswordInput('');
    }
  };

  const actionLabels: Record<'clear' | 'schema' | 'sde', string> = {
    clear: 'clear all data (drop all LMeve tables)',
    schema: 'initialize fresh schema (create tables)',
    sde: 'update SDE data import',
  };

  // Removed SDE status and indicators

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Database Connection Settings */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database size={20} />
                Database Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dbHost">Host</Label>
                  <Input
                    id="dbHost"
                    value={dbForm?.host || ''}
                    onChange={(e) => updateDbForm({ host: e.target.value })}
                    
                    placeholder="localhost or IP address"
                    disabled={isConnected}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dbPort">Port</Label>
                  <Input
                    id="dbPort"
                    value={dbForm?.port || '3306'}
                    onChange={(e) => updateDbForm({ port: e.target.value as any })}
                    
                    placeholder="3306"
                    disabled={isConnected}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dbName">Database Name</Label>
                <Input
                  id="dbName"
                  value={dbForm?.database || 'lmeve2'}
                  onChange={(e) => updateDbForm({ database: e.target.value })}
                  
                  placeholder="lmeve2"
                  disabled={isConnected}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Database Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Sudo User (Database Admin)</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <Input
                      placeholder="root"
                      value={dbForm?.sudoUsername || ''}
                      onChange={(e) => updateDbForm({ sudoUsername: e.target.value })}
                      
                    />
                    <Input
                      type="password"
                      placeholder="sudo password"
                      value={dbForm?.sudoPassword || ''}
                      onChange={(e) => updateDbForm({ sudoPassword: e.target.value })}
                      
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">LMeve User (Application)</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <Input
                      placeholder="lmeve"
                      value={dbForm?.username || ''}
                      onChange={(e) => updateDbForm({ username: e.target.value })}
                      
                      disabled={isConnected}
                    />
                    <Input
                      type="password"
                      placeholder="application password"
                      value={dbForm?.password || ''}
                      onChange={(e) => updateDbForm({ password: e.target.value })}
                      
                      disabled={isConnected}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Connection Logs with controls below */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connection Logs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg font-mono text-xs h-64 overflow-y-auto">
                {connectionLogs.length === 0 ? (
                  <div className="text-muted-foreground">No connection logs yet...</div>
                ) : (
                  connectionLogs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
              <Separator />
              <div className="grid grid-cols-1 gap-2">
                <Button 
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  variant="outline"
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </Button>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleConnect}
                    disabled={testingConnection || isConnected}
                  >
                    {isConnected ? 'Connected' : 'Connect'}
                  </Button>
                  <Button 
                    onClick={handleDisconnect}
                    disabled={testingConnection || !isConnected}
                    variant="outline"
                  >
                    Disconnect
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setConnectionLogs([])}>
                    Clear Logs
                  </Button>
                  <Button onClick={handleSaveSettings}>
                    Save Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Removed legacy system status, EVE stats, network info, and help sections */}

      {/* Database Maintenance — admin-only, gated behind verified DB connection */}
      {isConnected && !!(currentUser && isLocalSiteAdmin(currentUser)) && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database size={20} />
              Database Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Administrative actions on the <code className="bg-muted px-1 rounded">{dbForm.database || 'lmeve2'}</code> database.
              Requires sudo/root password confirmation. These operations are destructive.
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={isRunningDbAction}
                onClick={() => handleDbAdminAction('clear')}
              >
                <Trash size={16} className="mr-2" />
                Clear All Data
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isRunningDbAction}
                onClick={() => handleDbAdminAction('schema')}
              >
                <Database size={16} className="mr-2" />
                Initialize Schema
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isRunningDbAction}
                onClick={() => handleDbAdminAction('sde')}
              >
                <Download size={16} className="mr-2" />
                Update SDE Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sudo password confirmation dialog for DB admin actions */}
      <AlertDialog
        open={pendingDbAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDbAction(null);
            setSudoPasswordInput('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm sudo password</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the root/sudo database password to proceed with the
              <strong> {pendingDbAction && actionLabels[pendingDbAction]}</strong>.
              This operation cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="password"
            placeholder="Sudo password"
            value={sudoPasswordInput}
            onChange={(e) => setSudoPasswordInput(e.target.value)}
            disabled={isRunningDbAction}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunningDbAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRunningDbAction || !sudoPasswordInput}
              onClick={confirmDbAdminAction}
            >
              {isRunningDbAction ? 'Running...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}