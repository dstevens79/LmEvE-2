import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Database,
  UserCheck,
  Info,
  Play,
  ArrowClockwise,
  Download,
  Upload
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-provider';
import { toast } from 'sonner';
import { runDatabaseValidationTests } from '@/lib/databaseTestCases';
import { DatabaseManager } from '@/lib/database';
import { 
  useDatabaseSettings,
  backupSettings,
  exportAllSettings,
  importAllSettings,
  resetAllSettings
} from '@/lib/persistenceService';

interface DebugProps {
  onLoginClick?: () => void;
  isMobileView?: boolean;
}

export const Debug: React.FC<DebugProps> = () => {
  const { 
    user, 
    esiConfig,
    adminConfig,
    getRegisteredCorporations
  } = useAuth();
  
  const registeredCorps = getRegisteredCorporations();
  const databaseSettings = useDatabaseSettings();
  
  // Local state for debug functionality
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);

  // Helper to add timestamped connection logs
  const addConnectionLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // REAL database connection test using the strict DatabaseManager
  const handleTestDbConnection = async () => {
    // Prevent multiple concurrent tests
    if (testingConnection) {
      toast.warning('Database test already in progress...');
      return;
    }
    
    console.log('🧪 Starting REAL database connection test');
    
    if (!databaseSettings) {
      const error = 'Please configure database connection settings first';
      toast.error(error);
      addConnectionLog(`❌ ${error}`);
      return;
    }
    
    const { host, port, database, username, password } = databaseSettings;
    
    // Validate required fields
    if (!host || !port || !database || !username || !password) {
      const error = 'All database fields are required: host, port, database, username, password';
      toast.error(error);
      addConnectionLog(`❌ ${error}`);
      return;
    }
    
    // Clear previous logs and start test
    setConnectionLogs([]);
    setTestingConnection(true);
    
    try {
      addConnectionLog('🔍 Starting comprehensive database validation...');
      addConnectionLog(`🎯 Target: ${username}@${host}:${port}/${database}`);
      
      // Create database manager with current settings
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
        charset: 'utf8mb4'
      };
      
      const manager = new DatabaseManager(config);
      
      // Intercept console.log to capture detailed validation steps
      const originalConsoleLog = console.log;
      const interceptedMessages = new Set<string>(); // Prevent duplicate messages
      
      console.log = (...args: any[]) => {
        const message = args.join(' ');
        if (message.includes('🔍') || message.includes('🌐') || message.includes('🔌') || 
            message.includes('🔐') || message.includes('🗄️') || message.includes('🔑') || 
            message.includes('✅') || message.includes('❌')) {
          
          // Only add unique messages to prevent duplicates
          if (!interceptedMessages.has(message)) {
            interceptedMessages.add(message);
            addConnectionLog(message);
          }
        }
        originalConsoleLog(...args);
      };
      
      // Run the REAL connection test
      const testResult = await manager.testConnection();
      
      // Additional check for lmeve user if basic connection works
      let lmeveUserExists = false;
      if (testResult.success) {
        try {
          addConnectionLog('👤 Checking for lmeve database user...');
          
          // Try to connect with lmeve user specifically
          const lmeveConfig = {
            ...config,
            username: 'lmeve',
            password: databaseSettings.lmevePassword || 'lmpassword' // fallback
          };
          
          const lmeveManager = new DatabaseManager(lmeveConfig);
          const lmeveTest = await lmeveManager.testConnection();
          
          if (lmeveTest.success && lmeveTest.validated) {
            addConnectionLog('✅ lmeve user found and accessible');
            addConnectionLog('🎯 lmeve user has proper database access');
            lmeveUserExists = true;
          } else if (lmeveTest.success && !lmeveTest.validated) {
            addConnectionLog('⚠️ lmeve user found but connection validation failed');
            addConnectionLog('💡 Database exists but lmeve user may have insufficient permissions');
          } else {
            addConnectionLog('❌ lmeve user not found or credentials invalid');
            addConnectionLog('💡 This indicates remote setup has not been completed yet');
            addConnectionLog('🔧 The database connection works, but lmeve user needs to be created');
          }
        } catch (error) {
          addConnectionLog('⚠️ Could not test lmeve user connection');
          addConnectionLog('💡 Database connection works, but lmeve user status unclear');
          addConnectionLog(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Restore console.log
      console.log = originalConsoleLog;
      
      if (testResult.success && testResult.validated) {
        addConnectionLog(`✅ Database connection VALIDATED successfully!`);
        addConnectionLog(`⚡ Connection latency: ${testResult.latency}ms`);
        
        if (lmeveUserExists) {
          addConnectionLog(`🎉 All checks passed - database ready for LMeve!`);
          toast.success(`✅ Connection validated! LMeve user ready. Latency: ${testResult.latency}ms`);
        } else {
          addConnectionLog(`🔧 Connection good but setup incomplete - run Remote Setup to create lmeve user`);
          toast.success(`✅ Connection validated! Setup lmeve user next. Latency: ${testResult.latency}ms`);
        }
      } else if (testResult.success && !testResult.validated) {
        addConnectionLog(`⚠️ Partial connection success but validation incomplete`);
        addConnectionLog(`⚡ Connection latency: ${testResult.latency}ms`);
        addConnectionLog(`❌ Database validation failed - connection rejected`);
        toast.warning(`⚠️ Partial success - validation incomplete`);
      } else {
        addConnectionLog(`❌ Connection test FAILED: ${testResult.error}`);
        addConnectionLog(`🚫 This configuration cannot establish a valid MySQL connection`);
        toast.error(`❌ Connection failed: ${testResult.error}`);
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown connection error';
      addConnectionLog(`💥 Test error: ${errorMsg}`);
      addConnectionLog(`🚫 Connection test could not complete`);
      toast.error(`Test error: ${errorMsg}`);
    } finally {
      addConnectionLog('🏁 Database connection test completed');
      setTestingConnection(false);
    }
  };

  const handleExportSettings = async () => {
    try {
      await backupSettings();
      toast.success('Settings exported successfully');
    } catch (error) {
      console.error('Failed to export settings:', error);
      toast.error('Failed to export settings');
    }
  };

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllSettings(data);
      toast.success('Settings imported successfully');
      
      // Refresh the page to load new settings
      window.location.reload();
    } catch (error) {
      console.error('Failed to import settings:', error);
      toast.error('Failed to import settings: Invalid file format');
    }
  };

  const handleResetSettings = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    try {
      await resetAllSettings();
      toast.success('Settings reset to defaults');
      
      // Refresh the page to load default settings
      window.location.reload();
    } catch (error) {
      console.error('Failed to reset settings:', error);
      toast.error('Failed to reset settings');
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Debug</h1>
        <p className="text-muted-foreground">
          System debug information and testing tools for LMeve development and troubleshooting.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <UserCheck size={20} />
            Authentication Debug
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Simple Auth Service Test</CardTitle>
        </CardHeader>
        <CardContent>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Database size={20} />
            Database Connection Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Test database connectivity using the current configuration settings.
          </p>
          <Button
            onClick={() => {
              console.log('🧪 Debug test connection button clicked');
              handleTestDbConnection();
            }}
            disabled={testingConnection}
            className="w-full hover:bg-accent/10 active:bg-accent/20 transition-colors"
          >
            {testingConnection ? (
              <>
                <ArrowClockwise size={16} className="mr-2 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <Play size={16} className="mr-2" />
                Test Database Connection
              </>
            )}
          </Button>
          
          {connectionLogs.length > 0 && (
            <div className="border border-border rounded-lg p-3 bg-muted/30">
              <div className="font-mono text-xs space-y-1 max-h-32 overflow-y-auto">
                {connectionLogs.map((log, index) => (
                  <div key={index} className="text-foreground">{log}</div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Info size={20} />
            System Debug Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Current User</Label>
              <div className="p-3 border border-border rounded bg-muted/50 font-mono text-sm">
                {user ? (
                  <div>
                    <div>Name: {user.characterName}</div>
                    <div>Corp: {user.corporationName}</div>
                    <div>ID: {user.characterId}</div>
                    <div>Admin: {user.isAdmin ? 'Yes' : 'No'}</div>
                    <div>Auth: {user.authMethod}</div>
                    <div>ESI Access: {user.canManageESI ? 'Yes' : 'No'}</div>
                  </div>
                ) : (
                  'No user logged in'
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Corporation Registry</Label>
              <div className="p-3 border border-border rounded bg-muted/50 font-mono text-sm max-h-32 overflow-y-auto">
                {registeredCorps && Object.keys(registeredCorps).length > 0 ? (
                  Object.entries(registeredCorps).map(([corpId, corp]) => (
                    <div key={corpId} className="text-xs">
                      {corp.corporationName} ({corpId})
                    </div>
                  ))
                ) : (
                  'No corporations registered'
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Admin Configuration</Label>
              <div className="p-3 border border-border rounded bg-muted/50 font-mono text-sm">
                <div>Username: {adminConfig.username}</div>
                <div>Password Set: {adminConfig.password ? 'Yes' : 'No'}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>ESI Configuration Status</Label>
              <div className="p-3 border border-border rounded bg-muted/50 font-mono text-sm">
                <div>Client ID: {esiConfig.clientId ? 'Configured' : 'Not Set'}</div>
                <div>Secret: {esiConfig.secretKey ? 'Configured' : 'Not Set'}</div>
                <div>Base URL: {esiConfig.baseUrl || 'https://login.eveonline.com'}</div>
                <div>User Agent: {esiConfig.userAgent || 'Not Set'}</div>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            <h4 className="font-medium">Database Validation Tests</h4>
            <p className="text-sm text-muted-foreground">
              Run comprehensive tests to verify database connection validation is working properly.
              This will test both invalid configurations (should fail) and valid ones (might pass with real MySQL).
            </p>
            <Button
              onClick={() => {
                toast.info('Running database validation tests - check browser console for detailed results');
                runDatabaseValidationTests();
              }}
              variant="outline"
              className="w-full"
            >
              <Database size={16} className="mr-2" />
              Run Database Validation Test Suite
            </Button>
          </div>
          
          <Separator />
          
          {/* Data Management */}
          <div className="space-y-4">
            <h4 className="font-medium">Data Management</h4>
            <p className="text-sm text-muted-foreground">
              Export and import all LMeve configuration data including settings, users, and corporation data.
            </p>
            
            <div className="grid grid-cols-3 gap-4">
              <Button
                variant="outline"
                onClick={handleExportSettings}
                className="flex items-center justify-center"
              >
                <Download size={16} className="mr-2" />
                Export All Data
              </Button>
              
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportSettings}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center"
                >
                  <Upload size={16} className="mr-2" />
                  Import Data
                </Button>
              </div>
              
              <Button
                variant="destructive"
                onClick={handleResetSettings}
                className="flex items-center justify-center"
              >
                <ArrowClockwise size={16} className="mr-2" />
                Reset All
              </Button>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Export creates a downloadable backup file with all settings</p>
              <p>• Import restores settings from a previously exported file</p>
              <p>• Reset restores all settings to default values (requires confirmation)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Debug;