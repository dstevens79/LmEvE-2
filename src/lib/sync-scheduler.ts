import { SyncStateManager } from './sync-state-manager';
import { SyncExecutor, SyncProcessType } from './sync-executor';
import { ESIDataFetchService } from './esi-data-service';
import { ESIDataStorageService } from './database';
import { AuthUser } from './auth-provider';

export interface SyncScheduleConfig {
  processId: string;
  processType: SyncProcessType;
  enabled: boolean;
  intervalMinutes: number;
}

export interface SchedulerState {
  isRunning: boolean;
  scheduledProcesses: Map<string, SyncScheduleConfig>;
  nextRunTimes: Map<string, number>;
  intervalHandles: Map<string, number>;
}

export class SyncScheduler {
  private static instance: SyncScheduler;
  private stateManager: SyncStateManager;
  private executor: SyncExecutor;
  private state: SchedulerState;
  private checkIntervalHandle?: number;

  private constructor() {
    this.stateManager = SyncStateManager.getInstance();
    this.executor = new SyncExecutor();
    this.state = {
      isRunning: false,
      scheduledProcesses: new Map(),
      nextRunTimes: new Map(),
      intervalHandles: new Map()
    };
  }

  static getInstance(): SyncScheduler {
    if (!SyncScheduler.instance) {
      SyncScheduler.instance = new SyncScheduler();
    }
    return SyncScheduler.instance;
  }

  async loadScheduleConfig() {
    try {
      const configs = await spark.kv.get<SyncScheduleConfig[]>('sync-schedule-configs');
      if (configs) {
        configs.forEach(config => {
          this.state.scheduledProcesses.set(config.processId, config);
        });
      }
      console.log(`📅 Loaded ${this.state.scheduledProcesses.size} scheduled sync processes`);
    } catch (error) {
      console.error('Failed to load schedule config:', error);
    }
  }

  async saveScheduleConfig() {
    try {
      const configs = Array.from(this.state.scheduledProcesses.values());
      await spark.kv.set('sync-schedule-configs', configs);
      console.log(`💾 Saved ${configs.length} scheduled sync processes`);
    } catch (error) {
      console.error('Failed to save schedule config:', error);
    }
  }

  async scheduleProcess(config: SyncScheduleConfig) {
    console.log(`📅 Scheduling process: ${config.processId} (interval: ${config.intervalMinutes}m, enabled: ${config.enabled})`);
    
    this.state.scheduledProcesses.set(config.processId, config);
    
    if (config.enabled) {
      const nextRunTime = Date.now() + (config.intervalMinutes * 60 * 1000);
      this.state.nextRunTimes.set(config.processId, nextRunTime);
      await this.stateManager.setNextRunTime(config.processId, nextRunTime);
    }
    
    await this.saveScheduleConfig();
  }

  async unscheduleProcess(processId: string) {
    console.log(`📅 Unscheduling process: ${processId}`);
    
    this.state.scheduledProcesses.delete(processId);
    this.state.nextRunTimes.delete(processId);
    
    await this.saveScheduleConfig();
  }

  async updateProcessInterval(processId: string, intervalMinutes: number) {
    const config = this.state.scheduledProcesses.get(processId);
    if (config) {
      config.intervalMinutes = intervalMinutes;
      
      if (config.enabled) {
        const nextRunTime = Date.now() + (intervalMinutes * 60 * 1000);
        this.state.nextRunTimes.set(processId, nextRunTime);
        await this.stateManager.setNextRunTime(processId, nextRunTime);
      }
      
      await this.saveScheduleConfig();
    }
  }

  async toggleProcess(processId: string, enabled: boolean) {
    const config = this.state.scheduledProcesses.get(processId);
    if (config) {
      config.enabled = enabled;
      
      if (enabled) {
        const nextRunTime = Date.now() + (config.intervalMinutes * 60 * 1000);
        this.state.nextRunTimes.set(processId, nextRunTime);
        await this.stateManager.setNextRunTime(processId, nextRunTime);
      } else {
        this.state.nextRunTimes.delete(processId);
        await this.stateManager.setNextRunTime(processId, 0);
      }
      
      await this.saveScheduleConfig();
    }
  }

  start() {
    if (this.state.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    console.log('▶️ Starting sync scheduler...');
    this.state.isRunning = true;

    this.checkIntervalHandle = window.setInterval(() => {
      this.checkScheduledProcesses();
    }, 60000);

    this.checkScheduledProcesses();
  }

  stop() {
    if (!this.state.isRunning) {
      console.log('⚠️ Scheduler is not running');
      return;
    }

    console.log('⏸️ Stopping sync scheduler...');
    this.state.isRunning = false;

    if (this.checkIntervalHandle !== undefined) {
      window.clearInterval(this.checkIntervalHandle);
      this.checkIntervalHandle = undefined;
    }
  }

  private async checkScheduledProcesses() {
    const now = Date.now();

    for (const [processId, config] of this.state.scheduledProcesses) {
      if (!config.enabled) continue;

      const nextRunTime = this.state.nextRunTimes.get(processId);
      
      if (!nextRunTime || now >= nextRunTime) {
        if (!this.stateManager.isProcessRunning(processId)) {
          console.log(`⏰ Time to run scheduled process: ${processId}`);
          
          const newNextRunTime = now + (config.intervalMinutes * 60 * 1000);
          this.state.nextRunTimes.set(processId, newNextRunTime);
          await this.stateManager.setNextRunTime(processId, newNextRunTime);
        } else {
          console.log(`⏭️ Skipping scheduled run for ${processId} - already running`);
        }
      }
    }
  }

  async runProcessNow(
    processId: string,
    processType: SyncProcessType,
    corporationId: number,
    accessToken: string,
    databaseService: any
  ): Promise<void> {
    if (this.stateManager.isProcessRunning(processId)) {
      throw new Error(`Process ${processId} is already running`);
    }

    console.log(`🚀 Manually running sync process: ${processId}`);

    const storageService = new ESIDataStorageService(databaseService);
    const fetchService = new ESIDataFetchService();

    const result = await this.executor.executeSyncProcess(processType, {
      processId,
      corporationId,
      accessToken,
      storageService,
      fetchService
    });

    if (!result.success) {
      throw new Error(result.errorMessage || 'Sync process failed');
    }

    const config = this.state.scheduledProcesses.get(processId);
    if (config && config.enabled) {
      const nextRunTime = Date.now() + (config.intervalMinutes * 60 * 1000);
      this.state.nextRunTimes.set(processId, nextRunTime);
      await this.stateManager.setNextRunTime(processId, nextRunTime);
    }
  }

  getScheduledProcesses(): SyncScheduleConfig[] {
    return Array.from(this.state.scheduledProcesses.values());
  }

  getProcessConfig(processId: string): SyncScheduleConfig | undefined {
    return this.state.scheduledProcesses.get(processId);
  }

  getNextRunTime(processId: string): number | undefined {
    return this.state.nextRunTimes.get(processId);
  }

  isRunning(): boolean {
    return this.state.isRunning;
  }
}

export async function initializeSyncScheduler(configs: SyncScheduleConfig[]) {
  const scheduler = SyncScheduler.getInstance();
  
  await scheduler.loadScheduleConfig();
  
  for (const config of configs) {
    await scheduler.scheduleProcess(config);
  }
  
  return scheduler;
}

export function getSyncScheduler(): SyncScheduler {
  return SyncScheduler.getInstance();
}
