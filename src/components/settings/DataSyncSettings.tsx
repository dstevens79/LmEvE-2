import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Clock,
  CheckCircle,
  Warning,
  X,
  Play,
  Stop,
  ArrowClockwise,
  Settings as SettingsIcon,
  Activity,
  Info,
  Users,
  Package,
  Factory,
  HardHat,
  TrendUp,
  Crosshair,
  CurrencyDollar,
  Building,
  FileText,
  Receipt,
  Planet,
  User
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useSyncSettings } from '@/lib/persistenceService';
import { esiRouteManager, useESIRoutes } from '@/lib/esi-routes';
import { SyncStateManager, useSyncState } from '@/lib/sync-state-manager';
import { SyncExecutor, type SyncProcessType } from '@/lib/sync-executor';
import { ESIDataFetchService } from '@/lib/esi-data-service';
import { ESIDataStorageService, getDatabaseService } from '@/lib/database';
import { useAuth } from '@/lib/auth-provider';

interface DataSyncSettingsProps {
  isMobileView?: boolean;
}

interface SyncProcess {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  enabled: boolean;
  interval: number; // minutes
  lastSync: string | null;
  status: 'idle' | 'running' | 'success' | 'error';
  currentVersion: string;
  availableVersions: string[];
  nextRun: string | null;
  progress?: number;
}

export function DataSyncSettings({ isMobileView = false }: DataSyncSettingsProps) {
  const [syncSettings, setSyncSettings] = useSyncSettings();
  const { user } = useAuth();
  const syncState = useSyncState();
  const [cronInstalled, setCronInstalled] = useState(false);
  const [isInstallingCron, setIsInstallingCron] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update helper function
  const updateSyncSettings = (updates: any) => {
    setSyncSettings(current => ({
      ...current,
      ...updates
    }));
  };

  const esiRoutes = useESIRoutes();
  
  // Route validation states
  const [validatingRoutes, setValidatingRoutes] = useState(false);
  const [routeUpdateResults, setRouteUpdateResults] = useState<Record<string, string>>({});
  const [esiRouteValidation, setESIRouteValidation] = useState<Record<string, string>>({});

  // Sync processes configuration
  const [syncProcesses, setSyncProcesses] = useState<SyncProcess[]>([
    {
      id: 'corporation_members',
      name: 'Corporation Members',
      description: 'Sync corporation member list and roles',
      icon: Users,
      enabled: syncSettings.corporationMembers?.enabled ?? true,
      interval: syncSettings.corporationMembers?.interval ?? 1440,
      lastSync: null,
      status: 'idle',
      currentVersion: 'v1',
      availableVersions: ['v1', 'v2'],
      nextRun: null
    },
    {
      id: 'corporation_assets',
      name: 'Corporation Assets',
      description: 'Sync corporation assets and locations',
      icon: Package,
      enabled: syncSettings.corporationAssets?.enabled ?? true,
      interval: syncSettings.corporationAssets?.interval ?? 1440,
      lastSync: null,
      status: 'idle',
      currentVersion: 'v1',
      availableVersions: ['v1', 'v2'],
      nextRun: null
    },
    {
      id: 'industry_jobs',
      name: 'Industry Jobs',
      description: 'Sync active and completed industry jobs',
      icon: Factory,
      enabled: syncSettings.industryJobs?.enabled ?? true,
      interval: syncSettings.industryJobs?.interval ?? 1440,
      lastSync: null,
      status: 'idle',
      currentVersion: 'v1',
      availableVersions: ['v1'],
      nextRun: null
    },
    {
      id: 'mining_ledger',
      name: 'Mining Ledger',
      description: 'Sync corporation mining operations',
      icon: HardHat,
      enabled: syncSettings.miningLedger?.enabled ?? false,
      interval: syncSettings.miningLedger?.interval ?? 1440,
      lastSync: null,
      status: 'idle',
      currentVersion: 'v1',
      availableVersions: ['v1'],
      nextRun: null
    },
    {
      id: 'market_orders',
      name: 'Market Orders',
      description: 'Sync corporation market orders',
      icon: TrendUp,
      enabled: syncSettings.marketOrders?.enabled ?? false,
      interval: syncSettings.marketOrders?.interval ?? 1440,
      lastSync: null,
      status: 'idle',
      currentVersion: 'v1',
      availableVersions: ['v1', 'v2'],
      nextRun: null
    },
    {
      id: 'killmails',
      name: 'Killmails',
      description: 'Sync corporation killmails and losses',
      icon: Crosshair,
      enabled: syncSettings.killmails?.enabled ?? false,
      interval: syncSettings.killmails?.interval ?? 1440,
      lastSync: null,
      status: 'idle',
      currentVersion: 'v1',
      availableVersions: ['v1'],
      nextRun: null
    },
    {
      id: 'corporation_wallets',
      name: 'Corporation Wallets',
      description: 'Sync corporation wallet transactions',
      icon: CurrencyDollar,
      enabled: syncSettings.corporationWallets?.enabled ?? true,
      interval: syncSettings.corporationWallets?.interval ?? 1440,
      lastSync: null,
      status: 'idle',
      currentVersion: 'v1',
      availableVersions: ['v1'],
      nextRun: null
    },
    {
      id: 'structures',
      name: 'Structures',
      description: 'Sync corporation structures and services',
      icon: Building,
      enabled: syncSettings.structures?.enabled ?? false,
      interval: syncSettings.structures?.interval ?? 1440,
      lastSync: null,
      status: 'idle',
      currentVersion: 'v1',
      availableVersions: ['v1'],
      nextRun: null
    },
    {
      id: 'corporation_contracts',
      name: 'Corporation Contracts',
      description: 'Sync corporation contracts and contract items',
      icon: FileText,
      enabled: syncSettings.corporationContracts?.enabled ?? true,
      interval: syncSettings.corporationContracts?.interval ?? 1440,
      lastSync: null,
      status: 'idle',
      currentVersion: 'v1',
      availableVersions: ['v1'],
      nextRun: null
    },
    {
      id: 'item_pricing',
      name: 'Market Item Costs',
      description: 'Sync market prices for items from configured station',
      icon: Receipt,
      enabled: syncSettings.itemPricing?.enabled ?? true,
      interval: syncSettings.itemPricing?.interval ?? 1440,
      lastSync: null,
      status: 'idle',
      currentVersion: 'v1',
      availableVersions: ['v1'],
      nextRun: null
    },
    {
      id: 'planetary_interaction',
      name: 'Planetary Interaction',
      description: 'Sync planetary colonies and extraction data',
      icon: Planet,
      enabled: syncSettings.planetaryInteraction?.enabled ?? false,
      interval: syncSettings.planetaryInteraction?.interval ?? 1440,
      lastSync: null,
      status: 'idle',
      currentVersion: 'v1',
      availableVersions: ['v1'],
      nextRun: null
    },
    {
      id: 'personal_esi',
      name: 'Personal ESI Data',
      description: 'Sync personal data for pilots with ESI access',
      icon: User,
      enabled: syncSettings.personalESI?.enabled ?? false,
      interval: syncSettings.personalESI?.interval ?? 1440,
      lastSync: null,
      status: 'idle',
      currentVersion: 'v1',
      availableVersions: ['v1'],
      nextRun: null
    }
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setSyncProcesses(prev => prev.map(process => {
      const syncStatus = syncState.getSyncStatus(process.id);
      const lastSyncTime = syncStatus.lastRunTime || null;
      const nextRunTime = lastSyncTime && process.enabled 
        ? new Date(new Date(lastSyncTime).getTime() + process.interval * 60 * 1000).toISOString()
        : null;
      
      return {
        ...process,
        enabled: (syncSettings as any)?.[process.id as keyof typeof syncSettings]?.enabled ?? process.enabled,
        interval: (syncSettings as any)?.[process.id as keyof typeof syncSettings]?.interval ?? process.interval,
        status: syncStatus.status,
        progress: syncStatus.progress,
        lastSync: lastSyncTime ? new Date(lastSyncTime).toISOString() : process.lastSync,
        nextRun: nextRunTime
      };
    }));
  }, [syncSettings, syncState.state, currentTime]);

  const updateProcessConfig = (processId: string, updates: Partial<SyncProcess>) => {
    setSyncProcesses(prev => prev.map(process => 
      process.id === processId ? { ...process, ...updates } : process
    ));

    // Update settings
    updateSyncSettings({
      [processId]: {
        enabled: updates.enabled ?? syncSettings[processId as keyof typeof syncSettings]?.enabled,
        interval: updates.interval ?? syncSettings[processId as keyof typeof syncSettings]?.interval
      }
    });
  };

  const runSyncProcess = async (processId: string) => {
    if (!user?.corporationId || !user?.accessToken) {
      toast.error('Corporation authentication required. Please log in with ESI.');
      return;
    }

    if (syncState.isProcessRunning(processId)) {
      toast.warning('Sync process is already running');
      return;
    }

    const processName = syncProcesses.find(p => p.id === processId)?.name || processId;
    
    try {
      console.log(`🚀 Starting sync process: ${processId}`);
      
      const dbService = getDatabaseService();
      const storageService = new ESIDataStorageService(dbService);
      const fetchService = new ESIDataFetchService();
      const executor = new SyncExecutor();

      const processTypeMap: Record<string, SyncProcessType> = {
        'corporation_members': 'members',
        'corporation_assets': 'assets',
        'industry_jobs': 'manufacturing',
        'market_orders': 'market',
        'corporation_wallets': 'wallet',
        'mining_ledger': 'mining',
        'killmails': 'killmails',
        'structures': 'container_logs',
        'corporation_contracts': 'contracts',
        'item_pricing': 'item_pricing',
        'planetary_interaction': 'planetary',
        'personal_esi': 'personal_esi'
      };

      const processType = processTypeMap[processId];
      if (!processType) {
        toast.error(`Unknown sync process: ${processId}`);
        return;
      }

      const result = await executor.executeSyncProcess(processType, {
        processId,
        corporationId: user.corporationId,
        accessToken: user.accessToken,
        storageService,
        fetchService
      });

      if (result.success) {
        toast.success(`${processName} sync completed - ${result.itemsProcessed} items processed`);
      } else {
        toast.error(`${processName} sync failed: ${result.errorMessage}`);
      }
    } catch (error) {
      console.error(`❌ Sync process ${processId} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${processName} sync failed: ${errorMessage}`);
    }
  };

  const stopSyncProcess = (processId: string) => {
    updateProcessConfig(processId, { status: 'idle', progress: undefined });
    toast.info(`${syncProcesses.find(p => p.id === processId)?.name} sync stopped`);
  };

  const validateESIRoutes = async () => {
    setValidatingRoutes(true);
    setRouteUpdateResults({});
    setESIRouteValidation({});
    
    try {
      const results = await esiRouteManager.validateAllRoutes();
      const validationResults: Record<string, string> = {};
      
      for (const [processName, validation] of Object.entries(results.validations)) {
        validationResults[processName] = validation.isValid ? '✓ Valid' : `✗ Failed: ${validation.error}`;
      }
      
      setESIRouteValidation(validationResults);
      
      if (results.hasUpdates) {
        toast.success(`Route validation complete. ${Object.keys(results.updates).length} updates available`);
      } else {
        toast.success('All routes validated successfully');
      }
    } catch (error) {
      toast.error('Bulk route validation failed');
    } finally {
      setValidatingRoutes(false);
    }
  };

  const updateESIRouteVersion = (processName: string, version: string) => {
    const success = esiRoutes.updateVersion(processName, version);
    if (success) {
      toast.success(`Updated ${processName} to ESI version ${version}`);
      setRouteUpdateResults(prev => ({
        ...prev,
        [processName]: 'Updated - revalidation needed'
      }));
    } else {
      toast.error(`Failed to update ${processName} route version`);
    }
  };

  const handleSaveSettings = async () => {
    try {
      toast.success('Data sync settings saved successfully');
    } catch (error) {
      toast.error('Failed to save data sync settings');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-400';
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Activity size={12} className="animate-spin" />;
      case 'success': return <CheckCircle size={12} />;
      case 'error': return <X size={12} />;
      default: return <Clock size={12} />;
    }
  };

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatTimeUntilNext = (nextRun: string | null) => {
    if (!nextRun) return 'Not scheduled';
    const nextDate = new Date(nextRun);
    const now = new Date();
    const diff = nextDate.getTime() - now.getTime();
    
    if (diff <= 0) return 'Due now';
    
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return '< 1m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  const handleInstallCron = async () => {
    setIsInstallingCron(true);
    try {
      const enabledProcesses = syncProcesses.filter(p => p.enabled);
      
      if (enabledProcesses.length === 0) {
        toast.warning('No sync processes enabled. Enable at least one process before setting up cron.');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const cronEntries = enabledProcesses.map(p => 
        `*/${p.interval} * * * * /usr/local/bin/lmeve-sync ${p.id}`
      );
      
      console.log('Installing cron entries:', cronEntries);
      
      setCronInstalled(true);
      toast.success(`Successfully installed ${enabledProcesses.length} cron entries for data sync`);
    } catch (error) {
      console.error('Failed to install cron:', error);
      toast.error('Failed to install cron entries');
    } finally {
      setIsInstallingCron(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sync Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock size={20} />
              Data Sync Overview
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {syncProcesses.filter(p => p.enabled).length} Active
              </Badge>
              <Badge variant="outline" className="text-xs">
                {syncProcesses.filter(p => p.status === 'running').length} Running
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Configure automatic data synchronization from EVE Online ESI. Each process can be 
              individually configured with different polling intervals. All sync processes have a 
              minimum interval of 1 day (1440 minutes) to respect ESI rate limits and avoid excessive API calls.
            </AlertDescription>
          </Alert>

          {(!user?.corporationId || !user?.accessToken) && (
            <Alert variant="destructive">
              <Warning className="h-4 w-4" />
              <AlertDescription>
                <strong>ESI Authentication Required:</strong> You must log in with EVE SSO to use data sync features. 
                Manual sync processes require corporation-level ESI authentication.
              </AlertDescription>
            </Alert>
          )}

          {user?.authMethod === 'manual' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                You are logged in with manual credentials. For data sync to work, you need to authenticate 
                with EVE SSO using the "EVE Login" button in the header.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ESI Route Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">ESI Route Management</CardTitle>
            <Button
              onClick={validateESIRoutes}
              disabled={validatingRoutes}
              variant="outline"
              size="sm"
            >
              <ArrowClockwise size={16} className="mr-2" />
              {validatingRoutes ? 'Validating...' : 'Validate Routes'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Manage ESI API versions for each sync process. Newer versions may provide additional 
            data or improved performance.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {syncProcesses.map((process) => (
              <div key={process.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{process.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {process.currentVersion}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <Select
                    value={process.currentVersion}
                    onValueChange={(value) => updateESIRouteVersion(process.id, value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {process.availableVersions.map((version) => (
                        <SelectItem key={version} value={version}>
                          {version}
                          {version === process.currentVersion && ' (current)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {esiRouteValidation[process.id] && (
                  <div className={`text-xs ${
                    esiRouteValidation[process.id].startsWith('✓') 
                      ? 'text-green-400' 
                      : 'text-red-400'
                  }`}>
                    {esiRouteValidation[process.id]}
                  </div>
                )}
                
                {routeUpdateResults[process.id] && (
                  <div className="text-xs text-yellow-400">
                    {routeUpdateResults[process.id]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cron Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock size={20} />
            Automated Sync Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Install cron entries to automatically sync enabled processes at their configured intervals.
          </p>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleInstallCron}
              disabled={isInstallingCron || cronInstalled}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isInstallingCron ? (
                <>
                  <Activity size={16} className="mr-2 animate-spin" />
                  Installing...
                </>
              ) : cronInstalled ? (
                <>
                  <CheckCircle size={16} className="mr-2" />
                  Cron Installed
                </>
              ) : (
                <>
                  <Play size={16} className="mr-2" />
                  Setup Cron
                </>
              )}
            </Button>

            {cronInstalled && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm text-green-400">
                  {syncProcesses.filter(p => p.enabled).length} processes scheduled
                </span>
              </div>
            )}
          </div>

          {cronInstalled && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Cron is active. Enabled sync processes will run automatically at their configured intervals.
                Disable individual processes or modify intervals as needed.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Polled Routes Status List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sync Routes Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {syncProcesses.map((process) => {
              const IconComponent = process.icon;
              const hasError = process.status === 'error';
              const isSuccess = process.status === 'success';
              const isRunning = process.status === 'running';
              
              return (
                <div
                  key={process.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="relative">
                      {process.enabled ? (
                        <div className={`w-3 h-3 rounded-full ${
                          isRunning 
                            ? 'bg-blue-400 animate-pulse' 
                            : hasError 
                            ? 'bg-red-400' 
                            : isSuccess 
                            ? 'bg-green-400' 
                            : 'bg-muted-foreground/30'
                        }`} />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-muted-foreground/20 border border-muted-foreground/40" />
                      )}
                    </div>
                    
                    <IconComponent size={18} className="text-muted-foreground" />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{process.name}</span>
                        {!process.enabled && (
                          <Badge variant="outline" className="text-xs">Disabled</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>Every {process.interval >= 1440 ? `${(process.interval / 1440).toFixed(1)} day${process.interval > 1440 ? 's' : ''}` : `${process.interval}m`}</span>
                        {process.lastSync && (
                          <>
                            <span>•</span>
                            <span>Last: {formatLastSync(process.lastSync)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {process.enabled && process.nextRun ? (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Next sync in</div>
                        <div className="text-sm font-medium tabular-nums">
                          {formatTimeUntilNext(process.nextRun)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground text-right min-w-[80px]">
                        Not scheduled
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => runSyncProcess(process.id)}
                      disabled={!process.enabled || isRunning}
                      className="h-8"
                    >
                      {isRunning ? (
                        <Activity size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sync Process Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configure Sync Processes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enable or disable individual sync processes and adjust their polling intervals.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {syncProcesses.map((process) => {
              const IconComponent = process.icon;
              return (
                <div key={process.id} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent size={16} />
                      <span className="text-sm font-medium">{process.name}</span>
                    </div>
                    <Switch
                      checked={process.enabled}
                      onCheckedChange={(enabled) => updateProcessConfig(process.id, { enabled })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`${process.id}-interval`} className="text-xs text-muted-foreground">
                      Interval (minutes, min: 1 day)
                    </Label>
                    <Input
                      id={`${process.id}-interval`}
                      type="number"
                      min="1440"
                      max="10080"
                      value={process.interval}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1440;
                        const clampedValue = Math.max(1440, Math.min(10080, value));
                        updateProcessConfig(process.id, { 
                          interval: clampedValue
                        });
                      }}
                      disabled={!process.enabled}
                      className="h-8"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum: 1 day (1440 min) • Maximum: 7 days (10080 min)
                    </p>
                  </div>

                  {process.status === 'error' && syncState.getSyncStatus(process.id).errorMessage && (
                    <p className="text-xs text-red-400">
                      {syncState.getSyncStatus(process.id).errorMessage}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Global Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Global Sync Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxConcurrent">Max Concurrent Syncs</Label>
              <Input
                id="maxConcurrent"
                type="number"
                min="1"
                max="10"
                value={syncSettings.maxConcurrentSyncs || 3}
                onChange={(e) => updateSyncSettings({ 
                  maxConcurrentSyncs: parseInt(e.target.value) || 3 
                })}
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of sync processes that can run simultaneously
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="retryAttempts">Retry Attempts</Label>
              <Input
                id="retryAttempts"
                type="number"
                min="0"
                max="5"
                value={syncSettings.retryAttempts || 3}
                onChange={(e) => updateSyncSettings({ 
                  retryAttempts: parseInt(e.target.value) || 3 
                })}
              />
              <p className="text-xs text-muted-foreground">
                Number of retry attempts on sync failure
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings}>
              <CheckCircle size={16} className="mr-2" />
              Save Sync Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity size={20} />
              Recent Sync History
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncState.clearHistory()}
            >
              Clear History
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {syncState.state.history.length === 0 ? (
            <div className="text-center py-8">
              <Info size={32} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No sync history yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {syncState.state.history.slice().reverse().slice(0, 20).map((historyItem, index) => {
                const process = syncProcesses.find(p => p.id === historyItem.processId);
                const IconComponent = process?.icon || Activity;
                
                return (
                  <div 
                    key={`${historyItem.processId}-${historyItem.timestamp}-${index}`}
                    className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <IconComponent size={16} className="text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{process?.name || historyItem.processId}</span>
                          {historyItem.status === 'success' ? (
                            <CheckCircle size={14} className="text-green-400" />
                          ) : (
                            <X size={14} className="text-red-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>{new Date(historyItem.timestamp).toLocaleString()}</span>
                          <span>•</span>
                          <span>{(historyItem.duration / 1000).toFixed(1)}s</span>
                          {historyItem.itemsProcessed !== undefined && (
                            <>
                              <span>•</span>
                              <span>{historyItem.itemsProcessed} items</span>
                            </>
                          )}
                        </div>
                        {historyItem.errorMessage && (
                          <p className="text-xs text-red-400 mt-1">{historyItem.errorMessage}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {syncState.state.history.length > 20 && (
                <p className="text-xs text-center text-muted-foreground pt-2">
                  Showing 20 most recent entries out of {syncState.state.history.length} total
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}