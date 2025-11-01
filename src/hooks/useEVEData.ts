import { useState, useEffect, useCallback } from 'react';
import { useKV } from '@/lib/kv';
import type { IndustryJob, ESIBlueprint, AssetItem, MarketPrice } from '@/lib/eveApi';
import { fetchResource, clearResourceCache } from '@/lib/tabDataService';
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

// Note: corporationId and accessToken are currently unused; kept for compatibility.
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
    try {
      updateData({ isLoading: true, error: null });
      const jobs = await fetchResource<IndustryJob[]>('industry_jobs', corporationId ? { corporationId } : undefined);
      updateData({ industryJobs: jobs, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch industry jobs';
      updateData({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
    }
  }, [corporationId, updateData]);

  const refreshBlueprints = useCallback(async () => {
    try {
      updateData({ isLoading: true, error: null });
      const blueprints = await fetchResource<ESIBlueprint[]>('blueprints', corporationId ? { corporationId } : undefined);
      updateData({ blueprints, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch blueprints';
      updateData({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
    }
  }, [corporationId, updateData]);

  const refreshAssets = useCallback(async () => {
    try {
      updateData({ isLoading: true, error: null });
      const assets = await fetchResource<AssetItem[]>('assets', corporationId ? { corporationId } : undefined);
      updateData({ assets, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch assets';
      updateData({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
    }
  }, [corporationId, updateData]);

  const refreshMarketPrices = useCallback(async () => {
    try {
      updateData({ isLoading: true, error: null });
      const prices = await fetchResource<MarketPrice[]>('market_prices');
      updateData({ marketPrices: prices, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch market prices';
      updateData({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
    }
  }, [updateData]);

  const refreshData = useCallback(async () => {
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
  clearResourceCache();
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
      const allPrices = await fetchResource<MarketPrice[]>('market_prices');
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
      const params = new URLSearchParams({ ids: missingIds.join(',') });
      const resp = await fetch(`/api/names.php?${params.toString()}`, { headers: { 'Accept': 'application/json' } });
      const typeNames = await resp.json() as Array<{ type_id: number; type_name: string }>;
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