// Enhanced data service that integrates authentication, ESI API, and database
// Phase 1: Unified Data Service Implementation
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import { DatabaseManager } from './database';
import { UnifiedDataService } from './unified-data-service';
import { eveApi } from './eveApi';
import { useKV } from '@/lib/kv';
import { useDatabaseSettings } from './persistenceService';
import {
  fetchMembers,
  fetchAssets,
  fetchIndustryJobs,
  fetchWalletTransactions,
  fetchWalletDivisions,
  fetchMarketOrders,
  fetchMiningLedger,
  fetchKillmails,
} from './corp-data';
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
  const [databaseSettings] = useDatabaseSettings();
  
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
    if (databaseSettings?.host) {
      manager = new DatabaseManager({
        host: databaseSettings.host,
        port: Number(databaseSettings.port) || 3306,
        database: databaseSettings.database,
        username: databaseSettings.username,
        password: databaseSettings.password,
        ssl: !!databaseSettings.ssl,
        connectionPoolSize: databaseSettings.connectionPoolSize,
        queryTimeout: Number(databaseSettings.queryTimeout) || 30,
        autoReconnect: !!databaseSettings.autoReconnect,
        charset: databaseSettings.charset || 'utf8mb4',
      });
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
    
  }, [databaseSettings]);

  // Monitor database connection and ESI config changes
  useEffect(() => {
    if (!unifiedService) return;
    
  const isDatabaseConnected = !!dbManager && !!databaseSettings?.host;
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
    
  }, [dbManager, databaseSettings, esiConfig, unifiedService]);

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
  // All reads go to the server DB via corp-data (rows cached by cron/manual sync).
  const refreshMembers = async () => {
    if (!user?.corporationId) return;

    setLoading(prev => ({ ...prev, members: true }));
    try {
      const data = await fetchMembers(user.corporationId);
      setMembers(data);
      setDataSource(prev => ({ ...prev, members: 'database' }));
      console.log(`📊 Members loaded from database: ${data.length} members`);
    } catch (error) {
      console.error('Failed to refresh members:', error);
    } finally {
      setLoading(prev => ({ ...prev, members: false }));
    }
  };

  const refreshAssets = async () => {
    if (!user?.corporationId) return;

    setLoading(prev => ({ ...prev, assets: true }));
    try {
      const data = await fetchAssets(user.corporationId);
      setAssets(data);
      setDataSource(prev => ({ ...prev, assets: 'database' }));
      console.log(`📊 Assets loaded from database: ${data.length} assets`);
    } catch (error) {
      console.error('Failed to refresh assets:', error);
    } finally {
      setLoading(prev => ({ ...prev, assets: false }));
    }
  };

  const refreshManufacturing = async () => {
    if (!user?.corporationId) return;

    setLoading(prev => ({ ...prev, manufacturing: true }));
    try {
      const data = await fetchIndustryJobs(user.corporationId);
      setManufacturingJobs(data);
      setDataSource(prev => ({ ...prev, manufacturing: 'database' }));
      console.log(`📊 Manufacturing jobs loaded from database: ${data.length} jobs`);
    } catch (error) {
      console.error('Failed to refresh manufacturing:', error);
    } finally {
      setLoading(prev => ({ ...prev, manufacturing: false }));
    }
  };

  const refreshWallet = async () => {
    if (!user?.corporationId) return;

    setLoading(prev => ({ ...prev, wallet: true }));
    try {
      const data = await fetchWalletTransactions(user.corporationId);
      setWalletTransactions(data);
      setDataSource(prev => ({ ...prev, wallet: 'database' }));
      console.log(`📊 Wallet transactions loaded from database: ${data.length} transactions`);
    } catch (error) {
      console.error('Failed to refresh wallet:', error);
    } finally {
      setLoading(prev => ({ ...prev, wallet: false }));
    }
  };

  const refreshPlanetary = async () => {
    if (!user?.corporationId) return;

    setLoading(prev => ({ ...prev, planetary: true }));
    try {
      // Planetary colonies are not yet synced server-side; leave empty until then.
      setPlanetaryColonies([]);
      console.log('📭 Planetary colonies have no server sync segment yet');
    } catch (error) {
      console.error('Failed to refresh planetary:', error);
    } finally {
      setLoading(prev => ({ ...prev, planetary: false }));
    }
  };

  const refreshMining = async () => {
    if (!user?.corporationId) return;

    setLoading(prev => ({ ...prev, mining: true }));
    try {
      const data = await fetchMiningLedger(user.corporationId);
      setMiningOperations(data);
      console.log(`📊 Mining ledger loaded from database: ${data.length} entries`);
    } catch (error) {
      console.error('Failed to refresh mining:', error);
    } finally {
      setLoading(prev => ({ ...prev, mining: false }));
    }
  };

  const refreshMarket = async () => {
    // Market prices are populated by the item_pricing process; keep as-is.
    if (!unifiedService) return;

    setLoading(prev => ({ ...prev, market: true }));
    try {
      const result = await unifiedService.getMarketPrices();
      setMarketPrices(result.data);
      setDataSource(prev => ({ ...prev, market: result.source }));
    } catch (error) {
      console.error('Failed to refresh market:', error);
    } finally {
      setLoading(prev => ({ ...prev, market: false }));
    }
  };

  const refreshWalletDivisions = async () => {
    if (!user?.corporationId) return;

    setLoading(prev => ({ ...prev, wallet: true }));
    try {
      const data = await fetchWalletDivisions(user.corporationId);
      setWalletDivisions(data);
      console.log(`📊 Wallet divisions loaded from database: ${data.length} divisions`);
    } catch (error) {
      console.error('Failed to refresh wallet divisions:', error);
    } finally {
      setLoading(prev => ({ ...prev, wallet: false }));
    }
  };

  const refreshMarketOrders = async () => {
    if (!user?.corporationId) return;

    setLoading(prev => ({ ...prev, market: true }));
    try {
      const data = await fetchMarketOrders(user.corporationId);
      setMarketOrders(data);
      setDataSource(prev => ({ ...prev, market: 'database' }));
      console.log(`📊 Market orders loaded from database: ${data.length} orders`);
    } catch (error) {
      console.error('Failed to refresh market orders:', error);
    } finally {
      setLoading(prev => ({ ...prev, market: false }));
    }
  };

  const refreshKillmails = async () => {
    if (!user?.corporationId) return;

    setLoading(prev => ({ ...prev, killmails: true }));
    try {
      const data = await fetchKillmails(user.corporationId);
      setKillmails(data);
      console.log(`📊 Killmails loaded from database: ${data.length} losses`);
    } catch (error) {
      console.error('Failed to refresh killmails:', error);
    } finally {
      setLoading(prev => ({ ...prev, killmails: false }));
    }
  };

  const refreshIncome = async () => {
    if (!user?.corporationId) return;

    setLoading(prev => ({ ...prev, income: true }));
    try {
      // Income records are not yet synced server-side; leave empty until then.
      setIncomeRecords([]);
    } catch (error) {
      console.error('Failed to refresh income:', error);
    } finally {
      setLoading(prev => ({ ...prev, income: false }));
    }
  };

  const refreshDashboard = async () => {
    if (!user?.corporationId) return;
    try {
      const [m, a, j, o, k] = await Promise.all([
        fetchMembers(user.corporationId),
        fetchAssets(user.corporationId),
        fetchIndustryJobs(user.corporationId),
        fetchMarketOrders(user.corporationId),
        fetchKillmails(user.corporationId),
      ]);

      const activeJobStatuses = new Set(['active', 'paused']);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      setDashboardStats({
        totalMembers: m.length,
        activeMembers: m.filter(x => x.isActive).length,
        onlineMembers: m.filter(x => x.isOnline).length,
        totalAssets: a.length,
        activeJobs: j.filter(x => activeJobStatuses.has((x.status || '').toLowerCase())).length,
        completedJobs: j.filter(x => (x.status || '').toLowerCase() === 'delivered' || (x.status || '').toLowerCase() === 'completed').length,
        completedJobsThisMonth: j.filter(x => x.completedDate && new Date(x.completedDate) >= monthStart).length,
        marketOrders: o.length,
        recentKills: k.length,
        timestamp: new Date().toISOString(),
      });
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