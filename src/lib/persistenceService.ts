/**
 * Persistence Service for LMeve Settings and Data
 * 
 * This service provides a unified interface for managing application settings
 * using the useKV hooks and provides a unified interface for data operations.
 */

import { useKV } from '@github/spark/hooks';

export interface GeneralSettings {
  corpId: number;
  sessionTimeout: boolean;
  sessionTimeoutMinutes: number;
  maxLogRetentionDays: number;
  theme: 'dark' | 'light' | 'system';
  language: string;
  timezone: string;
}

export interface DatabaseSettings {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
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
}

export interface SyncSettings {
  enabled: boolean;
  autoSync: boolean;
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
    memberChanges: boolean;
    structureEvents: boolean;
    assetMovements: boolean;
    incomeUpdates: boolean;
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
  };
  paymentSettings: {
    currency: 'ISK';
    minimumPayout: number;
    paymentSchedule: 'daily' | 'weekly' | 'monthly';
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
  corporationId: number;
  permissions: string[];
  lastLogin: string;
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
  corpId: 0,
  sessionTimeout: true,
  sessionTimeoutMinutes: 60,
  maxLogRetentionDays: 30,
  theme: 'dark',
  language: 'en',
  timezone: 'UTC',
};

export const defaultDatabaseSettings: DatabaseSettings = {
  host: 'localhost',
  port: 3306,
  database: 'lmeve',
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
};

export const defaultESISettings: ESISettings = {
  clientId: '',
  clientSecret: '',
  callbackUrl: `${window.location.origin}/auth/callback`,
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
  updateSchedule: '0 2 * * 0', // Weekly at 2 AM on Sunday
  downloadUrl: 'https://www.fuzzwork.co.uk/dump/mysql-latest.tar.bz2',
  backupBeforeUpdate: true,
  cleanupAfterUpdate: true,
};

export const defaultSyncSettings: SyncSettings = {
  enabled: true,
  autoSync: true,
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
    memberChanges: true,
    structureEvents: false,
    assetMovements: false,
    incomeUpdates: false,
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
export const useGeneralSettings = () => useKV<GeneralSettings>('lmeve-settings-general', defaultGeneralSettings);
export const useDatabaseSettings = () => useKV<DatabaseSettings>('lmeve-settings-database', defaultDatabaseSettings);
export const useESISettings = () => useKV<ESISettings>('lmeve-settings-esi', defaultESISettings);
export const useSDESettings = () => useKV<SDESettings>('lmeve-settings-sde', defaultSDESettings);
export const useSyncSettings = () => useKV<SyncSettings>('lmeve-settings-sync', defaultSyncSettings);
export const useNotificationSettings = () => useKV<NotificationSettings>('lmeve-settings-notifications', defaultNotificationSettings);
export const useIncomeSettings = () => useKV<IncomeSettings>('lmeve-settings-income', defaultIncomeSettings);
export const useManualUsers = () => useKV<ManualUser[]>('lmeve-manual-users', []);
export const useApplicationData = () => useKV<ApplicationData>('lmeve-application-data', defaultApplicationData);
export const useCorporationData = () => useKV<CorporationData[]>('lmeve-corporation-data', []);

// Utility functions for data export/import
export const exportAllSettings = async () => {
  const settings = {
    general: await window.spark.kv.get<GeneralSettings>('lmeve-settings-general'),
    database: await window.spark.kv.get<DatabaseSettings>('lmeve-settings-database'),
    esi: await window.spark.kv.get<ESISettings>('lmeve-settings-esi'),
    sde: await window.spark.kv.get<SDESettings>('lmeve-settings-sde'),
    sync: await window.spark.kv.get<SyncSettings>('lmeve-settings-sync'),
    notifications: await window.spark.kv.get<NotificationSettings>('lmeve-settings-notifications'),
    income: await window.spark.kv.get<IncomeSettings>('lmeve-settings-income'),
    users: await window.spark.kv.get<ManualUser[]>('lmeve-manual-users'),
    application: await window.spark.kv.get<ApplicationData>('lmeve-application-data'),
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

  if (settings.general) await window.spark.kv.set('lmeve-settings-general', settings.general);
  if (settings.database) await window.spark.kv.set('lmeve-settings-database', settings.database);
  if (settings.esi) await window.spark.kv.set('lmeve-settings-esi', settings.esi);
  if (settings.sde) await window.spark.kv.set('lmeve-settings-sde', settings.sde);
  if (settings.sync) await window.spark.kv.set('lmeve-settings-sync', settings.sync);
  if (settings.notifications) await window.spark.kv.set('lmeve-settings-notifications', settings.notifications);
  if (settings.income) await window.spark.kv.set('lmeve-settings-income', settings.income);
  if (settings.users) await window.spark.kv.set('lmeve-manual-users', settings.users);
  if (settings.application) await window.spark.kv.set('lmeve-application-data', settings.application);
};

// Reset all settings to defaults
export const resetAllSettings = async () => {
  await window.spark.kv.set('lmeve-settings-general', defaultGeneralSettings);
  await window.spark.kv.set('lmeve-settings-database', defaultDatabaseSettings);
  await window.spark.kv.set('lmeve-settings-esi', defaultESISettings);
  await window.spark.kv.set('lmeve-settings-sde', defaultSDESettings);
  await window.spark.kv.set('lmeve-settings-sync', defaultSyncSettings);
  await window.spark.kv.set('lmeve-settings-notifications', defaultNotificationSettings);
  await window.spark.kv.set('lmeve-settings-income', defaultIncomeSettings);
  await window.spark.kv.set('lmeve-manual-users', []);
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

// Configuration validation
export const validateSettings = (category: string, settings: any): string[] => {
  const errors: string[] = [];
  
  switch (category) {
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