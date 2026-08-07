import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  UserCheck,
  CheckCircle,
  Warning,
  X,
  Copy,
  Download,
  Upload,
  Trash,
  RefreshCw,
  Terminal,
  Info,
  Activity,
  Database,
  Settings as SettingsIcon
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-provider';
import { runDatabaseValidationTests } from '@/lib/databaseTestCases';
import { 
  backupSettings,
  exportAllSettings,
  importAllSettings,
  resetAllSettings,
  validateSettings
} from '@/lib/persistenceService';

interface DebugSettingsProps {
  isMobileView?: boolean;
}

export function DebugSettings({ isMobileView = false }: DebugSettingsProps) {
  const { 
    user, 
    isAuthenticated, 
    authTrigger,
    loginWithCredentials,
    esiConfig,
    getRegisteredCorporations
  } = useAuth();

  // Debug state
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [systemInfo, setSystemInfo] = useState({
    userAgent: '',
    language: '',
    platform: '',
    cookiesEnabled: false,
    localStorageEnabled: false,
    sessionStorageEnabled: false,
    timestamp: ''
  });
  const [connectionTests, setConnectionTests] = useState({
    database: 'untested' as 'untested' | 'testing' | 'success' | 'error',
    esi: 'untested' as 'untested' | 'testing' | 'success' | 'error',
    eve: 'untested' as 'untested' | 'testing' | 'success' | 'error'
  });
  const [importExportProgress, setImportExportProgress] = useState(0);
  const [isImportExportRunning, setIsImportExportRunning] = useState(false);

  // Load system info on component mount
  useEffect(() => {
    loadSystemInfo();
    addDebugLog('Debug panel initialized');
  }, []);

  // Log auth state changes
  useEffect(() => {
    addDebugLog(`Auth state changed - User: ${user?.characterName || 'null'}, Authenticated: ${isAuthenticated}, Trigger: ${authTrigger}`);
  }, [user, isAuthenticated, authTrigger]);

  const loadSystemInfo = () => {
    setSystemInfo({
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookiesEnabled: navigator.cookieEnabled,
      localStorageEnabled: typeof(Storage) !== 'undefined',
      sessionStorageEnabled: typeof(sessionStorage) !== 'undefined',
      timestamp: new Date().toISOString()
    });
  };

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setDebugLogs(prev => [...prev.slice(-49), logEntry]);
  };

  const clearDebugLogs = () => {
    setDebugLogs([]);
    addDebugLog('Debug logs cleared');
  };

  const copyDebugLogs = () => {
    const logsText = debugLogs.join('\n');
    navigator.clipboard.writeText(logsText);
    toast.success('Debug logs copied to clipboard');
  };

  const testDatabaseConnection = async () => {
    setConnectionTests(prev => ({ ...prev, database: 'testing' }));
    addDebugLog('Testing database connection...');
    
    try {
      // Simulate database connection test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Run actual validation tests
      const results = await runDatabaseValidationTests();
      
      if (results.success) {
        setConnectionTests(prev => ({ ...prev, database: 'success' }));
        addDebugLog('✅ Database connection test passed');
        toast.success('Database connection test passed');
      } else {
        setConnectionTests(prev => ({ ...prev, database: 'error' }));
        addDebugLog(`❌ Database connection test failed: ${results.error}`);
        toast.error('Database connection test failed');
      }
    } catch (error) {
      setConnectionTests(prev => ({ ...prev, database: 'error' }));
      addDebugLog(`❌ Database test error: ${error}`);
      toast.error('Database test error');
    }
  };

  const testESIConnection = async () => {
    setConnectionTests(prev => ({ ...prev, esi: 'testing' }));
    addDebugLog('Testing ESI connection...');
    
    try {
      // Test ESI endpoint accessibility
      const response = await fetch('https://esi.evetech.net/latest/status/', {
        method: 'GET',
        headers: { 'User-Agent': 'LMeve/1.0' }
      });
      
      if (response.ok) {
        setConnectionTests(prev => ({ ...prev, esi: 'success' }));
        addDebugLog('✅ ESI connection test passed');
        toast.success('ESI connection test passed');
      } else {
        setConnectionTests(prev => ({ ...prev, esi: 'error' }));
        addDebugLog(`❌ ESI connection test failed: ${response.status}`);
        toast.error('ESI connection test failed');
      }
    } catch (error) {
      setConnectionTests(prev => ({ ...prev, esi: 'error' }));
      addDebugLog(`❌ ESI test error: ${error}`);
      toast.error('ESI test error');
    }
  };

  const testEVEServerStatus = async () => {
    setConnectionTests(prev => ({ ...prev, eve: 'testing' }));
    addDebugLog('Testing EVE Online server status...');
    
    try {
      // Test EVE server status endpoint
      const response = await fetch('https://esi.evetech.net/latest/status/', {
        method: 'GET',
        headers: { 'User-Agent': 'LMeve/1.0' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnectionTests(prev => ({ ...prev, eve: 'success' }));
        addDebugLog(`✅ EVE Online server status: ${data.players || 'Unknown'} players online`);
        toast.success('EVE Online server connection test passed');
      } else {
        setConnectionTests(prev => ({ ...prev, eve: 'error' }));
        addDebugLog(`❌ EVE server test failed: ${response.status}`);
        toast.error('EVE server test failed');
      }
    } catch (error) {
      setConnectionTests(prev => ({ ...prev, eve: 'error' }));
      addDebugLog(`❌ EVE server test error: ${error}`);
      toast.error('EVE server test error');
    }
  };

  const runAllConnectionTests = async () => {
    addDebugLog('Running all connection tests...');
    await Promise.all([
      testDatabaseConnection(),
      testESIConnection(),
      testEVEServerStatus()
    ]);
    addDebugLog('All connection tests completed');
  };

  const exportSettings = async () => {
    setIsImportExportRunning(true);
    setImportExportProgress(0);
    addDebugLog('Exporting all settings...');
    
    try {
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setImportExportProgress(i);
      }
      
      const settings = await exportAllSettings();
      const dataStr = JSON.stringify(settings, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `lmeve-settings-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      addDebugLog('✅ Settings exported successfully');
      toast.success('Settings exported successfully');
    } catch (error) {
      addDebugLog(`❌ Settings export failed: ${error}`);
      toast.error('Settings export failed');
    } finally {
      setIsImportExportRunning(false);
      setImportExportProgress(0);
    }
  };

  const importSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsImportExportRunning(true);
    setImportExportProgress(0);
    addDebugLog(`Importing settings from: ${file.name}`);
    
    try {
      const text = await file.text();
      const settings = JSON.parse(text);
      
      for (let i = 0; i <= 100; i += 25) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setImportExportProgress(i);
      }
      
      await importAllSettings(settings);
      
      addDebugLog('✅ Settings imported successfully');
      toast.success('Settings imported successfully - please refresh the page');
    } catch (error) {
      addDebugLog(`❌ Settings import failed: ${error}`);
      toast.error('Settings import failed');
    } finally {
      setIsImportExportRunning(false);
      setImportExportProgress(0);
    }
  };

  const backupCurrentSettings = async () => {
    addDebugLog('Creating settings backup...');
    
    try {
      await backupSettings();
      addDebugLog('✅ Settings backup created');
      toast.success('Settings backup created');
    } catch (error) {
      addDebugLog(`❌ Settings backup failed: ${error}`);
      toast.error('Settings backup failed');
    }
  };

  const validateAllSettings = async () => {
    addDebugLog('Validating all settings...');
    
    try {
      const validation = await validateSettings();
      
      if (validation.isValid) {
        addDebugLog('✅ All settings validation passed');
        toast.success('All settings are valid');
      } else {
        addDebugLog(`❌ Settings validation failed: ${validation.errors?.join(', ')}`);
        toast.error('Settings validation failed');
      }
    } catch (error) {
      addDebugLog(`❌ Settings validation error: ${error}`);
      toast.error('Settings validation error');
    }
  };

  const resetAllSettingsConfirm = async () => {
    if (!confirm('Are you sure you want to reset ALL settings? This cannot be undone.')) {
      return;
    }
    
    addDebugLog('Resetting all settings...');
    
    try {
      await resetAllSettings();
      addDebugLog('✅ All settings reset to defaults');
      toast.success('All settings reset - please refresh the page');
    } catch (error) {
      addDebugLog(`❌ Settings reset failed: ${error}`);
      toast.error('Settings reset failed');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'testing': return 'text-blue-400';
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'testing': return <Activity size={12} className="animate-spin" />;
      case 'success': return <CheckCircle size={12} />;
      case 'error': return <X size={12} />;
      default: return <RefreshCw size={12} />;
    }
  };

  const registeredCorps = getRegisteredCorporations();

  return (
    <div className="space-y-6">
      {/* Debug Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck size={20} />
            Debug & Testing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Debug tools, connection tests, and system diagnostics. Use these tools to 
              troubleshoot issues and validate system functionality.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Authentication Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Authentication Testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Current Auth State</h3>
              <div className="space-y-1 text-xs">
                <div>User: {user?.characterName || 'null'}</div>
                <div>Authenticated: {isAuthenticated ? 'true' : 'false'}</div>
                <div>Auth Method: {user?.authMethod || 'none'}</div>
                <div>Role: {(user as any)?.role || 'none'}</div>
                <div>Corporation: {user?.corporationName || 'none'}</div>
                <div>Auth Trigger: {authTrigger}</div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">ESI Configuration</h3>
              <div className="space-y-1 text-xs">
                <div>Client ID: {esiConfig?.clientId ? 'Configured' : 'Not Set'}</div>
                <div>Client Secret: {esiConfig?.clientSecret ? 'Configured' : 'Not Set'}</div>
                <div>Is Configured: {esiConfig?.isConfigured ? 'true' : 'false'}</div>
                <div>Registered Corps: {registeredCorps.length}</div>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Direct Login Tests</h3>
            <p className="text-sm text-muted-foreground">
              Authentication uses the server session flow.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Connection Testing */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Connection Testing</CardTitle>
            <Button onClick={runAllConnectionTests} variant="outline" size="sm">
              <RefreshCw size={16} className="mr-2" />
              Test All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database size={16} />
                    <span className="text-sm font-medium">Database</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(connectionTests.database)}
                    <span className={`text-xs ${getStatusColor(connectionTests.database)}`}>
                      {connectionTests.database.toUpperCase()}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={testDatabaseConnection}
                  disabled={connectionTests.database === 'testing'}
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                >
                  Test Database
                </Button>
              </CardContent>
            </Card>
            
            <Card className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={16} />
                    <span className="text-sm font-medium">ESI API</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(connectionTests.esi)}
                    <span className={`text-xs ${getStatusColor(connectionTests.esi)}`}>
                      {connectionTests.esi.toUpperCase()}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={testESIConnection}
                  disabled={connectionTests.esi === 'testing'}
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                >
                  Test ESI
                </Button>
              </CardContent>
            </Card>
            
            <Card className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={16} />
                    <span className="text-sm font-medium">EVE Online</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(connectionTests.eve)}
                    <span className={`text-xs ${getStatusColor(connectionTests.eve)}`}>
                      {connectionTests.eve.toUpperCase()}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={testEVEServerStatus}
                  disabled={connectionTests.eve === 'testing'}
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                >
                  Test EVE Server
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div><strong>Browser:</strong> {systemInfo.userAgent.split(' ')[0]}</div>
              <div><strong>Language:</strong> {systemInfo.language}</div>
              <div><strong>Platform:</strong> {systemInfo.platform}</div>
            </div>
            <div className="space-y-2">
              <div><strong>Cookies:</strong> {systemInfo.cookiesEnabled ? 'Enabled' : 'Disabled'}</div>
              <div><strong>Local Storage:</strong> {systemInfo.localStorageEnabled ? 'Available' : 'Not Available'}</div>
              <div><strong>Session Storage:</strong> {systemInfo.sessionStorageEnabled ? 'Available' : 'Not Available'}</div>
            </div>
          </div>
          
          <Separator />
          
          <div className="text-xs text-muted-foreground">
            <strong>Last Updated:</strong> {systemInfo.timestamp}
          </div>
          
          <Button onClick={loadSystemInfo} variant="outline" size="sm">
            <RefreshCw size={16} className="mr-2" />
            Refresh System Info
          </Button>
        </CardContent>
      </Card>

      {/* Settings Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Settings Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isImportExportRunning && (
            <div className="space-y-2">
              <Progress value={importExportProgress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {importExportProgress}% complete
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button onClick={exportSettings} variant="outline" size="sm" disabled={isImportExportRunning}>
              <Download size={16} className="mr-1" />
              Export
            </Button>
            
            <Button variant="outline" size="sm" disabled={isImportExportRunning}>
              <Upload size={16} className="mr-1" />
              <label htmlFor="import-settings" className="cursor-pointer">
                Import
              </label>
              <input
                id="import-settings"
                type="file"
                accept=".json"
                onChange={importSettings}
                className="hidden"
              />
            </Button>
            
            <Button onClick={backupCurrentSettings} variant="outline" size="sm" disabled={isImportExportRunning}>
              <Copy size={16} className="mr-1" />
              Backup
            </Button>
            
            <Button onClick={validateAllSettings} variant="outline" size="sm" disabled={isImportExportRunning}>
              <CheckCircle size={16} className="mr-1" />
              Validate
            </Button>
          </div>
          
          <Separator />
          
          <Button 
            onClick={resetAllSettingsConfirm} 
            variant="destructive" 
            size="sm"
            disabled={isImportExportRunning}
          >
            <Trash size={16} className="mr-2" />
            Reset All Settings
          </Button>
        </CardContent>
      </Card>

      {/* Debug Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Debug Logs</CardTitle>
            <div className="flex gap-2">
              <Button onClick={copyDebugLogs} variant="outline" size="sm">
                <Copy size={16} className="mr-2" />
                Copy
              </Button>
              <Button onClick={clearDebugLogs} variant="outline" size="sm">
                <Trash size={16} className="mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg font-mono text-xs h-60 overflow-y-auto">
            {debugLogs.length === 0 ? (
              <div className="text-muted-foreground">No debug logs yet...</div>
            ) : (
              debugLogs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}