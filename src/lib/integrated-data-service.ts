import { DatabaseManager } from './database';
import { 
  Member, 
  Asset, 
  ManufacturingJob, 
  MiningOperation, 
  MarketPrice, 
  WalletTransaction,
  WalletDivision,
  PlanetaryColony
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
  hasEverBeenGreen: boolean;
}

class IntegratedDataService {
  private dbManager: DatabaseManager | null = null;
  private cache: Map<string, { data: any; expires: number }> = new Map();
  private setupStatus: SetupStatus = { hasEverBeenGreen: false };
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor() {
    this.loadSetupStatus();
  }

  setDatabaseManager(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  private loadSetupStatus() {
    try {
      const saved = localStorage.getItem('lmeve-setup-status');
      if (saved) {
        this.setupStatus = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load setup status:', error);
    }
  }

  private saveSetupStatus() {
    try {
      localStorage.setItem('lmeve-setup-status', JSON.stringify(this.setupStatus));
    } catch (error) {
      console.error('Failed to save setup status:', error);
    }
  }

  isFullyConfigured(): boolean {
    return this.setupStatus.hasEverBeenGreen;
  }

  updateSetupStatus(hasEverBeenGreen: boolean) {
    if (hasEverBeenGreen && !this.setupStatus.hasEverBeenGreen) {
      this.setupStatus.hasEverBeenGreen = true;
      this.saveSetupStatus();
      this.clearCache();
      console.log('✅ System is now fully configured - mock data disabled permanently');
    }
  }

  private shouldUseMockData(): boolean {
    return !this.setupStatus.hasEverBeenGreen;
  }

  private getCacheKey(type: string, options: FetchOptions): string {
    return `${type}_${options.corporationId}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }
    return null;
  }

  private setCache<T>(key: string, data: T) {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.CACHE_TTL,
    });
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
        const result = await this.dbManager.query('SELECT * FROM corporation_members WHERE corporation_id = ?', [options.corporationId]);
        
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
          id: 90000001,
          characterId: 90000001,
          characterName: 'Sample Character Alpha',
          corporationId: options.corporationId,
          corporationName: 'Sample Corporation',
          roles: ['Director', 'Accountant'],
          lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          isActive: true,
          joinDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Jita IV - Moon 4',
          ship: 'Raven',
          totalSkillPoints: 50000000,
          accessLevel: 'director'
        },
        {
          id: 90000002,
          characterId: 90000002,
          characterName: 'Sample Character Beta',
          corporationId: options.corporationId,
          corporationName: 'Sample Corporation',
          roles: ['Member'],
          lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          isActive: true,
          joinDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Amarr VIII (Oris)',
          ship: 'Retriever',
          totalSkillPoints: 25000000,
          accessLevel: 'member'
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
        },
        {
          id: '2',
          typeId: 35,
          typeName: 'Pyerite',
          quantity: 500000,
          location: 'Jita IV - Moon 4',
          locationId: 60003760,
          hangar: 'Hangar 1',
          owner: 'Sample Corporation',
          ownerId: options.corporationId,
          category: 'mineral',
          estimatedValue: 2500000,
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
          jobId: 1001,
          blueprintId: 645,
          blueprintName: 'Raven Blueprint',
          productTypeId: 638,
          productTypeName: 'Raven',
          productQuantity: 1,
          runs: 1,
          startDate: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          facility: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
          facilityId: 60003760,
          installerId: 90000001,
          installerName: 'Sample Character Alpha',
          cost: 250000000,
          materialEfficiency: 10,
          timeEfficiency: 20,
          duration: 24 * 60 * 60,
          materials: [],
          priority: 'normal',
          activityId: 1
        },
        {
          id: '2',
          jobId: 1002,
          blueprintId: 11535,
          blueprintName: 'Hammerhead II Blueprint',
          productTypeId: 12742,
          productTypeName: 'Hammerhead II',
          productQuantity: 100,
          runs: 100,
          startDate: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          facility: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
          facilityId: 60003760,
          installerId: 90000001,
          installerName: 'Sample Character Alpha',
          cost: 5000000,
          materialEfficiency: 10,
          timeEfficiency: 20,
          duration: 12 * 60 * 60,
          materials: [],
          priority: 'high',
          activityId: 1
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

  async fetchPlanetaryColonies(options: FetchOptions): Promise<FetchResult<PlanetaryColony>> {
    const cacheKey = this.getCacheKey('planetary', options);
    const source: DataSource = { esi: false, database: false, cache: false, mock: false };

    if (options.useCache !== false) {
      const cached = this.getFromCache<PlanetaryColony[]>(cacheKey);
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
        console.log('🗄️ Fetching planetary colonies from database (Phase 2: database-first)...');
        const result = await this.dbManager.query('SELECT * FROM planetary_colonies WHERE corporation_id = ?', [options.corporationId]);
        
        if (result.success && result.data && result.data.length > 0) {
          this.setCache(cacheKey, result.data as PlanetaryColony[]);
          source.database = true;
          return {
            data: result.data as PlanetaryColony[],
            source,
            timestamp: new Date().toISOString()
          };
        }
        
        console.log('📭 No planetary colonies in database - empty result (data will be populated by sync process)');
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
      console.log('📝 Using mock planetary colony data (system not yet configured)');
      const mockColonies: PlanetaryColony[] = [
        {
          id: 1,
          planetId: 40161465,
          planetName: 'Auga VII',
          planetType: 'barren',
          ownerId: 90000001,
          ownerName: 'Sample Character Alpha',
          upgradeLevel: 5,
          numberOfPins: 15,
          lastUpdate: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          expiryTime: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 2,
          planetId: 40161466,
          planetName: 'Auga VIII',
          planetType: 'temperate',
          ownerId: 90000002,
          ownerName: 'Sample Character Beta',
          upgradeLevel: 4,
          numberOfPins: 12,
          lastUpdate: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          expiryTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
        }
      ];
      source.mock = true;
      return {
        data: mockColonies,
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

  async fetchMarketPrices(options: FetchOptions): Promise<FetchResult<MarketPrice>> {
    const cacheKey = this.getCacheKey('market_prices', options);
    const source: DataSource = { esi: false, database: false, cache: false, mock: false };

    if (options.useCache !== false) {
      const cached = this.getFromCache<MarketPrice[]>(cacheKey);
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
        console.log('🗄️ Fetching market prices from database (Phase 2: database-first)...');
        const result = await this.dbManager.query('SELECT * FROM market_prices ORDER BY last_updated DESC LIMIT 1000', []);
        
        if (result.success && result.data && result.data.length > 0) {
          this.setCache(cacheKey, result.data as MarketPrice[]);
          source.database = true;
          return {
            data: result.data as MarketPrice[],
            source,
            timestamp: new Date().toISOString()
          };
        }
        
        console.log('📭 No market prices in database - empty result (data will be populated by sync process)');
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
      console.log('📝 Using mock market price data (system not yet configured)');
      const mockPrices: MarketPrice[] = [
        {
          typeId: 34,
          typeName: 'Tritanium',
          regionId: 10000002,
          region: 'The Forge',
          buyPrice: 5.45,
          sellPrice: 5.55,
          averagePrice: 5.50,
          volume: 1000000000,
          orderCount: 1500,
          lastUpdate: new Date().toISOString()
        },
        {
          typeId: 35,
          typeName: 'Pyerite',
          regionId: 10000002,
          region: 'The Forge',
          buyPrice: 4.95,
          sellPrice: 5.05,
          averagePrice: 5.00,
          volume: 500000000,
          orderCount: 1200,
          lastUpdate: new Date().toISOString()
        }
      ];
      source.mock = true;
      return {
        data: mockPrices,
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
          id: 1,
          transactionId: 7000001,
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          typeId: 638,
          typeName: 'Raven',
          quantity: 1,
          unitPrice: 145000000,
          amount: 145000000,
          clientId: 91000001,
          clientName: 'External Buyer',
          locationId: 60003760,
          locationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
          isBuy: false,
          isPersonal: false,
          journalRefId: 8000001,
          divisionId: 1
        },
        {
          id: 2,
          transactionId: 7000002,
          date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          typeId: 34,
          typeName: 'Tritanium',
          quantity: 1000000,
          unitPrice: 5.5,
          amount: 5500000,
          clientId: 90000004,
          clientName: 'Seller Character',
          locationId: 60003760,
          locationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
          isBuy: true,
          isPersonal: false,
          journalRefId: 8000002,
          divisionId: 1
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
      console.log('📝 Using mock wallet balance data (system not yet configured)');
      const mockDivisions: WalletDivision[] = [
        {
          id: 1,
          divisionId: 1,
          divisionName: 'Master Wallet',
          balance: 1000000000,
          corporationId: options.corporationId,
          lastUpdate: new Date().toISOString()
        },
        {
          id: 2,
          divisionId: 2,
          divisionName: 'Secondary Wallet',
          balance: 500000000,
          corporationId: options.corporationId,
          lastUpdate: new Date().toISOString()
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
