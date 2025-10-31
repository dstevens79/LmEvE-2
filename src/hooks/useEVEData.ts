import { useState, useEffect, useCallback } from 'react';
import { useKV } from '@/lib/kv';
import { eveApi, type IndustryJob, type ESIBlueprint, type AssetItem, type MarketPrice } from '@/lib/eveApi';
import { toast } from 'sonner';

interface EVEDataState {
  industryJobs: IndustryJob[];
  blueprints: ESIBlueprint[];
  assets: AssetItem[];
  marketPrices: MarketPrice[];
  lastUpdate: string | null;
  isLoading: boolean;
  error: string | null;
}

interface EVEDataHook {
  data: EVEDataState;
  refreshData: () => Promise<void>;
  refreshIndustryJobs: () => Promise<void>;
  refreshBlueprints: () => Promise<void>;
  refreshAssets: () => Promise<void>;
  refreshMarketPrices: () => Promise<void>;
  clearCache: () => void;
}

export function useEVEData(corporationId?: number, accessToken?: string): EVEDataHook {
  const [data, setData] = useKV<EVEDataState>('eve-data', {
    industryJobs: [],
    blueprints: [],
    assets: [],
    marketPrices: [],
    lastUpdate: null,
    isLoading: false,
    error: null
  });

  const updateData = useCallback((updates: Partial<EVEDataState>) => {
    setData(current => ({
      ...current,
      ...updates,
      lastUpdate: new Date().toISOString()
    }));
  }, [setData]);

  const refreshIndustryJobs = useCallback(async () => {
    if (!corporationId) return;

    try {
      updateData({ isLoading: true, error: null });
      
      const jobs = await eveApi.getCorporationIndustryJobs(corporationId, accessToken);
      
      updateData({ 
        industryJobs: jobs,
        isLoading: false 
      });

      toast.success('Industry jobs updated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch industry jobs';
      updateData({ 
        error: errorMessage,
        isLoading: false 
      });
      toast.error(errorMessage);
    }
  }, [corporationId, accessToken, updateData]);

  const refreshBlueprints = useCallback(async () => {
    if (!corporationId) return;

    try {
      updateData({ isLoading: true, error: null });
      
      const blueprints = await eveApi.getCorporationBlueprints(corporationId, accessToken);
      
      updateData({ 
        blueprints,
        isLoading: false 
      });

      toast.success('Blueprints updated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch blueprints';
      updateData({ 
        error: errorMessage,
        isLoading: false 
      });
      toast.error(errorMessage);
    }
  }, [corporationId, accessToken, updateData]);

  const refreshAssets = useCallback(async () => {
    if (!corporationId) return;

    try {
      updateData({ isLoading: true, error: null });
      
      const assets = await eveApi.getCorporationAssets(corporationId, accessToken);
      
      updateData({ 
        assets,
        isLoading: false 
      });

      toast.success('Assets updated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch assets';
      updateData({ 
        error: errorMessage,
        isLoading: false 
      });
      toast.error(errorMessage);
    }
  }, [corporationId, accessToken, updateData]);

  const refreshMarketPrices = useCallback(async () => {
    try {
      updateData({ isLoading: true, error: null });
      
      const prices = await eveApi.getMarketPrices();
      
      updateData({ 
        marketPrices: prices,
        isLoading: false 
      });

      toast.success('Market prices updated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch market prices';
      updateData({ 
        error: errorMessage,
        isLoading: false 
      });
      toast.error(errorMessage);
    }
  }, [updateData]);

  const refreshData = useCallback(async () => {
    if (!corporationId) {
      toast.error('Corporation ID not configured');
      return;
    }

    if (!accessToken) {
      toast.error('Authentication token required for ESI calls');
      return;
    }

    updateData({ isLoading: true, error: null });

    try {
      await Promise.allSettled([
        refreshIndustryJobs(),
        refreshBlueprints(),
        refreshAssets(),
        refreshMarketPrices()
      ]);

      updateData({ isLoading: false });
      toast.success('All EVE Online data refreshed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh data';
      updateData({ 
        error: errorMessage,
        isLoading: false 
      });
      toast.error(errorMessage);
    }
  }, [corporationId, accessToken, refreshIndustryJobs, refreshBlueprints, refreshAssets, refreshMarketPrices, updateData]);

  const clearCache = useCallback(() => {
    eveApi.clearCache();
    setData({
      industryJobs: [],
      blueprints: [],
      assets: [],
      marketPrices: [],
      lastUpdate: null,
      isLoading: false,
      error: null
    });
    toast.success('EVE Online cache cleared');
  }, [setData]);

  return {
    data,
    refreshData,
    refreshIndustryJobs,
    refreshBlueprints,
    refreshAssets,
    refreshMarketPrices,
    clearCache
  };
}

// Helper hook for getting current market prices for specific items
export function useMarketPrices(typeIds: number[]) {
  const [prices, setPrices] = useKV<Record<number, MarketPrice>>('market-prices-cache', {});
  const [loading, setLoading] = useState(false);

  const fetchPrices = useCallback(async () => {
    if (typeIds.length === 0) return;

    setLoading(true);
    try {
      const allPrices = await eveApi.getMarketPrices();
      const priceMap: Record<number, MarketPrice> = {};
      
      allPrices.forEach(price => {
        if (typeIds.includes(price.type_id)) {
          priceMap[price.type_id] = price;
        }
      });

      setPrices(current => ({ ...current, ...priceMap }));
    } catch (error) {
      console.error('Failed to fetch market prices:', error);
    } finally {
      setLoading(false);
    }
  }, [typeIds, setPrices]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  return {
    prices,
    loading,
    refresh: fetchPrices
  };
}

// Helper hook for resolving type names
export function useTypeNames(typeIds: number[]) {
  const [names, setNames] = useKV<Record<number, string>>('type-names-cache', {});
  const [loading, setLoading] = useState(false);

  const fetchNames = useCallback(async () => {
    if (typeIds.length === 0) return;

    // Filter out type IDs we already have names for
    const missingIds = typeIds.filter(id => !names[id]);
    if (missingIds.length === 0) return;

    setLoading(true);
    try {
      const typeNames = await eveApi.getTypeNames(missingIds);
      const nameMap: Record<number, string> = {};
      
      typeNames.forEach(item => {
        nameMap[item.type_id] = item.type_name;
      });

      setNames(current => ({ ...current, ...nameMap }));
    } catch (error) {
      console.error('Failed to fetch type names:', error);
    } finally {
      setLoading(false);
    }
  }, [typeIds, names, setNames]);

  useEffect(() => {
    fetchNames();
  }, [fetchNames]);

  return {
    names,
    loading,
    refresh: fetchNames
  };
}