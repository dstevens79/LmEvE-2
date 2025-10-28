import { DatabaseManager } from './database';
import {
  Member,
  Asset,
  ManufacturingJob,
  MiningOperation,
  MarketPrice,
  KillmailSummary,
  DashboardStats
} from './types';

export interface DataFreshnessInfo {
  lastUpdated: string | null;
  isStale: boolean;
  staleDuration?: number;
  freshnessCutoff: number;
}

export class DataRetrievalService {
  private dbManager: DatabaseManager;
  private staleCutoffMinutes: Record<string, number> = {
    members: 120,
    assets: 60,
    manufacturing: 30,
    market: 60,
    wallet: 30,
    mining: 240,
    killmails: 120
  };

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  async getMembers(corporationId: number): Promise<{ data: Member[]; freshness: DataFreshnessInfo }> {
    try {
      const query = `
        SELECT 
          character_id as characterId,
          character_name as name,
          corporation_id as corporationId,
          DATE_FORMAT(start_date, '%Y-%m-%dT%H:%i:%sZ') as joinDate,
          location_id as locationId,
          logoff_date as lastLogin,
          ship_type_id as shipTypeId,
          title,
          last_updated as lastUpdated
        FROM corporation_members 
        WHERE corporation_id = ${corporationId}
        ORDER BY character_name ASC
      `;

      const result = await this.dbManager.query<any>(query);
      
      if (!result.success || !result.data || result.data.length === 0) {
        return {
          data: [],
          freshness: this.calculateFreshness(null, 'members')
        };
      }

      const lastUpdated = result.data[0]?.lastUpdated || null;
      const members: Member[] = result.data.map(row => ({
        id: row.characterId,
        characterId: row.characterId,
        name: row.name,
        corporationId: row.corporationId,
        joinDate: row.joinDate,
        lastLogin: row.lastLogin,
        title: row.title || 'Member',
        roles: [],
        isActive: true,
        securityStatus: 0,
        location: '',
        ship: ''
      }));

      return {
        data: members,
        freshness: this.calculateFreshness(lastUpdated, 'members')
      };
    } catch (error) {
      console.error('Error fetching members:', error);
      return {
        data: [],
        freshness: this.calculateFreshness(null, 'members')
      };
    }
  }

  async getAssets(corporationId: number): Promise<{ data: Asset[]; freshness: DataFreshnessInfo }> {
    try {
      const query = `
        SELECT 
          item_id as id,
          type_id as typeId,
          quantity,
          location_id as locationId,
          location_flag as locationFlag,
          location_type as locationType,
          is_singleton as isSingleton,
          last_updated as lastUpdated
        FROM corporation_assets 
        WHERE corporation_id = ${corporationId}
        ORDER BY quantity DESC
        LIMIT 1000
      `;

      const result = await this.dbManager.query<any>(query);
      
      if (!result.success || !result.data || result.data.length === 0) {
        return {
          data: [],
          freshness: this.calculateFreshness(null, 'assets')
        };
      }

      const lastUpdated = result.data[0]?.lastUpdated || null;
      const assets: Asset[] = result.data.map(row => ({
        id: row.id,
        typeId: row.typeId,
        name: `Item ${row.typeId}`,
        quantity: row.quantity,
        location: `Location ${row.locationId}`,
        locationId: row.locationId,
        estimatedValue: 0,
        isSingleton: row.isSingleton === 1,
        locationFlag: row.locationFlag,
        locationType: row.locationType
      }));

      return {
        data: assets,
        freshness: this.calculateFreshness(lastUpdated, 'assets')
      };
    } catch (error) {
      console.error('Error fetching assets:', error);
      return {
        data: [],
        freshness: this.calculateFreshness(null, 'assets')
      };
    }
  }

  async getManufacturingJobs(corporationId: number): Promise<{ data: ManufacturingJob[]; freshness: DataFreshnessInfo }> {
    try {
      const query = `
        SELECT 
          job_id as id,
          activity_id as activityId,
          blueprint_id as blueprintId,
          blueprint_type_id as blueprintTypeId,
          product_type_id as productTypeId,
          runs,
          status,
          DATE_FORMAT(start_date, '%Y-%m-%dT%H:%i:%sZ') as startDate,
          DATE_FORMAT(end_date, '%Y-%m-%dT%H:%i:%sZ') as endDate,
          installer_id as installerId,
          facility_id as facilityId,
          cost,
          licensed_runs as licensedRuns,
          probability,
          successful_runs as successfulRuns,
          last_updated as lastUpdated
        FROM industry_jobs 
        WHERE corporation_id = ${corporationId}
        ORDER BY end_date DESC
        LIMIT 500
      `;

      const result = await this.dbManager.query<any>(query);
      
      if (!result.success || !result.data || result.data.length === 0) {
        return {
          data: [],
          freshness: this.calculateFreshness(null, 'manufacturing')
        };
      }

      const lastUpdated = result.data[0]?.lastUpdated || null;
      const jobs: ManufacturingJob[] = result.data.map(row => ({
        id: row.id,
        blueprintId: row.blueprintId,
        blueprintName: `Blueprint ${row.blueprintTypeId}`,
        product: `Product ${row.productTypeId}`,
        productTypeId: row.productTypeId,
        runs: row.runs,
        startDate: row.startDate,
        endDate: row.endDate,
        status: this.mapJobStatus(row.status),
        facility: `Facility ${row.facilityId}`,
        installer: `Character ${row.installerId}`,
        cost: row.cost || 0,
        probability: row.probability,
        activityId: row.activityId
      }));

      return {
        data: jobs,
        freshness: this.calculateFreshness(lastUpdated, 'manufacturing')
      };
    } catch (error) {
      console.error('Error fetching manufacturing jobs:', error);
      return {
        data: [],
        freshness: this.calculateFreshness(null, 'manufacturing')
      };
    }
  }

  async getMarketOrders(corporationId: number): Promise<{ data: any[]; freshness: DataFreshnessInfo }> {
    try {
      const query = `
        SELECT 
          order_id as orderId,
          type_id as typeId,
          location_id as locationId,
          is_buy_order as isBuyOrder,
          price,
          volume_total as volumeTotal,
          volume_remain as volumeRemain,
          DATE_FORMAT(issued, '%Y-%m-%dT%H:%i:%sZ') as issued,
          duration,
          range_type as rangeType,
          min_volume as minVolume,
          last_updated as lastUpdated
        FROM market_orders 
        WHERE corporation_id = ${corporationId}
        ORDER BY issued DESC
        LIMIT 500
      `;

      const result = await this.dbManager.query<any>(query);
      
      if (!result.success || !result.data || result.data.length === 0) {
        return {
          data: [],
          freshness: this.calculateFreshness(null, 'market')
        };
      }

      const lastUpdated = result.data[0]?.lastUpdated || null;

      return {
        data: result.data,
        freshness: this.calculateFreshness(lastUpdated, 'market')
      };
    } catch (error) {
      console.error('Error fetching market orders:', error);
      return {
        data: [],
        freshness: this.calculateFreshness(null, 'market')
      };
    }
  }

  async getWalletTransactions(corporationId: number, division: number = 1): Promise<{ data: any[]; freshness: DataFreshnessInfo }> {
    try {
      const query = `
        SELECT 
          transaction_id as transactionId,
          client_id as clientId,
          DATE_FORMAT(date, '%Y-%m-%dT%H:%i:%sZ') as date,
          is_buy as isBuy,
          is_personal as isPersonal,
          journal_ref_id as journalRefId,
          location_id as locationId,
          quantity,
          type_id as typeId,
          unit_price as unitPrice,
          last_updated as lastUpdated
        FROM wallet_transactions 
        WHERE corporation_id = ${corporationId} AND division = ${division}
        ORDER BY date DESC
        LIMIT 500
      `;

      const result = await this.dbManager.query<any>(query);
      
      if (!result.success || !result.data || result.data.length === 0) {
        return {
          data: [],
          freshness: this.calculateFreshness(null, 'wallet')
        };
      }

      const lastUpdated = result.data[0]?.lastUpdated || null;

      return {
        data: result.data,
        freshness: this.calculateFreshness(lastUpdated, 'wallet')
      };
    } catch (error) {
      console.error('Error fetching wallet transactions:', error);
      return {
        data: [],
        freshness: this.calculateFreshness(null, 'wallet')
      };
    }
  }

  async getMiningLedger(corporationId: number): Promise<{ data: MiningOperation[]; freshness: DataFreshnessInfo }> {
    try {
      const query = `
        SELECT 
          character_id as characterId,
          DATE_FORMAT(date, '%Y-%m-%d') as date,
          type_id as typeId,
          quantity,
          recorded_corporation_id as corporationId,
          last_updated as lastUpdated
        FROM mining_ledger 
        WHERE recorded_corporation_id = ${corporationId}
        ORDER BY date DESC
        LIMIT 1000
      `;

      const result = await this.dbManager.query<any>(query);
      
      if (!result.success || !result.data || result.data.length === 0) {
        return {
          data: [],
          freshness: this.calculateFreshness(null, 'mining')
        };
      }

      const lastUpdated = result.data[0]?.lastUpdated || null;
      const operations: MiningOperation[] = result.data.map(row => ({
        id: `${row.characterId}-${row.date}-${row.typeId}`,
        miner: `Character ${row.characterId}`,
        ore: `Ore ${row.typeId}`,
        quantity: row.quantity,
        date: row.date,
        location: 'Unknown',
        value: 0
      }));

      return {
        data: operations,
        freshness: this.calculateFreshness(lastUpdated, 'mining')
      };
    } catch (error) {
      console.error('Error fetching mining ledger:', error);
      return {
        data: [],
        freshness: this.calculateFreshness(null, 'mining')
      };
    }
  }

  async getDashboardStats(corporationId: number): Promise<DashboardStats> {
    const [members, assets, jobs] = await Promise.all([
      this.getMembers(corporationId),
      this.getAssets(corporationId),
      this.getManufacturingJobs(corporationId)
    ]);

    const activeJobs = jobs.data.filter(j => j.status === 'active').length;
    const totalAssetValue = assets.data.reduce((sum, a) => sum + (a.estimatedValue || 0), 0);

    return {
      totalMembers: members.data.length,
      activeMembers: members.data.filter(m => m.isActive).length,
      totalAssets: assets.data.length,
      totalAssetValue,
      activeManufacturingJobs: activeJobs,
      completedJobs: jobs.data.filter(j => j.status === 'delivered').length,
      pendingOrders: 0,
      totalRevenue: 0,
      monthlyProfit: 0,
      efficiency: activeJobs > 0 ? 85 : 0
    };
  }

  private calculateFreshness(lastUpdated: string | null, dataType: string): DataFreshnessInfo {
    const cutoffMinutes = this.staleCutoffMinutes[dataType] || 60;
    
    if (!lastUpdated) {
      return {
        lastUpdated: null,
        isStale: true,
        freshnessCutoff: cutoffMinutes
      };
    }

    const lastUpdateTime = new Date(lastUpdated).getTime();
    const now = Date.now();
    const ageMinutes = (now - lastUpdateTime) / (1000 * 60);
    
    return {
      lastUpdated,
      isStale: ageMinutes > cutoffMinutes,
      staleDuration: Math.floor(ageMinutes),
      freshnessCutoff: cutoffMinutes
    };
  }

  private mapJobStatus(status: string): 'active' | 'paused' | 'ready' | 'delivered' | 'cancelled' | 'reverted' {
    const statusMap: Record<string, 'active' | 'paused' | 'ready' | 'delivered' | 'cancelled' | 'reverted'> = {
      'active': 'active',
      'paused': 'paused',
      'ready': 'ready',
      'delivered': 'delivered',
      'cancelled': 'cancelled',
      'reverted': 'reverted'
    };
    return statusMap[status] || 'active';
  }

  async getDataFreshness(corporationId: number): Promise<Record<string, DataFreshnessInfo>> {
    const dataTypes = ['members', 'assets', 'manufacturing', 'market', 'wallet', 'mining'];
    const freshness: Record<string, DataFreshnessInfo> = {};

    for (const dataType of dataTypes) {
      const tableName = this.getTableName(dataType);
      try {
        const query = `
          SELECT MAX(last_updated) as lastUpdated
          FROM ${tableName}
          WHERE corporation_id = ${corporationId}
        `;
        
        const result = await this.dbManager.query<any>(query);
        const lastUpdated = result.success && result.data?.[0]?.lastUpdated || null;
        
        freshness[dataType] = this.calculateFreshness(lastUpdated, dataType);
      } catch (error) {
        console.error(`Error fetching freshness for ${dataType}:`, error);
        freshness[dataType] = this.calculateFreshness(null, dataType);
      }
    }

    return freshness;
  }

  private getTableName(dataType: string): string {
    const tableMap: Record<string, string> = {
      members: 'corporation_members',
      assets: 'corporation_assets',
      manufacturing: 'industry_jobs',
      market: 'market_orders',
      wallet: 'wallet_transactions',
      mining: 'mining_ledger'
    };
    return tableMap[dataType] || dataType;
  }
}
