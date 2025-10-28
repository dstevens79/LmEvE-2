import { SyncStateManager } from './sync-state-manager';
import { ESIDataFetchService } from './esi-data-service';
import { ESIDataStorageService } from './database';

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
  | 'container_logs';

export interface SyncResult {
  success: boolean;
  itemsProcessed: number;
  errorMessage?: string;
}

export class SyncExecutor {
  private stateManager: SyncStateManager;
  
  constructor() {
    this.stateManager = SyncStateManager.getInstance();
  }

  async executeSyncProcess(
    processType: SyncProcessType,
    context: SyncExecutionContext
  ): Promise<SyncResult> {
    const { processId, corporationId, accessToken, storageService, fetchService } = context;
    
    console.log(`🔄 Starting sync process: ${processType} for corporation ${corporationId}`);
    
    try {
      await this.stateManager.startSync(processId);
      
      switch (processType) {
        case 'members':
          return await this.syncMembers(context);
        case 'assets':
          return await this.syncAssets(context);
        case 'manufacturing':
          return await this.syncManufacturing(context);
        case 'market':
          return await this.syncMarket(context);
        case 'wallet':
          return await this.syncWallet(context);
        case 'mining':
          return await this.syncMining(context);
        case 'killmails':
          return await this.syncKillmails(context);
        case 'container_logs':
          return await this.syncContainerLogs(context);
        default:
          throw new Error(`Unknown sync process type: ${processType}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Sync process ${processType} failed:`, errorMessage);
      await this.stateManager.failSync(processId, errorMessage);
      return {
        success: false,
        itemsProcessed: 0,
        errorMessage
      };
    }
  }

  private async syncMembers(context: SyncExecutionContext): Promise<SyncResult> {
    const { processId, corporationId, accessToken, storageService, fetchService } = context;
    
    await this.stateManager.updateSyncProgress(processId, 10, 'Fetching members from ESI...');
    
    const members = await fetchService.fetchCorporationMembers(corporationId, accessToken);
    
    if (!members || members.length === 0) {
      console.warn(`⚠️ No members data retrieved for corporation ${corporationId}`);
      await this.stateManager.completeSync(processId, 0);
      return { success: true, itemsProcessed: 0 };
    }
    
    await this.stateManager.updateSyncProgress(
      processId, 
      50, 
      'Storing members in database...',
      0,
      members.length
    );
    
    await storageService.storeMembers(corporationId, members);
    
    await this.stateManager.updateSyncProgress(processId, 90, 'Finalizing...');
    await this.stateManager.completeSync(processId, members.length);
    
    console.log(`✅ Members sync complete: ${members.length} members stored`);
    
    return {
      success: true,
      itemsProcessed: members.length
    };
  }

  private async syncAssets(context: SyncExecutionContext): Promise<SyncResult> {
    const { processId, corporationId, accessToken, storageService, fetchService } = context;
    
    await this.stateManager.updateSyncProgress(processId, 10, 'Fetching assets from ESI...');
    
    const assets = await fetchService.fetchCorporationAssets(corporationId, accessToken);
    
    if (!assets || assets.length === 0) {
      console.warn(`⚠️ No assets data retrieved for corporation ${corporationId}`);
      await this.stateManager.completeSync(processId, 0);
      return { success: true, itemsProcessed: 0 };
    }
    
    await this.stateManager.updateSyncProgress(
      processId, 
      50, 
      'Storing assets in database...',
      0,
      assets.length
    );
    
    await storageService.storeAssets(corporationId, assets);
    
    await this.stateManager.updateSyncProgress(processId, 90, 'Finalizing...');
    await this.stateManager.completeSync(processId, assets.length);
    
    console.log(`✅ Assets sync complete: ${assets.length} assets stored`);
    
    return {
      success: true,
      itemsProcessed: assets.length
    };
  }

  private async syncManufacturing(context: SyncExecutionContext): Promise<SyncResult> {
    const { processId, corporationId, accessToken, storageService, fetchService } = context;
    
    await this.stateManager.updateSyncProgress(processId, 10, 'Fetching industry jobs from ESI...');
    
    const jobs = await fetchService.fetchIndustryJobs(corporationId, accessToken);
    
    if (!jobs || jobs.length === 0) {
      console.warn(`⚠️ No industry jobs retrieved for corporation ${corporationId}`);
      await this.stateManager.completeSync(processId, 0);
      return { success: true, itemsProcessed: 0 };
    }
    
    await this.stateManager.updateSyncProgress(
      processId, 
      50, 
      'Storing industry jobs in database...',
      0,
      jobs.length
    );
    
    await storageService.storeIndustryJobs(corporationId, jobs);
    
    await this.stateManager.updateSyncProgress(processId, 90, 'Finalizing...');
    await this.stateManager.completeSync(processId, jobs.length);
    
    console.log(`✅ Manufacturing sync complete: ${jobs.length} jobs stored`);
    
    return {
      success: true,
      itemsProcessed: jobs.length
    };
  }

  private async syncMarket(context: SyncExecutionContext): Promise<SyncResult> {
    const { processId, corporationId, accessToken, storageService, fetchService } = context;
    
    await this.stateManager.updateSyncProgress(processId, 10, 'Fetching market orders from ESI...');
    
    const orders = await fetchService.fetchMarketOrders(corporationId, accessToken);
    
    if (!orders || orders.length === 0) {
      console.warn(`⚠️ No market orders retrieved for corporation ${corporationId}`);
      await this.stateManager.completeSync(processId, 0);
      return { success: true, itemsProcessed: 0 };
    }
    
    await this.stateManager.updateSyncProgress(
      processId, 
      50, 
      'Storing market orders in database...',
      0,
      orders.length
    );
    
    await storageService.storeMarketOrders(corporationId, orders);
    
    await this.stateManager.updateSyncProgress(processId, 90, 'Finalizing...');
    await this.stateManager.completeSync(processId, orders.length);
    
    console.log(`✅ Market sync complete: ${orders.length} orders stored`);
    
    return {
      success: true,
      itemsProcessed: orders.length
    };
  }

  private async syncWallet(context: SyncExecutionContext): Promise<SyncResult> {
    const { processId, corporationId, accessToken, storageService, fetchService } = context;
    
    await this.stateManager.updateSyncProgress(processId, 10, 'Fetching wallet transactions from ESI...');
    
    const divisions = [1, 2, 3, 4, 5, 6, 7];
    let totalTransactions = 0;
    
    for (let i = 0; i < divisions.length; i++) {
      const division = divisions[i];
      const progress = 10 + ((i / divisions.length) * 40);
      
      await this.stateManager.updateSyncProgress(
        processId, 
        progress, 
        `Fetching wallet division ${division}...`
      );
      
      try {
        const transactions = await fetchService.fetchWalletTransactions(
          corporationId, 
          division, 
          accessToken
        );
        
        if (transactions && transactions.length > 0) {
          await storageService.storeWalletTransactions(corporationId, division, transactions);
          totalTransactions += transactions.length;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch wallet division ${division}:`, error);
      }
    }
    
    await this.stateManager.updateSyncProgress(processId, 90, 'Finalizing...');
    await this.stateManager.completeSync(processId, totalTransactions);
    
    console.log(`✅ Wallet sync complete: ${totalTransactions} transactions stored`);
    
    return {
      success: true,
      itemsProcessed: totalTransactions
    };
  }

  private async syncMining(context: SyncExecutionContext): Promise<SyncResult> {
    const { processId, corporationId, accessToken, storageService, fetchService } = context;
    
    await this.stateManager.updateSyncProgress(processId, 10, 'Fetching mining ledger from ESI...');
    
    const miningData = await fetchService.fetchMiningLedger(corporationId, accessToken);
    
    if (!miningData || miningData.length === 0) {
      console.warn(`⚠️ No mining data retrieved for corporation ${corporationId}`);
      await this.stateManager.completeSync(processId, 0);
      return { success: true, itemsProcessed: 0 };
    }
    
    await this.stateManager.updateSyncProgress(
      processId, 
      50, 
      'Storing mining data in database...',
      0,
      miningData.length
    );
    
    await storageService.storeMiningLedger(corporationId, miningData);
    
    await this.stateManager.updateSyncProgress(processId, 90, 'Finalizing...');
    await this.stateManager.completeSync(processId, miningData.length);
    
    console.log(`✅ Mining sync complete: ${miningData.length} entries stored`);
    
    return {
      success: true,
      itemsProcessed: miningData.length
    };
  }

  private async syncKillmails(context: SyncExecutionContext): Promise<SyncResult> {
    const { processId, corporationId } = context;
    
    await this.stateManager.updateSyncProgress(processId, 10, 'Fetching killmails from ESI...');
    
    console.warn('⚠️ Killmails sync not yet implemented - requires character-level authentication');
    
    await this.stateManager.updateSyncProgress(processId, 100, 'Skipped (not implemented)');
    await this.stateManager.completeSync(processId, 0);
    
    return {
      success: true,
      itemsProcessed: 0
    };
  }

  private async syncContainerLogs(context: SyncExecutionContext): Promise<SyncResult> {
    const { processId, corporationId, accessToken, storageService, fetchService } = context;
    
    await this.stateManager.updateSyncProgress(processId, 10, 'Fetching container logs from ESI...');
    
    const logs = await fetchService.fetchContainerLogs(corporationId, accessToken);
    
    if (!logs || logs.length === 0) {
      console.warn(`⚠️ No container logs retrieved for corporation ${corporationId}`);
      await this.stateManager.completeSync(processId, 0);
      return { success: true, itemsProcessed: 0 };
    }
    
    await this.stateManager.updateSyncProgress(
      processId, 
      50, 
      'Storing container logs in database...',
      0,
      logs.length
    );
    
    await storageService.storeContainerLogs(corporationId, logs);
    
    await this.stateManager.updateSyncProgress(processId, 90, 'Finalizing...');
    await this.stateManager.completeSync(processId, logs.length);
    
    console.log(`✅ Container logs sync complete: ${logs.length} logs stored`);
    
    return {
      success: true,
      itemsProcessed: logs.length
    };
  }
}
