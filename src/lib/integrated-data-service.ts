import { DatabaseManager } from './database';
import type {
  Member,
  Asset,
  ManufacturingJob,
  MiningOperation,
  MarketPrice,
  WalletTransaction,
  WalletDivision,
  KillmailSummary,
  IncomeRecord,
  DashboardStats
} from './types';

export interface DataSource {
  esi: boolean;
  database: boolean;
  cache: boolean;
  mock: boolean;
}

export interface FetchOptions {
  corporationId: number;
  accessToken?: string;
  useCache?: boolean;
  forceESI?: boolean;
  forceDB?: boolean;
}

export interface FetchResult<T> {
  data: T[];
  source: DataSource;
  timestamp: string;
  error?: string;
}

interface SetupStatus {
  isFullyConfigured: boolean;
  databaseConnected: boolean;
  esiConfigured: boolean;
  hasEverBeenGreen: boolean;
  timestamp: string;
}

export class IntegratedDataService {
  private dbManager: DatabaseManager | null = null;
  private cache: Map<string, { data: any; expires: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000;
  private setupStatus: SetupStatus;

  constructor(dbManager?: DatabaseManager) {
    this.dbManager = dbManager || null;
    this.setupStatus = this.loadSetupStatus();
  }

  private loadSetupStatus(): SetupStatus {
    try {
      const stored = localStorage.getItem('lmeve-setup-status');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load setup status:', error);
    }

    return {
      isFullyConfigured: false,
      databaseConnected: false,
      esiConfigured: false,
      hasEverBeenGreen: false,
      timestamp: new Date().toISOString()
    };
  }

  private saveSetupStatus(): void {
    try {
      localStorage.setItem('lmeve-setup-status', JSON.stringify(this.setupStatus));
    } catch (error) {
      console.error('Failed to save setup status:', error);
    }
  }

  updateSetupStatus(status: Partial<SetupStatus>): void {
    this.setupStatus = {
      ...this.setupStatus,
      ...status,
      timestamp: new Date().toISOString()
    };

    if (this.setupStatus.isFullyConfigured && !this.setupStatus.hasEverBeenGreen) {
      this.setupStatus.hasEverBeenGreen = true;
      console.log('🎉 System fully configured! Database-first mode enabled, no more ESI fallbacks.');
      this.clearCache();
    }

    this.saveSetupStatus();
  }

  getSetupStatus(): SetupStatus {
    return { ...this.setupStatus };
  }

  private shouldUseMockData(): boolean {
    return !this.setupStatus.hasEverBeenGreen;
  }

  setDatabaseManager(dbManager: DatabaseManager | null) {
    this.dbManager = dbManager;
    this.updateSetupStatus({
      databaseConnected: !!dbManager
    });
  }

  private clearCache(): void {
    this.cache.clear();
    console.log('🧹 Cache cleared');
  }

  private getCacheKey(type: string, options: FetchOptions): string {
    return `${type}_${options.corporationId}_${options.accessToken?.substring(0, 10) || 'no-token'}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      console.log(`📦 Cache hit for ${key}`);
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.CACHE_DURATION
    });
    console.log(`💾 Cached data for ${key}`);
  }

  async fetchMembers(options: FetchOptions): Promise<FetchResult<Member>> {
    const cacheKey = this.getCacheKey('members', options);
    const source: DataSource = { esi: false, database: false, cache: false, mock: false };

    if (options.useCache !== false) {
      const cached = this.getFromCache<Member[]>(cacheKey);
      if (cached) {
        return {
          data: cached,
          source: { ...source, cache: true },
          timestamp: new Date().toISOString()
        };
      }
    }

    if (this.dbManager && this.setupStatus.hasEverBeenGreen) {
      try {
        console.log('🗄️ Fetching members from database (Phase 2: database-first)...');
        const result = await this.dbManager.query('SELECT * FROM characters WHERE corporation_id = ?', [options.corporationId]);
        
        if (result.success && result.data && result.data.length > 0) {
          this.setCache(cacheKey, result.data as Member[]);
          source.database = true;
          return {
            data: result.data as Member[],
            source,
            timestamp: new Date().toISOString()
          };
        }
        
        console.log('📭 No members in database - empty result (data will be populated by sync process)');
        return {
          data: [],
          source: { ...source, database: true },
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('❌ Database fetch failed:', error);
        return {
          data: [],
          source,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Database error'
        };
      }
    }

    if (this.shouldUseMockData()) {
      console.log('📝 Using mock member data (system not yet configured)');
      const mockMembers: Member[] = [
        {
          id: '1',
          characterId: 90000001,
          characterName: 'Sample Character Alpha',
          corporationId: options.corporationId,
          corporationName: 'Sample Corporation',
          role: 'director',
          joinDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: 'active' as const,
          location: 'Jita IV - Moon 4',
          shipType: 'Raven',
          skillPoints: 50000000,
          roles: ['Director', 'Accountant']
        }
      ];
      source.mock = true;
      return {
        data: mockMembers,
        source,
        timestamp: new Date().toISOString()
      };
    }

    return {
      data: [],
      source: { ...source, database: true },
      timestamp: new Date().toISOString(),
      error: 'System not configured and database unavailable'
    };
  }

  async fetchAssets(options: FetchOptions): Promise<FetchResult<Asset>> {
    const cacheKey = this.getCacheKey('assets', options);
    const source: DataSource = { esi: false, database: false, cache: false, mock: false };

    if (options.useCache !== false) {
      const cached = this.getFromCache<Asset[]>(cacheKey);
      if (cached) {
        return {
          data: cached,
          source: { ...source, cache: true },
          timestamp: new Date().toISOString()
        };
      }
    }

    if (this.dbManager && this.setupStatus.hasEverBeenGreen) {
      try {
        console.log('🗄️ Fetching assets from database (Phase 2: database-first)...');
        const result = await this.dbManager.query('SELECT * FROM assets WHERE owner_id = ?', [options.corporationId]);
        
        if (result.success && result.data && result.data.length > 0) {
          this.setCache(cacheKey, result.data as Asset[]);
          source.database = true;
          return {
            data: result.data as Asset[],
            source,
            timestamp: new Date().toISOString()
          };
        }
        
        console.log('📭 No assets in database - empty result (data will be populated by sync process)');
        return {
          data: [],
          source: { ...source, database: true },
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('❌ Database fetch failed:', error);
        return {
          data: [],
          source,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Database error'
        };
      }
    }

    if (this.shouldUseMockData()) {
      console.log('📝 Using mock asset data (system not yet configured)');
      const mockAssets: Asset[] = [
        {
          id: '1',
          typeId: 34,
          typeName: 'Tritanium',
          quantity: 1000000,
          location: 'Jita IV - Moon 4',
          locationId: 60003760,
          hangar: 'Hangar 1',
          owner: 'Sample Corporation',
          ownerId: options.corporationId,
          category: 'mineral',
          estimatedValue: 5500000,
          lastUpdate: new Date().toISOString()
        }
      ];
      source.mock = true;
      return {
        data: mockAssets,
        source,
        timestamp: new Date().toISOString()
      };
    }

    return {
      data: [],
      source: { ...source, database: true },
      timestamp: new Date().toISOString(),
      error: 'System not configured and database unavailable'
    };
  }

  async fetchManufacturingJobs(options: FetchOptions): Promise<FetchResult<ManufacturingJob>> {
    const cacheKey = this.getCacheKey('manufacturing', options);
    const source: DataSource = { esi: false, database: false, cache: false, mock: false };

    if (options.useCache !== false) {
      const cached = this.getFromCache<ManufacturingJob[]>(cacheKey);
      if (cached) {
        return {
          data: cached,
          source: { ...source, cache: true },
          timestamp: new Date().toISOString()
        };
      }
    }

    if (options.accessToken && !options.forceDB) {
      try {
        console.log('🌐 Fetching manufacturing jobs from ESI...');
        const esiJobs = await eveApi.getCorporationIndustryJobs(options.corporationId, options.accessToken);

        const uniqueTypeIds = [
          ...new Set([
            ...esiJobs.map(j => j.blueprint_type_id),
            ...esiJobs.filter(j => j.product_type_id).map(j => j.product_type_id!)
          ])
        ];
        const typeNames = await eveApi.getNames(uniqueTypeIds);
        const typeNameMap = new Map(typeNames.map(t => [t.id, t.name]));

        const uniqueInstallerIds = [...new Set(esiJobs.map(j => j.installer_id))];
        const installerNames = await eveApi.getNames(uniqueInstallerIds);
        const installerNameMap = new Map(installerNames.map(i => [i.id, i.name]));

        const jobs: ManufacturingJob[] = esiJobs.map(esiJob => ({
          id: `esi_${esiJob.job_id}`,
          blueprintId: esiJob.blueprint_type_id,
          blueprintName: typeNameMap.get(esiJob.blueprint_type_id) || `Blueprint ${esiJob.blueprint_type_id}`,
          productTypeId: esiJob.product_type_id || 0,
          productTypeName: esiJob.product_type_id ? (typeNameMap.get(esiJob.product_type_id) || 'Unknown') : 'Unknown',
          runs: esiJob.runs,
          startDate: esiJob.start_date,
          endDate: esiJob.end_date,
          status: esiJob.status,
          facility: `Station ${esiJob.station_id}`,
          facilityId: esiJob.station_id,
          installerId: esiJob.installer_id,
          installerName: installerNameMap.get(esiJob.installer_id) || 'Unknown',
          cost: esiJob.cost || 0,
          productQuantity: esiJob.runs,
          materialEfficiency: 0,
          timeEfficiency: 0,
          duration: esiJob.duration,
          materials: [],
          priority: 'normal' as const
        }));

        this.setCache(cacheKey, jobs);
        source.esi = true;

        return {
          data: jobs,
          source,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.warn('⚠️ ESI fetch failed, falling back to database:', error);
      }
    }

    if (this.dbManager && !options.forceESI) {
      try {
        console.log('🗄️ Fetching manufacturing jobs from database...');
        const result = await this.dbManager.query('SELECT * FROM industry_jobs WHERE corporation_id = ?', [options.corporationId]);
        
        if (result.success && result.data) {
          source.database = true;
          return {
            data: result.data as ManufacturingJob[],
            source,
            timestamp: new Date().toISOString()
          };
        }
      } catch (error) {
        console.warn('⚠️ Database fetch failed:', error);
      }
    }

    return {
      data: [],
      source,
      timestamp: new Date().toISOString(),
      error: 'No data source available'
    };
  }

  async fetchWalletTransactions(options: FetchOptions & { divisionId?: number }): Promise<FetchResult<WalletTransaction>> {
    const cacheKey = this.getCacheKey(`wallet_trans_${options.divisionId || 'all'}`, options);
    const source: DataSource = { esi: false, database: false, cache: false };

    if (options.useCache !== false) {
      const cached = this.getFromCache<WalletTransaction[]>(cacheKey);
      if (cached) {
        return {
          data: cached,
          source: { ...source, cache: true },
          timestamp: new Date().toISOString()
        };
      }
    }

    if (options.accessToken && !options.forceDB) {
      try {
        console.log('🌐 Fetching wallet transactions from ESI...');
        const division = options.divisionId || 1;
        const esiTransactions = await eveApi.getCorporationWalletTransactions(
          options.corporationId,
          division,
          options.accessToken
        );

        const transactions: WalletTransaction[] = esiTransactions.map((tx, index) => ({
          id: `esi_${tx.transaction_id}`,
          date: tx.date,
          divisionId: division,
          amount: tx.unit_price * tx.quantity * (tx.is_buy ? -1 : 1),
          balance: 0,
          description: `${tx.is_buy ? 'Buy' : 'Sell'} ${tx.quantity}x items`,
          refType: 'market_transaction',
          secondPartyId: tx.client_id,
          secondPartyName: 'Unknown'
        }));

        this.setCache(cacheKey, transactions);
        source.esi = true;

        return {
          data: transactions,
          source,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.warn('⚠️ ESI fetch failed, falling back to database:', error);
      }
    }

    if (this.dbManager && !options.forceESI) {
      try {
        console.log('🗄️ Fetching wallet transactions from database...');
        const query = options.divisionId
          ? 'SELECT * FROM wallet_transactions WHERE corporation_id = ? AND division_id = ? ORDER BY date DESC LIMIT 1000'
          : 'SELECT * FROM wallet_transactions WHERE corporation_id = ? ORDER BY date DESC LIMIT 1000';
        const params = options.divisionId 
          ? [options.corporationId, options.divisionId]
          : [options.corporationId];
        
        const result = await this.dbManager.query(query, params);
        
        if (result.success && result.data) {
          source.database = true;
          return {
            data: result.data as WalletTransaction[],
            source,
            timestamp: new Date().toISOString()
          };
        }
      } catch (error) {
        console.warn('⚠️ Database fetch failed:', error);
      }
    }

    return {
      data: [],
      source,
      timestamp: new Date().toISOString(),
      error: 'No data source available'
    };
  }

  async fetchWalletBalance(options: FetchOptions): Promise<FetchResult<WalletDivision>> {
    const cacheKey = this.getCacheKey('wallet_balance', options);
    const source: DataSource = { esi: false, database: false, cache: false };

    if (options.useCache !== false) {
      const cached = this.getFromCache<WalletDivision[]>(cacheKey);
      if (cached) {
        return {
          data: cached,
          source: { ...source, cache: true },
          timestamp: new Date().toISOString()
        };
      }
    }

    if (options.accessToken && !options.forceDB) {
      try {
        console.log('🌐 Fetching wallet balances from ESI...');
        const wallets = await eveApi.getCorporationWallets(options.corporationId, options.accessToken);

        const divisions: WalletDivision[] = wallets.map((wallet, index) => ({
          divisionId: index + 1,
          divisionName: `Wallet Division ${index + 1}`,
          balance: wallet.balance
        }));

        this.setCache(cacheKey, divisions);
        source.esi = true;

        return {
          data: divisions,
          source,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.warn('⚠️ ESI fetch failed, falling back to database:', error);
      }
    }

    if (this.dbManager && !options.forceESI) {
      try {
        console.log('🗄️ Fetching wallet balances from database...');
        const result = await this.dbManager.query(
          'SELECT * FROM wallet_divisions WHERE corporation_id = ?',
          [options.corporationId]
        );
        
        if (result.success && result.data) {
          source.database = true;
          return {
            data: result.data as WalletDivision[],
            source,
            timestamp: new Date().toISOString()
          };
        }
      } catch (error) {
        console.warn('⚠️ Database fetch failed:', error);
      }
    }

    return {
      data: [],
      source,
      timestamp: new Date().toISOString(),
      error: 'No data source available'
    };
  }

  clearCache(type?: string) {
    if (type) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(type));
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`🗑️ Cleared cache for ${type} (${keysToDelete.length} entries)`);
    } else {
      this.cache.clear();
      console.log('🗑️ Cleared all cache');
    }
  }
}

export const integratedDataService = new IntegratedDataService();
