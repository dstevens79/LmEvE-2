import { DatabaseManager } from './database';
  Member,
  Manufac
  Market
  ManufacturingJob,
  MiningOperation,
  MarketPrice,
  WalletTransaction,
  database: boole
  mock: boolean;

  corporationId:
  useCache?: bool


  data: T[];
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

      isFullyConf
 

  }
  private saveSetupStatus(): 
      localStorage.setItem('l
      console.error('Fail
  }
  updateSetupStatus(
 


      this.setupStatus.hasEverBeenGreen = true;
      this.clearCache();

  }

  }
  private shouldUseMockData(): boolean 
  }
  s

    });

    this.cache.clear();
  }
  private getCacheKey(type: string
  }
  private getFromCach
    if (cached && cached.expires > Date.now()) {
     

    }
  }
  private setCache<T>(key: stri
      data,
    });
  }
  asyn
   

      if (cached) {
         
          timestamp: new Date().toISOString()
      }

     
   

          source.database = true;
            data: result
            timestamp: new
        }
        console.log('📭 No members in dat
      

      } catch (error) {
        return {
          source,
          error: error i
     

      console.log('📝 Using
   

          corporationId: options.
          role: 'director',
   

          skillPoints: 50000000,
        }
   

        timestamp: new Date().toISOString()
    }
    return {
      source: { ...source, database:
      e
  }

    const source: DataSource =
    if (options.useCach
      if (cached) {
   

      }

   

        if (result.success && result.data && resul
          source.database = true;
            data: result.data as Asset[],
            timestamp: new Date().toISOString
        }
     
          data: [
          timestamp: new Date
     
        return {
   

      }

      conso
        {
       
          quantity: 1000000,
   

          category: 'mineral',
          lastUpdate: new Date().toISOString()
      ];

        source,
      };

      data: [],
      timestamp: new Da
    };

    const 

     

          source: { ...source, cache: true },
        };
    }
    if (this.dbManager && this.setupStatus.hasEverBeenGreen) {
        
        
          this.setCache(cacheKey, result.data as Manufactur
          return {
            source
          };
        
        return {
          so
        }
        
          data: [],
          timest
        };
    }
    if (this.shouldUseMockData()) {
      cons
          id: '1',
          blueprintName: 'Raven Blueprint',
          produc
          startDate
          status:
          facilityId: 60003760,
          installerName: 'Sample Character Alpha',
          
       
     

          id: '2',
          blueprintName: 'Tritanium Blueprint',
          productTypeName: 'Tritanium
         
          status: 
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
      data: [],
          installerId: 90000001,
      error: 'No data source available'
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

          materialEfficiency: 10,

          duration: 12 * 60 * 60,

          priority: 'high'

      ];

      return {

        source,
        timestamp: new Date().toISOString()
      };



      data: [],
      source: { ...source, database: true },
      timestamp: new Date().toISOString(),
      error: 'System not configured and database unavailable'
    };


  async fetchWalletTransactions(options: FetchOptions & { divisionId?: number }): Promise<FetchResult<WalletTransaction>> {
    const cacheKey = this.getCacheKey(`wallet_trans_${options.divisionId || 'all'}`, options);
    const source: DataSource = { esi: false, database: false, cache: false };

    if (options.useCache !== false) {
      const cached = this.getFromCache<WalletTransaction[]>(cacheKey);
      if (cached) {
        return {

          source: { ...source, cache: true },
          timestamp: new Date().toISOString()
        };
      }
    }

    if (options.accessToken && !options.forceDB) {

        console.log('🌐 Fetching wallet transactions from ESI...');
        const division = options.divisionId || 1;
        const esiTransactions = await eveApi.getCorporationWalletTransactions(

          division,

        );

        const transactions: WalletTransaction[] = esiTransactions.map((tx, index) => ({
          id: `esi_${tx.transaction_id}`,
          date: tx.date,
          divisionId: division,
          amount: tx.unit_price * tx.quantity * (tx.is_buy ? -1 : 1),
          balance: 0,
          description: `${tx.is_buy ? 'Buy' : 'Sell'} ${tx.quantity}x items`,

          secondPartyId: tx.client_id,

        }));

        this.setCache(cacheKey, transactions);
        source.esi = true;


          data: transactions,

          timestamp: new Date().toISOString()

      } catch (error) {
        console.warn('⚠️ ESI fetch failed, falling back to database:', error);
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
        

          source.database = true;
          return {
            data: result.data as WalletTransaction[],

            timestamp: new Date().toISOString()

        }
      } catch (error) {
        console.warn('⚠️ Database fetch failed:', error);

    }

    return {

      source,
      timestamp: new Date().toISOString(),
      error: 'No data source available'

  }

  async fetchWalletBalance(options: FetchOptions): Promise<FetchResult<WalletDivision>> {
    const cacheKey = this.getCacheKey('wallet_balance', options);
    const source: DataSource = { esi: false, database: false, cache: false };

    if (options.useCache !== false) {
      const cached = this.getFromCache<WalletDivision[]>(cacheKey);
      if (cached) {
        return {
          data: cached,

          timestamp: new Date().toISOString()

      }


    if (options.accessToken && !options.forceDB) {
      try {
        console.log('🌐 Fetching wallet balances from ESI...');
        const wallets = await eveApi.getCorporationWallets(options.corporationId, options.accessToken);

        const divisions: WalletDivision[] = wallets.map((wallet, index) => ({
          divisionId: index + 1,
          divisionName: `Wallet Division ${index + 1}`,

        }));

        this.setCache(cacheKey, divisions);
        source.esi = true;


          data: divisions,

          timestamp: new Date().toISOString()

      } catch (error) {
        console.warn('⚠️ ESI fetch failed, falling back to database:', error);
      }


    if (this.dbManager && !options.forceESI) {
      try {
        console.log('🗄️ Fetching wallet balances from database...');
        const result = await this.dbManager.query(
          'SELECT * FROM wallet_divisions WHERE corporation_id = ?',
          [options.corporationId]

        
        if (result.success && result.data) {
          source.database = true;
          return {
            data: result.data as WalletDivision[],
            source,
            timestamp: new Date().toISOString()

        }

        console.warn('⚠️ Database fetch failed:', error);

    }

    return {

      source,
      timestamp: new Date().toISOString(),
      error: 'No data source available'

  }

  clearCache(type?: string) {

      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(type));
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`🗑️ Cleared cache for ${type} (${keysToDelete.length} entries)`);

      this.cache.clear();
      console.log('🗑️ Cleared all cache');
    }

}

export const integratedDataService = new IntegratedDataService();
