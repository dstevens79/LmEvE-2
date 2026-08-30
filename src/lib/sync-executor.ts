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
  | 'item_pricing'
  | 'planetary'
  | 'personal_esi';

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
      
      // Only browser-only processes reach the in-browser executor now. Every corp
      // segment is served by sync-core.php (vaulted corp token); DataSyncSettings
      // routes them to runCorpSyncSegment and never dispatches here. The rest of
      // this switch was removed when those processes moved server-side.
      switch (processType) {
        case 'planetary':
          return await this.syncPlanetary(context);
        case 'personal_esi':
          return await this.syncPersonalESI(context);
        default:
          throw new Error(`Unknown sync process type: ${processType}`);
      }
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

// Corp-segment executor methods (members/assets/industry/market/wallet/
// mining/container logs/contracts/item pricing) were removed: all of those
// processes run server-side via sync-core.php; only planetary + personal_esi
// remain browser-only.

  private async syncPlanetary(context: SyncExecutionContext): Promise<SyncResult> {
    const { processId, corporationId, accessToken, storageService, fetchService } = context;
    
    await this.stateManager.updateSyncProgress(processId, 10, 'Fetching planetary colonies from ESI...');
    
    const members = await fetchService.fetchCorporationMembers(corporationId, accessToken);
    
    if (!members || members.length === 0) {
      console.warn(`⚠️ No members to fetch planetary data for`);
      await this.stateManager.completeSync(processId, 0);
      return { success: true, itemsProcessed: 0 };
    }
    
    let totalColonies = 0;
    const membersWithPlanets: number[] = [];
    
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const progress = 10 + ((i / members.length) * 70);
      
      try {
        const planets = await fetchService.fetchCharacterPlanets(member.character_id, accessToken);
        
        if (planets && planets.length > 0) {
          await storageService.storePlanetaryColonies(member.character_id, planets);
          totalColonies += planets.length;
          membersWithPlanets.push(member.character_id);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch planets for character ${member.character_id}:`, error);
      }
      
      if (i % 10 === 0) {
        await this.stateManager.updateSyncProgress(
          processId, 
          progress, 
          `Checking planetary colonies (${i}/${members.length})...`,
          i,
          members.length
        );
      }
    }
    
    await this.stateManager.updateSyncProgress(processId, 90, 'Finalizing...');
    await this.stateManager.completeSync(processId, totalColonies);
    
    console.log(`✅ Planetary sync complete: ${totalColonies} colonies from ${membersWithPlanets.length} members`);
    
    return {
      success: true,
      itemsProcessed: totalColonies
    };
  }

  private async syncPersonalESI(context: SyncExecutionContext): Promise<SyncResult> {
    const { processId, corporationId, accessToken, storageService, fetchService } = context;
    
    await this.stateManager.updateSyncProgress(processId, 10, 'Fetching personal ESI data for authenticated pilots...');
    
    const authenticatedPilots = await storageService.getAuthenticatedPilots(corporationId);
    
    if (!authenticatedPilots || authenticatedPilots.length === 0) {
      console.warn(`⚠️ No pilots with ESI access configured`);
      await this.stateManager.completeSync(processId, 0);
      return { success: true, itemsProcessed: 0 };
    }
    
    let syncedPilots = 0;
    
    for (let i = 0; i < authenticatedPilots.length; i++) {
      const pilot = authenticatedPilots[i];
      const progress = 10 + ((i / authenticatedPilots.length) * 70);
      
      try {
        await this.stateManager.updateSyncProgress(
          processId,
          progress,
          `Syncing data for ${pilot.characterName}...`,
          i,
          authenticatedPilots.length
        );
        
        const personalData = await fetchService.fetchCharacterData(pilot.characterId, pilot.accessToken);
        
        if (personalData) {
          await storageService.storePersonalData(pilot.characterId, personalData);
          syncedPilots++;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to sync personal data for ${pilot.characterName}:`, error);
      }
    }
    
    await this.stateManager.updateSyncProgress(processId, 90, 'Finalizing...');
    await this.stateManager.completeSync(processId, syncedPilots);
    
    console.log(`✅ Personal ESI sync complete: ${syncedPilots} pilots synced`);
    
    return {
      success: true,
      itemsProcessed: syncedPilots
    };
  }
}
