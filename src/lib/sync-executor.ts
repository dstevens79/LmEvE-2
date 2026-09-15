import { SyncStateManager } from './sync-state-manager';
import { ESIDataFetchService } from './esi-data-service';
import { ESIDataStorageService } from './database';
import { SyncErrorLogger } from './sync-error-logger';

export interface SyncExecutionContext {
  processId: string;
  corporationId: number;
  accessToken: string;
  storageService: ESIDataStorageService;
  fetchService: ESIDataFetchService;
}

export type SyncProcessType = 
  | 'members' 
  | 'assets' 
  | 'manufacturing' 
  | 'market' 
  | 'wallet' 
  | 'mining' 
  | 'killmails'
  | 'container_logs'
  | 'contracts'
  | 'item_costs'
  | 'item_pricing';

// Note: 'planetary' and 'personal_esi' processes run server-side via sync-core.php
// and are not available in this browser executor.

export interface SyncResult {
  success: boolean;
  itemsProcessed: number;
  errorMessage?: string;
}

export class SyncExecutor {
  private stateManager: SyncStateManager;
  private errorLogger: SyncErrorLogger;
  
  constructor() {
    this.stateManager = SyncStateManager.getInstance();
    this.errorLogger = SyncErrorLogger.getInstance();
  }

  async executeSyncProcess(
    processType: SyncProcessType,
    context: SyncExecutionContext
  ): Promise<SyncResult> {
    const { processId, corporationId, accessToken, storageService, fetchService } = context;
    
    console.log(`🔄 Starting sync process: ${processType} for corporation ${corporationId}`);
    
    try {
      await this.stateManager.startSync(processId);
      
      // All sync processes that reach this executor run server-side via sync-core.php
      // The DataSyncSettings component routes them to runCorpSyncSegment on the server
      console.warn(`⚠️ Sync process '${processType}' was routed to browser executor but should run server-side.`);
      await this.stateManager.failSync(processId, `Process '${processType}' must run server-side via sync-core.php`);
      return {
        success: false,
        itemsProcessed: 0,
        errorMessage: `Sync process '${processType}' must run server-side via sync-core.php`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Sync process ${processType} failed:`, errorMessage);
      
      // Log error with appropriate type detection
      const errorType = this.detectErrorType(error);
      await this.errorLogger.logError({
        processId,
        processName: processType.replace('_', ' ').toUpperCase(),
        errorType,
        errorMessage,
        errorDetails: error instanceof Error ? error.stack : undefined,
        corporationId
      });
      
      await this.stateManager.failSync(processId, errorMessage);
      return {
        success: false,
        itemsProcessed: 0,
        errorMessage
      };
    }
  }

  private detectErrorType(error: any): 'esi_api' | 'database' | 'auth' | 'network' | 'validation' | 'unknown' {
    if (!error) return 'unknown';
    
    const errorStr = error.toString().toLowerCase();
    const message = error.message?.toLowerCase() || '';
    
    if (errorStr.includes('401') || errorStr.includes('403') || message.includes('auth')) {
      return 'auth';
    }
    if (errorStr.includes('esi') || errorStr.includes('evetech') || error.response?.config?.url?.includes('esi')) {
      return 'esi_api';
    }
    if (errorStr.includes('database') || errorStr.includes('sql') || message.includes('query')) {
      return 'database';
    }
    if (errorStr.includes('network') || errorStr.includes('fetch') || message.includes('timeout')) {
      return 'network';
    }
    if (errorStr.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    
    return 'unknown';
  }
}