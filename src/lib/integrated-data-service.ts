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

    if (this.dbManager && this.setupStatus.hasEverBeenGreen) {
      try {
        console.log('🗄️ Fetching manufacturing jobs from database (Phase 2: database-first)...');
        const result = await this.dbManager.query('SELECT * FROM industry_jobs WHERE corporation_id = ?', [options.corporationId]);
        
        if (result.success && result.data && result.data.length > 0) {
          this.setCache(cacheKey, result.data as ManufacturingJob[]);
          source.database = true;
          return {
            data: result.data as ManufacturingJob[],
            source,
            timestamp: new Date().toISOString()
          };
        }
        
        console.log('📭 No manufacturing jobs in database - empty result (data will be populated by sync process)');
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
      console.log('📝 Using mock manufacturing job data (system not yet configured)');
      const mockJobs: ManufacturingJob[] = [
        {
          id: '1',
          blueprintId: 645,
          blueprintName: 'Raven Blueprint',
          productTypeId: 638,
          productTypeName: 'Raven',
          runs: 1,
          startDate: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          facility: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
          facilityId: 60003760,
          installerId: 90000001,
          installerName: 'Sample Character Alpha',
          cost: 250000000,
          productQuantity: 1,
          materialEfficiency: 10,
          timeEfficiency: 20,
          duration: 24 * 60 * 60,
          materials: [],
          priority: 'normal'
        },
        {
          id: '2',
          blueprintId: 11535,
          blueprintName: 'Tritanium Blueprint',
          productTypeId: 34,
          productTypeName: 'Tritanium',
          runs: 100,
          startDate: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          facility: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
          facilityId: 60003760,
          installerId: 90000001,
          installerName: 'Sample Character Alpha',
          cost: 5000000,
          productQuantity: 100,
          materialEfficiency: 10,
          timeEfficiency: 20,
          duration: 12 * 60 * 60,
          materials: [],
          priority: 'high'
        }
      ];
      source.mock = true;
      return {
        data: mockJobs,
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

  async fetchWalletTransactions(options: FetchOptions & { divisionId?: number }): Promise<FetchResult<WalletTransaction>> {
    const cacheKey = this.getCacheKey(`wallet_trans_${options.divisionId || 'all'}`, options);
    const source: DataSource = { esi: false, database: false, cache: false, mock: false };

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

    if (this.dbManager && this.setupStatus.hasEverBeenGreen) {
      try {
        console.log('🗄️ Fetching wallet transactions from database (Phase 2: database-first)...');
        const query = options.divisionId
          ? 'SELECT * FROM wallet_transactions WHERE corporation_id = ? AND division_id = ? ORDER BY date DESC LIMIT 1000'
          : 'SELECT * FROM wallet_transactions WHERE corporation_id = ? ORDER BY date DESC LIMIT 1000';
        const params = options.divisionId 
          ? [options.corporationId, options.divisionId]
          : [options.corporationId];
        
        const result = await this.dbManager.query(query, params);
        
        if (result.success && result.data && result.data.length > 0) {
          this.setCache(cacheKey, result.data as WalletTransaction[]);
          source.database = true;
          return {
            data: result.data as WalletTransaction[],
            source,
            timestamp: new Date().toISOString()
          };
        }
        
        console.log('📭 No wallet transactions in database - empty result (data will be populated by sync process)');
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
      console.log('📝 Using mock wallet transaction data (system not yet configured)');
      const mockTransactions: WalletTransaction[] = [
        {
          id: '1',
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          divisionId: options.divisionId || 1,
          amount: 1500000000,
          balance: 5000000000,
          description: 'Sell 100x Raven',
          refType: 'market_transaction',
          secondPartyId: 90000002,
          secondPartyName: 'Buyer Corporation'
        },
        {
          id: '2',
          date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          divisionId: options.divisionId || 1,
          amount: -500000000,
          balance: 4500000000,
          description: 'Buy 1000x Tritanium',
          refType: 'market_transaction',
          secondPartyId: 90000003,
          secondPartyName: 'Seller Corporation'
        },
        {
          id: '3',
          date: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          divisionId: options.divisionId || 1,
          amount: 250000000,
          balance: 4750000000,
          description: 'Bounty prizes',
          refType: 'bounty_prizes',
          secondPartyId: 1000125,
          secondPartyName: 'CONCORD'
        }
      ];
      source.mock = true;
      return {
        data: mockTransactions,
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

  async fetchWalletBalance(options: FetchOptions): Promise<FetchResult<WalletDivision>> {
    const cacheKey = this.getCacheKey('wallet_balance', options);
    const source: DataSource = { esi: false, database: false, cache: false, mock: false };

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

    if (this.dbManager && this.setupStatus.hasEverBeenGreen) {
      try {
        console.log('🗄️ Fetching wallet balances from database (Phase 2: database-first)...');
        const result = await this.dbManager.query(
          'SELECT * FROM wallet_divisions WHERE corporation_id = ?',
          [options.corporationId]
        );
        
        if (result.success && result.data && result.data.length > 0) {
          this.setCache(cacheKey, result.data as WalletDivision[]);
          source.database = true;
          return {
            data: result.data as WalletDivision[],
            source,
            timestamp: new Date().toISOString()
          };
        }
        
        console.log('📭 No wallet divisions in database - empty result (data will be populated by sync process)');
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
      console.log('📝 Using mock wallet division data (system not yet configured)');
      const mockDivisions: WalletDivision[] = [
        {
          divisionId: 1,
          divisionName: 'Master Wallet',
          balance: 5000000000
        },
        {
          divisionId: 2,
          divisionName: 'Manufacturing',
          balance: 1500000000
        },
        {
          divisionId: 3,
          divisionName: 'Market Trading',
          balance: 2000000000
        }
      ];
      source.mock = true;
      return {
        data: mockDivisions,
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
