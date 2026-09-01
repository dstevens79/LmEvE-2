/**
 * Unified Data Service (slimmed).
 *
 * Historically this was the single data source with Database → ESI → Cache → Mock
 * fallbacks and a large mock-data generator. The app now reads real data from the
 * server DB via src/lib/corp-data.ts, so the data getters and all mock generation are
 * gone. What remains is the persistent "setup status" store that the UI still uses to
 * know whether the database + ESI have ever been configured (drives demo/empty states).
 */

export type DataSource = 'database' | 'esi' | 'cache' | 'mock';

/**
 * Setup status tracking - persisted in localStorage.
 * `hasEverBeenGreen` permanently latches once fully configured so the UI never regresses to a "demo" presentation after real setup has occurred.
 */
export interface SetupStatus {
  isFullyConfigured: boolean;
  databaseConnected: boolean;
  esiConfigured: boolean;
  hasEverBeenGreen: boolean; // Once true, mock/demo presentation is permanently disabled
  timestamp: string;
}

const SETUP_STATUS_KEY = 'lmeve-setup-status';

function defaultSetupStatus(): SetupStatus {
  return {
    isFullyConfigured: false,
    databaseConnected: false,
    esiConfigured: false,
    hasEverBeenGreen: false,
    timestamp: new Date().toISOString(),
  };
}

export class UnifiedDataService {
  private setupStatus: SetupStatus;

  // The constructor previously accepted a DatabaseManager for data fetching. That path is
  // gone (data comes from corp-data.ts); the parameter is retained so existing call sites
  // keep working but is intentionally unused.
  constructor(_dbManager?: unknown) {
    this.setupStatus = this.loadSetupStatus();
  }

  /**
   * Load setup status from persistent storage.
   */
  private loadSetupStatus(): SetupStatus {
    try {
      const stored = localStorage.getItem(SETUP_STATUS_KEY);
      if (stored) {
        return JSON.parse(stored) as SetupStatus;
      }
    } catch (error) {
      console.error('Failed to load setup status:', error);
    }
    return defaultSetupStatus();
  }

  /**
   * Save setup status to persistent storage.
   */
  private saveSetupStatus(): void {
    try {
      localStorage.setItem(SETUP_STATUS_KEY, JSON.stringify(this.setupStatus));
    } catch (error) {
      console.error('Failed to save setup status:', error);
    }
  }

  /**
   * Update setup status. Once fully configured, permanently latch "ever been green".
   */
  updateSetupStatus(status: Partial<SetupStatus>): void {
    const wasGreen = this.setupStatus.isFullyConfigured;

    this.setupStatus = {
      ...this.setupStatus,
      ...status,
      timestamp: new Date().toISOString(),
    };

    if (this.setupStatus.isFullyConfigured && !this.setupStatus.hasEverBeenGreen) {
      this.setupStatus.hasEverBeenGreen = true;
      console.log('🎉 LMeve fully configured! Demo/mock presentation permanently disabled.');
    } else if (!wasGreen && !this.setupStatus.isFullyConfigured && this.setupStatus.hasEverBeenGreen) {
      // Reverting from a previously-configured state: keep the latch so we don't flip back to demo.
    }

    this.saveSetupStatus();
  }

  /**
   * Get a copy of the current setup status.
   */
  getSetupStatus(): SetupStatus {
    return { ...this.setupStatus };
  }
}
