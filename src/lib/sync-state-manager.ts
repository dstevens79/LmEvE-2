import { useKV } from '@github/spark/hooks';

export interface SyncStatus {
  processId: string;
  status: 'idle' | 'running' | 'success' | 'error';
  progress: number;
  currentStep: string;
  lastRunTime?: number;
  lastSuccessTime?: number;
  nextRunTime?: number;
  errorMessage?: string;
  errorCount: number;
  itemsProcessed?: number;
  totalItems?: number;
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
  private listeners: Set<(state: SyncStateData) => void> = new Set();
  
  private state: SyncStateData = {
    statuses: {},
    history: [],
    runningProcesses: new Set()
  };

  private constructor() {
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
      const storedStatuses = await spark.kv.get<Record<string, SyncStatus>>('sync-statuses');
      const storedHistory = await spark.kv.get<SyncHistory[]>('sync-history');
      
      if (storedStatuses) {
        this.state.statuses = storedStatuses;
      }
      if (storedHistory) {
        this.state.history = storedHistory.slice(-100);
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
      this.state.statuses[processId].progress = progress;
      this.state.statuses[processId].currentStep = currentStep;
      if (itemsProcessed !== undefined) {
        this.state.statuses[processId].itemsProcessed = itemsProcessed;
      }
      if (totalItems !== undefined) {
        this.state.statuses[processId].totalItems = totalItems;
      }
      
      this.notifyListeners();
    }
  }

  async completeSync(processId: string, itemsProcessed?: number) {
    const startTime = this.state.statuses[processId]?.lastRunTime || Date.now();
    const duration = Date.now() - startTime;
    
    this.state.runningProcesses.delete(processId);
    this.state.statuses[processId] = {
      ...this.state.statuses[processId],
      processId,
      status: 'success',
      progress: 100,
      currentStep: 'Completed',
      lastSuccessTime: Date.now(),
      errorCount: 0,
      itemsProcessed
    };

    this.state.history.unshift({
      processId,
      timestamp: Date.now(),
      status: 'success',
      duration,
      itemsProcessed
    });
    
    this.state.history = this.state.history.slice(0, 100);
    
    this.notifyListeners();
    await this.saveState();
  }

  async failSync(processId: string, errorMessage: string) {
    const startTime = this.state.statuses[processId]?.lastRunTime || Date.now();
    const duration = Date.now() - startTime;
    const currentErrorCount = this.state.statuses[processId]?.errorCount || 0;
    
    this.state.runningProcesses.delete(processId);
    this.state.statuses[processId] = {
      ...this.state.statuses[processId],
      processId,
      status: 'error',
      currentStep: 'Failed',
      errorMessage,
      errorCount: currentErrorCount + 1
    };

    this.state.history.unshift({
      processId,
      timestamp: Date.now(),
      status: 'error',
      duration,
      errorMessage
    });
    
    this.state.history = this.state.history.slice(0, 100);
    
    this.notifyListeners();
    await this.saveState();
  }

  async setNextRunTime(processId: string, nextRunTime: number) {
    if (this.state.statuses[processId]) {
      this.state.statuses[processId].nextRunTime = nextRunTime;
      this.notifyListeners();
      await this.saveState();
    }
  }

  getSyncHistory(processId?: string, limit: number = 20): SyncHistory[] {
    if (processId) {
      return this.state.history
        .filter(h => h.processId === processId)
        .slice(0, limit);
    }
    return this.state.history.slice(0, limit);
  }

  async clearHistory() {
    this.state.history = [];
    this.notifyListeners();
    await this.saveState();
  }

  async resetSyncStatus(processId: string) {
    this.state.runningProcesses.delete(processId);
    this.state.statuses[processId] = {
      processId,
      status: 'idle',
      progress: 0,
      currentStep: 'Not started',
      errorCount: 0
    };
    
    this.notifyListeners();
    await this.saveState();
  }
}

export function useSyncState() {
  const [state, setState] = React.useState<SyncStateData>(() => 
    SyncStateManager.getInstance().getState()
  );

  React.useEffect(() => {
    const manager = SyncStateManager.getInstance();
    const unsubscribe = manager.subscribe(setState);
    return unsubscribe;
  }, []);

  return {
    statuses: state.statuses,
    history: state.history,
    runningProcesses: state.runningProcesses,
    getSyncStatus: (processId: string) => 
      SyncStateManager.getInstance().getSyncStatus(processId),
    isProcessRunning: (processId: string) =>
      SyncStateManager.getInstance().isProcessRunning(processId),
    getSyncHistory: (processId?: string, limit?: number) =>
      SyncStateManager.getInstance().getSyncHistory(processId, limit)
  };
}

import React from 'react';
