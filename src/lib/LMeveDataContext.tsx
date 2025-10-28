// Enhanced data service that integrates authentication, ESI API, and database
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import { DatabaseManager } from './database';
import { LMeveDataService } from './dataService';
import { eveApi } from './eveApi';
import { useKV } from '@github/spark/hooks';
import type { 
  Member, 
  Asset, 
  ManufacturingJob, 
  Corporation,
  DashboardStats,
  MarketPrice,
  MiningOperation,
  KillmailSummary,
  IncomeRecord,
  IncomeAnalytics
} from './types';

interface DataSyncStatus {
  isRunning: boolean;
  stage: string;
  progress: number;
  lastSync?: string;
  error?: string;
}

interface LMeveDataContextType {
  // Services
  dataService: LMeveDataService | null;
  dbManager: DatabaseManager | null;
  
  // Data sync
  syncStatus: DataSyncStatus;
  syncData: () => Promise<void>;
  
  // Cached data (with ESI integration)
  members: Member[];
  assets: Asset[];
  manufacturingJobs: ManufacturingJob[];
  miningOperations: MiningOperation[];
  marketPrices: MarketPrice[];
  killmails: KillmailSummary[];
  incomeRecords: IncomeRecord[];
  dashboardStats: DashboardStats | null;
  
  // Data loading states
  loading: {
    members: boolean;
    assets: boolean;
    manufacturing: boolean;
    mining: boolean;
    market: boolean;
    killmails: boolean;
    income: boolean;
  };
  
  // Data refresh functions
  refreshMembers: () => Promise<void>;
  refreshAssets: () => Promise<void>;
  refreshManufacturing: () => Promise<void>;
  refreshMining: () => Promise<void>;
  refreshMarket: () => Promise<void>;
  refreshKillmails: () => Promise<void>;
  refreshIncome: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
}

const LMeveDataContext = createContext<LMeveDataContextType | null>(null);

export function LMeveDataProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isTokenExpired } = useAuth();
  const [dbSettings] = useKV('corp-settings', null);
  
  // Services
  const [dbManager, setDbManager] = useState<DatabaseManager | null>(null);
  const [dataService, setDataService] = useState<LMeveDataService | null>(null);
  
  // Sync status
  const [syncStatus, setSyncStatus] = useState<DataSyncStatus>({
    isRunning: false,
    stage: 'Idle',
    progress: 0
  });
  
  // Cached data
  const [members, setMembers] = useState<Member[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [manufacturingJobs, setManufacturingJobs] = useState<ManufacturingJob[]>([]);
  const [miningOperations, setMiningOperations] = useState<MiningOperation[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [killmails, setKillmails] = useState<KillmailSummary[]>([]);
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState({
    members: false,
    assets: false,
    manufacturing: false,
    mining: false,
    market: false,
    killmails: false,
    income: false
  });

  // Initialize database manager when settings change
  useEffect(() => {
    if (dbSettings?.database && isAuthenticated) {
      const manager = new DatabaseManager(dbSettings.database);
      setDbManager(manager);
      setDataService(new LMeveDataService(manager));
    } else {
      setDbManager(null);
      setDataService(null);
    }
  }, [dbSettings?.database, isAuthenticated]);

  // Enhanced data fetching with ESI integration
  const fetchMembersWithESI = async (): Promise<Member[]> => {
    if (!user || !dataService) return [];

    try {
      // First try to get from database
      let members = await dataService.getMembers(user.corporationId);
      
      // If we have valid ESI token, fetch real member data
      if (user.accessToken && !isTokenExpired()) {
        try {
          const memberIds = await eveApi.getCorporationMembers(user.corporationId, user.accessToken);
          
          const memberDetails = await eveApi.getNames(memberIds);
          
          const enhancedMembers: Member[] = memberDetails.map(detail => ({
            id: detail.id.toString(),
            characterId: detail.id,
            characterName: detail.name,
            corporationId: user.corporationId,
            corporationName: user.corporationName || 'Unknown',
            role: 'member',
            joinDate: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            status: 'active' as const,
            location: 'Unknown',
            shipType: 'Unknown',
            skillPoints: 0,
            roles: []
          }));
          
          return enhancedMembers;
        } catch (esiError) {
          console.warn('ESI member data fetch failed, using database data:', esiError);
        }
      }
      
      return members;
    } catch (error) {
      console.error('Failed to fetch members:', error);
      return [];
    }
  };

  const fetchAssetsWithESI = async (): Promise<Asset[]> => {
    if (!user || !dataService) return [];

    try {
      // First try to get from database
      let assets = await dataService.getAssets(user.corporationId);
      
      // If we have valid ESI token, fetch real asset data
      if (user.accessToken && !isTokenExpired()) {
        try {
          const esiAssets = await eveApi.getCorporationAssets(user.corporationId, user.accessToken);
          
          const uniqueTypeIds = [...new Set(esiAssets.map(a => a.type_id))];
          const typeNames = await eveApi.getNames(uniqueTypeIds);
          const typeNameMap = new Map(typeNames.map(t => [t.id, t.name]));
          
          const uniqueLocationIds = [...new Set(esiAssets.map(a => a.location_id))];
          const locationNames = await Promise.all(
            uniqueLocationIds.map(async (locId) => {
              const name = await eveApi.getLocationName(locId, user.accessToken);
              return { id: locId, name };
            })
          );
          const locationNameMap = new Map(locationNames.map(l => [l.id, l.name]));
          
          const parseHangarFlag = (flag: string): string => {
            const hangarMatch = flag.match(/CorpSAG(\d)/);
            if (hangarMatch) return `Hangar ${hangarMatch[1]}`;
            if (flag === 'Hangar') return 'Personal Hangar';
            return flag;
          };
          
          const enhancedAssets: Asset[] = esiAssets.map((esiAsset) => ({
            id: `esi_${esiAsset.item_id}`,
            typeId: esiAsset.type_id,
            typeName: typeNameMap.get(esiAsset.type_id) || `Type ${esiAsset.type_id}`,
            quantity: esiAsset.quantity,
            location: locationNameMap.get(esiAsset.location_id) || `Location ${esiAsset.location_id}`,
            locationId: esiAsset.location_id,
            hangar: parseHangarFlag(esiAsset.location_flag),
            owner: user.characterName,
            ownerId: user.characterId,
            category: 'unknown',
            estimatedValue: 0,
            lastUpdate: new Date().toISOString()
          }));
          
          return enhancedAssets;
        } catch (esiError) {
          console.warn('ESI asset data fetch failed, using database data:', esiError);
        }
      }
      
      return assets;
    } catch (error) {
      console.error('Failed to fetch assets:', error);
      return [];
    }
  };

  const fetchManufacturingWithESI = async (): Promise<ManufacturingJob[]> => {
    if (!user || !dataService) return [];

    try {
      // First try to get from database
      let jobs = await dataService.getManufacturingJobs();
      
      // If we have valid ESI token, fetch real industry jobs
      if (user.accessToken && !isTokenExpired()) {
        try {
          const esiJobs = await eveApi.getCorporationIndustryJobs(user.corporationId, user.accessToken);
          
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
          
          const uniqueStationIds = [...new Set(esiJobs.map(j => j.station_id))];
          const stationNames = await Promise.all(
            uniqueStationIds.map(async (stationId) => {
              const name = await eveApi.getLocationName(stationId, user.accessToken);
              return { id: stationId, name };
            })
          );
          const stationNameMap = new Map(stationNames.map(s => [s.id, s.name]));
          
          const enhancedJobs: ManufacturingJob[] = esiJobs.map((esiJob) => ({
            id: `esi_${esiJob.job_id}`,
            blueprintId: esiJob.blueprint_type_id,
            blueprintName: typeNameMap.get(esiJob.blueprint_type_id) || `Blueprint ${esiJob.blueprint_type_id}`,
            productTypeId: esiJob.product_type_id || 0,
            productTypeName: esiJob.product_type_id ? (typeNameMap.get(esiJob.product_type_id) || 'Unknown') : 'Unknown',
            runs: esiJob.runs,
            startDate: esiJob.start_date,
            endDate: esiJob.end_date,
            status: esiJob.status,
            facility: stationNameMap.get(esiJob.station_id) || `Station ${esiJob.station_id}`,
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
          
          return enhancedJobs;
        } catch (esiError) {
          console.warn('ESI industry job data fetch failed, using database data:', esiError);
        }
      }
      
      return jobs;
    } catch (error) {
      console.error('Failed to fetch manufacturing jobs:', error);
      return [];
    }
  };

  const refreshMembers = async () => {
    setLoading(prev => ({ ...prev, members: true }));
    try {
      const data = await fetchMembersWithESI();
      setMembers(data);
    } finally {
      setLoading(prev => ({ ...prev, members: false }));
    }
  };

  const refreshAssets = async () => {
    setLoading(prev => ({ ...prev, assets: true }));
    try {
      const data = await fetchAssetsWithESI();
      setAssets(data);
    } finally {
      setLoading(prev => ({ ...prev, assets: false }));
    }
  };

  const refreshManufacturing = async () => {
    setLoading(prev => ({ ...prev, manufacturing: true }));
    try {
      const data = await fetchManufacturingWithESI();
      setManufacturingJobs(data);
    } finally {
      setLoading(prev => ({ ...prev, manufacturing: false }));
    }
  };

  const refreshMining = async () => {
    setLoading(prev => ({ ...prev, mining: true }));
    try {
      if (dataService) {
        const data = await dataService.getMiningOperations();
        setMiningOperations(data);
      }
    } finally {
      setLoading(prev => ({ ...prev, mining: false }));
    }
  };

  const refreshMarket = async () => {
    setLoading(prev => ({ ...prev, market: true }));
    try {
      if (dataService) {
        const data = await dataService.getMarketPrices();
        setMarketPrices(data);
      }
    } finally {
      setLoading(prev => ({ ...prev, market: false }));
    }
  };

  const refreshKillmails = async () => {
    setLoading(prev => ({ ...prev, killmails: true }));
    try {
      if (dataService) {
        const data = await dataService.getKillmails(user?.corporationId);
        setKillmails(data);
      }
    } finally {
      setLoading(prev => ({ ...prev, killmails: false }));
    }
  };

  const refreshIncome = async () => {
    setLoading(prev => ({ ...prev, income: true }));
    try {
      if (dataService) {
        const data = await dataService.getIncomeRecords();
        setIncomeRecords(data);
      }
    } finally {
      setLoading(prev => ({ ...prev, income: false }));
    }
  };

  const refreshDashboard = async () => {
    try {
      if (dataService) {
        const stats = await dataService.getDashboardStats();
        setDashboardStats(stats);
      }
    } catch (error) {
      console.error('Failed to refresh dashboard stats:', error);
    }
  };

  // Comprehensive data sync function
  const syncData = async () => {
    if (syncStatus.isRunning || !dataService || !user) return;

    setSyncStatus({
      isRunning: true,
      stage: 'Initializing...',
      progress: 0
    });

    try {
      const stages = [
        { name: 'Syncing corporation members...', action: refreshMembers },
        { name: 'Updating asset locations...', action: refreshAssets },
        { name: 'Fetching industry jobs...', action: refreshManufacturing },
        { name: 'Collecting mining data...', action: refreshMining },
        { name: 'Updating market prices...', action: refreshMarket },
        { name: 'Processing killmails...', action: refreshKillmails },
        { name: 'Calculating income...', action: refreshIncome },
        { name: 'Finalizing dashboard...', action: refreshDashboard }
      ];

      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        setSyncStatus({
          isRunning: true,
          stage: stage.name,
          progress: (i / stages.length) * 100
        });

        await stage.action();
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setSyncStatus({
        isRunning: false,
        stage: 'Sync completed',
        progress: 100,
        lastSync: new Date().toISOString()
      });

      // Reset status after a short delay
      setTimeout(() => {
        setSyncStatus({
          isRunning: false,
          stage: 'Idle',
          progress: 0,
          lastSync: new Date().toISOString()
        });
      }, 3000);

    } catch (error) {
      setSyncStatus({
        isRunning: false,
        stage: 'Sync failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Initial data load when authenticated
  useEffect(() => {
    if (isAuthenticated && dataService) {
      // Load initial data without full sync
      refreshDashboard();
    }
  }, [isAuthenticated, dataService]);

  const contextValue: LMeveDataContextType = {
    dataService,
    dbManager,
    syncStatus,
    syncData,
    members,
    assets,
    manufacturingJobs,
    miningOperations,
    marketPrices,
    killmails,
    incomeRecords,
    dashboardStats,
    loading,
    refreshMembers,
    refreshAssets,
    refreshManufacturing,
    refreshMining,
    refreshMarket,
    refreshKillmails,
    refreshIncome,
    refreshDashboard
  };

  return (
    <LMeveDataContext.Provider value={contextValue}>
      {children}
    </LMeveDataContext.Provider>
  );
}

export function useLMeveData() {
  const context = useContext(LMeveDataContext);
  if (!context) {
    throw new Error('useLMeveData must be used within a LMeveDataProvider');
  }
  return context;
}