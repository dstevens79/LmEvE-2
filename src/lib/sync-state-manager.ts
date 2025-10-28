import { useState, useEffect } from 'react';

export interface SyncStatus {
  processId: string;
  status: 'idle' | 'running' | 'success' | 'error';
  progress: number;
  currentStep: string;
  lastRunTime?: number;
  errorCount: number;
  itemsProcessed?: number;
  totalItems?: number;
  errorMessage?: string;
}

export interface SyncHistory {
  processId: string;
  timestamp: number;
  status: 'success' | 'error';
  duration: number;
  itemsProcessed?: number;
  errorMessage?: string;
}

export interface SyncStateData {
  statuses: Record<string, SyncStatus>;
  history: SyncHistory[];
  runningProcesses: Set<string>;
}

export class SyncStateManager {
  private static instance: SyncStateManager;
  private state: SyncStateData;
  private listeners: Set<(state: SyncStateData) => void>;

  private constructor() {
    this.state = {
      statuses: {},
      history: [],
      runningProcesses: new Set()
    };
    this.listeners = new Set();
    this.loadState();
  }

  static getInstance(): SyncStateManager {
    if (!SyncStateManager.instance) {
      SyncStateManager.instance = new SyncStateManager();
    }
    return SyncStateManager.instance;
  }

  private async loadState() {
    try {
      const statuses = await spark.kv.get<Record<string, SyncStatus>>('sync-statuses');
      const history = await spark.kv.get<SyncHistory[]>('sync-history');
      
      if (statuses) {
        this.state.statuses = statuses;
      }
      if (history) {
        this.state.history = history;
      }
      
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to load sync state:', error);
    }
  }

  private async saveState() {
    try {
      await spark.kv.set('sync-statuses', this.state.statuses);
      await spark.kv.set('sync-history', this.state.history.slice(-100));
    } catch (error) {
      console.error('Failed to save sync state:', error);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  subscribe(listener: (state: SyncStateData) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): SyncStateData {
    return this.state;
  }

  getSyncStatus(processId: string): SyncStatus {
    return this.state.statuses[processId] || {
      processId,
      status: 'idle',
      progress: 0,
      currentStep: 'Not started',
      errorCount: 0
    };
  }

  isProcessRunning(processId: string): boolean {
    return this.state.runningProcesses.has(processId);
  }

  async startSync(processId: string) {
    this.state.runningProcesses.add(processId);
    this.state.statuses[processId] = {
      processId,
      status: 'running',
      progress: 0,
      currentStep: 'Initializing...',
      lastRunTime: Date.now(),
      errorCount: 0
    };
    
    this.notifyListeners();
    await this.saveState();
  }

  async updateSyncProgress(
    processId: string, 
    progress: number, 
    currentStep: string,
    itemsProcessed?: number,
    totalItems?: number
  ) {
    if (this.state.statuses[processId]) {
      this.state.statuses[processId] = {
        ...this.state.statuses[processId],
        progress,
        currentStep,
        itemsProcessed,
        totalItems
      };
      
      this.notifyListeners();
      await this.saveState();
    }
  }

  async completeSync(processId: string, itemsProcessed: number = 0) {
    const status = this.state.statuses[processId];
    if (!status) return;

    const duration = status.lastRunTime ? Date.now() - status.lastRunTime : 0;
    
    this.state.statuses[processId] = {
      ...status,
      status: 'success',
      progress: 100,
      currentStep: 'Completed',
      itemsProcessed
    };
    
    this.state.runningProcesses.delete(processId);
    
    this.state.history.push({
      processId,
      timestamp: Date.now(),
      status: 'success',
      duration,
      itemsProcessed
    });
    
    this.notifyListeners();
    await this.saveState();
  }

  async failSync(processId: string, errorMessage: string) {
    const status = this.state.statuses[processId];
    if (!status) return;

    const duration = status.lastRunTime ? Date.now() - status.lastRunTime : 0;
    
    this.state.statuses[processId] = {
      ...status,
      status: 'error',
      currentStep: 'Failed',
      errorMessage,
      errorCount: (status.errorCount || 0) + 1
    };
    
    this.state.runningProcesses.delete(processId);
    
    this.state.history.push({
      processId,
      timestamp: Date.now(),
      status: 'error',
      duration,
      errorMessage
    });
    
    this.notifyListeners();
    await this.saveState();
  }

  getHistory(processId?: string): SyncHistory[] {
    if (processId) {
      return this.state.history.filter(h => h.processId === processId);
    }
    return this.state.history;
  }

  clearHistory(processId?: string) {
    if (processId) {
      this.state.history = this.state.history.filter(h => h.processId !== processId);
    } else {
      this.state.history = [];
    }
    this.notifyListeners();
    this.saveState();
  }

  async setNextRunTime(processId: string, timestamp: number) {
    try {
      await spark.kv.set(`sync-next-run-${processId}`, timestamp);
    } catch (error) {
      console.error('Failed to save next run time:', error);
    }
  }

  async getNextRunTime(processId: string): Promise<number | undefined> {
    try {
      return await spark.kv.get<number>(`sync-next-run-${processId}`);
    } catch (error) {
      console.error('Failed to get next run time:', error);
      return undefined;
    }
  }
}

export function useSyncState() {
  const [state, setState] = useState<SyncStateData>(() => 
    SyncStateManager.getInstance().getState()
  );

  useEffect(() => {
    const manager = SyncStateManager.getInstance();
    const unsubscribe = manager.subscribe(setState);
    return unsubscribe;
  }, []);

  return {
    state,
    syncStatuses: state.statuses,
    syncHistory: state.history,
    getSyncStatus: (processId: string) => 
      SyncStateManager.getInstance().getSyncStatus(processId),
    isProcessRunning: (processId: string) => 
      SyncStateManager.getInstance().isProcessRunning(processId),
    getHistory: (processId?: string) => 
      SyncStateManager.getInstance().getHistory(processId),
    clearHistory: (processId?: string) => 
      SyncStateManager.getInstance().clearHistory(processId),
    setNextRunTime: (processId: string, timestamp: number) =>
      SyncStateManager.getInstance().setNextRunTime(processId, timestamp),
    getNextRunTime: (processId: string) =>
      SyncStateManager.getInstance().getNextRunTime(processId)
  };
}
