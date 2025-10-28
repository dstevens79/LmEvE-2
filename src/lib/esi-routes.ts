// ESI Route Management Service
// Provides dynamic ESI version selection and validation for LMeve data sync processes

import { toast } from 'sonner';

export interface ESIRoute {
  path: string;
  versions: string[];
  currentVersion: string;
  description: string;
  scopes?: string[];
}

export interface ESIRouteConfig {
  [processName: string]: ESIRoute;
}

// Default ESI route configurations based on LMeve processes
export const DEFAULT_ESI_ROUTES: ESIRouteConfig = {
  members: {
    path: '/corporations/{corporation_id}/membertracking/',
    versions: ['v3', 'v4'],
    currentVersion: 'v4',
    description: 'Corporation member tracking data',
    scopes: ['esi-corporations.read_corporation_membership.v1']
  },
  assets: {
    path: '/corporations/{corporation_id}/assets/',
    versions: ['v3', 'v4', 'v5'],
    currentVersion: 'v5',
    description: 'Corporation assets and locations',
    scopes: ['esi-assets.read_corporation_assets.v1']
  },
  manufacturing: {
    path: '/corporations/{corporation_id}/industry/jobs/',
    versions: ['v1'],
    currentVersion: 'v1',
    description: 'Industry jobs (manufacturing, research, reactions) - tracks job start/progress/completion automatically',
    scopes: ['esi-industry.read_corporation_jobs.v1']
  },
  mining: {
    path: '/corporations/{corporation_id}/mining/',
    versions: ['v1'],
    currentVersion: 'v1',
    description: 'Mining ledger data',
    scopes: ['esi-industry.read_corporation_mining.v1']
  },
  market: {
    path: '/corporations/{corporation_id}/orders/',
    versions: ['v2', 'v3'],
    currentVersion: 'v3',
    description: 'Market orders (buy/sell orders)',
    scopes: ['esi-markets.read_corporation_orders.v1']
  },
  killmails: {
    path: '/corporations/{corporation_id}/killmails/recent/',
    versions: ['v1'],
    currentVersion: 'v1',
    description: 'Recent corporation killmails',
    scopes: ['esi-killmails.read_corporation_killmails.v1']
  },
  income: {
    path: '/corporations/{corporation_id}/wallets/{division}/transactions/',
    versions: ['v1'],
    currentVersion: 'v1',
    description: 'Wallet transactions and journal',
    scopes: ['esi-wallet.read_corporation_wallets.v1']
  },
  contracts: {
    path: '/corporations/{corporation_id}/contracts/',
    versions: ['v1'],
    currentVersion: 'v1',
    description: 'Corporation contracts',
    scopes: ['esi-contracts.read_corporation_contracts.v1']
  },
  structures: {
    path: '/corporations/{corporation_id}/structures/',
    versions: ['v3', 'v4'],
    currentVersion: 'v4',
    description: 'Corporation structures',
    scopes: ['esi-corporations.read_structures.v1']
  },
  containerLogs: {
    path: '/corporations/{corporation_id}/containers/logs/',
    versions: ['v3'],
    currentVersion: 'v3',
    description: 'Corporation container access logs (hangar deliveries)',
    scopes: ['esi-corporations.read_container_logs.v1']
  },
  divisions: {
    path: '/corporations/{corporation_id}/divisions/',
    versions: ['v2'],
    currentVersion: 'v2',
    description: 'Corporation divisions (hangar and wallet names)',
    scopes: ['esi-corporations.read_divisions.v1']
  },
  assetNames: {
    path: '/corporations/{corporation_id}/assets/names/',
    versions: ['v1'],
    currentVersion: 'v1',
    description: 'Get names for corporation assets',
    scopes: ['esi-assets.read_corporation_assets.v1']
  },
  assetLocations: {
    path: '/corporations/{corporation_id}/assets/locations/',
    versions: ['v2'],
    currentVersion: 'v2',
    description: 'Get locations for corporation assets',
    scopes: ['esi-assets.read_corporation_assets.v1']
  }
};

// ESI base URLs for different environments
export const ESI_ENVIRONMENTS = {
  tranquility: 'https://esi.evetech.net',
  singularity: 'https://esi.evetech.net'
};

export class ESIRouteManager {
  private routes: ESIRouteConfig;
  private baseUrl: string;

  constructor(routes: ESIRouteConfig = DEFAULT_ESI_ROUTES, environment: string = 'tranquility') {
    this.routes = { ...routes };
    this.baseUrl = ESI_ENVIRONMENTS[environment as keyof typeof ESI_ENVIRONMENTS] || ESI_ENVIRONMENTS.tranquility;
  }

  // Get route configuration for a process
  getRoute(processName: string): ESIRoute | null {
    return this.routes[processName] || null;
  }

  // Update route version for a specific process
  updateRouteVersion(processName: string, version: string): boolean {
    const route = this.routes[processName];
    if (!route || !route.versions.includes(version)) {
      return false;
    }
    
    route.currentVersion = version;
    return true;
  }

  // Build full ESI URL for a process
  buildESIUrl(processName: string, replacements: { [key: string]: string } = {}): string | null {
    const route = this.routes[processName];
    if (!route) return null;

    let path = route.path;
    
    // Replace placeholders with actual values
    Object.entries(replacements).forEach(([key, value]) => {
      path = path.replace(`{${key}}`, value);
    });

    return `${this.baseUrl}/${route.currentVersion}${path}`;
  }

  // Validate if an ESI route version is available
  async validateRoute(processName: string, version?: string): Promise<{
    isValid: boolean;
    status?: number;
    error?: string;
    availableVersions?: string[];
  }> {
    const route = this.routes[processName];
    if (!route) {
      return { isValid: false, error: 'Route not found' };
    }

    const testVersion = version || route.currentVersion;
    
    try {
      // Test the route by making a HEAD request to the ESI endpoint
      const testUrl = `${this.baseUrl}/${testVersion}${route.path.replace(/{[^}]+}/g, '1')}`;
      
      console.log(`🔗 Validating ESI route: ${testUrl}`);
      
      // Since this is a browser environment, we can't actually make CORS requests to ESI
      // Instead, we'll simulate validation based on known good versions
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
      
      const knownGoodVersions: { [key: string]: string[] } = {
        members: ['v3', 'v4'],
        assets: ['v3', 'v4', 'v5'],
        manufacturing: ['v1'],
        mining: ['v1'],
        market: ['v2', 'v3'],
        killmails: ['v1'],
        income: ['v1'],
        contracts: ['v1'],
        structures: ['v3', 'v4'],
        containerLogs: ['v3'],
        divisions: ['v2'],
        assetNames: ['v1'],
        assetLocations: ['v2']
      };
      
      const validVersions = knownGoodVersions[processName] || [route.currentVersion];
      const isValid = validVersions.includes(testVersion);
      
      return {
        isValid,
        status: isValid ? 200 : 404,
        availableVersions: validVersions
      };
      
    } catch (error) {
      console.error(`❌ ESI route validation failed:`, error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        availableVersions: route.versions
      };
    }
  }

  // Bulk validate all routes
  async validateAllRoutes(): Promise<{ [processName: string]: boolean }> {
    const results: { [processName: string]: boolean } = {};
    
    for (const processName of Object.keys(this.routes)) {
      const validation = await this.validateRoute(processName);
      results[processName] = validation.isValid;
    }
    
    return results;
  }

  // Get all available processes
  getProcessNames(): string[] {
    return Object.keys(this.routes);
  }

  // Get route summary for display
  getRouteSummary(processName: string): {
    process: string;
    currentUrl: string;
    versions: string[];
    currentVersion: string;
    description: string;
    scopes: string[];
  } | null {
    const route = this.routes[processName];
    if (!route) return null;

    return {
      process: processName,
      currentUrl: this.buildESIUrl(processName, { corporation_id: '{corporation_id}', division: '{division}' }) || '',
      versions: route.versions,
      currentVersion: route.currentVersion,
      description: route.description,
      scopes: route.scopes || []
    };
  }

  // Export configuration
  exportConfig(): ESIRouteConfig {
    return { ...this.routes };
  }

  // Import configuration
  importConfig(config: ESIRouteConfig): void {
    this.routes = { ...config };
  }

  // Reset to defaults
  resetToDefaults(): void {
    this.routes = { ...DEFAULT_ESI_ROUTES };
  }

  // Check for route updates (simulate checking against ESI spec)
  async checkForUpdates(): Promise<{
    hasUpdates: boolean;
    updates: { [processName: string]: string[] };
    newRoutes: string[];
  }> {
    // Simulate checking for new versions or routes
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock some updates
    const mockUpdates = Math.random() > 0.7; // 30% chance of updates
    
    if (mockUpdates) {
      return {
        hasUpdates: true,
        updates: {
          assets: ['v6'], // New version available
          market: ['v4']  // New version available
        },
        newRoutes: ['blueprints'] // New route available
      };
    }
    
    return {
      hasUpdates: false,
      updates: {},
      newRoutes: []
    };
  }
}

// Singleton instance for the application
export const esiRouteManager = new ESIRouteManager();

// Utility functions for React components
export const useESIRoutes = () => {
  return {
    getRoute: (processName: string) => esiRouteManager.getRoute(processName),
    updateVersion: (processName: string, version: string) => esiRouteManager.updateRouteVersion(processName, version),
    validateRoute: (processName: string, version?: string) => esiRouteManager.validateRoute(processName, version),
    getProcessNames: () => esiRouteManager.getProcessNames(),
    getRouteSummary: (processName: string) => esiRouteManager.getRouteSummary(processName),
    checkForUpdates: () => esiRouteManager.checkForUpdates()
  };
};