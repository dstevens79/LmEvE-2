import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Database,
  CheckCircle,
  Warning,
  X,
  ArrowClockwise,
  Terminal,
  Network,
  Question,
  Wrench,
  Archive,
  CloudArrowDown,
  Play,
  Stop,
  RefreshCw
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useDatabaseSettings, useSDESettings, useLocalKV } from '@/lib/persistenceService';
import { DatabaseManager } from '@/lib/database';
import { useSDEManager, type SDEDatabaseStats } from '@/lib/sdeService';

interface DatabaseSettingsProps {
  isMobileView?: boolean;
}

export function DatabaseSettings({ isMobileView = false }: DatabaseSettingsProps) {
  const [databaseSettings, setDatabaseSettings] = useDatabaseSettings();
  const [sdeSettings, setSDESettings] = useSDESettings();

  const {
    sdeStatus,
    checkForUpdates,
    downloadSDE,
    updateDatabase,
    getDatabaseStats
  } = useSDEManager();

  // Update helper functions
  const updateDatabaseSettings = (updates: any) => {
    setDatabaseSettings(current => ({
      ...current,
      ...updates
    }));
  };

  const updateSDESettings = (updates: any) => {
    setSDESettings(current => ({
      ...current,
      ...updates
    }));
  };

  // Database connection state (persisted)
  const [isConnected, setIsConnected] = useLocalKV<boolean>('lmeve-database-connected', false);

  // Keep system status indicator in sync with persisted connection state
  useEffect(() => {
    setSystemStatus(prev => ({
      ...prev,
      databaseConnection: isConnected ? 'online' : 'offline'
    }));
  }, [isConnected]);
  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
  const [testingConnection, setTestingConnection] = useState(false);
  // Removed legacy setup progress/status state
  
  // Ref for auto-scrolling logs
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Network info state
  const [serverLocalIps, setServerLocalIps] = useState<string[]>([]);
  const [serverPublicIp, setServerPublicIp] = useState<string | null>(null);
  const [serverHostname, setServerHostname] = useState<string | null>(null);
  const [clientIp, setClientIp] = useState<string | null>(null);

  // System status indicators
  const [systemStatus, setSystemStatus] = useState({
    databaseConnection: 'unknown' as 'online' | 'offline' | 'unknown',
    sdeVersion: 'unknown' as 'current' | 'outdated' | 'unknown'
  });

  // Note: These will be instantiated with proper config when needed

  // Load settings on component mount
  useEffect(() => {
    checkSDEStatus();
    // Load server-backed settings (if available) to hydrate local config for all users
    (async () => {
      try {
        const resp = await fetch('/api/settings.php', { method: 'GET' });
        if (resp.ok) {
          const data = await resp.json();
          const srv = data?.settings?.database;
          if (srv && typeof srv === 'object') {
            setDatabaseSettings(current => ({
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
    // Fetch server/client host information
    (async () => {
      try {
        const resp = await fetch('/api/host-info.php', { method: 'POST' });
        if (resp.ok) {
          const json = await resp.json();
          if (json.ok) {
            setServerLocalIps(Array.isArray(json.server?.localAddrs) ? json.server.localAddrs : []);
            setServerPublicIp(json.server?.publicIp || null);
            setServerHostname(json.server?.hostname || null);
            setClientIp(json.client?.ip || null);
          }
        }
      } catch (e) {
        // non-fatal
      }
    })();
  }, []);

  // Reflect SDE status into System Status indicator
  useEffect(() => {
    if (!sdeStatus) return;
    setSystemStatus(prev => ({
      ...prev,
      sdeVersion: sdeStatus.isInstalled
        ? (sdeStatus.isUpdateAvailable ? 'outdated' : 'current')
        : 'unknown'
    }));
  }, [sdeStatus]);

  // Auto-scroll logs to bottom when new logs are added
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [connectionLogs]);

  const addConnectionLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setConnectionLogs(prev => [...prev.slice(-19), logEntry]);
  };

  const handleTestConnection = async () => {
    if (!databaseSettings?.host || !databaseSettings?.port || 
        !databaseSettings?.username || !databaseSettings?.password) {
      toast.error('Please fill in all database connection fields');
      return;
    }

    setTestingConnection(true);
    addConnectionLog('Starting database connection test...');
    
    try {
      // Create DatabaseManager with proper configuration
      const dbConfig = {
        host: databaseSettings.host,
        port: parseInt(String(databaseSettings.port)),
        username: databaseSettings.username,
        password: databaseSettings.password,
        database: databaseSettings.database || 'mysql',
        ssl: false,
        connectionPoolSize: 10,
        queryTimeout: 30,
        autoReconnect: true,
        charset: 'utf8mb4'
      };
      
      const databaseManager = new DatabaseManager(dbConfig);
      const result = await databaseManager.testConnection();

      if (result.success) {
        setIsConnected(true);
        // Persist to server so all users share the config
        try {
          await fetch('/api/settings.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ database: { ...databaseSettings } })
          });
        } catch {}
        try {
          const setupRaw = localStorage.getItem('lmeve-setup-status');
          const setup = setupRaw ? JSON.parse(setupRaw) : {};
          const updated = {
            hasEverBeenGreen: !!setup.hasEverBeenGreen,
            esiConfigured: !!setup.esiConfigured,
            databaseConnected: true,
            isFullyConfigured: !!setup.esiConfigured && true,
            lastUpdated: new Date().toISOString()
          };
          localStorage.setItem('lmeve-setup-status', JSON.stringify({ ...setup, ...updated }));
        } catch {}
        setSystemStatus(prev => ({ ...prev, databaseConnection: 'online' }));
        addConnectionLog('✅ Database connection successful');
        addConnectionLog(`Connected to: ${databaseSettings?.host}:${databaseSettings?.port}`);
        
        if (result.userExists) {
          addConnectionLog(`✅ User '${databaseSettings?.username}' exists and authenticated`);
        } else {
          addConnectionLog(`⚠️ User '${databaseSettings?.username}' authenticated but may need setup`);
        }
        
        toast.success('Database connection test successful');
      } else {
        setIsConnected(false);
        setSystemStatus(prev => ({ ...prev, databaseConnection: 'offline' }));
        addConnectionLog(`❌ Connection failed: ${result.error}`);
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (error) {
      setIsConnected(false);
      setSystemStatus(prev => ({ ...prev, databaseConnection: 'offline' }));
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addConnectionLog(`❌ Connection error: ${errorMessage}`);
      toast.error(`Connection error: ${errorMessage}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleConnect = async () => {
    if (!databaseSettings?.host || !databaseSettings?.port || 
        !databaseSettings?.username || !databaseSettings?.password) {
      toast.error('Please fill in all database connection fields');
      return;
    }

    setTestingConnection(true);
    addConnectionLog('Starting database connect...');
    try {
      const dbConfig = {
        host: databaseSettings.host,
        port: parseInt(String(databaseSettings.port)),
        username: databaseSettings.username,
        password: databaseSettings.password,
        database: databaseSettings.database || 'mysql',
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ database: { ...databaseSettings } })
          });
        } catch {}
        try {
          const setupRaw = localStorage.getItem('lmeve-setup-status');
          const setup = setupRaw ? JSON.parse(setupRaw) : {};
          const updated = {
            hasEverBeenGreen: !!setup.hasEverBeenGreen || true,
            esiConfigured: !!setup.esiConfigured,
            databaseConnected: true,
            isFullyConfigured: !!setup.esiConfigured && true,
            lastUpdated: new Date().toISOString()
          };
          localStorage.setItem('lmeve-setup-status', JSON.stringify({ ...setup, ...updated }));
        } catch {}
        setSystemStatus(prev => ({ ...prev, databaseConnection: 'online' }));
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

  const handleDisconnect = () => {
    setIsConnected(false);
    try {
      const setupRaw = localStorage.getItem('lmeve-setup-status');
      const setup = setupRaw ? JSON.parse(setupRaw) : {};
      const updated = {
        ...setup,
        databaseConnected: false,
        isFullyConfigured: false,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem('lmeve-setup-status', JSON.stringify(updated));
    } catch {}
    setSystemStatus(prev => ({ ...prev, databaseConnection: 'offline' }));
    addConnectionLog('🔌 Disconnected. Settings unlocked');
    toast.info('Disconnected. You can edit settings again.');
  };

  const handleSaveSettings = async () => {
    try {
      // Force commit current settings to persistence
      if (databaseSettings) {
        setDatabaseSettings({ ...databaseSettings });
      }
      // Also persist to server so other clients pick it up
      try {
        await fetch('/api/settings.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ database: { ...databaseSettings } })
        });
      } catch {}
      toast.success('Database settings saved successfully');
    } catch (error) {
      toast.error('Failed to save database settings');
    }
  };

  const checkSDEStatus = async () => {
    try {
      await checkForUpdates();
      // sdeStatus will update via hook; local system status syncs in effect
    } catch (error) {
      console.error('SDE status check failed:', error);
    }
  };

  const handleUpdateSDE = async () => {
    try {
      addConnectionLog('Starting SDE update...');
      await downloadSDE();
      await updateDatabase();
      addConnectionLog('✅ SDE update completed');
      toast.success('SDE updated successfully');
      await checkSDEStatus();
    } catch (error) {
      addConnectionLog(`❌ SDE update failed: ${error}`);
      toast.error('SDE update failed');
    }
  };

  const StatusIndicator: React.FC<{
    label: string;
    status: 'online' | 'offline' | 'unknown' | 'current' | 'outdated';
  }> = ({ label, status }) => (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <div 
          className={`w-2 h-2 rounded-full ${
            status === 'online' || status === 'current'
              ? 'bg-green-500' 
              : status === 'offline' || status === 'outdated'
              ? 'bg-red-500'
              : 'bg-yellow-500'
          }`} 
        />
        <span className={`text-xs ${
          status === 'online' || status === 'current'
            ? 'text-green-400' 
            : status === 'offline' || status === 'outdated'
            ? 'text-red-400'
            : 'text-yellow-400'
        }`}>
          {status === 'current' ? 'OK' : status === 'outdated' ? 'OLD' : status.toUpperCase()}
        </span>
      </div>
    </div>
  );

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
                    value={databaseSettings?.host || ''}
                    onChange={(e) => updateDatabaseSettings({ host: e.target.value })}
                    placeholder="localhost or IP address"
                    disabled={isConnected}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dbPort">Port</Label>
                  <Input
                    id="dbPort"
                    value={databaseSettings?.port || '3306'}
                    onChange={(e) => updateDatabaseSettings({ port: e.target.value })}
                    placeholder="3306"
                    disabled={isConnected}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dbName">Database Name</Label>
                <Input
                  id="dbName"
                  value={databaseSettings?.database || 'lmeve2'}
                  onChange={(e) => updateDatabaseSettings({ database: e.target.value })}
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
                      value={databaseSettings?.sudoUsername || ''}
                      onChange={(e) => updateDatabaseSettings({ sudoUsername: e.target.value })}
                    />
                    <Input
                      type="password"
                      placeholder="sudo password"
                      value={databaseSettings?.sudoPassword || ''}
                      onChange={(e) => updateDatabaseSettings({ sudoPassword: e.target.value })}
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">LMeve User (Application)</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <Input
                      placeholder="lmeve"
                      value={databaseSettings?.username || ''}
                      onChange={(e) => updateDatabaseSettings({ username: e.target.value })}
                      disabled={isConnected}
                    />
                    <Input
                      type="password"
                      placeholder="application password"
                      value={databaseSettings?.password || ''}
                      onChange={(e) => updateDatabaseSettings({ password: e.target.value })}
                      disabled={isConnected}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Status & Control Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <StatusIndicator label="Database" status={systemStatus.databaseConnection} />
                <StatusIndicator label="SDE Version" status={systemStatus.sdeVersion} />
              </div>
              
              <Separator />
              
              {/* Removed Database Schema section as requested */}

              {/* Network Info */}
              <div className="space-y-2">
                <Label>Network Info</Label>
                <div className="text-xs text-muted-foreground space-y-1">
                  {serverHostname && (
                    <div><span className="font-medium text-foreground">Server:</span> {serverHostname}</div>
                  )}
                  {serverLocalIps.length > 0 && (
                    <div><span className="font-medium text-foreground">Internal IPs:</span> {serverLocalIps.join(', ')}</div>
                  )}
                  <div>
                    <span className="font-medium text-foreground">External IP:</span> {serverPublicIp || 'Unknown'}
                  </div>
                  {clientIp && (
                    <div><span className="font-medium text-foreground">Your IP:</span> {clientIp}</div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>SDE Source</Label>
                <Select 
                  value={sdeSettings?.sdeSource || 'fuzzwork'} 
                  onValueChange={(value) => updateSDESettings({ sdeSource: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fuzzwork">Latest Fuzzwork SDE</SelectItem>
                    <SelectItem value="custom">Custom SDE File</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>SDE Latest Version</Label>
                  <Button variant="outline" size="sm" onClick={checkSDEStatus}>
                    <RefreshCw size={14} />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {sdeStatus?.latestVersion || 'Unknown'}{sdeStatus?.lastChecked ? ` (checked ${new Date(sdeStatus.lastChecked).toLocaleDateString()})` : ''}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Control Pad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                
                <Button 
                  onClick={handleUpdateSDE}
                  disabled={sdeStatus?.isUpdating || sdeStatus?.isDownloading || systemStatus.sdeVersion === 'current'}
                  variant="outline"
                >
                  {sdeStatus?.isUpdating || sdeStatus?.isDownloading ? 'Updating SDE...' : 'Update SDE'}
                </Button>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setConnectionLogs([])}>
                  Clear Logs
                </Button>
                <Button onClick={handleSaveSettings}>
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Connection Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connection Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg font-mono text-xs h-40 overflow-y-auto">
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
        </CardContent>
      </Card>

      {/* Removed legacy database setup and troubleshooting sections as requested */}
    </div>
  );
}