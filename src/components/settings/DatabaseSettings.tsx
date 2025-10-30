import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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
import { useDatabaseSettings, useSDESettings } from '@/lib/persistenceService';
import { DatabaseManager } from '@/lib/database';
import { useSDEManager, type SDEDatabaseStats } from '@/lib/sdeService';

interface DatabaseSettingsProps {
  isMobileView?: boolean;
}

export function DatabaseSettings({ isMobileView = false }: DatabaseSettingsProps) {
  const [databaseSettings, setDatabaseSettings] = useDatabaseSettings();
  const [sdeSettings, setSDESettings] = useSDESettings();

  const { 
    stats, 
    isUpdating, 
    checkForUpdates, 
    downloadAndInstallSDE,
    isCurrentVersion 
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

  // Database connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
  const [testingConnection, setTestingConnection] = useState(false);
  const [setupProgress, setSetupProgress] = useState(0);
  const [setupStatus, setSetupStatus] = useState<'ready' | 'running' | 'complete' | 'error'>('ready');
  
  // Ref for auto-scrolling logs
  const logsEndRef = useRef<HTMLDivElement>(null);

  // System status indicators
  const [systemStatus, setSystemStatus] = useState({
    databaseConnection: 'unknown' as 'online' | 'offline' | 'unknown',
    sdeVersion: 'unknown' as 'current' | 'outdated' | 'unknown'
  });

  // Note: These will be instantiated with proper config when needed

  // Load settings on component mount
  useEffect(() => {
    checkSDEStatus();
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

  const handleSaveSettings = async () => {
    try {
      toast.success('Database settings saved successfully');
    } catch (error) {
      toast.error('Failed to save database settings');
    }
  };

  const checkSDEStatus = async () => {
    try {
      await checkForUpdates();
      setSystemStatus(prev => ({ 
        ...prev, 
        sdeVersion: isCurrentVersion ? 'current' : 'outdated'
      }));
    } catch (error) {
      console.error('SDE status check failed:', error);
    }
  };

  const handleUpdateSDE = async () => {
    try {
      addConnectionLog('Starting SDE update...');
      await downloadAndInstallSDE();
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dbPort">Port</Label>
                  <Input
                    id="dbPort"
                    value={databaseSettings?.port || '3306'}
                    onChange={(e) => updateDatabaseSettings({ port: e.target.value })}
                    placeholder="3306"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dbName">Database Name</Label>
                <Input
                  id="dbName"
                  value={databaseSettings?.database || 'lmeve'}
                  onChange={(e) => updateDatabaseSettings({ database: e.target.value })}
                  placeholder="lmeve"
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
                    />
                    <Input
                      type="password"
                      placeholder="application password"
                      value={databaseSettings?.password || ''}
                      onChange={(e) => updateDatabaseSettings({ password: e.target.value })}
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
              
              <div className="space-y-2">
                <Label>Schema Source</Label>
                <Select 
                  value={databaseSettings?.schemaSource || 'default'} 
                  onValueChange={(value) => updateDatabaseSettings({ schemaSource: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use Default Schema</SelectItem>
                    <SelectItem value="custom">Custom Schema File</SelectItem>
                  </SelectContent>
                </Select>
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
                  {stats?.lastModified ? new Date(stats.lastModified).toLocaleDateString() : 'Unknown'}
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
                
                <Button 
                  onClick={handleUpdateSDE}
                  disabled={isUpdating || systemStatus.sdeVersion === 'current'}
                  variant="outline"
                >
                  {isUpdating ? 'Updating SDE...' : 'Update SDE'}
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

      {/* Setup Progress */}
      {setupStatus === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Database Setup Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={setupProgress} className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">
              Setting up database... {Math.round(setupProgress)}% complete
            </p>
          </CardContent>
        </Card>
      )}

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

      {/* Troubleshooting Guide */}
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Warning size={20} className="text-yellow-500" />
            Troubleshooting Guide - User Creation Issues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">Issue: lmeve user not created after running scripts</h4>
            <p className="text-muted-foreground mb-3">
              If you see "empty set" when running <code className="bg-muted px-1 py-0.5 rounded">SELECT user, host FROM mysql.user WHERE user='lmeve';</code>
            </p>
          </div>
          
          <div className="space-y-3">
            <div>
              <h5 className="font-medium mb-1">✅ Solution 1: Verify Script Parameters</h5>
              <p className="text-muted-foreground text-xs mb-2">
                The create-db.sh script requires THREE parameters to be passed correctly:
              </p>
              <div className="bg-muted p-2 rounded font-mono text-xs">
                sudo /usr/local/lmeve/create-db.sh "YOUR_MYSQL_ROOT_PASSWORD" "YOUR_LMEVE_PASSWORD" "YOUR_LMEVE_USERNAME"
              </div>
              <p className="text-muted-foreground text-xs mt-2">
                Make sure all three parameters are enclosed in quotes and match what you entered in the fields above.
              </p>
            </div>
            
            <div>
              <h5 className="font-medium mb-1">✅ Solution 2: Download and Manually Execute</h5>
              <p className="text-muted-foreground text-xs mb-2">
                Click "Download create-db.sh" button above, then manually upload and execute:
              </p>
              <div className="bg-muted p-2 rounded font-mono text-xs space-y-1">
                <div># Upload the script to your server</div>
                <div>scp create-db.sh user@yourserver:/usr/local/lmeve/</div>
                <div className="mt-2"># Make it executable</div>
                <div>ssh user@yourserver "chmod +x /usr/local/lmeve/create-db.sh"</div>
                <div className="mt-2"># Run with your passwords and username</div>
                <div>ssh user@yourserver "sudo /usr/local/lmeve/create-db.sh 'root_pass' 'lmeve_pass' 'lmeve_user'"</div>
              </div>
            </div>
            
            <div>
              <h5 className="font-medium mb-1">✅ Solution 3: Manual SQL Execution</h5>
              <p className="text-muted-foreground text-xs mb-2">
                If scripts fail, execute these SQL commands directly on your MySQL server:
              </p>
              <div className="bg-muted p-2 rounded font-mono text-xs space-y-1">
                <div>DROP USER IF EXISTS 'lmeve'@'%';</div>
                <div>CREATE USER 'lmeve'@'%' IDENTIFIED BY 'your_password_here';</div>
                <div>GRANT ALL PRIVILEGES ON lmeve.* TO 'lmeve'@'%';</div>
                <div>GRANT ALL PRIVILEGES ON EveStaticData.* TO 'lmeve'@'%';</div>
                <div>FLUSH PRIVILEGES;</div>
              </div>
              <p className="text-muted-foreground text-xs mt-2">
                Replace 'your_password_here' with the LMeve password you want to use.
              </p>
            </div>
            
            <div>
              <h5 className="font-medium mb-1">🔍 Verification</h5>
              <p className="text-muted-foreground text-xs mb-2">
                After running any solution, verify the user was created:
              </p>
              <div className="bg-muted p-2 rounded font-mono text-xs">
                SELECT user, host FROM mysql.user WHERE user='lmeve';
              </div>
              <p className="text-muted-foreground text-xs mt-2">
                You should see: lmeve | %
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}