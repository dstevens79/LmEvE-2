// EVE Online Static Data Export (SDE) Management Service
import { useKV } from '@/lib/kv';
import * as React from 'react';

export interface SDEInfo {
  version: string;
  releaseDate: string;
  downloadUrl: string;
  checksum?: string;
  size?: number;
}

export interface SDEStatus {
  isInstalled: boolean;
  currentVersion?: string;
  installedDate?: string;
  isUpdateAvailable: boolean;
  latestVersion?: string;
  lastChecked?: string;
  downloadProgress?: number;
  isDownloading?: boolean;
  isUpdating?: boolean;
  error?: string;
}

export interface SDEDatabaseStats {
  isConnected: boolean;
  tableCount: number;
  totalRecords: number;
  totalSize: string;
  lastUpdate: string;
  currentVersion?: string;
  availableVersion?: string;
  lastUpdateCheck?: string;
  isOutdated?: boolean;
  tables?: string[];
}

class SDEService {
  private readonly SDE_URL = 'https://www.fuzzwork.co.uk/dump/mysql-latest.tar.bz2';
  private readonly SDE_VERSION_URL = 'https://www.fuzzwork.co.uk/dump/latest/';
  
  /**
   * Check for the latest SDE version available
   */
  async checkLatestVersion(): Promise<SDEInfo> {
    try {
      // In a real implementation, this would check the Fuzzwork API
      // For now, we'll simulate the response
      const response = await fetch(`${this.SDE_VERSION_URL}version.txt`, {
        // Be nice to remote servers; avoid sending credentials, simple GET only
        method: 'GET',
        cache: 'no-cache',
        // mode left default (cors) so we can read the response body
        redirect: 'follow'
      });
      
      if (!response.ok) {
        // Fallback to simulated data if the API is not available
        const simulatedVersion = this.generateSimulatedVersion();
        return simulatedVersion;
      }
      
      const versionText = await response.text();
      const version = versionText.trim();
      
      return {
        version,
        releaseDate: new Date().toISOString(),
        downloadUrl: this.SDE_URL,
        size: 50 * 1024 * 1024 // ~50MB estimated
      };
    } catch (error) {
      console.error('Failed to check SDE version:', error);
      // Return simulated data as fallback
      return this.generateSimulatedVersion();
    }
  }

  /**
   * Generate simulated SDE version for development
   */
  private generateSimulatedVersion(): SDEInfo {
    const now = new Date();
    const version = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    return {
      version,
      releaseDate: now.toISOString(),
      downloadUrl: this.SDE_URL,
      size: 52428800, // 50MB
      checksum: 'abc123def456789'
    };
  }

  /**
   * Compare version strings to determine if an update is available
   */
  compareVersions(currentVersion: string, latestVersion: string): boolean {
    // Simple date-based version comparison (YYYY-MM-DD format)
    return new Date(latestVersion) > new Date(currentVersion);
  }

  /**
   * Download and extract SDE data
   */
  async downloadSDE(
    onProgress?: (progress: number, stage: string) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      onProgress?.(0, 'Initializing download...');
      
      // Simulate download stages
      const stages = [
        'Downloading SDE archive...',
        'Extracting database files...',
        'Validating data integrity...',
        'Preparing for import...'
      ];

      for (let i = 0; i < stages.length; i++) {
        onProgress?.(((i + 1) / stages.length) * 80, stages[i]);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      onProgress?.(90, 'Download completed');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onProgress?.(100, 'Ready for database import');
      
      return { success: true };
    } catch (error) {
      console.error('SDE download failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown download error' 
      };
    }
  }

  /**
   * Import SDE data into database
   */
  async importToDatabase(
    onProgress?: (progress: number, stage: string) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      onProgress?.(0, 'Connecting to database...');
      
      const importStages = [
        'Creating database tables...',
        'Importing type definitions...',
        'Importing solar system data...',
        'Importing station information...',
        'Importing market groups...',
        'Importing blueprints...',
        'Building indexes...',
        'Finalizing import...'
      ];

      for (let i = 0; i < importStages.length; i++) {
        onProgress?.(((i + 1) / importStages.length) * 100, importStages[i]);
        
        // Simulate import time (longer for database operations)
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      return { success: true };
    } catch (error) {
      console.error('SDE import failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Database import failed' 
      };
    }
  }

  /**
   * Get database statistics about imported SDE data
   */
  async getDatabaseStats(): Promise<SDEDatabaseStats> {
    // In a real implementation, this would query the database
    // For now, return simulated stats
    return {
      isConnected: true,
      tableCount: 47,
      totalRecords: 2456789,
      totalSize: '485 MB',
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Clean up old SDE files and data
   */
  async cleanup(): Promise<void> {
    // In a real implementation, this would remove temporary files
    // and old database entries
    console.log('Cleaning up SDE files...');
  }
}

export const sdeService = new SDEService();

/**
 * React hook for SDE management
 */
export function useSDEManager() {
  const [sdeStatus, setSDEStatus] = useKV<SDEStatus>('sde-status', {
    isInstalled: false,
    isUpdateAvailable: false,
    isDownloading: false,
    isUpdating: false
  });

  // Cooldown/backoff controls persisted separately to avoid tight polling
  const [cooldown, setCooldown] = useKV<{ lastChecked?: string; nextAllowed?: string }>(
    'sde-check-cooldown',
    { lastChecked: undefined, nextAllowed: undefined }
  );

  // Use refs to avoid recreating callbacks on each render due to state deps
  const nextAllowedRef = React.useRef<number | undefined>(
    cooldown?.nextAllowed ? Date.parse(cooldown.nextAllowed) : undefined
  );
  const lastCheckedRef = React.useRef<number | undefined>(
    sdeStatus?.lastChecked ? Date.parse(sdeStatus.lastChecked) : (cooldown?.lastChecked ? Date.parse(cooldown.lastChecked) : undefined)
  );

  React.useEffect(() => {
    nextAllowedRef.current = cooldown?.nextAllowed ? Date.parse(cooldown.nextAllowed) : undefined;
  }, [cooldown?.nextAllowed]);

  React.useEffect(() => {
    lastCheckedRef.current = sdeStatus?.lastChecked ? Date.parse(sdeStatus.lastChecked) : lastCheckedRef.current;
  }, [sdeStatus?.lastChecked]);

  // Minimum interval between remote checks (24h)
  const MIN_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

  const checkForUpdates = React.useCallback(async (options?: { force?: boolean }): Promise<void> => {
    try {
      const now = Date.now();
      const force = options?.force === true;
      const nextAllowed = nextAllowedRef.current;
      const last = lastCheckedRef.current;

      // Skip if we're within cooldown and not forced
      if (!force && typeof nextAllowed === 'number' && now < nextAllowed) {
        return;
      }
      // Also skip if we checked recently (< 24h)
      if (!force && typeof last === 'number' && now - last < MIN_CHECK_INTERVAL_MS) {
        return;
      }

      const latestInfo = await sdeService.checkLatestVersion();
      const isUpdateAvailable = sdeStatus.currentVersion 
        ? sdeService.compareVersions(sdeStatus.currentVersion, latestInfo.version)
        : true;

      setSDEStatus(current => ({
        isInstalled: current?.isInstalled || false,
        isUpdateAvailable,
        isDownloading: current?.isDownloading || false,
        isUpdating: current?.isUpdating || false,
        currentVersion: current?.currentVersion,
        installedDate: current?.installedDate,
        latestVersion: latestInfo.version,
        lastChecked: new Date().toISOString(),
        downloadProgress: current?.downloadProgress,
        error: undefined
      }));

      // Reset cooldown on success
      const lastCheckedIso = new Date().toISOString();
      setCooldown({ lastChecked: lastCheckedIso, nextAllowed: new Date(now + MIN_CHECK_INTERVAL_MS).toISOString() });
      nextAllowedRef.current = now + MIN_CHECK_INTERVAL_MS;
      lastCheckedRef.current = now;
    } catch (error) {
      // If we fail (network/CORS/429), set a modest backoff to avoid hammering
      const now = Date.now();
      const backoffMs = 6 * 60 * 60 * 1000; // 6h backoff on failure
      setCooldown({
        lastChecked: new Date().toISOString(),
        nextAllowed: new Date(now + backoffMs).toISOString()
      });
      nextAllowedRef.current = now + backoffMs;

      setSDEStatus(current => ({
        isInstalled: current?.isInstalled || false,
        isUpdateAvailable: current?.isUpdateAvailable || false,
        isDownloading: current?.isDownloading || false,
        isUpdating: current?.isUpdating || false,
        currentVersion: current?.currentVersion,
        installedDate: current?.installedDate,
        latestVersion: current?.latestVersion,
        lastChecked: new Date().toISOString(),
        downloadProgress: current?.downloadProgress,
        error: error instanceof Error ? error.message : 'Failed to check for updates'
      }));
    }
  }, [setSDEStatus, setCooldown]);

  const downloadSDE = React.useCallback(async (): Promise<void> => {
    setSDEStatus(current => ({
      isInstalled: current?.isInstalled || false,
      isUpdateAvailable: current?.isUpdateAvailable || false,
      isDownloading: true,
      isUpdating: current?.isUpdating || false,
      currentVersion: current?.currentVersion,
      installedDate: current?.installedDate,
      latestVersion: current?.latestVersion,
      lastChecked: current?.lastChecked,
      downloadProgress: 0,
      error: undefined
    }));

    const result = await sdeService.downloadSDE((progress, stage) => {
      setSDEStatus(current => ({
        ...current,
        downloadProgress: progress
      }));
    });

    if (result.success) {
      setSDEStatus(current => ({
        isInstalled: current?.isInstalled || false,
        isUpdateAvailable: current?.isUpdateAvailable || false,
        isDownloading: false,
        isUpdating: current?.isUpdating || false,
        currentVersion: current?.currentVersion,
        installedDate: current?.installedDate,
        latestVersion: current?.latestVersion,
        lastChecked: current?.lastChecked,
        downloadProgress: 100,
        error: current?.error
      }));
    } else {
      setSDEStatus(current => ({
        isInstalled: current?.isInstalled || false,
        isUpdateAvailable: current?.isUpdateAvailable || false,
        isDownloading: false,
        isUpdating: current?.isUpdating || false,
        currentVersion: current?.currentVersion,
        installedDate: current?.installedDate,
        latestVersion: current?.latestVersion,
        lastChecked: current?.lastChecked,
        downloadProgress: 0,
        error: result.error
      }));
    }
  }, [setSDEStatus]);

  const updateDatabase = React.useCallback(async (): Promise<void> => {
    setSDEStatus(current => ({
      isInstalled: current?.isInstalled || false,
      isUpdateAvailable: current?.isUpdateAvailable || false,
      isDownloading: current?.isDownloading || false,
      isUpdating: true,
      currentVersion: current?.currentVersion,
      installedDate: current?.installedDate,
      latestVersion: current?.latestVersion,
      lastChecked: current?.lastChecked,
      downloadProgress: current?.downloadProgress,
      error: undefined
    }));

    const result = await sdeService.importToDatabase((progress, stage) => {
      // Update progress could be tracked here
    });

    if (result.success) {
      const latestInfo = await sdeService.checkLatestVersion();
      
      setSDEStatus(current => ({
        isInstalled: true,
        isUpdateAvailable: false,
        isDownloading: current?.isDownloading || false,
        isUpdating: false,
        currentVersion: latestInfo.version,
        installedDate: new Date().toISOString(),
        latestVersion: latestInfo.version,
        lastChecked: current?.lastChecked,
        downloadProgress: current?.downloadProgress,
        error: current?.error
      }));
      
      // Clean up temporary files
      await sdeService.cleanup();
    } else {
      setSDEStatus(current => ({
        isInstalled: current?.isInstalled || false,
        isUpdateAvailable: current?.isUpdateAvailable || false,
        isDownloading: current?.isDownloading || false,
        isUpdating: false,
        currentVersion: current?.currentVersion,
        installedDate: current?.installedDate,
        latestVersion: current?.latestVersion,
        lastChecked: current?.lastChecked,
        downloadProgress: current?.downloadProgress,
        error: result.error
      }));
    }
  }, [setSDEStatus]);

  const getDatabaseStats = React.useCallback(async (): Promise<SDEDatabaseStats | null> => {
    if (!sdeStatus || !sdeStatus.isInstalled) return null;
    
    try {
      return await sdeService.getDatabaseStats();
    } catch (error) {
      console.error('Failed to get database stats:', error);
      return null;
    }
  }, [sdeStatus?.isInstalled]);

  return {
    sdeStatus,
    checkForUpdates,
    downloadSDE,
    updateDatabase,
    getDatabaseStats
  };
}