// Corporation Projects ESI Service
// Handles scanning corporation hangars for deliveries and tracking project progress

import { toast } from 'sonner';

export interface ESIAsset {
  itemId: number;
  typeId: number;
  locationId: number;
  locationFlag: string;
  locationFlagId: number;
  quantity: number;
  isSingleton: boolean;
  isBlueprintCopy?: boolean;
}

export interface ESIContainerLog {
  loggedAt: string;
  characterId: number;
  locationId: number;
  locationFlag: string;
  action: 'add' | 'remove' | 'configure' | 'lock' | 'unlock' | 'password_configure' | 'password_check';
  typeId: number;
  quantity: number;
  newConfiguration?: number;
  oldConfiguration?: number;
  passwordType?: string;
}

export interface HangarDelivery {
  typeId: number;
  quantity: number;
  characterId: number;
  timestamp: string;
  locationId: number;
  locationFlag: string;
  verified: boolean;
}

export class ProjectsESIService {
  private baseUrl = 'https://esi.evetech.net/latest';
  private accessToken: string | null = null;
  private corporationId: number | null = null;

  constructor(accessToken?: string, corporationId?: number) {
    this.accessToken = accessToken || null;
    this.corporationId = corporationId || null;
  }

  setCredentials(accessToken: string, corporationId: number) {
    this.accessToken = accessToken;
    this.corporationId = corporationId;
  }

  private async fetchESI<T>(endpoint: string, scopes?: string[]): Promise<T | null> {
    if (!this.accessToken) {
      console.warn('No access token available for ESI request');
      return null;
    }

    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`📡 ESI Request: ${url}`);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`ESI request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      console.error('ESI request failed:', error);
      return null;
    }
  }

  async getCorporationAssets(): Promise<ESIAsset[]> {
    if (!this.corporationId) {
      console.warn('Corporation ID not set');
      return [];
    }

    const assets = await this.fetchESI<ESIAsset[]>(
      `/corporations/${this.corporationId}/assets/`,
      ['esi-assets.read_corporation_assets.v1']
    );

    return assets || [];
  }

  async getHangarAssets(hangarDivision: number): Promise<ESIAsset[]> {
    const allAssets = await this.getCorporationAssets();
    
    const hangarFlagName = `CorpSAG${hangarDivision}`;
    
    return allAssets.filter(asset => 
      asset.locationFlag === hangarFlagName || 
      asset.locationFlag === 'CorpDeliveries'
    );
  }

  async getContainerLogs(since?: Date): Promise<ESIContainerLog[]> {
    if (!this.corporationId) {
      console.warn('Corporation ID not set');
      return [];
    }

    const logs = await this.fetchESI<ESIContainerLog[]>(
      `/corporations/${this.corporationId}/containers/logs/`,
      ['esi-corporations.read_container_logs.v1']
    );

    if (!logs) return [];

    if (since) {
      return logs.filter(log => new Date(log.loggedAt) >= since);
    }

    return logs;
  }

  async scanHangarForDeliveries(
    hangarDivision: number,
    requiredTypeIds: number[],
    sinceDate?: Date
  ): Promise<HangarDelivery[]> {
    console.log(`🔍 Scanning hangar ${hangarDivision} for deliveries...`);
    
    const logs = await this.getContainerLogs(sinceDate);
    
    const deliveryLogs = logs.filter(log => 
      log.action === 'add' &&
      log.locationFlag === `CorpSAG${hangarDivision}` &&
      requiredTypeIds.includes(log.typeId)
    );

    const deliveries: HangarDelivery[] = deliveryLogs.map(log => ({
      typeId: log.typeId,
      quantity: log.quantity,
      characterId: log.characterId,
      timestamp: log.loggedAt,
      locationId: log.locationId,
      locationFlag: log.locationFlag,
      verified: true
    }));

    console.log(`✅ Found ${deliveries.length} deliveries in hangar ${hangarDivision}`);
    
    return deliveries;
  }

  async matchDeliveriesToRequirements(
    hangarDivision: number,
    requirements: { typeId: number; quantityRequired: number; quantityDelivered: number }[],
    sinceDate?: Date
  ): Promise<Map<number, number>> {
    const requiredTypeIds = requirements.map(req => req.typeId);
    const deliveries = await this.scanHangarForDeliveries(hangarDivision, requiredTypeIds, sinceDate);
    
    const deliveryTotals = new Map<number, number>();
    
    deliveries.forEach(delivery => {
      const current = deliveryTotals.get(delivery.typeId) || 0;
      deliveryTotals.set(delivery.typeId, current + delivery.quantity);
    });

    return deliveryTotals;
  }

  async getCorporationDivisions(): Promise<{ hangar?: { name: string; division: number }[] }> {
    if (!this.corporationId) {
      console.warn('Corporation ID not set');
      return {};
    }

    const divisions = await this.fetchESI<any>(
      `/corporations/${this.corporationId}/divisions/`,
      ['esi-corporations.read_divisions.v1']
    );

    return divisions || {};
  }

  async getItemNames(typeIds: number[]): Promise<Map<number, string>> {
    const names = new Map<number, string>();
    
    try {
      const response = await fetch(`https://esi.evetech.net/latest/universe/names/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(typeIds),
      });

      if (response.ok) {
        const data = await response.json();
        data.forEach((item: { id: number; name: string }) => {
          names.set(item.id, item.name);
        });
      }
    } catch (error) {
      console.error('Failed to fetch item names:', error);
    }

    return names;
  }

  async verifyDelivery(
    typeId: number,
    quantity: number,
    characterId: number,
    hangarDivision: number,
    timeWindow: { start: Date; end: Date }
  ): Promise<boolean> {
    const logs = await this.getContainerLogs(timeWindow.start);
    
    const matchingLog = logs.find(log => 
      log.typeId === typeId &&
      log.quantity === quantity &&
      log.characterId === characterId &&
      log.locationFlag === `CorpSAG${hangarDivision}` &&
      log.action === 'add' &&
      new Date(log.loggedAt) >= timeWindow.start &&
      new Date(log.loggedAt) <= timeWindow.end
    );

    return !!matchingLog;
  }

  async getCurrentHangarContents(hangarDivision: number): Promise<Map<number, number>> {
    const assets = await this.getHangarAssets(hangarDivision);
    
    const contents = new Map<number, number>();
    
    assets.forEach(asset => {
      const current = contents.get(asset.typeId) || 0;
      contents.set(asset.typeId, current + asset.quantity);
    });

    return contents;
  }

  simulateDeliveryScan(
    requirements: { typeId: number; quantityRequired: number; quantityDelivered: number }[],
    hangarDivision: number
  ): HangarDelivery[] {
    const deliveries: HangarDelivery[] = [];
    
    requirements.forEach(req => {
      if (req.quantityDelivered < req.quantityRequired && Math.random() > 0.3) {
        const remaining = req.quantityRequired - req.quantityDelivered;
        const deliveryAmount = Math.floor(Math.random() * remaining * 0.5) + 1;
        
        deliveries.push({
          typeId: req.typeId,
          quantity: deliveryAmount,
          characterId: 91000000 + Math.floor(Math.random() * 1000000),
          timestamp: new Date().toISOString(),
          locationId: 60003760,
          locationFlag: `CorpSAG${hangarDivision}`,
          verified: true
        });
      }
    });

    return deliveries;
  }
}

export const projectsESIService = new ProjectsESIService();

export const useProjectsESI = () => {
  return {
    scanHangarForDeliveries: (
      hangarDivision: number,
      requiredTypeIds: number[],
      sinceDate?: Date
    ) => projectsESIService.scanHangarForDeliveries(hangarDivision, requiredTypeIds, sinceDate),
    
    matchDeliveriesToRequirements: (
      hangarDivision: number,
      requirements: { typeId: number; quantityRequired: number; quantityDelivered: number }[],
      sinceDate?: Date
    ) => projectsESIService.matchDeliveriesToRequirements(hangarDivision, requirements, sinceDate),
    
    verifyDelivery: (
      typeId: number,
      quantity: number,
      characterId: number,
      hangarDivision: number,
      timeWindow: { start: Date; end: Date }
    ) => projectsESIService.verifyDelivery(typeId, quantity, characterId, hangarDivision, timeWindow),
    
    getCurrentHangarContents: (hangarDivision: number) => 
      projectsESIService.getCurrentHangarContents(hangarDivision),
    
    simulateDeliveryScan: (
      requirements: { typeId: number; quantityRequired: number; quantityDelivered: number }[],
      hangarDivision: number
    ) => projectsESIService.simulateDeliveryScan(requirements, hangarDivision),
    
    setCredentials: (accessToken: string, corporationId: number) =>
      projectsESIService.setCredentials(accessToken, corporationId)
  };
};
