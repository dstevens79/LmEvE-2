/**
 * Persistence Service for LMeve Settings and Data
 * 
 * This service provides a unified interface for managing application settings
 * using the useKV hooks and provides a unified interface for data operations.
 */

import React from 'react';

// Lightweight fallback to localStorage when Spark KV isn't available or isn't persisting
function useLocalStorageKV<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const initializer = () => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch {}
    return defaultValue;
  };
  const [value, setValue] = React.useState<T>(initializer);
  const setAndPersist = (next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      try { localStorage.setItem(key, JSON.stringify(resolved)); } catch {}
      return resolved;
    });
  };
  return [value, setAndPersist];
}

// Expose a local KV hook for use across the app (no Spark KV dependency)
export const useLocalKV = useLocalStorageKV;

// Server write-through: debounce saves to disk per category
const saveDebounceTimers: Record<string, number | undefined> = {};
function scheduleCategorySave(category: string, payload: any, delayMs = 400) {
  try {
    if (saveDebounceTimers[category]) {
      window.clearTimeout(saveDebounceTimers[category]);
    }
    saveDebounceTimers[category] = window.setTimeout(async () => {
      try {
        await fetch('/api/settings.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [category]: payload })
        });
      } catch {}
    }, delayMs);
  } catch {}
}

export interface GeneralSettings {
  applicationName: string;
  corpId: number;
  corpName: string;
  corpTicker: string;
  sessionTimeout: number;
  sessionTimeoutMinutes: number;
  maxLogRetentionDays: number;
  theme: 'dark' | 'light' | 'system';
  language: string;
  timezone: string;
  maintenanceMode: boolean;
  debugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableLogging: boolean;
  enableAutoBackup: boolean;
  // Cache and deployment config
  cacheEnabled?: boolean;
  cacheMaxSizeMB?: number;
  deploymentProtocol?: 'http' | 'https';
  authFlow?: 'spa' | 'server';
}

export interface DatabaseSettings {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  // Optional fields used by setup flows
  rootPassword?: string;
  lmevePassword?: string;
  ssl: boolean;
  connectionPoolSize: number;
  queryTimeout: number;
  autoReconnect: boolean;
  charset: string;
  // Sudo database settings for admin operations
  sudoHost: string;
  sudoPort: number;
  sudoUsername: string;
  sudoPassword: string;
  sudoSsl?: boolean;
  // SSH connection settings for remote database setup
  sshHost?: string;
  sshUsername?: string;
  sshPassword?: string;
  sshPort?: number;
  // Schema import settings
  schemaSource?: 'default' | 'custom' | 'file';
  schemaFilePath?: string;
}

export interface ESISettings {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  userAgent: string;
  scopes: string[];
  rateLimitBuffer: number;
  maxRetries: number;
  requestTimeout: number;
}

export interface SDESettings {
  currentVersion: string;
  lastUpdateCheck: string;
  lastUpdateDate: string;
  autoUpdate: boolean;
  updateSchedule: string;
  downloadUrl: string;
  backupBeforeUpdate: boolean;
  cleanupAfterUpdate: boolean;
  sdeSource?: 'fuzzwork' | 'custom' | 'file';
  sdeFilePath?: string;
}

export interface SyncProcessConfig {
  enabled: boolean;
  interval: number;
}

export interface SyncSettings {
  enabled: boolean;
  autoSync: boolean;
  lastSync: string;
  syncIntervals: {
    assets: number;
    members: number;
    manufacturing: number;
    mining: number;
    market: number;
    killmails: number;
    income: number;
    wallets: number;
  };
  lastSyncTimes: {
    members: string;
    assets: string;
    manufacturing: string;
    mining: string;
    market: string;
    killmails: string;
    income: string;
    structures: string;
  };
  batchSizes: {
    assets: number;
    members: number;
    manufacturing: number;
    mining: number;
    market: number;
    killmails: number;
  };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  maxConcurrentSyncs?: number;
  retryAttempts?: number;
  corporation_members?: SyncProcessConfig;
  corporation_assets?: SyncProcessConfig;
  industry_jobs?: SyncProcessConfig;
  mining_ledger?: SyncProcessConfig;
  market_orders?: SyncProcessConfig;
  killmails?: SyncProcessConfig;
  corporation_wallets?: SyncProcessConfig;
  structures?: SyncProcessConfig;
  corporation_contracts?: SyncProcessConfig;
  item_pricing?: SyncProcessConfig;
  planetary_interaction?: SyncProcessConfig;
  personal_esi?: SyncProcessConfig;
}

export interface NotificationSettings {
  enabled: boolean;
  channels: {
    email: boolean;
    inApp: boolean;
    webhook: boolean;
  };
  events: {
    syncErrors: boolean;
    manufacturing: boolean;
    mining: boolean;
    markets: boolean;
    killmails: boolean;
    memberChanges: boolean;
    structureEvents: boolean;
    assetMovements: boolean;
    incomeUpdates: boolean;
  };
  eventChannels?: {
    [eventId: string]: {
      toast?: boolean;
      discord?: boolean;
      eveMail?: boolean;
    };
  };
  emailSettings: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    smtpSecure: boolean;
    fromEmail: string;
  };
  webhookUrl: string;
  discord?: {
    enabled?: boolean;
    webhookUrl?: string;
    botName?: string;
    avatarUrl?: string;
    channels?: string[];
    roles?: string[];
    userMentions?: string[];
    embedFormat?: boolean;
    includeThumbnails?: boolean;
    throttleMinutes?: number;
  };
  eveMail?: {
    enabled?: boolean;
    senderCharacterId?: number;
    subjectPrefix?: string;
    recipientIds?: number[];
    mailingLists?: Array<{ name: string; id: number }>;
    sendToCorporation?: boolean;
    sendToAlliance?: boolean;
    onlyToOnlineCharacters?: boolean;
    cspaChargeCheck?: boolean;
    throttleMinutes?: number;
  };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
}

export interface IncomeSettings {
  enabled: boolean;
  hourlyRates: {
    mining: number;
    manufacturing: number;
    invention: number;
    copying: number;
    research: number;
    reaction: number;
  };
  bonusRates: {
    weekendMultiplier: number;
    holidayMultiplier: number;
    nightShiftMultiplier?: number;
  };
  paymentSettings: {
    currency: 'ISK' | 'USD' | 'EUR';
    minimumPayout: number;
    paymentSchedule: 'daily' | 'weekly' | 'monthly';
    taxRate?: number;
  };
}

export interface CorporationData {
  corporationId: number;
  corporationName: string;
  allianceId?: number;
  allianceName?: string;
  ceoId: number;
  ceoName: string;
  memberCount: number;
  description: string;
  homeStationId?: number;
  taxRate: number;
  url?: string;
  dateFounded: string;
  creatorId: number;
  ticker: string;
  factionId?: number;
  warEligible: boolean;
}

export interface ManualUser {
  id: string;
  username: string;
  characterName: string;
  corporationName: string;
  corporationId?: number;
  roles: string[];
  permissions?: string[];
  lastLogin?: string;
  createdAt: string;
  isActive: boolean;
}

export interface ApplicationData {
  version: string;
  installDate: string;
  lastStartup: string;
  features: {
    manufacturing: boolean;
    mining: boolean;
    market: boolean;
    structures: boolean;
  };
  metrics: {
    totalApiCalls: number;
    averageResponseTime: number;
    errorRate: number;
  };
  maintenance: {
    autoBackup: boolean;
    cleanupSchedule: string;
    logRotation: boolean;
  };
}

// Default values for all settings
export const defaultGeneralSettings: GeneralSettings = {
  applicationName: 'LMeve',
  corpId: 0,
  corpName: '',
  corpTicker: '',
  sessionTimeout: 120,
  sessionTimeoutMinutes: 60,
  maxLogRetentionDays: 30,
  theme: 'dark',
  language: 'en',
  timezone: 'UTC',
  maintenanceMode: false,
  debugMode: false,
  logLevel: 'info',
  enableLogging: true,
  enableAutoBackup: true,
  cacheEnabled: true,
  cacheMaxSizeMB: 256,
  deploymentProtocol: (window.location.protocol === 'https:' ? 'https' : 'http'),
  authFlow: 'server',
};

export const defaultDatabaseSettings: DatabaseSettings = {
  host: 'localhost',
  port: 3306,
  database: 'lmeve2',
  username: 'lmeve',
  password: '',
  ssl: false,
  connectionPoolSize: 10,
  queryTimeout: 30000,
  autoReconnect: true,
  charset: 'utf8mb4',
  sudoHost: 'localhost',
  sudoPort: 3306,
  sudoUsername: 'root',
  sudoPassword: '',
  sshHost: 'localhost',
  sshUsername: 'root',
  sshPassword: '',
  sshPort: 22,
  schemaSource: 'default',
  schemaFilePath: '',
};

export const defaultESISettings: ESISettings = {
  clientId: '',
  clientSecret: '',
  callbackUrl: `${window.location.origin}/`,
  userAgent: 'LMeve Corporation Management Tool',
  scopes: [
    'esi-corporations.read_corporation_membership.v1',
    'esi-industry.read_corporation_jobs.v1',
    'esi-markets.read_corporation_orders.v1',
    'esi-universe.read_structures.v1',
  ],
  rateLimitBuffer: 50,
  maxRetries: 3,
  requestTimeout: 10000,
};

export const defaultSDESettings: SDESettings = {
  currentVersion: '',
  lastUpdateCheck: '',
  lastUpdateDate: '',
  autoUpdate: false,
  updateSchedule: '0 2 * * 0',
  downloadUrl: 'https://www.fuzzwork.co.uk/dump/mysql-latest.tar.bz2',
  backupBeforeUpdate: true,
  cleanupAfterUpdate: true,
  sdeSource: 'fuzzwork',
  sdeFilePath: '',
};

export const defaultSyncSettings: SyncSettings = {
  enabled: true,
  autoSync: true,
  lastSync: '',
  syncIntervals: {
    assets: 60,
    members: 30,
    manufacturing: 15,
    mining: 30,
    market: 45,
    killmails: 120,
    income: 60,
    wallets: 180,
  },
  lastSyncTimes: {
    members: '',
    assets: '',
    manufacturing: '',
    mining: '',
    market: '',
    killmails: '',
    income: '',
    structures: '',
  },
  batchSizes: {
    assets: 500,
    members: 100,
    manufacturing: 50,
    mining: 100,
    market: 200,
    killmails: 25,
  },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    timezone: 'UTC',
  },
  maxConcurrentSyncs: 3,
  retryAttempts: 3,
  corporation_members: { enabled: true, interval: 1440 },
  corporation_assets: { enabled: true, interval: 1440 },
  industry_jobs: { enabled: true, interval: 1440 },
  mining_ledger: { enabled: false, interval: 1440 },
  market_orders: { enabled: false, interval: 1440 },
  killmails: { enabled: false, interval: 1440 },
  corporation_wallets: { enabled: true, interval: 1440 },
  structures: { enabled: false, interval: 1440 },
  corporation_contracts: { enabled: true, interval: 1440 },
  item_pricing: { enabled: true, interval: 1440 },
  planetary_interaction: { enabled: false, interval: 1440 },
  personal_esi: { enabled: false, interval: 1440 },
};

export const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  channels: {
    email: false,
    inApp: true,
    webhook: false,
  },
  events: {
    syncErrors: true,
    manufacturing: true,
    mining: false,
    markets: false,
    killmails: false,
    memberChanges: true,
    structureEvents: false,
    assetMovements: false,
    incomeUpdates: false,
  },
  eventChannels: {
    manufacturing: { toast: true, discord: false, eveMail: false },
    mining: { toast: false, discord: false, eveMail: false },
    planetary: { toast: false, discord: false, eveMail: false },
    projects: { toast: false, discord: false, eveMail: false },
    killmails: { toast: false, discord: false, eveMail: false },
    markets: { toast: false, discord: false, eveMail: false },
    wallet: { toast: false, discord: false, eveMail: false },
    assets: { toast: false, discord: false, eveMail: false },
    members: { toast: true, discord: false, eveMail: false },
    buyback: { toast: false, discord: false, eveMail: false },
    system: { toast: true, discord: false, eveMail: false },
  },
  emailSettings: {
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    smtpSecure: true,
    fromEmail: '',
  },
  webhookUrl: '',
  discord: {
    enabled: false,
    webhookUrl: '',
    botName: 'LMeve Notifications',
    avatarUrl: '',
    channels: [],
    roles: [],
    userMentions: [],
    embedFormat: true,
    includeThumbnails: true,
    throttleMinutes: 5,
  },
  eveMail: {
    enabled: false,
    senderCharacterId: 0,
    subjectPrefix: '[LMeve]',
    recipientIds: [],
    mailingLists: [],
    sendToCorporation: false,
    sendToAlliance: false,
    onlyToOnlineCharacters: false,
    cspaChargeCheck: true,
    throttleMinutes: 15,
  },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    timezone: 'UTC',
  },
};

export const defaultIncomeSettings: IncomeSettings = {
  enabled: true,
  hourlyRates: {
    mining: 30000000,        // 30M ISK/hour
    manufacturing: 25000000, // 25M ISK/hour
    invention: 35000000,     // 35M ISK/hour
    copying: 20000000,       // 20M ISK/hour
    research: 30000000,      // 30M ISK/hour
    reaction: 40000000,      // 40M ISK/hour
  },
  bonusRates: {
    weekendMultiplier: 1.2,
    holidayMultiplier: 1.5,
  },
  paymentSettings: {
    currency: 'ISK',
    minimumPayout: 100000000, // 100M ISK
    paymentSchedule: 'weekly',
  },
};

export const defaultApplicationData: ApplicationData = {
  version: '2.0.0',
  installDate: new Date().toISOString(),
  lastStartup: new Date().toISOString(),
  features: {
    manufacturing: true,
    mining: true,
    market: true,
    structures: true,
  },
  metrics: {
    totalApiCalls: 0,
    averageResponseTime: 0,
    errorRate: 0,
  },
  maintenance: {
    autoBackup: true,
    cleanupSchedule: '0 1 * * *', // Daily at 1 AM
    logRotation: true,
  },
};

// Hook exports for React components
// Category-specific hooks that also persist changes to server storage (disk)
export const useGeneralSettings = () => {
  const [val, setVal] = useLocalStorageKV<GeneralSettings>('lmeve-settings-general', defaultGeneralSettings);
  const setter = (next: GeneralSettings | ((prev: GeneralSettings) => GeneralSettings)) => {
    setVal(prev => {
      const resolved = typeof next === 'function' ? (next as any)(prev) : next;
      scheduleCategorySave('general', resolved);
      return resolved;
    });
  };
  return [val, setter] as const;
};

export const useDatabaseSettings = () => {
  const [val, setVal] = useLocalStorageKV<DatabaseSettings>('lmeve-settings-database', defaultDatabaseSettings);
  const setter = (next: DatabaseSettings | ((prev: DatabaseSettings) => DatabaseSettings)) => {
    setVal(prev => {
      const resolved = typeof next === 'function' ? (next as any)(prev) : next;
      scheduleCategorySave('database', resolved);
      return resolved;
    });
  };
  return [val, setter] as const;
};

export const useESISettings = () => {
  const [val, setVal] = useLocalStorageKV<ESISettings>('lmeve-settings-esi', defaultESISettings);
  const setter = (next: ESISettings | ((prev: ESISettings) => ESISettings)) => {
    setVal(prev => {
      const resolved = typeof next === 'function' ? (next as any)(prev) : next;
      scheduleCategorySave('esi', resolved);
      return resolved;
    });
  };
  return [val, setter] as const;
};

export const useSDESettings = () => useLocalStorageKV<SDESettings>('lmeve-settings-sde', defaultSDESettings);

export const useSyncSettings = () => useLocalStorageKV<SyncSettings>('lmeve-settings-sync', defaultSyncSettings);

export const useNotificationSettings = () => useLocalStorageKV<NotificationSettings>('lmeve-settings-notifications', defaultNotificationSettings);

export const useIncomeSettings = () => useLocalStorageKV<IncomeSettings>('lmeve-settings-income', defaultIncomeSettings);

export const useManualUsers = () => useLocalStorageKV<ManualUser[]>('lmeve-manual-users', []);

export const useApplicationData = () => useLocalStorageKV<ApplicationData>('lmeve-application-data', defaultApplicationData);

export const useCorporationData = () => useLocalStorageKV<CorporationData[]>('lmeve-corporation-data', []);

// Local-only helpers to read/write settings
async function safeKVGet<T>(key: string): Promise<T | null> {
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function safeKVSet<T>(key: string, value: T): Promise<void> {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// Utility functions for data export/import
export const exportAllSettings = async () => {
  const settings = {
    general: (await safeKVGet<GeneralSettings>('lmeve-settings-general')) ?? defaultGeneralSettings,
    database: (await safeKVGet<DatabaseSettings>('lmeve-settings-database')) ?? defaultDatabaseSettings,
    esi: (await safeKVGet<ESISettings>('lmeve-settings-esi')) ?? defaultESISettings,
    sde: (await safeKVGet<SDESettings>('lmeve-settings-sde')) ?? defaultSDESettings,
    sync: (await safeKVGet<SyncSettings>('lmeve-settings-sync')) ?? defaultSyncSettings,
    notifications: (await safeKVGet<NotificationSettings>('lmeve-settings-notifications')) ?? defaultNotificationSettings,
    income: (await safeKVGet<IncomeSettings>('lmeve-settings-income')) ?? defaultIncomeSettings,
    users: (await safeKVGet<ManualUser[]>('lmeve-manual-users')) ?? [],
    application: (await safeKVGet<ApplicationData>('lmeve-application-data')) ?? defaultApplicationData
  };

  return {
    version: '2.0.0',
    exportDate: new Date().toISOString(),
    settings,
  };
};

export const importAllSettings = async (importData: any) => {
  if (!importData.settings) {
    throw new Error('Invalid import data format');
  }

  const { settings } = importData;

  if (settings.general) await safeKVSet('lmeve-settings-general', settings.general);
  if (settings.database) await safeKVSet('lmeve-settings-database', settings.database);
  if (settings.esi) await safeKVSet('lmeve-settings-esi', settings.esi);
  if (settings.sde) await safeKVSet('lmeve-settings-sde', settings.sde);
  if (settings.sync) await safeKVSet('lmeve-settings-sync', settings.sync);
  if (settings.notifications) await safeKVSet('lmeve-settings-notifications', settings.notifications);
  if (settings.income) await safeKVSet('lmeve-settings-income', settings.income);
  if (settings.users) await safeKVSet('lmeve-manual-users', settings.users);
  if (settings.application) await safeKVSet('lmeve-application-data', settings.application);
};

// Reset all settings to defaults
export const resetAllSettings = async () => {
  await safeKVSet('lmeve-settings-general', defaultGeneralSettings);
  await safeKVSet('lmeve-settings-database', defaultDatabaseSettings);
  await safeKVSet('lmeve-settings-esi', defaultESISettings);
  await safeKVSet('lmeve-settings-sde', defaultSDESettings);
  await safeKVSet('lmeve-settings-sync', defaultSyncSettings);
  await safeKVSet('lmeve-settings-notifications', defaultNotificationSettings);
  await safeKVSet('lmeve-settings-income', defaultIncomeSettings);
  await safeKVSet('lmeve-manual-users', []);
  // Don't reset application data as it contains version info
};

// Backup to downloadable file
export const backupSettings = async () => {
  const backup = await exportAllSettings();
  const dataBlob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `lmeve-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Server-backed persistence helpers
export const saveSettingsToServer = async (): Promise<boolean> => {
  try {
    const backup = await exportAllSettings();
    const resp = await fetch('/api/settings.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backup)
    });
    return resp.ok;
  } catch {
    return false;
  }
};

export const loadSettingsFromServer = async (): Promise<boolean> => {
  try {
    const resp = await fetch('/api/settings.php', { method: 'GET' });
    if (!resp.ok) return false;
    const data = await resp.json();
    if (!data) return false;
    // Accept both shapes:
    // 1) { ok, settings: { general, database, ... } }
    // 2) { ok, settings: { version, exportDate, settings: { ... } } }
    // 3) Fallback legacy: { ok, settings: { database: {...} } }
    const settingsPayload = data.settings;
    if (!settingsPayload) return false;
    // If the payload already has a 'settings' key, pass the whole object
    // Otherwise, wrap it so importAllSettings receives expected shape
    const importObj = settingsPayload.settings
      ? settingsPayload
      : { settings: settingsPayload };

    // Build current local snapshot for comparison
    const localSnapshot = {
      general: (await safeKVGet<GeneralSettings>('lmeve-settings-general')) ?? defaultGeneralSettings,
      database: (await safeKVGet<DatabaseSettings>('lmeve-settings-database')) ?? defaultDatabaseSettings,
      esi: (await safeKVGet<ESISettings>('lmeve-settings-esi')) ?? defaultESISettings,
      sde: (await safeKVGet<SDESettings>('lmeve-settings-sde')) ?? defaultSDESettings,
      sync: (await safeKVGet<SyncSettings>('lmeve-settings-sync')) ?? defaultSyncSettings,
      notifications: (await safeKVGet<NotificationSettings>('lmeve-settings-notifications')) ?? defaultNotificationSettings,
      income: (await safeKVGet<IncomeSettings>('lmeve-settings-income')) ?? defaultIncomeSettings,
      users: (await safeKVGet<ManualUser[]>('lmeve-manual-users')) ?? [],
      application: (await safeKVGet<ApplicationData>('lmeve-application-data')) ?? defaultApplicationData,
    };
    const incomingSnapshot = importObj.settings;

    // Compare shallow JSON of categories to avoid unnecessary import/reload
    const isSame = JSON.stringify(localSnapshot) === JSON.stringify(incomingSnapshot);
    if (isSame) return false;

    await importAllSettings(importObj);
    return true;
  } catch {
    return false;
  }
};

export const bootstrapSettingsFromServerIfEmpty = async (): Promise<'loaded' | 'skipped' | 'failed'> => {
  try {
    // If any critical category is missing locally, hydrate from server.
    const hasESI = localStorage.getItem('lmeve-settings-esi');
    const hasDB = localStorage.getItem('lmeve-settings-database');
    const hasGeneral = localStorage.getItem('lmeve-settings-general');

    const needsHydration = !hasESI || !hasDB || !hasGeneral;
    if (!needsHydration) return 'skipped';

    const ok = await loadSettingsFromServer();
    return ok ? 'loaded' : 'failed';
  } catch {
    return 'failed';
  }
};

// Configuration validation
export const validateSettings = (category: string, settings: any): string[] => {
  const errors: string[] = [];
  
  switch (category) {
    case 'general':
      if (settings.cacheEnabled) {
        if (typeof settings.cacheMaxSizeMB !== 'number' || settings.cacheMaxSizeMB < 16) {
          errors.push('Cache size must be at least 16 MB');
        }
      }
      if (settings.deploymentProtocol && !['http','https'].includes(settings.deploymentProtocol)) {
        errors.push('Deployment protocol must be http or https');
      }
      if (settings.authFlow && !['spa','server'].includes(settings.authFlow)) {
        errors.push('Auth flow must be spa or server');
      }
      break;
    case 'database':
      if (!settings.host) errors.push('Database host is required');
      if (!settings.database) errors.push('Database name is required');
      if (!settings.username) errors.push('Database username is required');
      break;
    case 'esi':
      if (!settings.clientId) errors.push('ESI Client ID is required');
      if (!settings.clientSecret) errors.push('ESI Client Secret is required');
      break;
    case 'notifications':
      if (settings.channels.email && !settings.emailSettings.smtpHost) {
        errors.push('SMTP host is required for email notifications');
      }
      if (settings.channels.webhook && !settings.webhookUrl) {
        errors.push('Webhook URL is required for webhook notifications');
      }
      break;
    case 'income':
      Object.entries(settings.hourlyRates).forEach(([key, value]) => {
        if (typeof value !== 'number' || value < 0) {
          errors.push(`Invalid hourly rate for ${key}`);
        }
      });
      break;
  }

  return errors;
};