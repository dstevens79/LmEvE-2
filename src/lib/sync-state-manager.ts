import { useKV } from '@github/spark/hooks';

export interface SyncStatus {
  processId: string;
  status: 'idle' | 'running' | 'success' | 'error';
  progress: number;
  currentStep: string;
  lastRunTime?: number;
export interface SyncHistor
  timestamp: number;
  duration: number;
  errorMessage?: stri

  statuses: Record<str
 

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
      this.notifyListeners();
      console.error('Failed to load sync state:', error);
  
  private async saveState() {
      await spark
    } catch (err
    }



    this.listeners.ad
   

  }
  getState(): SyncStateData {
  }
  get
      processId,
   

  }
  isProce
  }
  async startSync(processId: string) {
    th
      status: 'running',
      currentStep: 'Initializing...',
      e
    
    await this.saveState();

    pr
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
    history: state.histo
    getSyncStatus: (processI
    isProcessRunning: (
    g
  };







































































































































