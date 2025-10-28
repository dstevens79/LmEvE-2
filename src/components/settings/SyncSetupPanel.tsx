import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  Warning, 
  X,
  Play,
  Stop,
  ArrowClockwise,
  Clock,
  Database,
  CloudArrowDown,
  List,
  Users,
  Package,
  Factory,
  HardHat,
  TrendUp,
  CurrencyDollar,
  Crosshair,
  Archive,
  Activity
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-provider';
import { SyncScheduler, getSyncScheduler, initializeSyncScheduler, SyncScheduleConfig } from '@/lib/sync-scheduler';
import { useSyncState } from '@/lib/sync-state-manager';
import { DatabaseManager } from '@/lib/database';
import { useDatabaseSettings } from '@/lib/persistenceService';
import { formatDistanceToNow } from 'date-fns';

interface SyncProcessConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  defaultInterval: number;
  enabled: boolean;
}

const SYNC_PROCESSES: SyncProcessConfig[] = [
  {
    id: 'members',
    name: 'Corporation Members',
    description: 'Sync member list, roles, titles, and tracking data',
    icon: Users,
    color: 'text-blue-400',
    defaultInterval: 60,
    enabled: false
  },
  {
    id: 'assets',
    name: 'Corporation Assets',
    description: 'Sync assets, locations, and naming data',
    icon: Package,
    color: 'text-green-400',
    defaultInterval: 30,
    enabled: false
  },
  {
    id: 'manufacturing',
    name: 'Industry Jobs',
    description: 'Sync manufacturing, research, and reaction jobs',
    icon: Factory,
    color: 'text-purple-400',
    defaultInterval: 15,
    enabled: false
  },
  {
    id: 'market',
    name: 'Market Orders',
    description: 'Sync corporation market buy and sell orders',
    icon: TrendUp,
    color: 'text-orange-400',
    defaultInterval: 20,
    enabled: false
  },
  {
    id: 'wallet',
    name: 'Wallet Transactions',
    description: 'Sync wallet journal and transactions across divisions',
    icon: CurrencyDollar,
    color: 'text-yellow-400',
    defaultInterval: 30,
    enabled: false
  },
  {
    id: 'mining',
    name: 'Mining Ledger',
    description: 'Sync corporation mining operations and yields',
    icon: HardHat,
    color: 'text-amber-400',
    defaultInterval: 120,
    enabled: false
  },
  {
    id: 'container_logs',
    name: 'Container Logs',
    description: 'Sync container access logs for project tracking',
    icon: Archive,
    color: 'text-cyan-400',
    defaultInterval: 60,
    enabled: false
  },
  {
    id: 'killmails',
    name: 'Killmails',
    description: 'Sync corporation killmails and combat data',
    icon: Crosshair,
    color: 'text-red-400',
    defaultInterval: 60,
    enabled: false
  }
];

export function SyncSetupPanel() {
  const { user, getRegisteredCorporations } = useAuth();
  const [databaseSettings] = useDatabaseSettings();
  const { state: syncState, getSyncStatus, isProcessRunning } = useSyncState();
  
  const [scheduler, setScheduler] = useState<SyncScheduler | null>(null);
  const [isSchedulerRunning, setIsSchedulerRunning] = useState(false);
  const [processConfigs, setProcessConfigs] = useState<Map<string, SyncScheduleConfig>>(new Map());
  const [setupComplete, setSetupComplete] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const registeredCorps = getRegisteredCorporations();
  const activeCorp = registeredCorps.find(c => c.isActive);

  useEffect(() => {
    const schedulerInstance = getSyncScheduler();
    setScheduler(schedulerInstance);
    setIsSchedulerRunning(schedulerInstance.isRunning());
    
    const configs = schedulerInstance.getScheduledProcesses();
    const configMap = new Map(configs.map(c => [c.processId, c]));
    setProcessConfigs(configMap);
    
    if (configs.length > 0) {
      setSetupComplete(true);
    }
  }, []);

  const checkRequirements = () => {
    const requirements = {
      hasUser: !!user,
      hasActiveCorp: !!activeCorp,
      hasDatabase: !!(databaseSettings?.host && databaseSettings?.username && databaseSettings?.password),
      hasESIAuth: !!(activeCorp?.accessToken)
    };
    
    const isReady = Object.values(requirements).every(Boolean);
    
    return { requirements, isReady };
  };

  const { requirements, isReady } = checkRequirements();

  const handleSetupSync = async () => {
    if (!isReady) {
      toast.error('Please complete all requirements before setting up sync');
      return;
    }

    setIsInitializing(true);
    
    try {
      const configs: SyncScheduleConfig[] = SYNC_PROCESSES.map(process => ({
        processId: `corp_${activeCorp!.corporationId}_${process.id}`,
        processType: process.id as any,
        enabled: false,
        intervalMinutes: process.defaultInterval
      }));

      await initializeSyncScheduler(configs);
      
      const configMap = new Map(configs.map(c => [c.processId, c]));
      setProcessConfigs(configMap);
      setSetupComplete(true);
      
      toast.success('Sync system initialized successfully');
    } catch (error) {
      console.error('Failed to setup sync:', error);
      toast.error('Failed to initialize sync system');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleStartScheduler = () => {
    if (!scheduler) return;
    
    try {
      scheduler.start();
      setIsSchedulerRunning(true);
      toast.success('Sync scheduler started');
    } catch (error) {
      console.error('Failed to start scheduler:', error);
      toast.error('Failed to start scheduler');
    }
  };

  const handleStopScheduler = () => {
    if (!scheduler) return;
    
    try {
      scheduler.stop();
      setIsSchedulerRunning(false);
      toast.success('Sync scheduler stopped');
    } catch (error) {
      console.error('Failed to stop scheduler:', error);
      toast.error('Failed to stop scheduler');
    }
  };

  const handleToggleProcess = async (processId: string) => {
    if (!scheduler) return;
    
    const config = processConfigs.get(processId);
    if (!config) return;
    
    try {
      await scheduler.toggleProcess(processId, !config.enabled);
      
      const updatedConfig = { ...config, enabled: !config.enabled };
      setProcessConfigs(new Map(processConfigs).set(processId, updatedConfig));
      
      toast.success(`${config.enabled ? 'Disabled' : 'Enabled'} sync process`);
    } catch (error) {
      console.error('Failed to toggle process:', error);
      toast.error('Failed to toggle sync process');
    }
  };

  const handleRunNow = async (processId: string, processType: string) => {
    if (!scheduler || !activeCorp) return;
    
    if (!activeCorp.accessToken) {
      toast.error('No valid access token for corporation');
      return;
    }

    if (!databaseSettings?.host) {
      toast.error('Database not configured');
      return;
    }

    try {
      const databaseService = new DatabaseManager({
        host: databaseSettings.host,
        port: databaseSettings.port || 3306,
        username: databaseSettings.username!,
        password: databaseSettings.password!,
        database: databaseSettings.database || 'lmeve'
      });

      await scheduler.runProcessNow(
        processId,
        processType as any,
        activeCorp.corporationId,
        activeCorp.accessToken,
        databaseService
      );
      
      toast.success('Sync process started');
    } catch (error) {
      console.error('Failed to run sync:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run sync');
    }
  };

  if (!setupComplete) {
    return (
      <div className="space-y-4">
        <div className="p-6 bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20 rounded-lg">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-accent/20 rounded-lg">
              <CloudArrowDown size={32} className="text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Setup Data Synchronization</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure automated data synchronization between EVE Online ESI and your local database.
                This enables real-time tracking of corporation assets, members, manufacturing, and more.
              </p>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2">
                  {requirements.hasUser ? (
                    <CheckCircle size={18} className="text-green-400" />
                  ) : (
                    <X size={18} className="text-red-400" />
                  )}
                  <span className="text-sm">User authenticated</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {requirements.hasActiveCorp ? (
                    <CheckCircle size={18} className="text-green-400" />
                  ) : (
                    <X size={18} className="text-red-400" />
                  )}
                  <span className="text-sm">Active corporation registered</span>
                  {activeCorp && (
                    <Badge variant="secondary" className="text-xs">
                      {activeCorp.corporationName}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {requirements.hasDatabase ? (
                    <CheckCircle size={18} className="text-green-400" />
                  ) : (
                    <X size={18} className="text-red-400" />
                  )}
                  <span className="text-sm">Database configured</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {requirements.hasESIAuth ? (
                    <CheckCircle size={18} className="text-green-400" />
                  ) : (
                    <X size={18} className="text-red-400" />
                  )}
                  <span className="text-sm">ESI authentication active</span>
                </div>
              </div>
              
              {!isReady && (
                <Alert className="mb-4">
                  <Warning size={16} />
                  <AlertDescription>
                    Please complete all requirements before setting up sync. Ensure you have registered a corporation 
                    with director/CEO permissions via EVE SSO and configured database connection in Settings.
                  </AlertDescription>
                </Alert>
              )}
              
              <Button
                onClick={handleSetupSync}
                disabled={!isReady || isInitializing}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {isInitializing ? (
                  <>
                    <ArrowClockwise size={16} className="mr-2 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <CloudArrowDown size={16} className="mr-2" />
                    Setup Data Sync
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scheduler Status and Controls */}
      <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isSchedulerRunning ? 'bg-green-500/20' : 'bg-muted'}`}>
              <Activity size={24} className={isSchedulerRunning ? 'text-green-400' : 'text-muted-foreground'} />
            </div>
            <div>
              <h3 className="font-semibold">Sync Scheduler</h3>
              <p className="text-sm text-muted-foreground">
                {isSchedulerRunning ? 'Running - monitoring scheduled processes' : 'Stopped - no automatic syncing'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={isSchedulerRunning ? "default" : "secondary"} className="text-xs">
              {isSchedulerRunning ? "Active" : "Inactive"}
            </Badge>
            {isSchedulerRunning ? (
              <Button
                onClick={handleStopScheduler}
                variant="outline"
                size="sm"
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                <Stop size={16} className="mr-2" />
                Stop Scheduler
              </Button>
            ) : (
              <Button
                onClick={handleStartScheduler}
                variant="outline"
                size="sm"
                className="border-green-500/50 text-green-400 hover:bg-green-500/10"
              >
                <Play size={16} className="mr-2" />
                Start Scheduler
              </Button>
            )}
          </div>
        </div>
        
        {activeCorp && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Corporation:</span>
              <span className="font-medium">{activeCorp.corporationName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Active Processes:</span>
              <Badge variant="secondary">
                {Array.from(processConfigs.values()).filter(c => c.enabled).length} / {processConfigs.size}
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* Individual Process Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <List size={18} />
            Sync Processes
          </h4>
          <Badge variant="outline" className="text-xs">
            {SYNC_PROCESSES.length} processes available
          </Badge>
        </div>
        
        <div className="grid gap-4">
          {SYNC_PROCESSES.map((process) => {
            const processId = `corp_${activeCorp?.corporationId}_${process.id}`;
            const config = processConfigs.get(processId);
            const status = getSyncStatus(processId);
            const running = isProcessRunning(processId);
            const nextRun = scheduler?.getNextRunTime(processId);
            const IconComponent = process.icon;

            return (
              <div key={process.id} className="p-4 border border-border rounded-lg hover:border-accent/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${config?.enabled ? 'bg-accent/20' : 'bg-muted'}`}>
                      <IconComponent size={20} className={config?.enabled ? process.color : 'text-muted-foreground'} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-medium">{process.name}</h5>
                        {running && (
                          <Badge variant="default" className="text-xs">
                            <ArrowClockwise size={12} className="mr-1 animate-spin" />
                            Running
                          </Badge>
                        )}
                        {status.status === 'error' && (
                          <Badge variant="destructive" className="text-xs">
                            Error
                          </Badge>
                        )}
                        {status.status === 'success' && !running && (
                          <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-400">
                            <CheckCircle size={12} className="mr-1" />
                            Success
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{process.description}</p>
                      
                      {running && (
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{status.currentStep}</span>
                            <span className="text-muted-foreground">{status.progress}%</span>
                          </div>
                          <Progress value={status.progress} className="h-1" />
                          {status.itemsProcessed !== undefined && status.totalItems !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              {status.itemsProcessed} / {status.totalItems} items
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Interval:</span>
                          <span className="ml-1 font-medium">{config?.intervalMinutes || process.defaultInterval} min</span>
                        </div>
                        {status.lastRunTime && (
                          <div>
                            <span className="text-muted-foreground">Last run:</span>
                            <span className="ml-1 font-medium">
                              {formatDistanceToNow(status.lastRunTime, { addSuffix: true })}
                            </span>
                          </div>
                        )}
                        {nextRun && config?.enabled && (
                          <div>
                            <span className="text-muted-foreground">Next run:</span>
                            <span className="ml-1 font-medium">
                              {formatDistanceToNow(nextRun, { addSuffix: true })}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {status.errorMessage && (
                        <Alert className="mt-2">
                          <Warning size={14} />
                          <AlertDescription className="text-xs">
                            {status.errorMessage}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      onClick={() => handleRunNow(processId, process.id)}
                      disabled={running || !config?.enabled}
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                    >
                      <Play size={14} className="mr-1" />
                      Run Now
                    </Button>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config?.enabled || false}
                        onCheckedChange={() => handleToggleProcess(processId)}
                        disabled={running}
                      />
                      <Label className="text-xs text-muted-foreground">
                        {config?.enabled ? 'Enabled' : 'Disabled'}
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
