// Enhanced data service that integrates authentication, ESI API, and database
// Phase 1: Unified Data Service Implementation
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import { DatabaseManager } from './database';
import { UnifiedDataService } from './unified-data-service';
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
  IncomeAnalytics,
  WalletTransaction,
  WalletDivision,
  MarketOrder,
  PlanetaryColony
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
  unifiedService: UnifiedDataService | null;
  dbManager: DatabaseManager | null;
  
  // Setup status
  setupStatus: {
    isFullyConfigured: boolean;
    databaseConnected: boolean;
    esiConfigured: boolean;
    hasEverBeenGreen: boolean;
  };
  updateSetupStatus: (status: Partial<{
    isFullyConfigured: boolean;
    databaseConnected: boolean;
    esiConfigured: boolean;
  }>) => void;
  
  // Data sync
  syncStatus: DataSyncStatus;
  syncData: () => Promise<void>;
  
  // Cached data (with ESI integration)
  members: Member[];
  assets: Asset[];
  manufacturingJobs: ManufacturingJob[];
  walletTransactions: WalletTransaction[];
  walletDivisions: WalletDivision[];
  marketOrders: MarketOrder[];
  planetaryColonies: PlanetaryColony[];
  miningOperations: MiningOperation[];
  marketPrices: MarketPrice[];
  killmails: KillmailSummary[];
  incomeRecords: IncomeRecord[];
  dashboardStats: DashboardStats | null;
  
  // Data source tracking
  dataSource: {
    members: string;
    assets: string;
    manufacturing: string;
    wallet: string;
    planetary: string;
    market: string;
  };
  
  // Data loading states
  loading: {
    members: boolean;
    assets: boolean;
    manufacturing: boolean;
    wallet: boolean;
    planetary: boolean;
    mining: boolean;
    market: boolean;
    killmails: boolean;
    income: boolean;
  };
  
  // Data refresh functions
  refreshMembers: () => Promise<void>;
  refreshAssets: () => Promise<void>;
  refreshManufacturing: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  refreshWalletDivisions: () => Promise<void>;
  refreshMarketOrders: () => Promise<void>;
  refreshPlanetary: () => Promise<void>;
  refreshMining: () => Promise<void>;
  refreshMarket: () => Promise<void>;
  refreshKillmails: () => Promise<void>;
  refreshIncome: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
}

const LMeveDataContext = createContext<LMeveDataContextType | null>(null);

export function LMeveDataProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isTokenExpired, esiConfig } = useAuth();
  const [dbSettings] = useKV('database-settings', null);
  
  // Services
  const [dbManager, setDbManager] = useState<DatabaseManager | null>(null);
  const [unifiedService, setUnifiedService] = useState<UnifiedDataService | null>(null);
  
  // Setup status from unified service
  const [setupStatus, setSetupStatus] = useState({
    isFullyConfigured: false,
    databaseConnected: false,
    esiConfigured: false,
    hasEverBeenGreen: false
  });
  
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
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [walletDivisions, setWalletDivisions] = useState<WalletDivision[]>([]);
  const [marketOrders, setMarketOrders] = useState<MarketOrder[]>([]);
  const [planetaryColonies, setPlanetaryColonies] = useState<PlanetaryColony[]>([]);
  const [miningOperations, setMiningOperations] = useState<MiningOperation[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [killmails, setKillmails] = useState<KillmailSummary[]>([]);
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  
  // Data source tracking
  const [dataSource, setDataSource] = useState({
    members: 'none',
    assets: 'none',
    manufacturing: 'none',
    wallet: 'none',
    planetary: 'none',
    market: 'none'
  });
  
  // Loading states
  const [loading, setLoading] = useState({
    members: false,
    assets: false,
    manufacturing: false,
    wallet: false,
    planetary: false,
    mining: false,
    market: false,
    killmails: false,
    income: false
  });

  // Initialize unified service and database manager
  useEffect(() => {
    console.log('🔧 Initializing unified data service...');
    
    // Create or update database manager
    let manager: DatabaseManager | null = null;
    if (dbSettings?.host) {
      manager = new DatabaseManager(dbSettings);
      setDbManager(manager);
      console.log('✅ Database manager initialized');
    } else {
      setDbManager(null);
      console.log('⚠️ No database settings found');
    }
    
    // Create unified service (always available, manages mock data internally)
    const service = new UnifiedDataService(manager || undefined);
    setUnifiedService(service);
    
    // Load and update setup status
    const status = service.getSetupStatus();
    setSetupStatus(status);
    console.log('📊 Setup status:', status);
    
  }, [dbSettings]);

  // Monitor database connection and ESI config changes
  useEffect(() => {
    if (!unifiedService) return;
    
    const isDatabaseConnected = !!dbManager && !!dbSettings?.host;
    const isESIConfigured = !!esiConfig?.clientId;
    
    // Check if all LEDs are green
    const isFullyConfigured = isDatabaseConnected && isESIConfigured;
    
    console.log('🔍 Configuration check:', {
      isDatabaseConnected,
      isESIConfigured,
      isFullyConfigured
    });
    
    // Update unified service status
    unifiedService.updateSetupStatus({
      databaseConnected: isDatabaseConnected,
      esiConfigured: isESIConfigured,
      isFullyConfigured
    });
    
    // Sync local state
    setSetupStatus(unifiedService.getSetupStatus());
    
  }, [dbManager, dbSettings, esiConfig, unifiedService]);

  // Function to manually update setup status (for Settings panel)
  const updateSetupStatus = (status: Partial<{
    isFullyConfigured: boolean;
    databaseConnected: boolean;
    esiConfigured: boolean;
  }>) => {
    if (!unifiedService) return;
    
    unifiedService.updateSetupStatus(status);
    setSetupStatus(unifiedService.getSetupStatus());
  };

  // Refresh functions using unified data service
  const refreshMembers = async () => {
    if (!unifiedService) return;
    
    setLoading(prev => ({ ...prev, members: true }));
    try {
      const result = await unifiedService.getMembers(user?.corporationId);
      setMembers(result.data);
      setDataSource(prev => ({ ...prev, members: result.source }));
      console.log(`📊 Members loaded from ${result.source}: ${result.data.length} members`);
    } catch (error) {
      console.error('Failed to refresh members:', error);
      setMembers([]);
    } finally {
      setLoading(prev => ({ ...prev, members: false }));
    }
  };

  const refreshAssets = async () => {
    if (!unifiedService) return;
    
    setLoading(prev => ({ ...prev, assets: true }));
    try {
      const result = await unifiedService.getAssets(user?.corporationId);
      setAssets(result.data);
      setDataSource(prev => ({ ...prev, assets: result.source }));
      console.log(`📊 Assets loaded from ${result.source}: ${result.data.length} assets`);
    } catch (error) {
      console.error('Failed to refresh assets:', error);
      setAssets([]);
    } finally {
      setLoading(prev => ({ ...prev, assets: false }));
    }
  };

  const refreshManufacturing = async () => {
    if (!unifiedService) return;
    
    setLoading(prev => ({ ...prev, manufacturing: true }));
    try {
      const result = await unifiedService.getManufacturingJobs(user?.corporationId);
      setManufacturingJobs(result.data);
      setDataSource(prev => ({ ...prev, manufacturing: result.source }));
      console.log(`📊 Manufacturing jobs loaded from ${result.source}: ${result.data.length} jobs`);
    } catch (error) {
      console.error('Failed to refresh manufacturing:', error);
      setManufacturingJobs([]);
    } finally {
      setLoading(prev => ({ ...prev, manufacturing: false }));
    }
  };

  const refreshWallet = async () => {
    if (!unifiedService) return;
    
    setLoading(prev => ({ ...prev, wallet: true }));
    try {
      const result = await unifiedService.getWalletTransactions(user?.corporationId);
      setWalletTransactions(result.data);
      setDataSource(prev => ({ ...prev, wallet: result.source }));
      console.log(`📊 Wallet transactions loaded from ${result.source}: ${result.data.length} transactions`);
    } catch (error) {
      console.error('Failed to refresh wallet:', error);
      setWalletTransactions([]);
    } finally {
      setLoading(prev => ({ ...prev, wallet: false }));
    }
  };

  const refreshPlanetary = async () => {
    if (!unifiedService) return;
    
    setLoading(prev => ({ ...prev, planetary: true }));
    try {
      const result = await unifiedService.getPlanetaryColonies(user?.corporationId);
      setPlanetaryColonies(result.data);
      setDataSource(prev => ({ ...prev, planetary: result.source }));
      console.log(`📊 Planetary colonies loaded from ${result.source}: ${result.data.length} colonies`);
    } catch (error) {
      console.error('Failed to refresh planetary:', error);
      setPlanetaryColonies([]);
    } finally {
      setLoading(prev => ({ ...prev, planetary: false }));
    }
  };

  const refreshMining = async () => {
    setLoading(prev => ({ ...prev, mining: true }));
    try {
      // Mining data not yet in unified service - placeholder
      setMiningOperations([]);
    } finally {
      setLoading(prev => ({ ...prev, mining: false }));
    }
  };

  const refreshMarket = async () => {
    if (!unifiedService) return;
    
    setLoading(prev => ({ ...prev, market: true }));
    try {
      const result = await unifiedService.getMarketPrices();
      setMarketPrices(result.data);
      setDataSource(prev => ({ ...prev, market: result.source }));
      console.log(`📊 Market prices loaded from ${result.source}: ${result.data.length} prices`);
    } catch (error) {
      console.error('Failed to refresh market:', error);
      setMarketPrices([]);
    } finally {
      setLoading(prev => ({ ...prev, market: false }));
    }
  };

  const refreshWalletDivisions = async () => {
    if (!unifiedService) return;
    
    setLoading(prev => ({ ...prev, wallet: true }));
    try {
      const result = await unifiedService.getWalletDivisions(user?.corporationId);
      setWalletDivisions(result.data);
      setDataSource(prev => ({ ...prev, wallet: result.source }));
      console.log(`📊 Wallet divisions loaded from ${result.source}: ${result.data.length} divisions`);
    } catch (error) {
      console.error('Failed to refresh wallet divisions:', error);
      setWalletDivisions([]);
    } finally {
      setLoading(prev => ({ ...prev, wallet: false }));
    }
  };

  const refreshMarketOrders = async () => {
    if (!unifiedService) return;
    
    setLoading(prev => ({ ...prev, market: true }));
    try {
      const result = await unifiedService.getMarketOrders(user?.corporationId);
      setMarketOrders(result.data);
      setDataSource(prev => ({ ...prev, market: result.source }));
      console.log(`📊 Market orders loaded from ${result.source}: ${result.data.length} orders`);
    } catch (error) {
      console.error('Failed to refresh market orders:', error);
      setMarketOrders([]);
    } finally {
      setLoading(prev => ({ ...prev, market: false }));
    }
  };

  const refreshKillmails = async () => {
    setLoading(prev => ({ ...prev, killmails: true }));
    try {
      // Killmails not yet in unified service - placeholder
      setKillmails([]);
    } finally {
      setLoading(prev => ({ ...prev, killmails: false }));
    }
  };

  const refreshIncome = async () => {
    setLoading(prev => ({ ...prev, income: true }));
    try {
      // Income not yet in unified service - placeholder
      setIncomeRecords([]);
    } finally {
      setLoading(prev => ({ ...prev, income: false }));
    }
  };

  const refreshDashboard = async () => {
    if (!unifiedService) return;
    
    try {
      const result = await unifiedService.getDashboardStats(user?.corporationId);
      setDashboardStats(result.data);
      console.log(`📊 Dashboard stats loaded from ${result.source}`);
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
      setDashboardStats(null);
    }
  };

  // Comprehensive data sync function
  const syncData = async () => {
    if (syncStatus.isRunning || !unifiedService) return;

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
        { name: 'Loading wallet transactions...', action: refreshWallet },
        { name: 'Loading wallet divisions...', action: refreshWalletDivisions },
        { name: 'Fetching market orders...', action: refreshMarketOrders },
        { name: 'Checking planetary colonies...', action: refreshPlanetary },
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
        await new Promise(resolve => setTimeout(resolve, 300));
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
      }, 2000);

    } catch (error) {
      setSyncStatus({
        isRunning: false,
        stage: 'Sync failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Initial data load when service is ready
  useEffect(() => {
    if (unifiedService) {
      console.log('🚀 Unified service ready - loading initial data');
      refreshDashboard();
      
      // Load data for authenticated users
      if (isAuthenticated) {
        refreshMembers();
        refreshAssets();
        refreshManufacturing();
      }
    }
  }, [unifiedService, isAuthenticated]);

  const contextValue: LMeveDataContextType = {
    unifiedService,
    dbManager,
    setupStatus,
    updateSetupStatus,
    syncStatus,
    syncData,
    members,
    assets,
    manufacturingJobs,
    walletTransactions,
    walletDivisions,
    marketOrders,
    planetaryColonies,
    miningOperations,
    marketPrices,
    killmails,
    incomeRecords,
    dashboardStats,
    dataSource,
    loading,
    refreshMembers,
    refreshAssets,
    refreshManufacturing,
    refreshWallet,
    refreshWalletDivisions,
    refreshMarketOrders,
    refreshPlanetary,
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