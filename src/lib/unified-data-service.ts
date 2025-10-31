/**
 * Unified Data Service - Phase 1 Implementation
 * 
 * This service provides a single, authoritative source for all application data.
 * Data priority: Database → ESI API → Cache → Mock (only if never set up)
 * 
 * Mock data is ONLY used when:
 * - Database has never been fully configured (no green status ever achieved)
 * - Allows demo/testing without full setup
 * 
 * Once database is fully configured:
 * - Mock data is permanently disabled
 * - All data comes from database (populated by sync processes)
 * - ESI used only for real-time fallback when needed
 */

import { DatabaseManager, LMeveQueries } from './database';
import type {
  Member,
  Asset,
  ManufacturingJob,
  Blueprint,
  MiningOperation,
  Corporation,
  DashboardStats,
  MarketPrice,
  KillmailSummary,
  IncomeRecord,
  WalletTransaction,
  WalletDivision,
  MarketOrder,
  PlanetaryColony
} from './types';

/**
 * Setup status tracking - determines if mock data should be used
 */
interface SetupStatus {
  isFullyConfigured: boolean;
  databaseConnected: boolean;
  esiConfigured: boolean;
  hasEverBeenGreen: boolean; // Once true, mock data is permanently disabled
  timestamp: string;
}

/**
 * Data source indicator
 */
export type DataSource = 'database' | 'esi' | 'cache' | 'mock';

interface DataResult<T> {
  data: T;
  source: DataSource;
  timestamp: string;
  fromCache?: boolean;
}

/**
 * Mock data generator - ESI-compliant sample data
 * Only used when database has NEVER been fully configured
 */
class MockDataGenerator {
  /**
   * Generate mock members (2-3 sample users)
   */
  static generateMembers(): Member[] {
    return [
      {
        id: 1,
        name: 'Sample Character Alpha',
        corporationId: 98000001,
        characterId: 90000001,
        joinDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        title: 'CEO',
        roles: ['Director', 'Station_Manager', 'Accountant'],
        isActive: true,
        securityStatus: 5.0,
        location: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
        ship: 'Raven'
      },
      {
        id: 2,
        name: 'Sample Character Beta',
        corporationId: 98000001,
        characterId: 90000002,
        joinDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        lastLogin: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        title: 'Director',
        roles: ['Junior_Accountant', 'Hangar_Take_1'],
        isActive: true,
        securityStatus: 2.3,
        location: 'Amarr VIII (Oris) - Emperor Family Academy',
        ship: 'Hulk'
      },
      {
        id: 3,
        name: 'Sample Character Gamma',
        corporationId: 98000001,
        characterId: 90000003,
        joinDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        title: 'Member',
        roles: ['Hangar_Take_2'],
        isActive: true,
        securityStatus: -0.8,
        location: 'Dodixie IX - Moon 20 - Federation Navy Assembly Plant',
        ship: 'Retriever'
      }
    ];
  }

  /**
   * Generate mock assets (handful of items)
   */
  static generateAssets(): Asset[] {
    return [
      {
        id: '1',
        itemId: 587,
        typeId: 587,
        typeName: 'Rifter',
        quantity: 5,
        locationId: 60003760,
        locationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
        locationFlag: 'Hangar',
        isSingleton: false,
        estimatedValue: 250000 * 5,
        lastUpdate: new Date().toISOString()
      },
      {
        id: '2',
        itemId: 34,
        typeId: 34,
        typeName: 'Tritanium',
        quantity: 1000000,
        locationId: 60003760,
        locationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
        locationFlag: 'Hangar',
        isSingleton: false,
        estimatedValue: 5.5 * 1000000,
        lastUpdate: new Date().toISOString()
      },
      {
        id: '3',
        itemId: 638,
        typeId: 638,
        typeName: 'Raven',
        quantity: 2,
        locationId: 60003760,
        locationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
        locationFlag: 'Hangar',
        isSingleton: false,
        estimatedValue: 120000000 * 2,
        lastUpdate: new Date().toISOString()
      },
      {
        id: '4',
        itemId: 11399,
        typeId: 11399,
        typeName: 'Compressed Veldspar',
        quantity: 50000,
        locationId: 60003760,
        locationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
        locationFlag: 'Hangar',
        isSingleton: false,
        estimatedValue: 120 * 50000,
        lastUpdate: new Date().toISOString()
      }
    ];
  }

  /**
   * Generate mock manufacturing jobs (2-3 jobs)
   */
  static generateManufacturingJobs(): ManufacturingJob[] {
    return [
      {
        id: '1',
        jobId: 500001,
        activityId: 1,
        blueprintId: 1001,
        blueprintTypeId: 638,
        productTypeId: 638,
        productTypeName: 'Raven',
        runs: 1,
        startDate: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        installerId: 90000001,
        installerName: 'Sample Character Alpha',
        facilityId: 60003760,
        status: 'active',
        cost: 15000000,
        facility: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
        materialEfficiency: 10,
        timeEfficiency: 20,
        productQuantity: 1,
        blueprintName: 'Raven Blueprint',
        priority: 'high',
        duration: 72 * 60 * 60,
        materials: [
          { typeId: 34, typeName: 'Tritanium', quantity: 5000000, totalValue: 26000000 }
        ]
      },
      {
        id: '2',
        jobId: 500002,
        activityId: 1,
        blueprintId: 1002,
        blueprintTypeId: 587,
        productTypeId: 587,
        productTypeName: 'Rifter',
        runs: 10,
        startDate: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        installerId: 90000002,
        installerName: 'Sample Character Beta',
        facilityId: 60003760,
        status: 'active',
        cost: 2500000,
        facility: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
        materialEfficiency: 8,
        timeEfficiency: 16,
        productQuantity: 10,
        blueprintName: 'Rifter Blueprint',
        priority: 'normal',
        duration: 12 * 60 * 60,
        materials: [
          { typeId: 34, typeName: 'Tritanium', quantity: 250000, totalValue: 1375000 }
        ]
      },
      {
        id: '3',
        jobId: 500003,
        activityId: 1,
        blueprintId: 1003,
        blueprintTypeId: 11535,
        productTypeId: 11535,
        productTypeName: 'Compressed Scordite',
        runs: 100,
        startDate: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        installerId: 90000003,
        installerName: 'Sample Character Gamma',
        facilityId: 60003760,
        status: 'delivered',
        cost: 500000,
        facility: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
        materialEfficiency: 0,
        timeEfficiency: 0,
        productQuantity: 100,
        blueprintName: 'Compressed Scordite Blueprint',
        priority: 'normal',
        duration: 96 * 60 * 60,
        materials: [
          { typeId: 34, typeName: 'Tritanium', quantity: 1000000, totalValue: 5500000 }
        ]
      }
    ];
  }

  /**
   * Generate mock wallet transactions (random recent activity)
   */
  static generateWalletTransactions(): WalletTransaction[] {
    return [
      {
        id: 1,
        transactionId: 7000001,
        date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        typeId: 34,
        typeName: 'Tritanium',
        quantity: 500000,
        unitPrice: 5.5,
        amount: 2750000,
        clientId: 90000001,
        clientName: 'Sample Character Alpha',
        locationId: 60003760,
        isBuy: true,
        isPersonal: false,
        journalRefId: 8000001
      },
      {
        id: 2,
        transactionId: 7000002,
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        typeId: 638,
        typeName: 'Raven',
        quantity: 1,
        unitPrice: 145000000,
        amount: 145000000,
        clientId: 91000001,
        clientName: 'External Buyer',
        locationId: 60003760,
        isBuy: false,
        isPersonal: false,
        journalRefId: 8000002
      },
      {
        id: 3,
        transactionId: 7000003,
        date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        typeId: 587,
        typeName: 'Rifter',
        quantity: 5,
        unitPrice: 275000,
        amount: 1375000,
        clientId: 91000002,
        clientName: 'Market Trader',
        locationId: 60003760,
        isBuy: false,
        isPersonal: false,
        journalRefId: 8000003
      }
    ];
  }

  /**
   * Generate mock planetary colonies (2-3 planets)
   */
  static generatePlanetaryColonies(): PlanetaryColony[] {
    return [
      {
        id: 1,
        planetId: 40009077,
        planetName: 'Tanoo II',
        planetType: 'temperate',
        ownerId: 90000001,
        ownerName: 'Sample Character Alpha',
        lastUpdate: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        upgradeLevel: 5,
        numberOfPins: 12,
        expiryTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 2,
        planetId: 40009078,
        planetName: 'Tanoo III',
        planetType: 'barren',
        ownerId: 90000002,
        ownerName: 'Sample Character Beta',
        lastUpdate: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        upgradeLevel: 4,
        numberOfPins: 10,
        expiryTime: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString()
      }
    ];
  }

  /**
   * Generate mock market prices (handful of common items)
   */
  static generateMarketPrices(): MarketPrice[] {
    return [
      {
        typeId: 34,
        typeName: 'Tritanium',
        regionId: 10000002,
        region: 'The Forge',
        buyPrice: 5.45,
        sellPrice: 5.52,
        averagePrice: 5.48,
        volume: 15000000000,
        lastUpdate: new Date().toISOString()
      },
      {
        typeId: 587,
        typeName: 'Rifter',
        regionId: 10000002,
        region: 'The Forge',
        buyPrice: 248000,
        sellPrice: 275000,
        averagePrice: 261000,
        volume: 12500,
        lastUpdate: new Date().toISOString()
      },
      {
        typeId: 638,
        typeName: 'Raven',
        regionId: 10000002,
        region: 'The Forge',
        buyPrice: 138000000,
        sellPrice: 145000000,
        averagePrice: 141500000,
        volume: 850,
        lastUpdate: new Date().toISOString()
      }
    ];
  }

  /**
   * Generate mock wallet divisions (7 corporate wallet divisions)
   */
  static generateWalletDivisions(): WalletDivision[] {
    return [
      {
        id: 1,
        divisionId: 1,
        divisionName: 'Master Wallet',
        balance: 15750000000,
        corporationId: 98000001,
        lastUpdate: new Date().toISOString()
      },
      {
        id: 2,
        divisionId: 2,
        divisionName: 'Manufacturing',
        balance: 8250000000,
        corporationId: 98000001,
        lastUpdate: new Date().toISOString()
      },
      {
        id: 3,
        divisionId: 3,
        divisionName: 'Mining Operations',
        balance: 3500000000,
        corporationId: 98000001,
        lastUpdate: new Date().toISOString()
      },
      {
        id: 4,
        divisionId: 4,
        divisionName: 'Market Trading',
        balance: 12100000000,
        corporationId: 98000001,
        lastUpdate: new Date().toISOString()
      },
      {
        id: 5,
        divisionId: 5,
        divisionName: 'Research & Development',
        balance: 2750000000,
        corporationId: 98000001,
        lastUpdate: new Date().toISOString()
      },
      {
        id: 6,
        divisionId: 6,
        divisionName: 'Planetary Interaction',
        balance: 1850000000,
        corporationId: 98000001,
        lastUpdate: new Date().toISOString()
      },
      {
        id: 7,
        divisionId: 7,
        divisionName: 'Reserves',
        balance: 25000000000,
        corporationId: 98000001,
        lastUpdate: new Date().toISOString()
      }
    ];
  }

  /**
   * Generate mock market orders (handful of active orders)
   */
  static generateMarketOrders(): MarketOrder[] {
    return [
      {
        id: 1,
        orderId: 6000001,
        typeId: 34,
        typeName: 'Tritanium',
        locationId: 60003760,
        locationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
        isBuyOrder: false,
        price: 5.50,
        volumeTotal: 10000000,
        volumeRemain: 7500000,
        issued: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 90,
        minVolume: 1,
        range: 'station',
        state: 'active',
        corporationId: 98000001,
        walletDivision: 4
      },
      {
        id: 2,
        orderId: 6000002,
        typeId: 638,
        typeName: 'Raven',
        locationId: 60003760,
        locationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
        isBuyOrder: false,
        price: 145000000,
        volumeTotal: 3,
        volumeRemain: 2,
        issued: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 90,
        minVolume: 1,
        range: 'region',
        state: 'active',
        corporationId: 98000001,
        walletDivision: 4
      },
      {
        id: 3,
        orderId: 6000003,
        typeId: 587,
        typeName: 'Rifter',
        locationId: 60003760,
        locationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
        isBuyOrder: true,
        price: 240000,
        volumeTotal: 50,
        volumeRemain: 35,
        issued: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 30,
        minVolume: 1,
        range: 'station',
        state: 'active',
        corporationId: 98000001,
        walletDivision: 4
      }
    ];
  }

  /**
   * Generate mock dashboard stats
   */
  static generateDashboardStats(): DashboardStats {
    return {
      totalMembers: 3,
      activeMembers: 3,
      totalAssets: 4,
      totalAssetValue: 247750000,
      activeJobs: 2,
      completedJobs: 1,
      totalIncome: 146375000,
      totalExpenses: 18000000,
      netProfit: 128375000,
      activePlanets: 2,
      marketOrders: 0,
      recentKills: 0,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Unified Data Service - Single source of truth
 */
export class UnifiedDataService {
  private dbManager: DatabaseManager | null = null;
  private setupStatus: SetupStatus;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  
  // Default cache TTL in milliseconds
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(dbManager?: DatabaseManager) {
    this.dbManager = dbManager || null;
    
    // Initialize setup status from storage
    this.setupStatus = this.loadSetupStatus();
  }

  /**
   * Load setup status from persistent storage
   */
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

  /**
   * Save setup status to persistent storage
   */
  private saveSetupStatus(): void {
    try {
      localStorage.setItem('lmeve-setup-status', JSON.stringify(this.setupStatus));
    } catch (error) {
      console.error('Failed to save setup status:', error);
    }
  }

  /**
   * Update setup status - permanently disables mock data once fully configured
   */
  updateSetupStatus(status: Partial<SetupStatus>): void {
    const wasGreen = this.setupStatus.isFullyConfigured;
    
    this.setupStatus = {
      ...this.setupStatus,
      ...status,
      timestamp: new Date().toISOString()
    };

    // Once fully configured, permanently mark as "ever been green"
    if (this.setupStatus.isFullyConfigured && !this.setupStatus.hasEverBeenGreen) {
      this.setupStatus.hasEverBeenGreen = true;
      console.log('🎉 LMeve fully configured! Mock data permanently disabled.');
      
      // Clear all mock data from cache
      this.clearAllMockData();
    }

    this.saveSetupStatus();
  }

  /**
   * Check if we should use mock data
   */
  private shouldUseMockData(): boolean {
    // Mock data ONLY if never been fully configured
    return !this.setupStatus.hasEverBeenGreen;
  }

  /**
   * Clear all mock data from cache and memory
   */
  private clearAllMockData(): void {
    console.log('🧹 Clearing all mock data...');
    this.cache.clear();
    console.log('✅ Mock data cleared');
  }

  /**
   * Set database manager
   */
  setDatabaseManager(dbManager: DatabaseManager): void {
    this.dbManager = dbManager;
  }

  /**
   * Get from cache or execute function
   */
  private async getCached<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.DEFAULT_CACHE_TTL
  ): Promise<{ data: T; fromCache: boolean }> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < cached.ttl) {
      return { data: cached.data as T, fromCache: true };
    }

    const data = await fetchFn();
    this.cache.set(key, { data, timestamp: now, ttl });
    return { data, fromCache: false };
  }

  /**
   * Get members - Database → Mock (if never configured)
   */
  async getMembers(corporationId?: number): Promise<DataResult<Member[]>> {
    const startTime = Date.now();
    
    try {
      // Try database first if available
      if (this.dbManager && this.setupStatus.databaseConnected) {
        const result = await this.dbManager.query<Member>(
          LMeveQueries.getCharacters(corporationId)
        );

        if (result.success && result.data && result.data.length > 0) {
          console.log(`✅ Members from database: ${result.data.length} members`);
          return {
            data: result.data,
            source: 'database',
            timestamp: new Date().toISOString()
          };
        }
      }

      // Use mock data ONLY if never been configured
      if (this.shouldUseMockData()) {
        console.log('📝 Using mock member data (database not yet configured)');
        return {
          data: MockDataGenerator.generateMembers(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      // Database configured but empty - return empty array
      console.log('📭 No members in database');
      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get members:', error);
      
      // Only fall back to mock if never configured
      if (this.shouldUseMockData()) {
        return {
          data: MockDataGenerator.generateMembers(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get assets - Database → Mock (if never configured)
   */
  async getAssets(corporationId?: number): Promise<DataResult<Asset[]>> {
    try {
      // Try real PHP API first if database is configured
      if (this.dbManager && this.setupStatus.databaseConnected) {
        const cfg = this.dbManager.getConfig();
        const body: any = {
          host: cfg.host,
          port: cfg.port,
          username: cfg.username,
          password: cfg.password,
          database: cfg.database,
          ownerId: corporationId || 0,
          limit: 1000,
        };

        const resp = await fetch('/api/lmeve/get-assets.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (resp.ok) {
          const contentType = resp.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            const text = await resp.text();
            throw new Error(`Assets API returned non-JSON response`);
          }
          const json = await resp.json();
          if (json.ok && Array.isArray(json.rows)) {
            const rows = json.rows as Array<{
              item_id: number;
              type_id: number;
              location_id?: number;
              location_type?: string;
              location_flag?: string;
              quantity: number;
              is_singleton?: number;
              is_blueprint_copy?: number;
              owner_id?: number;
              corporation_id?: number;
            }>;

            // Resolve type names via SDE
            const uniqueTypeIds = Array.from(new Set(rows.map(r => r.type_id).filter(Boolean)));
            let typeNameMap = new Map<number, string>();
            if (uniqueTypeIds.length > 0) {
              try {
                const sdeResp = await fetch('/api/sde/get-type-names.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    host: cfg.host,
                    port: cfg.port,
                    username: cfg.username,
                    password: cfg.password,
                    sdeDatabase: 'EveStaticData',
                    typeIds: uniqueTypeIds,
                  }),
                });
                if (sdeResp.ok) {
                  const sdeJson = await sdeResp.json();
                  if (sdeJson.ok && Array.isArray(sdeJson.rows)) {
                    sdeJson.rows.forEach((row: any) => {
                      if (row.typeID && row.typeName) typeNameMap.set(Number(row.typeID), String(row.typeName));
                    });
                  }
                }
              } catch (e) {
                console.warn('SDE type name lookup failed, continuing without names');
              }
            }

            const assets: Asset[] = rows.map(r => ({
              id: String(r.item_id),
              itemId: r.item_id,
              typeId: r.type_id,
              typeName: typeNameMap.get(r.type_id) || `Type ${r.type_id}`,
              quantity: r.quantity,
              locationId: r.location_id,
              locationFlag: r.location_flag || undefined,
              locationType: (r.location_type as any) || undefined,
              isSingleton: r.is_singleton ? r.is_singleton === 1 : false,
              isBlueprintCopy: r.is_blueprint_copy ? r.is_blueprint_copy === 1 : undefined,
              ownerId: r.owner_id,
              estimatedValue: 0,
              lastUpdate: new Date().toISOString(),
            }));

            console.log(`✅ Assets from API/database: ${assets.length} assets`);
            return {
              data: assets,
              source: 'database',
              timestamp: new Date().toISOString(),
            };
          } else if (json.error) {
            throw new Error(json.error);
          }
        } else {
          throw new Error(`Assets API error: ${resp.status} ${resp.statusText}`);
        }
      }

      // Use mock data ONLY if never configured
      if (this.shouldUseMockData()) {
        console.log('📝 Using mock asset data (database not yet configured)');
        return {
          data: MockDataGenerator.generateAssets(),
          source: 'mock',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get assets:', error);
      if (this.shouldUseMockData()) {
        return {
          data: MockDataGenerator.generateAssets(),
          source: 'mock',
          timestamp: new Date().toISOString(),
        };
      }
      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get manufacturing jobs - Database → Mock (if never configured)
   */
  async getManufacturingJobs(corporationId?: number): Promise<DataResult<ManufacturingJob[]>> {
    try {
      if (this.dbManager && this.setupStatus.databaseConnected) {
        const result = await this.dbManager.query<ManufacturingJob>(
          LMeveQueries.getIndustryJobs(undefined)
        );

        if (result.success && result.data && result.data.length > 0) {
          console.log(`✅ Manufacturing jobs from database: ${result.data.length} jobs`);
          return {
            data: result.data,
            source: 'database',
            timestamp: new Date().toISOString()
          };
        }
      }

      if (this.shouldUseMockData()) {
        console.log('📝 Using mock manufacturing data (database not yet configured)');
        return {
          data: MockDataGenerator.generateManufacturingJobs(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get manufacturing jobs:', error);
      
      if (this.shouldUseMockData()) {
        return {
          data: MockDataGenerator.generateManufacturingJobs(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get wallet transactions - Database → Mock (if never configured)
   */
  async getWalletTransactions(corporationId?: number): Promise<DataResult<WalletTransaction[]>> {
    try {
      if (this.dbManager && this.setupStatus.databaseConnected) {
        const result = await this.dbManager.query<WalletTransaction>(
          LMeveQueries.getWalletTransactions(corporationId)
        );

        if (result.success && result.data && result.data.length > 0) {
          console.log(`✅ Wallet transactions from database: ${result.data.length} transactions`);
          return {
            data: result.data,
            source: 'database',
            timestamp: new Date().toISOString()
          };
        }
      }

      if (this.shouldUseMockData()) {
        console.log('📝 Using mock wallet data (database not yet configured)');
        return {
          data: MockDataGenerator.generateWalletTransactions(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get wallet transactions:', error);
      
      if (this.shouldUseMockData()) {
        return {
          data: MockDataGenerator.generateWalletTransactions(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get planetary colonies - Database → Mock (if never configured)
   */
  async getPlanetaryColonies(corporationId?: number): Promise<DataResult<PlanetaryColony[]>> {
    try {
      if (this.dbManager && this.setupStatus.databaseConnected) {
        const result = await this.dbManager.query<PlanetaryColony>(
          `SELECT * FROM planetary_colonies WHERE corporation_id = ${corporationId || 0}`
        );

        if (result.success && result.data && result.data.length > 0) {
          console.log(`✅ Planetary colonies from database: ${result.data.length} colonies`);
          return {
            data: result.data,
            source: 'database',
            timestamp: new Date().toISOString()
          };
        }
      }

      if (this.shouldUseMockData()) {
        console.log('📝 Using mock planetary data (database not yet configured)');
        return {
          data: MockDataGenerator.generatePlanetaryColonies(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get planetary colonies:', error);
      
      if (this.shouldUseMockData()) {
        return {
          data: MockDataGenerator.generatePlanetaryColonies(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get market prices - Database → Mock (if never configured)
   */
  async getMarketPrices(): Promise<DataResult<MarketPrice[]>> {
    try {
      if (this.dbManager && this.setupStatus.databaseConnected) {
        const result = await this.dbManager.query<MarketPrice>(
          'SELECT * FROM market_prices ORDER BY timestamp DESC LIMIT 100'
        );

        if (result.success && result.data && result.data.length > 0) {
          console.log(`✅ Market prices from database: ${result.data.length} prices`);
          return {
            data: result.data,
            source: 'database',
            timestamp: new Date().toISOString()
          };
        }
      }

      if (this.shouldUseMockData()) {
        console.log('📝 Using mock market data (database not yet configured)');
        return {
          data: MockDataGenerator.generateMarketPrices(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get market prices:', error);
      
      if (this.shouldUseMockData()) {
        return {
          data: MockDataGenerator.generateMarketPrices(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get wallet divisions - Database → Mock (if never configured)
   */
  async getWalletDivisions(corporationId?: number): Promise<DataResult<WalletDivision[]>> {
    try {
      if (this.dbManager && this.setupStatus.databaseConnected) {
        const result = await this.dbManager.query<WalletDivision>(
          LMeveQueries.getWalletDivisions(corporationId)
        );

        if (result.success && result.data && result.data.length > 0) {
          console.log(`✅ Wallet divisions from database: ${result.data.length} divisions`);
          return {
            data: result.data,
            source: 'database',
            timestamp: new Date().toISOString()
          };
        }
      }

      if (this.shouldUseMockData()) {
        console.log('📝 Using mock wallet division data (database not yet configured)');
        return {
          data: MockDataGenerator.generateWalletDivisions(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get wallet divisions:', error);
      
      if (this.shouldUseMockData()) {
        return {
          data: MockDataGenerator.generateWalletDivisions(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get market orders - Database → Mock (if never configured)
   */
  async getMarketOrders(corporationId?: number): Promise<DataResult<MarketOrder[]>> {
    try {
      if (this.dbManager && this.setupStatus.databaseConnected) {
        const result = await this.dbManager.query<MarketOrder>(
          `SELECT * FROM market_orders WHERE corporation_id = ${corporationId || 0} ORDER BY issued DESC`
        );

        if (result.success && result.data && result.data.length > 0) {
          console.log(`✅ Market orders from database: ${result.data.length} orders`);
          return {
            data: result.data,
            source: 'database',
            timestamp: new Date().toISOString()
          };
        }
      }

      if (this.shouldUseMockData()) {
        console.log('📝 Using mock market order data (database not yet configured)');
        return {
          data: MockDataGenerator.generateMarketOrders(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get market orders:', error);
      
      if (this.shouldUseMockData()) {
        return {
          data: MockDataGenerator.generateMarketOrders(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      return {
        data: [],
        source: 'database',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get dashboard stats - Computed from database or mock
   */
  async getDashboardStats(corporationId?: number): Promise<DataResult<DashboardStats>> {
    try {
      // If database is configured, compute from real data
      if (this.dbManager && this.setupStatus.databaseConnected && !this.shouldUseMockData()) {
        const [members, assets, jobs, wallet] = await Promise.all([
          this.getMembers(corporationId),
          this.getAssets(corporationId),
          this.getManufacturingJobs(corporationId),
          this.getWalletTransactions(corporationId)
        ]);

        const stats: DashboardStats = {
          totalMembers: members.data.length,
          activeMembers: members.data.filter(m => m.isActive).length,
          totalAssets: assets.data.length,
          totalAssetValue: assets.data.reduce((sum, a) => sum + (a.estimatedValue || 0), 0),
          activeJobs: jobs.data.filter(j => j.status === 'active').length,
          completedJobs: jobs.data.filter(j => j.status === 'delivered').length,
          totalIncome: wallet.data.filter(t => !t.isBuy).reduce((sum, t) => sum + t.amount, 0),
          totalExpenses: wallet.data.filter(t => t.isBuy).reduce((sum, t) => sum + t.amount, 0),
          netProfit: 0,
          activePlanets: 0,
          marketOrders: 0,
          recentKills: 0,
          timestamp: new Date().toISOString()
        };

  const totalIncome = stats.totalIncome || 0;
  const totalExpenses = stats.totalExpenses || 0;
  stats.netProfit = totalIncome - totalExpenses;

        return {
          data: stats,
          source: 'database',
          timestamp: new Date().toISOString()
        };
      }

      // Use mock stats if never configured
      if (this.shouldUseMockData()) {
        console.log('📝 Using mock dashboard stats (database not yet configured)');
        return {
          data: MockDataGenerator.generateDashboardStats(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      // Empty stats
      return {
        data: {
          totalMembers: 0,
          activeMembers: 0,
          totalAssets: 0,
          totalAssetValue: 0,
          activeJobs: 0,
          completedJobs: 0,
          totalIncome: 0,
          totalExpenses: 0,
          netProfit: 0,
          activePlanets: 0,
          marketOrders: 0,
          recentKills: 0,
          timestamp: new Date().toISOString()
        },
        source: 'database',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get dashboard stats:', error);
      
      if (this.shouldUseMockData()) {
        return {
          data: MockDataGenerator.generateDashboardStats(),
          source: 'mock',
          timestamp: new Date().toISOString()
        };
      }

      throw error;
    }
  }

  /**
   * Get current setup status
   */
  getSetupStatus(): SetupStatus {
    return { ...this.setupStatus };
  }

  /**
   * Reset setup status (for testing only - should not be used in production)
   */
  resetSetupStatus(): void {
    console.warn('⚠️ Resetting setup status - this should only be used for testing!');
    this.setupStatus = {
      isFullyConfigured: false,
      databaseConnected: false,
      esiConfigured: false,
      hasEverBeenGreen: false,
      timestamp: new Date().toISOString()
    };
    this.saveSetupStatus();
  }
}
