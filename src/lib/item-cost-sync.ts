import { fetchESI } from './eveApi';

export interface ItemCost {
  typeId: number;
  typeName: string;
  buyPrice: number;
  sellPrice: number;
  averagePrice: number;
  lastUpdated: string;
  stationId?: number;
  stationName?: string;
  source: 'esi' | 'database' | 'manual';
}

export interface MarketOrderStats {
  highestBuy: number;
  lowestSell: number;
  volume: number;
  orderCount: number;
}

export interface ItemCostSyncOptions {
  stationId: number;
  typeIds: number[];
  accessToken?: string;
  useCache?: boolean;
}

export interface ItemCostSyncResult {
  success: boolean;
  costs: ItemCost[];
  errors: string[];
  cached?: boolean;
}

const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const MARKET_CACHE_DURATION = 60 * 60 * 1000;

export class ItemCostSyncService {
  private priceCache: Map<string, { data: ItemCost; timestamp: number }> = new Map();
  private stationCache: Map<number, string> = new Map();

  async getStationName(stationId: number): Promise<string> {
    if (this.stationCache.has(stationId)) {
      return this.stationCache.get(stationId)!;
    }

    try {
      const response = await fetch(`${ESI_BASE_URL}/universe/stations/${stationId}/`);
      if (!response.ok) {
        return `Station ${stationId}`;
      }
      const data = await response.json();
      const name = data.name || `Station ${stationId}`;
      this.stationCache.set(stationId, name);
      return name;
    } catch (error) {
      console.error(`Failed to fetch station name for ${stationId}:`, error);
      return `Station ${stationId}`;
    }
  }

  async getRegionIdForStation(stationId: number): Promise<number | null> {
    try {
      const response = await fetch(`${ESI_BASE_URL}/universe/stations/${stationId}/`);
      if (!response.ok) return null;
      const data = await response.json();
      
      if (data.system_id) {
        const systemResponse = await fetch(`${ESI_BASE_URL}/universe/systems/${data.system_id}/`);
        if (!systemResponse.ok) return null;
        const systemData = await systemResponse.json();
        return systemData.constellation_id ? await this.getRegionFromConstellation(systemData.constellation_id) : null;
      }
      return null;
    } catch (error) {
      console.error(`Failed to get region for station ${stationId}:`, error);
      return null;
    }
  }

  private async getRegionFromConstellation(constellationId: number): Promise<number | null> {
    try {
      const response = await fetch(`${ESI_BASE_URL}/universe/constellations/${constellationId}/`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.region_id || null;
    } catch (error) {
      return null;
    }
  }

  async fetchMarketOrders(
    regionId: number,
    typeId: number,
    orderType: 'buy' | 'sell' | 'all' = 'all'
  ): Promise<MarketOrderStats | null> {
    try {
      const url = `${ESI_BASE_URL}/markets/${regionId}/orders/?order_type=${orderType}&type_id=${typeId}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Market orders fetch failed: ${response.status}`);
      }

      const orders = await response.json();
      
      if (!Array.isArray(orders) || orders.length === 0) {
        return null;
      }

      const buyOrders = orders.filter((o: any) => o.is_buy_order === true);
      const sellOrders = orders.filter((o: any) => o.is_buy_order === false);

      const highestBuy = buyOrders.length > 0
        ? Math.max(...buyOrders.map((o: any) => o.price))
        : 0;

      const lowestSell = sellOrders.length > 0
        ? Math.min(...sellOrders.map((o: any) => o.price))
        : 0;

      const totalVolume = orders.reduce((sum: number, o: any) => sum + (o.volume_remain || 0), 0);

      return {
        highestBuy,
        lowestSell,
        volume: totalVolume,
        orderCount: orders.length
      };
    } catch (error) {
      console.error(`Failed to fetch market orders for type ${typeId}:`, error);
      return null;
    }
  }

  async syncItemCost(
    typeId: number,
    typeName: string,
    stationId: number,
    useCache: boolean = true
  ): Promise<ItemCost | null> {
    const cacheKey = `${typeId}-${stationId}`;
    
    if (useCache && this.priceCache.has(cacheKey)) {
      const cached = this.priceCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < MARKET_CACHE_DURATION) {
        console.log(`📦 Using cached price for ${typeName} (${typeId})`);
        return cached.data;
      }
    }

    try {
      const regionId = await this.getRegionIdForStation(stationId);
      if (!regionId) {
        console.warn(`Could not determine region for station ${stationId}`);
        return null;
      }

      const stationName = await this.getStationName(stationId);
      const marketStats = await this.fetchMarketOrders(regionId, typeId, 'all');

      if (!marketStats) {
        console.warn(`No market data found for ${typeName} (${typeId}) in region ${regionId}`);
        return null;
      }

      const itemCost: ItemCost = {
        typeId,
        typeName,
        buyPrice: marketStats.highestBuy,
        sellPrice: marketStats.lowestSell,
        averagePrice: marketStats.highestBuy > 0 && marketStats.lowestSell > 0
          ? (marketStats.highestBuy + marketStats.lowestSell) / 2
          : marketStats.highestBuy || marketStats.lowestSell,
        lastUpdated: new Date().toISOString(),
        stationId,
        stationName,
        source: 'esi'
      };

      this.priceCache.set(cacheKey, { data: itemCost, timestamp: Date.now() });
      
      console.log(`✅ Synced price for ${typeName}: Buy ${marketStats.highestBuy.toFixed(2)} ISK, Sell ${marketStats.lowestSell.toFixed(2)} ISK`);
      
      return itemCost;
    } catch (error) {
      console.error(`Failed to sync cost for ${typeName} (${typeId}):`, error);
      return null;
    }
  }

  async syncItemCosts(options: ItemCostSyncOptions): Promise<ItemCostSyncResult> {
    const { stationId, typeIds, useCache = true } = options;
    const costs: ItemCost[] = [];
    const errors: string[] = [];

    console.log(`🔄 Starting item cost sync for ${typeIds.length} items at station ${stationId}`);

    for (const typeId of typeIds) {
      try {
        const cost = await this.syncItemCost(typeId, `Type ${typeId}`, stationId, useCache);
        if (cost) {
          costs.push(cost);
        } else {
          errors.push(`No market data for type ${typeId}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to sync type ${typeId}: ${errorMsg}`);
      }
    }

    console.log(`✅ Item cost sync completed: ${costs.length} successful, ${errors.length} errors`);

    return {
      success: costs.length > 0,
      costs,
      errors,
      cached: useCache
    };
  }

  async syncItemCostWithName(
    typeId: number,
    typeName: string,
    stationId: number,
    useCache: boolean = true
  ): Promise<ItemCost | null> {
    return this.syncItemCost(typeId, typeName, stationId, useCache);
  }

  clearCache() {
    this.priceCache.clear();
    console.log('🗑️ Item cost cache cleared');
  }

  getCacheStats() {
    return {
      size: this.priceCache.size,
      items: Array.from(this.priceCache.entries()).map(([key, value]) => ({
        key,
        age: Date.now() - value.timestamp,
        typeId: value.data.typeId,
        typeName: value.data.typeName
      }))
    };
  }
}

export const itemCostSyncService = new ItemCostSyncService();

export const KNOWN_TRADE_HUBS: { [key: string]: number } = {
  'Jita IV - Moon 4 - Caldari Navy Assembly Plant': 60003760,
  'Amarr VIII (Oris) - Emperor Family Academy': 60008494,
  'Dodixie IX - Moon 20 - Federation Navy Assembly Plant': 60011866,
  'Rens VI - Moon 8 - Brutor Tribe Treasury': 60004588,
  'Hek VIII - Moon 12 - Boundless Creation Factory': 60005686
};

export function getStationIdByName(stationName: string): number | null {
  return KNOWN_TRADE_HUBS[stationName] || null;
}

export function getStationNameById(stationId: number): string | null {
  const entry = Object.entries(KNOWN_TRADE_HUBS).find(([_, id]) => id === stationId);
  return entry ? entry[0] : null;
}
