import { useState, useCallback, useEffect } from 'react';
import { integratedDataService, type FetchOptions, type FetchResult } from '@/lib/integrated-data-service';
import { useAuth } from '@/lib/auth-provider';
import { useDatabase } from '@/lib/DatabaseContext';
import type {
  Member,
  Asset,
  ManufacturingJob,
  WalletTransaction,
  WalletDivision
} from '@/lib/types';

export interface UseIntegratedDataOptions {
  autoFetch?: boolean;
  useCache?: boolean;
  forceESI?: boolean;
  forceDB?: boolean;
}

export interface DataState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  source: {
    esi: boolean;
    database: boolean;
    cache: boolean;
  };
  timestamp: string | null;
}

export function useIntegratedData() {
  const { user, isAuthenticated } = useAuth();
  const { manager: dbManager } = useDatabase();

  useEffect(() => {
    integratedDataService.setDatabaseManager(dbManager);
  }, [dbManager]);

  const createDataState = <T,>(): DataState<T> => ({
    data: [],
    loading: false,
    error: null,
    source: { esi: false, database: false, cache: false },
    timestamp: null
  });

  const [membersState, setMembersState] = useState<DataState<Member>>(createDataState());
  const [assetsState, setAssetsState] = useState<DataState<Asset>>(createDataState());
  const [manufacturingState, setManufacturingState] = useState<DataState<ManufacturingJob>>(createDataState());
  const [walletTransactionsState, setWalletTransactionsState] = useState<DataState<WalletTransaction>>(createDataState());
  const [walletDivisionsState, setWalletDivisionsState] = useState<DataState<WalletDivision>>(createDataState());

  const buildFetchOptions = (customOptions?: Partial<UseIntegratedDataOptions>): FetchOptions | null => {
    if (!user?.corporationId) return null;

    return {
      corporationId: user.corporationId,
      accessToken: user.accessToken,
      useCache: customOptions?.useCache !== false,
      forceESI: customOptions?.forceESI,
      forceDB: customOptions?.forceDB
    };
  };

  const fetchMembers = useCallback(async (customOptions?: Partial<UseIntegratedDataOptions>) => {
    const options = buildFetchOptions(customOptions);
    if (!options) {
      setMembersState(prev => ({ ...prev, error: 'Not authenticated' }));
      return;
    }

    setMembersState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await integratedDataService.fetchMembers(options);
      setMembersState({
        data: result.data,
        loading: false,
        error: result.error || null,
        source: result.source,
        timestamp: result.timestamp
      });
    } catch (error) {
      setMembersState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch members'
      }));
    }
  }, [user]);

  const fetchAssets = useCallback(async (customOptions?: Partial<UseIntegratedDataOptions>) => {
    const options = buildFetchOptions(customOptions);
    if (!options) {
      setAssetsState(prev => ({ ...prev, error: 'Not authenticated' }));
      return;
    }

    setAssetsState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await integratedDataService.fetchAssets(options);
      setAssetsState({
        data: result.data,
        loading: false,
        error: result.error || null,
        source: result.source,
        timestamp: result.timestamp
      });
    } catch (error) {
      setAssetsState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch assets'
      }));
    }
  }, [user]);

  const fetchManufacturingJobs = useCallback(async (customOptions?: Partial<UseIntegratedDataOptions>) => {
    const options = buildFetchOptions(customOptions);
    if (!options) {
      setManufacturingState(prev => ({ ...prev, error: 'Not authenticated' }));
      return;
    }

    setManufacturingState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await integratedDataService.fetchManufacturingJobs(options);
      setManufacturingState({
        data: result.data,
        loading: false,
        error: result.error || null,
        source: result.source,
        timestamp: result.timestamp
      });
    } catch (error) {
      setManufacturingState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch manufacturing jobs'
      }));
    }
  }, [user]);

  const fetchWalletTransactions = useCallback(async (divisionId?: number, customOptions?: Partial<UseIntegratedDataOptions>) => {
    const options = buildFetchOptions(customOptions);
    if (!options) {
      setWalletTransactionsState(prev => ({ ...prev, error: 'Not authenticated' }));
      return;
    }

    setWalletTransactionsState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await integratedDataService.fetchWalletTransactions({ ...options, divisionId });
      setWalletTransactionsState({
        data: result.data,
        loading: false,
        error: result.error || null,
        source: result.source,
        timestamp: result.timestamp
      });
    } catch (error) {
      setWalletTransactionsState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch wallet transactions'
      }));
    }
  }, [user]);

  const fetchWalletDivisions = useCallback(async (customOptions?: Partial<UseIntegratedDataOptions>) => {
    const options = buildFetchOptions(customOptions);
    if (!options) {
      setWalletDivisionsState(prev => ({ ...prev, error: 'Not authenticated' }));
      return;
    }

    setWalletDivisionsState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await integratedDataService.fetchWalletBalance(options);
      setWalletDivisionsState({
        data: result.data,
        loading: false,
        error: result.error || null,
        source: result.source,
        timestamp: result.timestamp
      });
    } catch (error) {
      setWalletDivisionsState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch wallet divisions'
      }));
    }
  }, [user]);

  const refreshAll = useCallback(async (customOptions?: Partial<UseIntegratedDataOptions>) => {
    if (!isAuthenticated) return;

    await Promise.all([
      fetchMembers({ ...customOptions, useCache: false }),
      fetchAssets({ ...customOptions, useCache: false }),
      fetchManufacturingJobs({ ...customOptions, useCache: false }),
      fetchWalletDivisions({ ...customOptions, useCache: false }),
      fetchWalletTransactions(undefined, { ...customOptions, useCache: false })
    ]);
  }, [isAuthenticated, fetchMembers, fetchAssets, fetchManufacturingJobs, fetchWalletDivisions, fetchWalletTransactions]);

  const clearCache = useCallback((type?: string) => {
    integratedDataService.clearCache(type);
  }, []);

  return {
    members: membersState,
    assets: assetsState,
    manufacturing: manufacturingState,
    walletTransactions: walletTransactionsState,
    walletDivisions: walletDivisionsState,
    
    fetchMembers,
    fetchAssets,
    fetchManufacturingJobs,
    fetchWalletTransactions,
    fetchWalletDivisions,
    refreshAll,
    clearCache
  };
}
