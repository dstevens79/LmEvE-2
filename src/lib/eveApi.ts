// EVE Online ESI API Integration
// Documentation: https://esi.evetech.net/ui/

interface ESIResponse<T> {
  data: T;
  expires?: string;
  etag?: string;
  lastModified?: string;
  pages?: number;
}

interface ESIError {
  error: string;
  error_description?: string;
  timeout?: number;
}

interface CharacterInfo {
  alliance_id?: number;
  ancestry_id?: number;
  birthday: string;
  bloodline_id: number;
  corporation_id: number;
  description?: string;
  faction_id?: number;
  gender: string;
  name: string;
  race_id: number;
  security_status?: number;
  title?: string;
}

interface CorporationInfo {
  alliance_id?: number;
  ceo_id: number;
  creator_id: number;
  date_founded?: string;
  description?: string;
  faction_id?: number;
  home_station_id?: number;
  member_count: number;
  name: string;
  shares?: number;
  tax_rate: number;
  ticker: string;
  url?: string;
  war_eligible?: boolean;
}

interface IndustryJob {
  activity_id: number;
  blueprint_id: number;
  blueprint_location_id: number;
  blueprint_type_id: number;
  completed_character_id?: number;
  completed_date?: string;
  cost?: number;
  duration: number;
  end_date: string;
  facility_id: number;
  installer_id: number;
  job_id: number;
  licensed_runs?: number;
  output_location_id: number;
  pause_date?: string;
  probability?: number;
  product_type_id?: number;
  runs: number;
  start_date: string;
  station_id: number;
  status: string;
  successful_runs?: number;
}

interface Blueprint {
  item_id: number;
  location_flag: string;
  location_id: number;
  material_efficiency: number;
  quantity: number;
  runs: number;
  time_efficiency: number;
  type_id: number;
}

interface AssetItem {
  is_singleton: boolean;
  item_id: number;
  location_flag: string;
  location_id: number;
  location_type: string;
  quantity: number;
  type_id: number;
}

interface MarketPrice {
  adjusted_price?: number;
  average_price?: number;
  type_id: number;
}

interface MarketOrder {
  duration: number;
  is_buy_order: boolean;
  issued: string;
  location_id: number;
  min_volume: number;
  order_id: number;
  price: number;
  range: string;
  region_id: number;
  type_id: number;
  volume_remain: number;
  volume_total: number;
}

class EVEApi {
  private baseUrl = 'https://esi.evetech.net/latest';
  private userAgent = 'LMeve Corporation Management Tool';
  
  private cache = new Map<string, { data: any; expires: number }>();

  constructor() {
    // Initialize with default settings
  }

  /**
   * Generic ESI API call with caching and error handling
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    cacheDuration = 300000 // 5 minutes default cache
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = url + JSON.stringify(options);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData: ESIError = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`
        }));
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      const data = await response.json();
      
      // Cache the response
      this.cache.set(cacheKey, {
        data,
        expires: Date.now() + cacheDuration
      });

      return data;
    } catch (error) {
      console.error(`EVE API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Get character information by character ID
   */
  async getCharacter(characterId: number): Promise<CharacterInfo> {
    return this.makeRequest<CharacterInfo>(`/characters/${characterId}/`);
  }

  /**
   * Get corporation information by corporation ID
   */
  async getCorporation(corporationId: number): Promise<CorporationInfo> {
    return this.makeRequest<CorporationInfo>(`/corporations/${corporationId}/`);
  }

  /**
   * Get corporation members (requires authentication)
   */
  async getCorporationMembers(corporationId: number, token?: string): Promise<number[]> {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    return this.makeRequest<number[]>(
      `/corporations/${corporationId}/members/`,
      { headers },
      300000 // 5 minute cache for members
    );
  }

  /**
   * Get corporation industry jobs (requires authentication)
   * Note: This would require proper OAuth implementation in production
   */
  async getCorporationIndustryJobs(corporationId: number, token?: string): Promise<IndustryJob[]> {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    return this.makeRequest<IndustryJob[]>(
      `/corporations/${corporationId}/industry/jobs/`,
      { headers },
      60000 // 1 minute cache for industry jobs
    );
  }

  /**
   * Get corporation blueprints (requires authentication)
   */
  async getCorporationBlueprints(corporationId: number, token?: string): Promise<Blueprint[]> {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    return this.makeRequest<Blueprint[]>(
      `/corporations/${corporationId}/blueprints/`,
      { headers },
      300000 // 5 minute cache for blueprints
    );
  }

  /**
   * Get corporation assets (requires authentication)
   */
  async getCorporationAssets(corporationId: number, token?: string): Promise<AssetItem[]> {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    return this.makeRequest<AssetItem[]>(
      `/corporations/${corporationId}/assets/`,
      { headers },
      300000 // 5 minute cache for assets
    );
  }

  /**
   * Get market prices for all items
   */
  async getMarketPrices(): Promise<MarketPrice[]> {
    return this.makeRequest<MarketPrice[]>(
      '/markets/prices/',
      {},
      3600000 // 1 hour cache for market prices
    );
  }

  /**
   * Get market orders for a region and type
   */
  async getMarketOrders(regionId: number, typeId?: number): Promise<MarketOrder[]> {
    const endpoint = typeId 
      ? `/markets/${regionId}/orders/?type_id=${typeId}`
      : `/markets/${regionId}/orders/`;
      
    return this.makeRequest<MarketOrder[]>(
      endpoint,
      {},
      600000 // 10 minute cache for market orders
    );
  }

  /**
   * Get type information by type ID
   */
  async getType(typeId: number): Promise<{ name: string; description?: string; group_id: number; published: boolean }> {
    return this.makeRequest<{ name: string; description?: string; group_id: number; published: boolean }>(
      `/universe/types/${typeId}/`,
      {},
      86400000 // 24 hour cache for type info
    );
  }

  /**
   * Get system information by system ID
   */
  async getSystem(systemId: number): Promise<{ name: string; security_status: number; star_id?: number }> {
    return this.makeRequest<{ name: string; security_status: number; star_id?: number }>(
      `/universe/systems/${systemId}/`,
      {},
      86400000 // 24 hour cache for system info
    );
  }

  /**
   * Get station information by station ID
   */
  async getStation(stationId: number): Promise<{ name: string; system_id: number; type_id: number }> {
    return this.makeRequest<{ name: string; system_id: number; type_id: number }>(
      `/universe/stations/${stationId}/`,
      {},
      86400000 // 24 hour cache for station info
    );
  }

  /**
   * Get structure information by structure ID (requires authentication)
   */
  async getStructure(structureId: number, token?: string): Promise<{ name: string; solar_system_id: number; type_id?: number }> {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    return this.makeRequest<{ name: string; solar_system_id: number; type_id?: number }>(
      `/universe/structures/${structureId}/`,
      { headers },
      86400000 // 24 hour cache for structure info
    );
  }

  /**
   * Resolve location name (station or structure) - handles both NPC stations and player structures
   */
  async getLocationName(locationId: number, token?: string): Promise<string> {
    try {
      if (locationId >= 60000000 && locationId < 64000000) {
        const station = await this.getStation(locationId);
        return station.name;
      } else if (locationId > 1000000000000) {
        if (!token) {
          return `Structure ${locationId}`;
        }
        try {
          const structure = await this.getStructure(locationId, token);
          return structure.name;
        } catch {
          return `Structure ${locationId}`;
        }
      } else {
        return `Unknown Location ${locationId}`;
      }
    } catch (error) {
      console.error(`Failed to resolve location ${locationId}:`, error);
      return `Location ${locationId}`;
    }
  }

  /**
   * Search for items by name
   */
  async search(query: string, categories: string[] = ['inventory_type']): Promise<{ inventory_type?: number[] }> {
    const categoriesParam = categories.join(',');
    return this.makeRequest<{ inventory_type?: number[] }>(
      `/search/?search=${encodeURIComponent(query)}&categories=${categoriesParam}&strict=false`,
      {},
      600000 // 10 minute cache for searches
    );
  }

  /**
   * Batch get names for multiple IDs (types, characters, corporations, stations, etc.)
   */
  async getNames(ids: number[]): Promise<Array<{ id: number; name: string; category: string }>> {
    if (ids.length === 0) return [];
    
    // ESI limits batch requests to 1000 IDs
    const chunks = [];
    for (let i = 0; i < ids.length; i += 1000) {
      chunks.push(ids.slice(i, i + 1000));
    }
    
    const results = await Promise.all(
      chunks.map(chunk =>
        this.makeRequest<Array<{ id: number; name: string; category: string }>>(
          '/universe/names/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(chunk),
          },
          3600000 // 1 hour cache for names
        )
      )
    );
    
    return results.flat();
  }

  /**
   * Batch get type names for multiple type IDs (convenience wrapper)
   */
  async getTypeNames(typeIds: number[]): Promise<Array<{ type_id: number; type_name: string }>> {
    if (typeIds.length === 0) return [];
    
    const names = await this.getNames(typeIds);
    return names.map(n => ({ type_id: n.id, type_name: n.name }));
  }

  /**
   * Clear the API cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Create a singleton instance
export const eveApi = new EVEApi();

// Helper functions for common operations
export const formatISK = (amount: number): string => {
  if (amount >= 1e12) return `${(amount / 1e12).toFixed(2)}T ISK`;
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B ISK`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M ISK`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(0)}K ISK`;
  return `${Math.round(amount)} ISK`;
};

export const getSecurityColor = (securityStatus: number): string => {
  if (securityStatus >= 0.5) return 'text-green-400';
  if (securityStatus >= 0.1) return 'text-yellow-400';
  return 'text-red-400';
};

export const getSecurityClass = (securityStatus: number): string => {
  if (securityStatus >= 0.5) return 'highsec';
  if (securityStatus >= 0.0) return 'lowsec';
  return 'nullsec';
};

// Export types for use in components
export type {
  CharacterInfo,
  CorporationInfo,
  IndustryJob,
  Blueprint as ESIBlueprint,
  AssetItem,
  MarketPrice,
  MarketOrder,
  ESIResponse,
  ESIError
};