import { useState, useEffect } from 'react';
import { DataRetrievalService, type DataFreshnessInfo } from './data-retrieval-service';
import { getDatabaseService } from './database';
import { useAuth } from './auth-provider';
import type { Member, Asset, ManufacturingJob, MiningOperation, DashboardStats } from './types';

export function useRetrievalService() {
  const { user } = useAuth();
  const [service] = useState(() => {
    const dbService = getDatabaseService();
    return new DataRetrievalService(dbService);
  });

  return service;
}

export function useMembers() {
  const { user } = useAuth();
  const service = useRetrievalService();
  const [data, setData] = useState<Member[]>([]);
  const [freshness, setFreshness] = useState<DataFreshnessInfo>({
    lastUpdated: null,
    isStale: true,
    freshnessCutoff: 120
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!user?.corporationId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await service.getMembers(user.corporationId);
      setData(result.data);
      setFreshness(result.freshness);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
      console.error('Error loading members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [user?.corporationId]);

  return { data, freshness, loading, error, refresh };
}

export function useAssets() {
  const { user } = useAuth();
  const service = useRetrievalService();
  const [data, setData] = useState<Asset[]>([]);
  const [freshness, setFreshness] = useState<DataFreshnessInfo>({
    lastUpdated: null,
    isStale: true,
    freshnessCutoff: 60
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!user?.corporationId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await service.getAssets(user.corporationId);
      setData(result.data);
      setFreshness(result.freshness);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
      console.error('Error loading assets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [user?.corporationId]);

  return { data, freshness, loading, error, refresh };
}

export function useManufacturingJobs() {
  const { user } = useAuth();
  const service = useRetrievalService();
  const [data, setData] = useState<ManufacturingJob[]>([]);
  const [freshness, setFreshness] = useState<DataFreshnessInfo>({
    lastUpdated: null,
    isStale: true,
    freshnessCutoff: 30
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!user?.corporationId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await service.getManufacturingJobs(user.corporationId);
      setData(result.data);
      setFreshness(result.freshness);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manufacturing jobs');
      console.error('Error loading manufacturing jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [user?.corporationId]);

  return { data, freshness, loading, error, refresh };
}

export function useMarketOrders() {
  const { user } = useAuth();
  const service = useRetrievalService();
  const [data, setData] = useState<any[]>([]);
  const [freshness, setFreshness] = useState<DataFreshnessInfo>({
    lastUpdated: null,
    isStale: true,
    freshnessCutoff: 60
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!user?.corporationId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await service.getMarketOrders(user.corporationId);
      setData(result.data);
      setFreshness(result.freshness);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load market orders');
      console.error('Error loading market orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [user?.corporationId]);

  return { data, freshness, loading, error, refresh };
}

export function useWalletTransactions(division: number = 1) {
  const { user } = useAuth();
  const service = useRetrievalService();
  const [data, setData] = useState<any[]>([]);
  const [freshness, setFreshness] = useState<DataFreshnessInfo>({
    lastUpdated: null,
    isStale: true,
    freshnessCutoff: 30
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!user?.corporationId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await service.getWalletTransactions(user.corporationId, division);
      setData(result.data);
      setFreshness(result.freshness);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallet transactions');
      console.error('Error loading wallet transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [user?.corporationId, division]);

  return { data, freshness, loading, error, refresh };
}

export function useMiningLedger() {
  const { user } = useAuth();
  const service = useRetrievalService();
  const [data, setData] = useState<MiningOperation[]>([]);
  const [freshness, setFreshness] = useState<DataFreshnessInfo>({
    lastUpdated: null,
    isStale: true,
    freshnessCutoff: 240
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!user?.corporationId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await service.getMiningLedger(user.corporationId);
      setData(result.data);
      setFreshness(result.freshness);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mining ledger');
      console.error('Error loading mining ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [user?.corporationId]);

  return { data, freshness, loading, error, refresh };
}

export function useDashboardStats() {
  const { user } = useAuth();
  const service = useRetrievalService();
  const [data, setData] = useState<DashboardStats>({
    totalMembers: 0,
    activeMembers: 0,
    totalAssets: 0,
    totalAssetValue: 0,
    activeManufacturingJobs: 0,
    completedJobs: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    monthlyProfit: 0,
    efficiency: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!user?.corporationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const stats = await service.getDashboardStats(user.corporationId);
      setData(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard stats');
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [user?.corporationId]);

  return { data, loading, error, refresh };
}

export function useDataFreshness() {
  const { user } = useAuth();
  const service = useRetrievalService();
  const [freshness, setFreshness] = useState<Record<string, DataFreshnessInfo>>({});
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user?.corporationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      const result = await service.getDataFreshness(user.corporationId);
      setFreshness(result);
    } catch (err) {
      console.error('Error loading data freshness:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    
    const interval = setInterval(refresh, 60000);
    
    return () => clearInterval(interval);
  }, [user?.corporationId]);

  return { freshness, loading, refresh };
}
