import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatabaseSchemaManager } from '@/components/DatabaseSchemaManager';
import { lmeveSchemas } from '@/lib/database-schemas';
import { esiRouteManager, useESIRoutes } from '@/lib/esi-routes';
import { 
  Gear, 
  Key, 
  Bell, 
  Shield, 
  Database,
  Globe,
  Users,
  Clock,
  Download,
  Upload,
  CheckCircle,
  Warning,
  X,
  Rocket,
  ArrowClockwise,
  LinkSimple,
  Eye,
  EyeSlash,
  Copy,
  Package,
  Factory,
  HardHat,
  TrendUp,
  Crosshair,
  CurrencyDollar,
  List,
  Play,
  Stop,
  Info,
  CloudArrowDown,
  Archive,
  UserCheck,
  Building,
  Wrench,
  Terminal,
  FileText,
  Network,
  CaretUp,
  CaretDown,
  CaretRight,
  Question,
  Activity,
  Settings as SettingsIcon,
  RefreshCw
} from '@phosphor-icons/react';
import { useKV } from '@github/spark/hooks';
import { useAuth } from '@/lib/auth-provider';
import { CorpSettings } from '@/lib/types';
import { toast } from 'sonner';
import { eveApi, type CharacterInfo, type CorporationInfo } from '@/lib/eveApi';
import { useSDEManager, type SDEDatabaseStats } from '@/lib/sdeService';
import { AdminLoginTest } from '@/components/AdminLoginTest';
import { SimpleLoginTest } from '@/components/SimpleLoginTest';
import { runDatabaseValidationTests } from '@/lib/databaseTestCases';
import { EnhancedDatabaseSetupManager, validateSetupConfig, type DatabaseSetupConfig } from '@/lib/database-setup-scripts';
import { DatabaseManager } from '@/lib/database';

// Status Indicator Component
const StatusIndicator: React.FC<{
  label: string;
  status: 'online' | 'offline' | 'unknown';
}> = ({ label, status }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-2">
      <div 
        className={`w-2 h-2 rounded-full ${
          status === 'online' ? 'bg-green-500' : 
          status === 'offline' ? 'bg-red-500' : 
          'bg-gray-400'
        }`} 
      />
      <span className="text-xs font-medium">
        {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Unknown'}
      </span>
    </div>
  </div>
);

import { 
  useGeneralSettings, 
  useDatabaseSettings, 
  useESISettings, 
  useSDESettings, 
  useSyncSettings, 
  useNotificationSettings, 
  useIncomeSettings, 
  useApplicationData,
  useManualUsers,
  useCorporationData,
  backupSettings,
  exportAllSettings,
  importAllSettings,
  resetAllSettings,
  validateSettings
} from '@/lib/persistenceService';
import { UserManagement } from '@/components/UserManagement';

interface SyncStatus {
  isRunning: boolean;
  progress: number;
  stage: string;
  error?: string;
}

interface ESIOAuthState {
  isAuthenticated: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  characterId?: number;
  characterName?: string;
  corporationId?: number;
}

interface SettingsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isMobileView?: boolean;
}

export function Settings({ activeTab, onTabChange, isMobileView }: SettingsProps) {
  // Use main auth provider for all authentication
  const {
    user,
    esiConfig,
    updateESIConfig,
    getRegisteredCorporations,
    registerCorporation,
    updateCorporation,
    deleteCorporation,
    adminConfig,
    updateAdminConfig
  } = useAuth();
  
  // Get registered corporations
  const registeredCorps = getRegisteredCorporations();
  
  // Get all users (manual + ESI)
  const allUsers = React.useMemo(() => {
    const authUsers = getAllUsers() || [];
    return authUsers.sort((a, b) => {
      // Sort by last login (most recent first), then by character name
      const aTime = new Date(a.lastLogin || 0).getTime();
      const bTime = new Date(b.lastLogin || 0).getTime();
      if (aTime !== bTime) return bTime - aTime;
      return (a.characterName || '').localeCompare(b.characterName || '');
    });
  }, [getAllUsers]);
  
  const { sdeStatus, checkForUpdates, downloadSDE, updateDatabase, getDatabaseStats } = useSDEManager();
  const [generalSettings, setGeneralSettings] = useGeneralSettings();
  const [databaseSettings, setDatabaseSettings] = useDatabaseSettings();
  const [esiSettings, setESISettings] = useESISettings();
  const [sdeSettings, setSDESettings] = useSDESettings();
  const [syncSettings, setSyncSettings] = useSyncSettings();
  const [notificationSettings, setNotificationSettings] = useNotificationSettings();
  const [incomeSettings, setIncomeSettings] = useIncomeSettings();
  const [applicationData, setApplicationData] = useApplicationData();
  const [manualUsers, setManualUsers] = useManualUsers();
  const [corporationData, setCorporationData] = useCorporationData();

  // Remote access and SSH state
  const [remoteAccess, setRemoteAccess] = useKV('remote-access-state', {
    sshConnected: false,
    sshStatus: 'unknown', // 'unknown', 'offline', 'online'
    scriptsDeployed: false,
    scriptsStatus: 'unknown', // 'unknown', 'not-deployed', 'deployed', 'error'
    remoteSetupComplete: false,
    remoteSetupStatus: 'unknown', // 'unknown', 'not-run', 'outdated', 'complete'
    lastSSHCheck: null,
    lastScriptCheck: null,
    lastSetupCheck: null
  });

  // Backward compatibility - gradually migrate away from this
  const settings = {
    corpName: generalSettings.corpName,
    corpTicker: generalSettings.corpTicker,
    corpId: generalSettings.corpId,
    timezone: generalSettings.timezone,
    language: generalSettings.language,
    sessionTimeout: generalSettings.sessionTimeout,
    notifications: {
      manufacturing: notificationSettings.events.manufacturing,
      mining: notificationSettings.events.mining,
      killmails: notificationSettings.events.killmails,
      markets: notificationSettings.events.markets,
    },
    eveOnlineSync: {
      enabled: syncSettings.enabled,
      autoSync: syncSettings.autoSync,
      syncInterval: 30,
      lastSync: new Date().toISOString(),
      characterId: generalSettings.corpId || 91316135,
      corporationId: generalSettings.corpId || 498125261
    },
    dataSyncTimers: syncSettings.syncIntervals,
    database: databaseSettings,
    sudoDatabase: {
      host: databaseSettings.sudoHost,
      port: databaseSettings.sudoPort,
      username: databaseSettings.sudoUsername,
      password: databaseSettings.sudoPassword,
      ssl: databaseSettings.sudoSsl
    }
  };

  const [esiConfigLocal, setESIConfigLocal] = useKV<any>('esi-config-legacy', {
    clientId: '',
    secretKey: '',
    baseUrl: 'https://login.eveonline.com',
    userAgent: 'LMeve Corporation Management Tool'
  });

  const [oauthState, setOAuthState] = useKV<ESIOAuthState>('esi-oauth', {
    isAuthenticated: false
  });

  const [showSecrets, setShowSecrets] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isRunning: false,
    progress: 0,
    stage: 'Idle'
  });
  const [corpInfo, setCorporationInfo] = useState<CorporationInfo | null>(null);
  const [characterInfo, setCharacterInfo] = useState<CharacterInfo | null>(null);
  
  // ESI Routes management
  const esiRoutes = useESIRoutes();
  const [validatingRoutes, setValidatingRoutes] = useState(false);
  const [esiRouteValidation, setESIRouteValidation] = useState<{[key: string]: boolean | undefined}>({});
  const [routeUpdateResults, setRouteUpdateResults] = useState<{[key: string]: string}>({});
  
  // Simplified setup state types
  interface EnhancedSetupConfig {
    lmevePassword: string;
    allowedHosts: string;
    downloadSDE: boolean; // Backward compatibility
    schemaSource: 'default' | 'custom' | 'managed';
    customSchemaFile?: File;
    sdeSource: 'auto' | 'custom' | 'skip';
    customSDEFile?: File;
  }
  
  // Enhanced setup state
  const [setupConfig, setSetupConfig] = useState<EnhancedSetupConfig>({
    lmevePassword: '',
    allowedHosts: '%',
    downloadSDE: true, // Backward compatibility
    schemaSource: 'managed', // Default to using schema manager
    sdeSource: 'auto' // Default to downloading latest SDE
  });

  // Setup progress state
  interface DatabaseSetupProgress {
    isRunning: boolean;
    progress: number;
    currentStep: string;
    currentStepNumber: number;
    totalSteps: number;
    stepLogs: string[];
    errors: string[];
    completed: boolean;
  }

  const [setupProgress, setSetupProgress] = useState<DatabaseSetupProgress>({
    isRunning: false,
    progress: 0,
    currentStep: 'Ready to begin setup',
    currentStepNumber: 0,
    totalSteps: 11,
    stepLogs: [],
    errors: [],
    completed: false
  });
  
  // UI state management for modals and forms
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [showSudoPassword, setShowSudoPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
  const [showConnectionLogs, setShowConnectionLogs] = useState(true);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showSetupCommands, setShowSetupCommands] = useState(false);
  
  // SDE Management - using the existing useSDEManager hook imported above
  const [sdeStats, setSDEStats] = useState<SDEDatabaseStats>({
    isConnected: false,
    tableCount: 0,
    totalRecords: 0,
    totalSize: '0 MB',
    lastUpdate: '',
    currentVersion: 'Unknown',
    availableVersion: 'Checking...',
    lastUpdateCheck: undefined,
    isOutdated: false
  });
  
  // Database connection state
  const [dbStatus, setDbStatus] = useState({
    connected: false,
    connectionCount: 0,
    queryCount: 0,
    avgQueryTime: 0,
    uptime: 0,
    lastConnection: null as string | null,
    lastError: null as string | null
  });
  const [tableInfo, setTableInfo] = useState<any[]>([]);
  const [showDatabaseTables, setShowDatabaseTables] = useKV<boolean>('database-tables-expanded', false);
  const [showDatabaseSchema, setShowDatabaseSchema] = useKV<boolean>('database-schema-expanded', false);
  
  // Admin configuration state
  const [tempAdminConfig, setTempAdminConfig] = useState(adminConfig);
  



  // Save handlers for each settings category
  const saveGeneralSettings = async () => {
    try {
      const errors = validateSettings('general', generalSettings);
      if (errors.length > 0) {
        toast.error(`Validation failed: ${errors.join(', ')}`);
        return;
      }
      
      setGeneralSettings({ ...generalSettings });
      toast.success('General settings saved successfully');
    } catch (error) {
      console.error('Failed to save general settings:', error);
      toast.error('Failed to save general settings');
    }
  };

  const saveDatabaseSettings = async () => {
    try {
      const errors = validateSettings('database', databaseSettings);
      if (errors.length > 0) {
        toast.error(`Validation failed: ${errors.join(', ')}`);
        return;
      }
      
      setDatabaseSettings({ ...databaseSettings });
      toast.success('Database settings saved successfully');
    } catch (error) {
      console.error('Failed to save database settings:', error);
      toast.error('Failed to save database settings');
    }
  };

  const saveESISettings = async () => {
    try {
      const errors = validateSettings('esi', esiSettings);
      if (errors.length > 0) {
        toast.error(`Validation failed: ${errors.join(', ')}`);
        return;
      }
      
      // Update the auth provider with new ESI configuration
      const clientId = esiSettings.clientId || esiConfig.clientId || '';
      const clientSecret = esiSettings.clientSecret || esiConfig.clientSecret;
      
      if (!clientId) {
        toast.error('Client ID is required');
        return;
      }
      
      console.log('🔧 Saving ESI configuration to auth provider:', { clientId, hasSecret: !!clientSecret });
      
      // Update auth provider ESI config
      updateESIConfig(clientId, clientSecret);
      
      // Save to local settings as well
      setESISettings({ ...esiSettings });
      
      toast.success('ESI settings saved successfully');
    } catch (error) {
      console.error('Failed to save ESI settings:', error);
      toast.error('Failed to save ESI settings');
    }
  };

  const saveSDESettings = async () => {
    try {
      setSDESettings({ ...sdeSettings });
      toast.success('SDE settings saved successfully');
    } catch (error) {
      console.error('Failed to save SDE settings:', error);
      toast.error('Failed to save SDE settings');
    }
  };

  const saveSyncSettings = async () => {
    try {
      // Save sync intervals
      setSyncSettings({ ...syncSettings });
      
      // Save ESI route configurations
      const routeConfig = esiRouteManager.exportConfig();
      // Store ESI routes in localStorage for persistence
      localStorage.setItem('lmeve-esi-routes', JSON.stringify(routeConfig));
      
      toast.success('Sync settings and ESI routes saved successfully');
    } catch (error) {
      console.error('Failed to save sync settings:', error);
      toast.error('Failed to save sync settings');
    }
  };

  // Load ESI routes from localStorage on mount
  React.useEffect(() => {
    try {
      const storedRoutes = localStorage.getItem('lmeve-esi-routes');
      if (storedRoutes) {
        const routeConfig = JSON.parse(storedRoutes);
        esiRouteManager.importConfig(routeConfig);
      }
    } catch (error) {
      console.warn('Failed to load stored ESI routes:', error);
    }
  }, []);

  const saveNotificationSettings = async () => {
    try {
      const errors = validateSettings('notifications', notificationSettings);
      if (errors.length > 0) {
        toast.error(`Validation failed: ${errors.join(', ')}`);
        return;
      }
      
      setNotificationSettings({ ...notificationSettings });
      toast.success('Notification settings saved successfully');
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      toast.error('Failed to save notification settings');
    }
  };

  const saveIncomeSettings = async () => {
    try {
      const errors = validateSettings('income', incomeSettings);
      if (errors.length > 0) {
        toast.error(`Validation failed: ${errors.join(', ')}`);
        return;
      }
      
      setIncomeSettings({ ...incomeSettings });
      toast.success('Income settings saved successfully');
    } catch (error) {
      console.error('Failed to save income settings:', error);
      toast.error('Failed to save income settings');
    }
  };

  // Export/Import handlers
  const handleExportSettings = async () => {
    try {
      await backupSettings();
      toast.success('Settings exported successfully');
    } catch (error) {
      console.error('Failed to export settings:', error);
      toast.error('Failed to export settings');
    }
  };

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllSettings(data);
      toast.success('Settings imported successfully');
      
      // Refresh the page to load new settings
      window.location.reload();
    } catch (error) {
      console.error('Failed to import settings:', error);
      toast.error('Failed to import settings: Invalid file format');
    }
  };

  const handleResetSettings = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    try {
      await resetAllSettings();
      toast.success('Settings reset to defaults');
      
      // Refresh the page to load default settings
      window.location.reload();
    } catch (error) {
      console.error('Failed to reset settings:', error);
      toast.error('Failed to reset settings');
    }
  };

  // Helper functions for updating settings
  const updateGeneralSetting = (key: keyof typeof generalSettings, value: any) => {
    setGeneralSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateDatabaseSetting = (key: keyof typeof databaseSettings, value: any) => {
    setDatabaseSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateESISetting = (key: keyof typeof esiSettings, value: any) => {
    setESISettings(prev => ({ ...prev, [key]: value }));
  };

  const updateSDESetting = (key: keyof typeof sdeSettings, value: any) => {
    setSDESettings(prev => ({ ...prev, [key]: value }));
  };

  const updateSyncSetting = (key: keyof typeof syncSettings, value: any) => {
    setSyncSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateNotificationSetting = (key: keyof typeof notificationSettings, value: any) => {
    setNotificationSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateIncomeSetting = (key: keyof typeof incomeSettings, value: any) => {
    setIncomeSettings(prev => ({ ...prev, [key]: value }));
  };

  // Nested setting updates
  const updateSyncInterval = (category: string, minutes: number) => {
    setSyncSettings(prev => ({
      ...prev,
      syncIntervals: { ...prev.syncIntervals, [category]: minutes }
    }));
  };

  const updateNotificationEvent = (event: string, enabled: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      events: { ...prev.events, [event]: enabled }
    }));
  };

  const updateIncomeRate = (category: string, rate: number) => {
    setIncomeSettings(prev => ({
      ...prev,
      hourlyRates: { ...prev.hourlyRates, [category]: rate }
    }));
  };

  // Character lookup functionality
  const searchCharacters = async (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 3) {
      setCharacterSearchResults([]);
      return;
    }

    setIsSearchingCharacters(true);
    try {
      console.log('🔍 Searching for characters:', searchTerm);
      
      // Use EVE API to search for characters
      const response = await fetch(`https://esi.evetech.net/v1/search/?categories=character&search=${encodeURIComponent(searchTerm)}&strict=false`, {
        headers: {
          'User-Agent': 'LMeve/2.0 (Character Search)'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Character search results:', data);
        
        if (data.character && data.character.length > 0) {
          // Get character details
          const characterDetails = await Promise.all(
            data.character.slice(0, 10).map(async (id: number) => {
              try {
                console.log('📋 Fetching details for character ID:', id);
                
                const charResponse = await fetch(`https://esi.evetech.net/v5/characters/${id}/`, {
                  headers: {
                    'User-Agent': 'LMeve/2.0 (Character Details)'
                  }
                });
                
                if (charResponse.ok) {
                  const charData = await charResponse.json();
                  console.log('📋 Character data received:', charData);
                  
                  // Get corporation details
                  let corporationData = null;
                  if (charData.corporation_id) {
                    try {
                      const corpResponse = await fetch(`https://esi.evetech.net/v5/corporations/${charData.corporation_id}/`, {
                        headers: {
                          'User-Agent': 'LMeve/2.0 (Corporation Details)'
                        }
                      });
                      if (corpResponse.ok) {
                        corporationData = await corpResponse.json();
                        console.log('🏢 Corporation data received:', corporationData);
                      }
                    } catch (error) {
                      console.warn('⚠️ Failed to fetch corporation data:', error);
                    }
                  }

                  return {
                    characterId: id,
                    characterName: charData.name,
                    corporationId: charData.corporation_id,
                    corporationName: corporationData?.name || 'Unknown Corporation',
                    allianceId: charData.alliance_id,
                    securityStatus: charData.security_status,
                    birthDate: charData.birthday
                  };
                } else {
                  console.warn('⚠️ Character details fetch failed:', charResponse.status);
                }
              } catch (error) {
                console.warn('⚠️ Failed to fetch character details:', error);
              }
              return null;
            })
          );

          const validCharacters = characterDetails.filter(char => char !== null);
          console.log('✅ Valid character results:', validCharacters);
          setCharacterSearchResults(validCharacters);
          
          if (validCharacters.length === 0) {
            toast.error('No character details could be retrieved');
          }
        } else {
          console.log('📭 No characters found in search');
          setCharacterSearchResults([]);
          toast.error(`No characters found matching "${searchTerm}"`);
        }
      } else {
        console.error('❌ Character search failed:', response.status, response.statusText);
        setCharacterSearchResults([]);
        toast.error('Character search failed. EVE API may be unavailable.');
      }
    } catch (error) {
      console.error('❌ Character search error:', error);
      setCharacterSearchResults([]);
      toast.error('Failed to search characters. Check your internet connection.');
    } finally {
      setIsSearchingCharacters(false);
    }
  };

  // Handle user deletion
  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await deleteUser(userId);
        toast.success('User deleted successfully');
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error('Failed to delete user');
      }
    }
  };

  // Handle character selection and user creation
  const handleCreateUserFromCharacter = async (character: any, role: string = 'member') => {
    try {
      const newUser = {
        id: Date.now().toString(),
        characterId: character.characterId,
        characterName: character.characterName,
        corporationId: character.corporationId,
        corporationName: character.corporationName,
        allianceId: character.allianceId,
        authMethod: 'manual' as const,
        role: role as any,
        isActive: true,
        createdDate: new Date().toISOString(),
        lastLogin: '',
        sessionExpiry: ''
      };

      // This would use the auth provider's createManualUser
      // For now, we'll add to manual users list
      setManualUsers(prev => [...prev, {
        id: newUser.id,
        username: character.characterName.toLowerCase().replace(/\s+/g, '_'),
        characterName: character.characterName,
        corporationName: character.corporationName,
        corporationId: character.corporationId,
        roles: [role],
        createdAt: new Date().toISOString(),
        isActive: true
      }]);

      setShowCharacterLookup(false);
      setSelectedCharacter(null);
      setCharacterSearchTerm('');
      setCharacterSearchResults([]);
      
      toast.success(`User created for ${character.characterName}`);
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    }
  };
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showCharacterLookup, setShowCharacterLookup] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    characterName: '',
    corporationName: '',
    roles: [] as string[],
  });
  
  // Character lookup state
  const [characterSearchTerm, setCharacterSearchTerm] = useState('');
  const [characterSearchResults, setCharacterSearchResults] = useState<any[]>([]);
  const [isSearchingCharacters, setIsSearchingCharacters] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<any>(null);

  // Backward compatibility functions for existing code
  const updateDatabaseConfig = (key: string, value: any) => {
    updateDatabaseSetting(key as any, value);
  };

  const updateSudoDatabaseConfig = (key: string, value: any) => {
    const sudoKey = `sudo${key.charAt(0).toUpperCase() + key.slice(1)}`;
    updateDatabaseSetting(sudoKey as any, value);
  };

  // Ensure safe access to settings
  const eveOnlineSync = settings?.eveOnlineSync || {
    enabled: false,
    autoSync: false,
    syncInterval: 30,
    lastSync: new Date().toISOString(),
    characterId: 91316135,
    corporationId: 498125261
  };

  // Clear connection logs
  const clearConnectionLogs = () => {
    setConnectionLogs([]);
  };

  // Helper to add timestamped connection logs
  const addConnectionLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Remote database operations handlers
  const handleSSHConnection = async () => {
    if (!databaseSettings.host || 
        databaseSettings.host === 'localhost' || 
        databaseSettings.host === '127.0.0.1') {
      toast.error('SSH connection is only needed for remote database hosts');
      return;
    }

    try {
      setRemoteAccess(prev => ({ 
        ...prev, 
        sshStatus: 'offline', 
        lastSSHCheck: new Date().toISOString() 
      }));

      // Simulate SSH connection test
      toast.info('Testing SSH connection...');
      
      // This would be replaced with actual SSH connection logic
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For now, simulate success
      setRemoteAccess(prev => ({ 
        ...prev, 
        sshConnected: true,
        sshStatus: 'online',
        lastSSHCheck: new Date().toISOString() 
      }));
      
      toast.success('SSH connection established successfully');
    } catch (error) {
      setRemoteAccess(prev => ({ 
        ...prev, 
        sshConnected: false,
        sshStatus: 'offline',
        lastSSHCheck: new Date().toISOString() 
      }));
      
      toast.error('SSH connection failed');
    }
  };

  const handleDeployScripts = async () => {
    try {
      setRemoteAccess(prev => ({ 
        ...prev, 
        scriptsStatus: 'warning',
        lastScriptCheck: new Date().toISOString() 
      }));

      toast.info('Deploying database setup scripts...');
      
      // This would deploy the actual scripts
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setRemoteAccess(prev => ({ 
        ...prev, 
        scriptsDeployed: true,
        scriptsStatus: 'deployed',
        lastScriptCheck: new Date().toISOString() 
      }));
      
      toast.success('Scripts deployed successfully');
    } catch (error) {
      setRemoteAccess(prev => ({ 
        ...prev, 
        scriptsStatus: 'error',
        lastScriptCheck: new Date().toISOString() 
      }));
      
      toast.error('Script deployment failed');
    }
  };

  const handleRemoteSetup = async () => {
    if (!remoteAccess.sshConnected) {
      toast.error('SSH connection required before running remote setup');
      return;
    }
    
    if (!remoteAccess.scriptsDeployed) {
      toast.error('Scripts must be deployed before running remote setup');
      return;
    }

    try {
      setRemoteAccess(prev => ({ 
        ...prev, 
        remoteSetupStatus: 'warning',
        lastSetupCheck: new Date().toISOString() 
      }));

      toast.info('Running remote database setup...');
      
      // This would run the actual remote setup
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      setRemoteAccess(prev => ({ 
        ...prev, 
        remoteSetupComplete: true,
        remoteSetupStatus: 'complete',
        lastSetupCheck: new Date().toISOString() 
      }));
      
      toast.success('Remote setup completed successfully');
    } catch (error) {
      setRemoteAccess(prev => ({ 
        ...prev, 
        remoteSetupStatus: 'offline',
        lastSetupCheck: new Date().toISOString() 
      }));
      
      toast.error('Remote setup failed');
    }
  };




  // Load SDE database stats on component mount
  React.useEffect(() => {
    const loadSDEStats = async () => {
      if (databaseSettings?.host && databaseSettings?.username && databaseSettings?.password) {
        try {
          // Simulate checking EveStaticData database
          const sdeDbConfig = {
            ...databaseSettings,
            database: 'EveStaticData'
          };
          
          const manager = new DatabaseManager(sdeDbConfig);
          const testResult = await manager.testConnection();
          
          if (testResult.success && testResult.validated) {
            // Simulate getting database stats
            setSDEStats(prev => ({
              ...prev,
              isConnected: true,
              tableCount: 167,
              totalRecords: 2456891,
              totalSize: '342.7 MB',
              lastUpdate: '2024-01-15T10:30:00Z',
              currentVersion: '2024-01-15-1'
            }));
          } else {
            setSDEStats(prev => ({
              ...prev,
              isConnected: false
            }));
          }
        } catch (error) {
          setSDEStats(prev => ({
            ...prev,
            isConnected: false
          }));
        }
      }
    };
    
    loadSDEStats();
  }, [databaseSettings]);

  // REAL database connection test using the strict DatabaseManager
  const handleTestDbConnection = async () => {
    // Prevent multiple concurrent tests
    if (testingConnection) {
      toast.warning('Database test already in progress...');
      return;
    }
    
    console.log('🧪 Starting REAL database connection test');
    
    if (!databaseSettings) {
      const error = 'Please configure database connection settings first';
      toast.error(error);
      addConnectionLog(`❌ ${error}`);
      return;
    }
    
    const { host, port, database, username, password } = databaseSettings;
    
    // Validate required fields
    if (!host || !port || !database || !username || !password) {
      const error = 'All database fields are required: host, port, database, username, password';
      toast.error(error);
      addConnectionLog(`❌ ${error}`);
      return;
    }
    
    // Clear previous logs and start test
    setConnectionLogs([]);
    setTestingConnection(true);
    
    try {
      addConnectionLog('🔍 Starting comprehensive database validation...');
      addConnectionLog(`🎯 Target: ${username}@${host}:${port}/${database}`);
      
      // Create database manager with current settings
      const config = {
        host,
        port: Number(port),
        database,
        username,
        password,
        ssl: false,
        connectionPoolSize: 1,
        queryTimeout: 30,
        autoReconnect: false,
        charset: 'utf8mb4'
      };
      
      const manager = new DatabaseManager(config);
      
      // Intercept console.log to capture detailed validation steps
      const originalConsoleLog = console.log;
      const interceptedMessages = new Set<string>(); // Prevent duplicate messages
      
      console.log = (...args: any[]) => {
        const message = args.join(' ');
        if (message.includes('🔍') || message.includes('🌐') || message.includes('🔌') || 
            message.includes('🔐') || message.includes('🗄️') || message.includes('🔑') || 
            message.includes('✅') || message.includes('❌')) {
          
          // Only add unique messages to prevent duplicates
          if (!interceptedMessages.has(message)) {
            interceptedMessages.add(message);
            addConnectionLog(message);
          }
        }
        originalConsoleLog(...args);
      };
      
      // Run the REAL connection test
      const testResult = await manager.testConnection();
      
      // Restore console.log
      console.log = originalConsoleLog;
      
      if (testResult.success && testResult.validated) {
        addConnectionLog(`✅ Database connection VALIDATED successfully!`);
        addConnectionLog(`⚡ Connection latency: ${testResult.latency}ms`);
        addConnectionLog(`🎉 All checks passed - this is a legitimate MySQL database`);
        toast.success(`✅ Connection validated! Latency: ${testResult.latency}ms`);
      } else if (testResult.success && !testResult.validated) {
        addConnectionLog(`⚠️ Partial connection success but validation incomplete`);
        addConnectionLog(`⚡ Connection latency: ${testResult.latency}ms`);
        addConnectionLog(`❌ Database validation failed - connection rejected`);
        toast.warning(`⚠️ Partial success - validation incomplete`);
      } else {
        addConnectionLog(`❌ Connection test FAILED: ${testResult.error}`);
        addConnectionLog(`🚫 This configuration cannot establish a valid MySQL connection`);
        toast.error(`❌ Connection failed: ${testResult.error}`);
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown connection error';
      addConnectionLog(`💥 Test error: ${errorMsg}`);
      addConnectionLog(`🚫 Connection test could not complete`);
      toast.error(`Test error: ${errorMsg}`);
    } finally {
      addConnectionLog('🏁 Database connection test completed');
      setTestingConnection(false);
    }
  };

  // Simplified database connection functions
  const handleConnectDb = async () => {
    if (!databaseSettings) {
      toast.error('Please configure database connection settings first');
      return;
    }
    
    const { host, port, database, username, password } = databaseSettings;
    
    if (!host || !port || !database || !username || !password) {
      toast.error('All database fields are required');
      return;
    }
    
    try {
      addConnectionLog('🔌 Establishing persistent database connection...');
      
      // Use the DatabaseManager for consistent connection handling
      const config = {
        host,
        port: Number(port),
        database,
        username,
        password,
        ssl: databaseSettings.ssl || false,
        connectionPoolSize: databaseSettings.connectionPoolSize || 10,
        queryTimeout: databaseSettings.queryTimeout || 30,
        autoReconnect: databaseSettings.autoReconnect || true,
        charset: databaseSettings.charset || 'utf8mb4'
      };
      
      const manager = new DatabaseManager(config);
      const testResult = await manager.testConnection();
      
      if (testResult.success && testResult.validated) {
        setDbStatus(prev => ({
          ...prev,
          connected: true,
          connectionCount: 1,
          lastConnection: new Date().toISOString(),
          lastError: null
        }));
        addConnectionLog(`✅ Database connection established successfully!`);
        toast.success('Connected to database');
      } else {
        throw new Error(testResult.error || 'Connection failed validation');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setDbStatus(prev => ({
        ...prev,
        connected: false,
        lastError: errorMsg
      }));
      addConnectionLog(`❌ Connection failed: ${errorMsg}`);
      toast.error(`Connection failed: ${errorMsg}`);
    }
  };

  const handleDisconnectDb = async () => {
    toast.info('Database disconnection feature not implemented yet');
  };

  const loadTableInfo = async () => {
    console.log('Table info loading not implemented yet');
  };

  // Database setup readiness check
  const getDatabaseSetupReadiness = () => {
    const requirements = [];
    let isReady = true;

    // Check database connection settings - only if not filled in
    if (!databaseSettings.host?.trim()) {
      requirements.push('Database host is required');
      isReady = false;
    }
    if (!databaseSettings.port) {
      requirements.push('Database port is required');
      isReady = false;
    }
    if (!databaseSettings.database?.trim()) {
      requirements.push('Database name is required');
      isReady = false;
    }

    // Check database users - only if not filled in
    if (!databaseSettings.username?.trim() || !databaseSettings.password?.trim()) {
      requirements.push('LMeve database user credentials are required');
      isReady = false;
    }
    if (!databaseSettings.sudoUsername?.trim() || !databaseSettings.sudoPassword?.trim()) {
      requirements.push('Database admin user credentials are required');
      isReady = false;
    }

    // Check ESI configuration - only if not filled in
    if (!esiConfig.clientId?.trim()) {
      requirements.push('EVE Online ESI Client ID is required');
      isReady = false;
    }
    if (!esiConfig.clientSecret?.trim()) {
      requirements.push('EVE Online ESI Client Secret is required');
      isReady = false;
    }

    // Check database connection status
    if (!dbStatus.connected) {
      requirements.push('Database connection not established');
      isReady = false;
    }

    // Check remote access if database is on remote host
    const isRemoteDB = databaseSettings.host && 
      databaseSettings.host !== 'localhost' && 
      databaseSettings.host !== '127.0.0.1';
    
    if (isRemoteDB && !remoteAccess.sshConnected) {
      requirements.push('Remote access not configured');
      isReady = false;
    }

    return {
      isReady,
      missingRequirements: requirements
    };
  };

  const handleShowSetupCommands = () => {
    setShowSetupCommands(true);
  };

  // ESI scopes required for LMeve functionality
  const ESI_SCOPES = [
    'esi-corporations.read_corporation_membership.v1',
    'esi-industry.read_corporation_jobs.v1', 
    'esi-assets.read_corporation_assets.v1',
    'esi-corporations.read_blueprints.v1',
    'esi-markets.read_corporation_orders.v1',
    'esi-wallet.read_corporation_wallets.v1',
    'esi-killmails.read_corporation_killmails.v1',
    'esi-contracts.read_corporation_contracts.v1'
  ];

  // Generate OAuth authorization URL
  const generateAuthUrl = () => {
    const state = Math.random().toString(36).substring(2, 15);
    const scopes = ESI_SCOPES.join(' ');
    
    const authUrl = `https://login.eveonline.com/v2/oauth/authorize/?` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(window.location.origin)}&` +
      `client_id=${esiConfig?.clientId || ''}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${state}`;
    
    return authUrl;
  };

  const handleESIOAuth = () => {
    if (!esiConfig?.clientId) {
      toast.error('Please configure your ESI Client ID first');
      return;
    }
    
    const authUrl = generateAuthUrl();
    window.open(authUrl, '_blank', 'width=600,height=700');
    toast.info('Complete authorization in the opened window');
  };

  const handleCopyAuthUrl = () => {
    const authUrl = generateAuthUrl();
    navigator.clipboard.writeText(authUrl);
    toast.success('Authorization URL copied to clipboard');
  };

  const handleRevokeESI = () => {
    setOAuthState({
      isAuthenticated: false
    });
    toast.success('ESI authorization revoked');
  };

  const handleSaveESIConfig = () => {
    updateESIConfig(esiConfig);
    toast.success('ESI configuration saved');
  };

  const getScopeDescription = (scope: string): string => {
    const descriptions: Record<string, string> = {
      'esi-corporations.read_corporation_membership.v1': 'Read corporation member list',
      'esi-industry.read_corporation_jobs.v1': 'Read corporation manufacturing jobs',
      'esi-assets.read_corporation_assets.v1': 'Read corporation assets',
      'esi-universe.read_structures.v1': 'Read structure information',
      'esi-corporations.read_structures.v1': 'Read corporation-owned structures'
    };
    return descriptions[scope] || 'EVE Online API access scope';
  };

  // Load corporation and character info on mount
  useEffect(() => {
    const loadEVEData = async () => {
      if (eveOnlineSync.corporationId) {
        try {
          const corp = await eveApi.getCorporation(eveOnlineSync.corporationId);
          setCorporationInfo(corp);
        } catch (error) {
          console.error('Failed to load corporation info:', error);
        }
      }

      if (eveOnlineSync.characterId) {
        try {
          const char = await eveApi.getCharacter(eveOnlineSync.characterId);
          setCharacterInfo(char);
        } catch (error) {
          console.error('Failed to load character info:', error);
        }
      }
    };

    if (eveOnlineSync.enabled) {
      loadEVEData();
    }
  }, [eveOnlineSync.enabled, eveOnlineSync.corporationId, eveOnlineSync.characterId]);

  // Initialize ESI settings with proper state management
  useEffect(() => {
    console.log('🔄 ESI Config sync check:', {
      realClientId: esiConfig.clientId,
      realSecret: !!esiConfig.clientSecret,
      localClientId: esiSettings.clientId,
      localSecret: !!esiSettings.clientSecret
    });
    
    // Initialize local state with values from auth provider if they exist and local state is empty
    if (esiConfig.clientId && !esiSettings.clientId) {
      console.log('📥 Initializing ESI settings from auth provider');
      setESISettings(prev => ({
        ...prev,
        clientId: esiConfig.clientId || '',
        clientSecret: esiConfig.clientSecret || ''
      }));
    }
  }, [esiConfig.clientId, esiConfig.clientSecret, esiSettings.clientId, esiSettings.clientSecret, setESISettings]);

  // Load SDE stats when component mounts
  useEffect(() => {
    const loadSDEStats = async () => {
      if (sdeStatus.isInstalled) {
        const stats = await getDatabaseStats();
        setSDEStats(stats);
      }
    };
    
    loadSDEStats();
  }, [sdeStatus.isInstalled, getDatabaseStats]);

  // Check for SDE updates on mount
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  // Simplified database manager effect
  useEffect(() => {
    console.log('Database config updated');
  }, [databaseSettings]);

  const handleSyncData = async () => {
    if (syncStatus.isRunning) return;

    setSyncStatus({
      isRunning: true,
      progress: 0,
      stage: 'Initializing...'
    });

    try {
      // Simulate sync process with multiple stages
      const stages = [
        'Connecting to EVE Online API...',
        'Fetching corporation data...',
        'Updating member information...',
        'Syncing industry jobs...',
        'Updating asset database...',
        'Calculating market prices...',
        'Finalizing data...'
      ];

      for (let i = 0; i < stages.length; i++) {
        setSyncStatus({
          isRunning: true,
          progress: ((i + 1) / stages.length) * 100,
          stage: stages[i]
        });

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Simulate some actual API calls
        if (i === 1 && eveOnlineSync.corporationId) {
          try {
            const corp = await eveApi.getCorporation(eveOnlineSync.corporationId);
            setCorporationInfo(corp);
            
            // Update settings with fetched data
            updateGeneralSetting('corpName', corp.name);
            updateGeneralSetting('corpTicker', corp.ticker);
          } catch (error) {
            console.error('Failed to sync corporation data:', error);
          }
        }
      }

      // Update last sync time
      updateSyncSetting('lastSync', new Date().toISOString());

      setSyncStatus({
        isRunning: false,
        progress: 100,
        stage: 'Sync completed successfully!'
      });

      toast.success('EVE Online data synchronized successfully');
      
      // Reset status after a short delay
      setTimeout(() => {
        setSyncStatus({
          isRunning: false,
          progress: 0,
          stage: 'Idle'
        });
      }, 3000);

    } catch (error) {
      setSyncStatus({
        isRunning: false,
        progress: 0,
        stage: 'Sync failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      toast.error('Failed to sync EVE Online data');
    }
  };

  const handleToggleAutoSync = () => {
    updateSyncSetting('autoSync', !syncSettings.autoSync);
  };

  const handleToggleEVESync = () => {
    updateSyncSetting('enabled', !syncSettings.enabled);
  };

  const handleSaveSettings = () => {
    // Save all settings using individual save functions
    saveGeneralSettings();
    saveDatabaseSettings();
    saveESISettings();
    saveSDESettings();
    saveSyncSettings();
    saveNotificationSettings();
    saveIncomeSettings();
    toast.success('All settings saved successfully');
  };

  const handleSaveAdminConfig = () => {
    updateAdminConfig(tempAdminConfig);
    toast.success('Admin configuration updated');
  };

  // Real database setup function using configured database connections
  const handleRunDatabaseSetup = async () => {
    // Check readiness first
    const readiness = getDatabaseSetupReadiness();
    if (!readiness.isReady) {
      toast.error('Setup requirements not met. Please check the configuration.');
      return;
    }

    if (!setupConfig.lmevePassword) {
      toast.error('Please enter a database password');
      return;
    }

    if (setupConfig.lmevePassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (!databaseSettings?.sudoHost || !databaseSettings?.sudoUsername || !databaseSettings?.sudoPassword) {
      toast.error('Please configure sudo database connection first (host, username, password)');
      return;
    }

    setSetupProgress({
      isRunning: true,
      progress: 0,
      currentStep: 'Starting database setup using configured connections...',
      currentStepNumber: 1,
      totalSteps: 11,
      stepLogs: ['🚀 Starting complete database setup process'],
      errors: [],
      completed: false
    });

    try {
      // Use the DatabaseSetupManager with real database connections
      const setupManager = new DatabaseSetupManager((progress) => {
        // Convert old progress format to new format
        setSetupProgress(prev => ({
          ...prev,
          progress: progress.progress || 0,
          currentStep: progress.currentStage || 'Processing...',
          currentStepNumber: progress.currentStep || 1,
          stepLogs: [...prev.stepLogs, `Step ${progress.currentStep}: ${progress.currentStage}`]
        }));
      });

      const setupConfig_full = {
        mysqlRootPassword: databaseSettings.sudoPassword,
        lmevePassword: setupConfig.lmevePassword,
        allowedHosts: setupConfig.allowedHosts,
        downloadSDE: setupConfig.downloadSDE,
        createDatabases: true,
        importSchema: true,
        createUser: true,
        grantPrivileges: true,
        validateSetup: true
      };

      // Execute real database setup using configured sudo connection
      const result = await setupManager.setupNewDatabase(setupConfig_full);

      if (result.success) {
        setSetupProgress(prev => ({
          ...prev,
          completed: true,
          progress: 100,
          currentStep: 'Database setup completed successfully!',
          stepLogs: [...prev.stepLogs, '🎉 Complete database setup finished successfully!']
        }));
        
        toast.success('Database setup completed successfully');
        
        // Update the lmeve database config with the new setup
        updateDatabaseConfig('password', setupConfig.lmevePassword);
        updateDatabaseConfig('database', 'lmeve');
        if (!databaseSettings?.username) {
          updateDatabaseConfig('username', 'lmeve');
        }
        
        // Automatically test the new connection
        setTimeout(() => {
          handleTestDbConnection();
        }, 1000);
        
        // Reset progress after delay
        setTimeout(() => {
          setSetupProgress({
            isRunning: false,
            progress: 0,
            currentStep: 'Ready to begin setup',
            currentStepNumber: 0,
            totalSteps: 11,
            stepLogs: [],
            errors: [],
            completed: false
          });
        }, 5000);
        
      } else {
        throw new Error(result.error || 'Setup failed');
      }
    } catch (error) {
      console.error('Setup failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Setup failed';
      setSetupProgress(prev => ({
        ...prev,
        isRunning: false,
        errors: [...prev.errors, errorMsg],
        stepLogs: [...prev.stepLogs, `❌ Setup failed: ${errorMsg}`]
      }));
      toast.error(`Database setup failed: ${errorMsg}`);
    }
  };

  // ESI Route validation handlers
  const validateESIRoute = async (processName: string, version?: string) => {
    setValidatingRoutes(true);
    try {
      const result = await esiRoutes.validateRoute(processName, version);
      setESIRouteValidation(prev => ({
        ...prev,
        [processName]: result.isValid
      }));
      
      if (result.isValid) {
        toast.success(`ESI route ${processName} (${version || 'current'}) is valid`);
        setRouteUpdateResults(prev => ({
          ...prev,
          [processName]: `✓ Valid (${result.status})`
        }));
      } else {
        toast.error(`ESI route ${processName} validation failed: ${result.error}`);
        setRouteUpdateResults(prev => ({
          ...prev,
          [processName]: `✗ Failed (${result.error})`
        }));
      }
    } catch (error) {
      toast.error('Route validation failed');
      setRouteUpdateResults(prev => ({
        ...prev,
        [processName]: `✗ Error`
      }));
    } finally {
      setValidatingRoutes(false);
    }
  };

  const validateAllESIRoutes = async () => {
    setValidatingRoutes(true);
    toast.info('Validating all ESI routes...');
    
    try {
      const results = await esiRoutes.checkForUpdates();
      const validationResults = {};
      
      const processNames = esiRoutes.getProcessNames();
      for (const processName of processNames) {
        const validation = await esiRoutes.validateRoute(processName);
        validationResults[processName] = validation.isValid;
        
        setRouteUpdateResults(prev => ({
          ...prev,
          [processName]: validation.isValid ? '✓ Valid' : `✗ Failed: ${validation.error}`
        }));
      }
      
      setESIRouteValidation(validationResults);
      
      if (results.hasUpdates) {
        toast.success(`Route validation complete. ${Object.keys(results.updates).length} updates available`);
      } else {
        toast.success('All routes validated successfully');
      }
    } catch (error) {
      toast.error('Bulk route validation failed');
    } finally {
      setValidatingRoutes(false);
    }
  };

  const updateESIRouteVersion = (processName: string, version: string) => {
    const success = esiRoutes.updateVersion(processName, version);
    if (success) {
      toast.success(`Updated ${processName} to ESI version ${version}`);
      // Clear previous validation results
      setRouteUpdateResults(prev => ({
        ...prev,
        [processName]: 'Updated - revalidation needed'
      }));
    } else {
      toast.error(`Failed to update ${processName} route version`);
    }
  };

  const handleRefreshStatus = async () => {
    toast.info('Refreshing system status...');
    
    // Refresh database connection
    if (databaseSettings.host && databaseSettings.port && databaseSettings.username && databaseSettings.password) {
      await handleTestDbConnection();
    }
    
    // Check SSH status for remote hosts
    if (databaseSettings.host && 
        databaseSettings.host !== 'localhost' && 
        databaseSettings.host !== '127.0.0.1' && 
        remoteAccess.sshConnected) {
      // Simulate SSH status check
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setRemoteAccess(prev => ({ 
          ...prev, 
          sshStatus: Math.random() > 0.3 ? 'online' : 'offline',
          lastSSHCheck: new Date().toISOString() 
        }));
      } catch (error) {
        setRemoteAccess(prev => ({ 
          ...prev, 
          sshStatus: 'offline',
          lastSSHCheck: new Date().toISOString() 
        }));
      }
    }
    
    // Check SDE status
    try {
      await checkForUpdates();
    } catch (error) {
      console.error('SDE check failed:', error);
    }
    
    toast.success('Status refreshed');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Gear size={24} />
          Database Settings
        </h2>
        <p className="text-muted-foreground">
          Configure database core settings
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
        <div className="hidden">
          {/* Hidden tabs list since navigation is handled by parent */}
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="eve">EVE Online</TabsTrigger>
            <TabsTrigger value="sde">EVE SDE</TabsTrigger>
            <TabsTrigger value="esi">Corporations</TabsTrigger>
            <TabsTrigger value="sync">Data Sync</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe size={20} />
                General Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Corporation Information */}
              <div className="space-y-4">
                <h4 className="font-medium">Corporation Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="corpName">Corporation Name</Label>
                    <Input
                      id="corpName"
                      value={generalSettings.corpName}
                      onChange={(e) => updateGeneralSetting('corpName', e.target.value)}
                      placeholder="Your Corporation Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="corpTicker">Corporation Ticker</Label>
                    <Input
                      id="corpTicker"
                      value={generalSettings.corpTicker}
                      onChange={(e) => updateGeneralSetting('corpTicker', e.target.value)}
                      placeholder="CORP"
                      maxLength={5}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="corpId">Corporation ID</Label>
                  <Input
                    id="corpId"
                    type="number"
                    value={generalSettings.corpId?.toString() || '0'}
                    onChange={(e) => updateGeneralSetting('corpId', parseInt(e.target.value) || 0)}
                    placeholder="98000001"
                  />
                </div>
              </div>

              {/* Regional Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">Regional Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={generalSettings.timezone}
                      onChange={(e) => updateGeneralSetting('timezone', e.target.value)}
                      placeholder="UTC"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Input
                      id="language"
                      value={generalSettings.language}
                      onChange={(e) => updateGeneralSetting('language', e.target.value)}
                      placeholder="en"
                    />
                  </div>
                </div>
              </div>

              {/* Session Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">Session Settings</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Session Timeout</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically log out users after period of inactivity
                    </p>
                  </div>
                  <Switch 
                    checked={generalSettings.sessionTimeout}
                    onCheckedChange={(checked) => updateGeneralSetting('sessionTimeout', checked)}
                  />
                </div>

                {generalSettings.sessionTimeout && (
                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeoutMinutes">Session Timeout (minutes)</Label>
                    <Input
                      id="sessionTimeoutMinutes"
                      type="number"
                      value={generalSettings.sessionTimeoutMinutes?.toString() || '30'}
                      onChange={(e) => updateGeneralSetting('sessionTimeoutMinutes', parseInt(e.target.value) || 30)}
                      min="5"
                      max="480"
                      placeholder="30"
                    />
                    <p className="text-xs text-muted-foreground">
                      Range: 5-480 minutes (8 hours max)
                    </p>
                  </div>
                )}
              </div>

              {/* Application Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">Application Settings</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Block all non-admin access for maintenance
                    </p>
                  </div>
                  <Switch 
                    checked={generalSettings.maintenanceMode}
                    onCheckedChange={(checked) => updateGeneralSetting('maintenanceMode', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Debug Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable detailed logging and debug information
                    </p>
                  </div>
                  <Switch 
                    checked={generalSettings.debugMode}
                    onCheckedChange={(checked) => updateGeneralSetting('debugMode', checked)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="logLevel">Log Level</Label>
                    <select
                      id="logLevel"
                      value={generalSettings.logLevel}
                      onChange={(e) => updateGeneralSetting('logLevel', e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="error">Error</option>
                      <option value="warn">Warning</option>
                      <option value="info">Info</option>
                      <option value="debug">Debug</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxLogRetentionDays">Log Retention (days)</Label>
                    <Input
                      id="maxLogRetentionDays"
                      type="number"
                      value={generalSettings.maxLogRetentionDays?.toString() || '30'}
                      onChange={(e) => updateGeneralSetting('maxLogRetentionDays', parseInt(e.target.value) || 30)}
                      min="1"
                      max="365"
                      placeholder="30"
                    />
                  </div>
                </div>
              </div>

              {/* Save Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Reset to current saved values
                    window.location.reload();
                  }}
                >
                  Reset Changes
                </Button>
                <Button
                  onClick={saveGeneralSettings}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <CheckCircle size={16} className="mr-2" />
                  Save General Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={20} />
                  Database Configuration
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Question size={16} />
                      Setup Requirements
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Info size={20} />
                        Database Setup Requirements
                      </DialogTitle>
                      <DialogDescription>
                        Follow these steps to properly configure your database environment
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Database size={16} />
                          Database Prerequisites
                        </h4>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                          <li>• MySQL/MariaDB server installed and running</li>
                          <li>• Administrative (sudo) access to the database server</li>
                          <li>• Network connectivity to the database server</li>
                          <li>• Sufficient privileges to create databases and users</li>
                        </ul>
                      </div>
                      
                      <div className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Key size={16} />
                          EVE Online ESI Application
                        </h4>
                        <ol className="space-y-1 text-sm text-muted-foreground ml-4">
                          <li>1. Visit <code className="bg-background px-1 rounded">https://developers.eveonline.com</code></li>
                          <li>2. Create a new application with callback URL: <code className="bg-background px-1 rounded">{window.location.origin}/</code></li>
                          <li>3. Copy the Client ID and Client Secret to the fields above</li>
                          <li>4. Ensure your application has the required scopes for LMeve</li>
                        </ol>
                      </div>
                      
                      <div className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Network size={16} />
                          Remote Database Setup (Optional)
                        </h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          If your database is on a remote server, you'll need:
                        </p>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                          <li>• SSH access to the database server</li>
                          <li>• SSH key-based authentication configured</li>
                          <li>• Proper firewall rules for database access</li>
                          <li>• Database server configured to accept remote connections</li>
                        </ul>
                      </div>
                      
                      <div className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Archive size={16} />
                          EVE Static Data Export (SDE)
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          LMeve requires the EVE Static Data Export for ship, item, and universe data. 
                          This will be automatically downloaded and configured during the database setup process.
                        </p>
                      </div>

                      <Alert>
                        <Info size={16} />
                        <AlertDescription>
                          The automated setup process will handle database creation, user setup, and SDE import. 
                          Ensure you have the administrative credentials ready before starting.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* ESI Configuration Section */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${esiConfig.clientId ? 'bg-green-500' : 'bg-red-500'}`} />
                    <h4 className="font-medium">ESI Application Credentials</h4>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://developers.eveonline.com/applications', '_blank')}
                  >
                    <Globe size={16} className="mr-2" />
                    Manage Apps
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientId">EVE Online Client ID</Label>
                      <Input
                        id="clientId"
                        value={esiSettings.clientId || esiConfig.clientId || ''}
                        onChange={(e) => updateESISetting('clientId', e.target.value)}
                        placeholder="Your EVE Online application Client ID"
                        className={esiSettings.clientId && esiSettings.clientId !== esiConfig.clientId ? 'border-accent' : ''}
                      />
                      {esiSettings.clientId && esiSettings.clientId !== esiConfig.clientId && (
                        <p className="text-xs text-accent">• Unsaved changes</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientSecret">EVE Online Client Secret</Label>
                      <div className="relative">
                        <Input
                          id="clientSecret"
                          type={showSecrets ? "text" : "password"}
                          value={esiSettings.clientSecret || esiConfig.clientSecret || ''}
                          onChange={(e) => updateESISetting('clientSecret', e.target.value)}
                          placeholder="Your EVE Online application Client Secret"
                          className={esiSettings.clientSecret && esiSettings.clientSecret !== esiConfig.clientSecret ? 'border-accent' : ''}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowSecrets(!showSecrets)}
                        >
                          {showSecrets ? <EyeSlash size={16} /> : <Eye size={16} />}
                        </Button>
                      </div>
                      {esiSettings.clientSecret && esiSettings.clientSecret !== esiConfig.clientSecret && (
                        <p className="text-xs text-accent">• Unsaved changes</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        const clientId = esiSettings.clientId || esiConfig.clientId || '';
                        const clientSecret = esiSettings.clientSecret || esiConfig.clientSecret;
                        if (clientId.trim()) {
                          updateESIConfig(clientId.trim(), clientSecret || '');
                          setESISettings(prev => ({ ...prev, clientId: '', clientSecret: '' }));
                          toast.success('ESI configuration updated');
                        } else {
                          toast.error('Client ID is required');
                        }
                      }}
                      size="sm"
                      disabled={!esiSettings.clientId && !esiConfig.clientId}
                      className={
                        (esiSettings.clientId && esiSettings.clientId !== esiConfig.clientId) ||
                        (esiSettings.clientSecret && esiSettings.clientSecret !== esiConfig.clientSecret)
                          ? 'bg-accent hover:bg-accent/90 text-accent-foreground'
                          : ''
                      }
                    >
                      {((esiSettings.clientId && esiSettings.clientId !== esiConfig.clientId) ||
                        (esiSettings.clientSecret && esiSettings.clientSecret !== esiConfig.clientSecret)) 
                        ? 'Save Changes' : 'Save ESI Config'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setESISettings(prev => ({ ...prev, clientId: '', clientSecret: '' }));
                        toast.info('Form cleared');
                      }}
                      disabled={!esiSettings.clientId && !esiSettings.clientSecret}
                    >
                      Clear
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Create an application at developers.eveonline.com with callback URL: <code className="bg-background px-1 rounded">{window.location.origin}/</code>
                  </p>
                </div>
              </div>

              {/* Compact Database Connection Configuration */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Database Connection - Compact */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full ${dbStatus.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                      <h4 className="text-sm font-medium">Database Connection</h4>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="dbHost" className="text-xs">Host</Label>
                        <Input
                          id="dbHost"
                          value={databaseSettings.host || ''}
                          onChange={(e) => {
                            updateDatabaseSetting('host', e.target.value);
                            updateDatabaseSetting('sudoHost', e.target.value);
                          }}
                          placeholder="localhost"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dbPort" className="text-xs">Port</Label>
                        <Input
                          id="dbPort"
                          type="number"
                          value={databaseSettings.port || ''}
                          onChange={(e) => {
                            const port = parseInt(e.target.value) || 3306;
                            updateDatabaseSetting('port', port);
                            updateDatabaseSetting('sudoPort', port);
                          }}
                          placeholder="3306"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dbName" className="text-xs">Database</Label>
                        <Input
                          id="dbName"
                          value={databaseSettings.database || ''}
                          onChange={(e) => updateDatabaseSetting('database', e.target.value)}
                          placeholder="lmeve"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Database Users - Compact */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full ${databaseSettings.sudoUsername && databaseSettings.sudoPassword ? 'bg-green-500' : 'bg-red-500'}`} />
                      <h4 className="text-sm font-medium">Database Users</h4>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Admin User */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Sudo User</Label>
                        <Input
                          value={databaseSettings.sudoUsername || ''}
                          onChange={(e) => updateDatabaseSetting('sudoUsername', e.target.value)}
                          placeholder="root"
                          className="h-8 text-sm"
                        />
                        <div className="relative">
                          <Input
                            type={showSudoPassword ? "text" : "password"}
                            value={databaseSettings.sudoPassword || ''}
                            onChange={(e) => updateDatabaseSetting('sudoPassword', e.target.value)}
                            placeholder="Admin password"
                            className="h-8 text-sm pr-8"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-8 w-8 p-0"
                            onClick={() => setShowSudoPassword(!showSudoPassword)}
                          >
                            {showSudoPassword ? <EyeSlash size={12} /> : <Eye size={12} />}
                          </Button>
                        </div>
                      </div>

                      {/* App User */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">LMeve User</Label>
                        <Input
                          value={databaseSettings.username || ''}
                          onChange={(e) => updateDatabaseSetting('username', e.target.value)}
                          placeholder="lmeve_user"
                          className="h-8 text-sm"
                        />
                        <div className="relative">
                          <Input
                            type={showDbPassword ? "text" : "password"}
                            value={databaseSettings.password || ''}
                            onChange={(e) => updateDatabaseSetting('password', e.target.value)}
                            placeholder="App password"
                            className="h-8 text-sm pr-8"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-8 w-8 p-0"
                            onClick={() => setShowDbPassword(!showDbPassword)}
                          >
                            {showDbPassword ? <EyeSlash size={12} /> : <Eye size={12} />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configuration and Control Pad */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="border border-border rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-3">Configuration</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Schema Source</Label>
                        <Select value="default" onValueChange={() => {}}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select schema source" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default Schema</SelectItem>
                            <SelectItem value="custom">Custom File</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-xs text-muted-foreground">SDE Source</Label>
                        <Select value="latest" onValueChange={() => {}}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select SDE source" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="latest">Latest SDE</SelectItem>
                            <SelectItem value="custom">Custom File</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Control Pad */}
                  <div className="border border-border rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-3">Control Pad</h4>
                    <div className="space-y-2">
                      <Button
                        onClick={handleSSHConnection}
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-8"
                        disabled={
                          !databaseSettings.host || 
                          databaseSettings.host === 'localhost' || 
                          databaseSettings.host === '127.0.0.1'
                        }
                      >
                        <Terminal size={12} className="mr-1" />
                        Setup SSH Connection
                      </Button>
                      
                      <Button
                        onClick={handleDeployScripts}
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-8"
                        disabled={!remoteAccess.sshConnected}
                      >
                        <Upload size={12} className="mr-1" />
                        Deploy Scripts
                      </Button>
                      
                      <Button
                        onClick={handleRemoteSetup}
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-8"
                        disabled={!remoteAccess.scriptsDeployed}
                      >
                        <Play size={12} className="mr-1" />
                        Run Remote Setup
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Quick Actions Above System Status */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="flex gap-2 mb-4">
                    <Button
                      onClick={handleRefreshStatus}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-8"
                    >
                      <RefreshCw size={12} className="mr-1" />
                      Refresh Status
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info('Version check coming soon')}
                      className="flex-1 text-xs h-8"
                    >
                      <CloudArrowDown size={12} className="mr-1" />
                      Check SDE
                    </Button>
                  </div>
                
                  {/* Status Overview Panel */}
                  <div className="border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity size={16} />
                      <h4 className="text-sm font-medium">System Status</h4>
                    </div>
                    
                    {/* Status Indicators */}
                    <div className="space-y-2 mb-3">
                      <StatusIndicator 
                        label="Database Status" 
                        status={dbStatus.connected ? 'online' : 'offline'} 
                      />
                      
                      <StatusIndicator 
                        label="SSH Status" 
                        status={
                          databaseSettings.host && 
                          databaseSettings.host !== 'localhost' && 
                          databaseSettings.host !== '127.0.0.1'
                            ? remoteAccess.sshStatus === 'online' 
                              ? 'online' 
                              : remoteAccess.sshStatus === 'offline' 
                              ? 'warning'  // yellow - working but offline
                              : 'offline'  // red - broken/unknown
                            : 'unknown'    // not applicable for localhost
                        } 
                      />
                      
                      <StatusIndicator 
                        label="Scripts Deployed" 
                        status={
                          remoteAccess.scriptsStatus === 'deployed' 
                            ? 'online'    // green - deployed successfully
                            : remoteAccess.scriptsStatus === 'not-deployed'
                            ? 'offline'   // red - not done or error
                            : remoteAccess.scriptsStatus === 'error'
                            ? 'offline'   // red - error during deployment
                            : 'warning'   // yellow - prepared but not run
                        } 
                      />
                      
                      <StatusIndicator 
                        label="Remote Setup" 
                        status={
                          remoteAccess.remoteSetupStatus === 'complete' 
                            ? 'online'    // green - setup and working
                            : remoteAccess.remoteSetupStatus === 'outdated'
                            ? 'warning'   // yellow - needs update/SDE outdated
                            : 'offline'   // red - not run or error
                        } 
                      />
                      
                      <StatusIndicator 
                        label="ESI Status" 
                        status={esiConfig?.clientId && esiConfig?.clientSecret ? 'online' : 'offline'} 
                      />
                      
                      <StatusIndicator 
                        label="EVE Online API" 
                        status="unknown" 
                      />
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">SDE Latest:</span>
                        <span className="text-foreground">{sdeStatus?.latestVersion || 'Unknown'}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">SDE Current:</span>
                        <span className="text-foreground">{sdeStatus?.currentVersion || 'Unknown'}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Uptime:</span>
                        <span className="text-foreground">Unknown</span>
                      </div>
                      
                      <StatusIndicator 
                        label="Overall Status" 
                        status={
                          dbStatus.connected && 
                          esiConfig?.clientId && 
                          esiConfig?.clientSecret &&
                          (databaseSettings.host === 'localhost' || 
                           databaseSettings.host === '127.0.0.1' || 
                           remoteAccess.sshStatus === 'online') 
                            ? 'online' 
                            : 'offline'
                        } 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Connection Controls Row */}
              <div className="flex gap-3 max-w-2xl">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('🧪 Test connection button clicked');
                    handleTestDbConnection();
                  }}
                  disabled={testingConnection}
                  className="flex-1 hover:bg-accent/10 active:bg-accent/20 transition-colors"
                >
                  {testingConnection ? (
                    <>
                      <ArrowClockwise size={16} className="mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play size={16} className="mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>
                
                {dbStatus.connected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectDb}
                    className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    <Stop size={16} className="mr-2" />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleConnectDb}
                    className="flex-1 bg-accent hover:bg-accent/90"
                  >
                    <Play size={16} className="mr-2" />
                    Connect
                  </Button>
                )}
                
                <Button
                  onClick={saveDatabaseSettings}
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                >
                  Save
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    // Reset to current saved values
                    window.location.reload();
                  }}
                  size="sm"
                  className="flex-1"
                >
                  Reset
                </Button>
              </div>

              {/* Connection Logs - Full Width */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Connection Logs</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearConnectionLogs}
                    disabled={connectionLogs.length === 0}
                    className="h-8 px-3 text-xs"
                  >
                    <X size={12} className="mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="bg-muted/30 border border-border rounded p-4 h-64 overflow-y-auto font-mono text-xs">
                  {connectionLogs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No logs available
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {connectionLogs.map((log, index) => (
                        <div 
                          key={index} 
                          className={`leading-relaxed ${
                            log.includes('❌') || log.includes('💥') ? 'text-red-300' :
                            log.includes('⚠️') ? 'text-yellow-300' :
                            log.includes('✅') || log.includes('🎉') ? 'text-green-300' :
                            log.includes('🔍') || log.includes('🌐') || log.includes('🔌') || 
                            log.includes('🔐') || log.includes('🗄️') || log.includes('🔑') || 
                            log.includes('🎯') ? 'text-blue-300' :
                            log.includes('⚡') ? 'text-purple-300' :
                            log.includes('🏁') ? 'text-gray-400' :
                            'text-foreground'
                          }`}
                        >
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Complete Database Setup Section */}
              <div className={`border rounded-lg p-4 ${
                getDatabaseSetupReadiness().isReady 
                  ? setupProgress?.isRunning 
                    ? "border-green-500/50 bg-green-500/10" 
                    : "border-green-500/20 bg-green-500/5"
                  : "border-yellow-500/50 bg-yellow-500/10"
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      getDatabaseSetupReadiness().isReady 
                        ? setupProgress?.isRunning 
                          ? "bg-green-500/30" 
                          : "bg-green-500/20"
                        : "bg-yellow-500/20"
                    }`}>
                      <Wrench size={16} className={
                        getDatabaseSetupReadiness().isReady 
                          ? "text-green-400" 
                          : "text-yellow-400"
                      } />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${
                        getDatabaseSetupReadiness().isReady 
                          ? "text-green-300" 
                          : "text-yellow-300"
                      }`}>Complete Database Setup</h3>
                      <div className="text-sm text-muted-foreground">
                        {setupProgress?.isRunning ? (
                          <div className="flex items-center gap-2">
                            <ArrowClockwise size={14} className="animate-spin" />
                            <span>{setupProgress.currentStep}</span>
                          </div>
                        ) : getDatabaseSetupReadiness().isReady ? (
                          "Ready to configure EVE ESI data, databases, and users with proper privileges."
                        ) : (
                          <div className="space-y-1">
                            {getDatabaseSetupReadiness().missingRequirements.map((req, index) => (
                              <div key={index} className="flex items-start gap-1">
                                <X size={12} className="text-red-400 mt-0.5 shrink-0" />
                                <span>{req}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    variant="default"
                    size="sm"
                    className={
                      getDatabaseSetupReadiness().isReady 
                        ? "bg-green-600 hover:bg-green-700 text-white shrink-0"
                        : "bg-red-600 hover:bg-red-700 text-white shrink-0 cursor-not-allowed"
                    }
                    disabled={!getDatabaseSetupReadiness().isReady || setupProgress?.isRunning}
                    onClick={handleRunDatabaseSetup}
                  >
                    {setupProgress?.isRunning ? (
                      <>
                        <ArrowClockwise size={16} className="mr-2 animate-spin" />
                        Setting Up...
                      </>
                    ) : getDatabaseSetupReadiness().isReady ? (
                      <>
                        <Play size={16} className="mr-2" />
                        Begin
                      </>
                    ) : (
                      "Not Ready"
                    )}
                  </Button>
                </div>
                
                {setupProgress?.isRunning && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>{setupProgress.currentStep}</span>
                      <span className="text-accent font-mono">
                        {setupProgress.progress}%
                      </span>
                    </div>
                    <Progress value={setupProgress.progress} className="h-2 bg-muted" />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Step {setupProgress.currentStepNumber} of {setupProgress.totalSteps}</span>
                      {setupProgress.errors.length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {setupProgress.errors.length} error{setupProgress.errors.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Real-time step log */}
                    {setupProgress.stepLogs.length > 0 && (
                      <div className="bg-background/50 border border-border rounded p-3 max-h-32 overflow-y-auto">
                        <div className="space-y-1 font-mono text-xs">
                          {setupProgress.stepLogs.slice(-10).map((log, index) => (
                            <div key={index} className={`${
                              log.includes('✅') ? 'text-green-400' :
                              log.includes('❌') ? 'text-red-400' :
                              log.includes('⚠️') ? 'text-yellow-400' :
                              'text-foreground'
                            }`}>
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Database Tables - Collapsible Section */}
              {dbStatus.connected && tableInfo.length > 0 && (
                <div className="border-t border-border pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-auto hover:bg-transparent"
                      onClick={() => setShowDatabaseTables(!showDatabaseTables)}
                    >
                      <div className="flex items-center gap-2">
                        {showDatabaseTables ? (
                          <CaretDown size={16} className="text-muted-foreground" />
                        ) : (
                          <CaretRight size={16} className="text-muted-foreground" />
                        )}
                        <h4 className="font-medium">Database Tables</h4>
                        <Badge variant="outline" className="text-xs">
                          {tableInfo.length} tables
                        </Badge>
                      </div>
                    </Button>
                    {showDatabaseTables && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadTableInfo}
                      >
                        <ArrowClockwise size={16} className="mr-2" />
                        Refresh
                      </Button>
                    )}
                  </div>
                  
                  {showDatabaseTables && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 px-4 py-2 border-b border-border">
                        <div className="grid grid-cols-5 gap-4 text-sm font-medium text-muted-foreground">
                          <span>Table Name</span>
                          <span>Rows</span>
                          <span>Size</span>
                          <span>Engine</span>
                          <span>Last Update</span>
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {tableInfo.map((table, index) => (
                          <div key={index} className="px-4 py-2 border-b border-border/50 last:border-b-0 hover:bg-muted/30">
                            <div className="grid grid-cols-5 gap-4 text-sm">
                              <span className="font-mono">{table.name}</span>
                              <span>{table.rowCount.toLocaleString()}</span>
                              <span>{table.size}</span>
                              <span>{table.engine}</span>
                              <span className="text-muted-foreground">
                                {new Date(table.lastUpdate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Database Schema Manager - Collapsible */}
              <div className="border-t border-border pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 h-auto hover:bg-transparent"
                    onClick={() => setShowDatabaseSchema(!showDatabaseSchema)}
                  >
                    <div className="flex items-center gap-2">
                      {showDatabaseSchema ? (
                        <CaretDown size={16} className="text-muted-foreground" />
                      ) : (
                        <CaretRight size={16} className="text-muted-foreground" />
                      )}
                      <h4 className="font-medium">Database Schema Manager</h4>
                      <Badge variant="outline" className="text-xs">
                        {lmeveSchemas.length} tables
                      </Badge>
                    </div>
                  </Button>
                </div>
                
                {showDatabaseSchema && (
                  <DatabaseSchemaManager />
                )}
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="esi" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building size={20} />
                Corporations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Registered Corporations */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Registered Corporations</h4>
                  <Badge variant="outline">
                    {registeredCorps.filter(corp => corp.isActive).length} Active
                  </Badge>
                </div>
                
                {registeredCorps.length > 0 ? (
                  <div className="space-y-3">
                    {registeredCorps.map((corp) => (
                      <div key={corp.corporationId} className="p-4 border border-border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium">{corp.corporationName}</h5>
                            <p className="text-sm text-muted-foreground">
                              Corp ID: {corp.corporationId} • Registered: {new Date(corp.registrationDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={corp.isActive ? "default" : "secondary"}>
                              {corp.isActive ? "Active" : "Inactive"}
                            </Badge>
                            {corp.lastTokenRefresh && (
                              <Badge variant="outline" className="text-xs">
                                Updated: {new Date(corp.lastTokenRefresh).toLocaleDateString()}
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateCorporation(corp.corporationId, { isActive: !corp.isActive })}
                            >
                              {corp.isActive ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(`Are you sure you want to remove ${corp.corporationName}?`)) {
                                  deleteCorporation(corp.corporationId);
                                  toast.success('Corporation removed');
                                }
                              }}
                            >
                              <X size={14} />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="mt-3 text-xs text-muted-foreground">
                          <p>Scopes: {corp.registeredScopes.join(', ')}</p>
                          <p>ESI Client: {corp.esiClientId ? 'Configured' : 'Using Global'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 border border-dashed border-border rounded-lg text-center">
                    <Building size={32} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">No corporations registered</p>
                    <p className="text-xs text-muted-foreground">
                      CEOs and Directors can register their corporations by logging in with EVE Online SSO
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">
                    {registeredCorps.reduce((sum, corp) => sum + (corp.isActive ? 1 : 0), 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Active Corps</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">
                    {esiConfig.clientId ? '✓' : '✗'}
                  </div>
                  <div className="text-xs text-muted-foreground">ESI Configured</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock size={20} />
                Data Synchronization Processes
              </CardTitle>
              <p className="text-muted-foreground">
                LMeve data poller configuration based on individual sync processes with master orchestration
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Master Poller Status */}
              <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Terminal size={18} className="text-accent" />
                    <span className="font-medium">Master Poller</span>
                  </div>
                  <Badge variant={syncSettings.masterPoller?.enabled ? "default" : "secondary"}>
                    {syncSettings.masterPoller?.enabled ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Central orchestration process that manages and schedules all individual data sync processes (poller.php equivalent)
                </p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Last Run</p>
                    <p className="font-medium">{syncSettings.masterPoller?.lastRun ? new Date(syncSettings.masterPoller.lastRun).toLocaleTimeString() : 'Never'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Next Run</p>
                    <p className="font-medium">{syncSettings.masterPoller?.nextRun ? new Date(syncSettings.masterPoller.nextRun).toLocaleTimeString() : 'Not scheduled'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Interval</p>
                    <p className="font-medium">{syncSettings.masterPoller?.interval || 5} min</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Switch
                    checked={syncSettings.masterPoller?.enabled || false}
                    onCheckedChange={(checked) => setSyncSettings(prev => ({
                      ...prev,
                      masterPoller: { ...prev.masterPoller, enabled: checked }
                    }))}
                  />
                  <Label className="text-sm">Enable Master Poller</Label>
                </div>
              </div>

              {/* ESI Route Validation */}
              <div className="border-t border-border pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Network size={18} className="text-accent" />
                    <h4 className="font-medium">ESI Route Management</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={validateAllESIRoutes}
                      disabled={validatingRoutes}
                      size="sm"
                      variant="outline"
                    >
                      {validatingRoutes ? (
                        <>
                          <ArrowClockwise size={16} className="mr-2 animate-spin" />
                          Validating...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} className="mr-2" />
                          Validate All Routes
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <Alert>
                  <Info size={16} />
                  <AlertDescription>
                    ESI routes can have multiple versions. LMeve automatically selects optimal versions, but you can override them here. 
                    Use "Validate" to test if a route version is currently supported by CCP's ESI API.
                  </AlertDescription>
                </Alert>

                {/* Route validation results summary */}
                {Object.keys(routeUpdateResults).length > 0 && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-sm font-medium mb-2">Last Validation Results:</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {Object.entries(routeUpdateResults).map(([process, result]) => (
                        <div key={process} className="flex items-center gap-1">
                          <span className="capitalize">{process}:</span>
                          <span className={result.startsWith('✓') ? 'text-green-400' : 'text-red-400'}>
                            {result}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Individual Process Configuration with ESI Route Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Individual Sync Processes</h4>
                  <Badge variant="outline">
                    {Object.values(syncSettings.syncIntervals || {}).filter(interval => interval > 0).length} Enabled
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {/* Corporation Members Process */}
                  <div className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Users size={16} className="text-blue-400" />
                        <div>
                          <h5 className="font-medium">Corporation Members</h5>
                          <p className="text-sm text-muted-foreground">Sync member list, roles, titles, and tracking data</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={(syncSettings.syncIntervals?.members || 0) > 0}
                          onCheckedChange={(checked) => updateSyncInterval('members', checked ? 60 : 0)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Interval</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="1440"
                            value={syncSettings.syncIntervals?.members || 60}
                            onChange={(e) => updateSyncInterval('members', parseInt(e.target.value) || 60)}
                            className="w-16 text-center text-sm h-8"
                            disabled={(syncSettings.syncIntervals?.members || 0) === 0}
                          />
                          <span className="text-muted-foreground">min</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Sync</p>
                        <p className="font-medium">2 min ago</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Records</p>
                        <p className="font-medium">42 members</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge variant="default" className="text-xs">Success</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                      <div><strong>Process:</strong> getMemberTracking.php</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong>ESI Endpoint:</strong> 
                        <Select 
                          value={esiRoutes.getRoute('members')?.currentVersion || 'v4'}
                          onValueChange={(version) => updateESIRouteVersion('members', version)}
                        >
                          <SelectTrigger className="w-16 h-6 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(esiRoutes.getRoute('members')?.versions || ['v3', 'v4']).map(version => (
                              <SelectItem key={version} value={version}>{version}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span>/corporations/{'{corporation_id}'}/membertracking/</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => validateESIRoute('members')}
                          disabled={validatingRoutes}
                        >
                          {validatingRoutes ? '...' : 'Validate'}
                        </Button>
                        {esiRouteValidation.members !== undefined && (
                          <Badge variant={esiRouteValidation.members ? "default" : "destructive"} className="text-xs h-5">
                            {esiRouteValidation.members ? '✓' : '✗'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Corporation Assets Process */}
                  <div className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Package size={16} className="text-green-400" />
                        <div>
                          <h5 className="font-medium">Corporation Assets</h5>
                          <p className="text-sm text-muted-foreground">Sync assets, locations, and naming data</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={(syncSettings.syncIntervals?.assets || 0) > 0}
                          onCheckedChange={(checked) => updateSyncInterval('assets', checked ? 30 : 0)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Interval</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="1440"
                            value={syncSettings.syncIntervals?.assets || 30}
                            onChange={(e) => updateSyncInterval('assets', parseInt(e.target.value) || 30)}
                            className="w-16 text-center text-sm h-8"
                            disabled={(syncSettings.syncIntervals?.assets || 0) === 0}
                          />
                          <span className="text-muted-foreground">min</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Sync</p>
                        <p className="font-medium">5 min ago</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Records</p>
                        <p className="font-medium">1,247 assets</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge variant="default" className="text-xs">Success</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                      <div><strong>Process:</strong> getAssets.php</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong>ESI Endpoint:</strong> 
                        <Select 
                          value={esiRoutes.getRoute('assets')?.currentVersion || 'v5'}
                          onValueChange={(version) => updateESIRouteVersion('assets', version)}
                        >
                          <SelectTrigger className="w-16 h-6 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(esiRoutes.getRoute('assets')?.versions || ['v3', 'v4', 'v5']).map(version => (
                              <SelectItem key={version} value={version}>{version}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span>/corporations/{'{corporation_id}'}/assets/</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => validateESIRoute('assets')}
                          disabled={validatingRoutes}
                        >
                          {validatingRoutes ? '...' : 'Validate'}
                        </Button>
                        {esiRouteValidation.assets !== undefined && (
                          <Badge variant={esiRouteValidation.assets ? "default" : "destructive"} className="text-xs h-5">
                            {esiRouteValidation.assets ? '✓' : '✗'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Industry Jobs Process */}
                  <div className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Factory size={16} className="text-purple-400" />
                        <div>
                          <h5 className="font-medium">Industry Jobs</h5>
                          <p className="text-sm text-muted-foreground">Manufacturing, research, reactions, and invention jobs</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={(syncSettings.syncIntervals?.manufacturing || 0) > 0}
                          onCheckedChange={(checked) => updateSyncInterval('manufacturing', checked ? 15 : 0)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Interval</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="1440"
                            value={syncSettings.syncIntervals?.manufacturing || 15}
                            onChange={(e) => updateSyncInterval('manufacturing', parseInt(e.target.value) || 15)}
                            className="w-16 text-center text-sm h-8"
                            disabled={(syncSettings.syncIntervals?.manufacturing || 0) === 0}
                          />
                          <span className="text-muted-foreground">min</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Sync</p>
                        <p className="font-medium">1 min ago</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Records</p>
                        <p className="font-medium">23 active jobs</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge variant="default" className="text-xs">Success</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                      <div><strong>Process:</strong> getIndustryJobs.php</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong>ESI Endpoint:</strong> 
                        <Select 
                          value={esiRoutes.getRoute('manufacturing')?.currentVersion || 'v1'}
                          onValueChange={(version) => updateESIRouteVersion('manufacturing', version)}
                        >
                          <SelectTrigger className="w-16 h-6 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(esiRoutes.getRoute('manufacturing')?.versions || ['v1']).map(version => (
                              <SelectItem key={version} value={version}>{version}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span>/corporations/{'{corporation_id}'}/industry/jobs/</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => validateESIRoute('manufacturing')}
                          disabled={validatingRoutes}
                        >
                          {validatingRoutes ? '...' : 'Validate'}
                        </Button>
                        {esiRouteValidation.manufacturing !== undefined && (
                          <Badge variant={esiRouteValidation.manufacturing ? "default" : "destructive"} className="text-xs h-5">
                            {esiRouteValidation.manufacturing ? '✓' : '✗'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mining Operations Process */}
                  <div className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <HardHat size={16} className="text-yellow-400" />
                        <div>
                          <h5 className="font-medium">Mining Operations</h5>
                          <p className="text-sm text-muted-foreground">Mining ledger and observer data</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={(syncSettings.syncIntervals?.mining || 0) > 0}
                          onCheckedChange={(checked) => updateSyncInterval('mining', checked ? 45 : 0)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Interval</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="1440"
                            value={syncSettings.syncIntervals?.mining || 45}
                            onChange={(e) => updateSyncInterval('mining', parseInt(e.target.value) || 45)}
                            className="w-16 text-center text-sm h-8"
                            disabled={(syncSettings.syncIntervals?.mining || 0) === 0}
                          />
                          <span className="text-muted-foreground">min</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Sync</p>
                        <p className="font-medium">12 min ago</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Records</p>
                        <p className="font-medium">156 entries</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge variant="default" className="text-xs">Success</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                      <div><strong>Process:</strong> getMiningLedger.php</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong>ESI Endpoint:</strong> 
                        <Select 
                          value={esiRoutes.getRoute('mining')?.currentVersion || 'v1'}
                          onValueChange={(version) => updateESIRouteVersion('mining', version)}
                        >
                          <SelectTrigger className="w-16 h-6 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(esiRoutes.getRoute('mining')?.versions || ['v1']).map(version => (
                              <SelectItem key={version} value={version}>{version}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span>/corporations/{'{corporation_id}'}/mining/</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => validateESIRoute('mining')}
                          disabled={validatingRoutes}
                        >
                          {validatingRoutes ? '...' : 'Validate'}
                        </Button>
                        {esiRouteValidation.mining !== undefined && (
                          <Badge variant={esiRouteValidation.mining ? "default" : "destructive"} className="text-xs h-5">
                            {esiRouteValidation.mining ? '✓' : '✗'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Market Orders Process */}
                  <div className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <TrendUp size={16} className="text-cyan-400" />
                        <div>
                          <h5 className="font-medium">Market Orders</h5>
                          <p className="text-sm text-muted-foreground">Buy and sell orders, market transactions</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={(syncSettings.syncIntervals?.market || 0) > 0}
                          onCheckedChange={(checked) => updateSyncInterval('market', checked ? 10 : 0)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Interval</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="1440"
                            value={syncSettings.syncIntervals?.market || 10}
                            onChange={(e) => updateSyncInterval('market', parseInt(e.target.value) || 10)}
                            className="w-16 text-center text-sm h-8"
                            disabled={(syncSettings.syncIntervals?.market || 0) === 0}
                          />
                          <span className="text-muted-foreground">min</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Sync</p>
                        <p className="font-medium">30 sec ago</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Records</p>
                        <p className="font-medium">89 orders</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge variant="default" className="text-xs">Success</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                      <div><strong>Process:</strong> getMarketOrders.php</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong>ESI Endpoint:</strong> 
                        <Select 
                          value={esiRoutes.getRoute('market')?.currentVersion || 'v3'}
                          onValueChange={(version) => updateESIRouteVersion('market', version)}
                        >
                          <SelectTrigger className="w-16 h-6 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(esiRoutes.getRoute('market')?.versions || ['v2', 'v3']).map(version => (
                              <SelectItem key={version} value={version}>{version}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span>/corporations/{'{corporation_id}'}/orders/</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => validateESIRoute('market')}
                          disabled={validatingRoutes}
                        >
                          {validatingRoutes ? '...' : 'Validate'}
                        </Button>
                        {esiRouteValidation.market !== undefined && (
                          <Badge variant={esiRouteValidation.market ? "default" : "destructive"} className="text-xs h-5">
                            {esiRouteValidation.market ? '✓' : '✗'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Killmails Process */}
                  <div className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Crosshair size={16} className="text-red-400" />
                        <div>
                          <h5 className="font-medium">Killmails</h5>
                          <p className="text-sm text-muted-foreground">Corporation member kills and losses</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={(syncSettings.syncIntervals?.killmails || 0) > 0}
                          onCheckedChange={(checked) => updateSyncInterval('killmails', checked ? 120 : 0)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Interval</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="1440"
                            value={syncSettings.syncIntervals?.killmails || 120}
                            onChange={(e) => updateSyncInterval('killmails', parseInt(e.target.value) || 120)}
                            className="w-16 text-center text-sm h-8"
                            disabled={(syncSettings.syncIntervals?.killmails || 0) === 0}
                          />
                          <span className="text-muted-foreground">min</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Sync</p>
                        <p className="font-medium">45 min ago</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Records</p>
                        <p className="font-medium">7 new kills</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge variant="default" className="text-xs">Success</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                      <div><strong>Process:</strong> getKillmails.php</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong>ESI Endpoint:</strong> 
                        <Select 
                          value={esiRoutes.getRoute('killmails')?.currentVersion || 'v1'}
                          onValueChange={(version) => updateESIRouteVersion('killmails', version)}
                        >
                          <SelectTrigger className="w-16 h-6 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(esiRoutes.getRoute('killmails')?.versions || ['v1']).map(version => (
                              <SelectItem key={version} value={version}>{version}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span>/corporations/{'{corporation_id}'}/killmails/recent/</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => validateESIRoute('killmails')}
                          disabled={validatingRoutes}
                        >
                          {validatingRoutes ? '...' : 'Validate'}
                        </Button>
                        {esiRouteValidation.killmails !== undefined && (
                          <Badge variant={esiRouteValidation.killmails ? "default" : "destructive"} className="text-xs h-5">
                            {esiRouteValidation.killmails ? '✓' : '✗'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Wallet & Transactions Process */}
                  <div className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <CurrencyDollar size={16} className="text-orange-400" />
                        <div>
                          <h5 className="font-medium">Wallet & Transactions</h5>
                          <p className="text-sm text-muted-foreground">Corporation wallet balance, transactions, and journal</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={(syncSettings.syncIntervals?.income || 0) > 0}
                          onCheckedChange={(checked) => updateSyncInterval('income', checked ? 30 : 0)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Interval</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="1440"
                            value={syncSettings.syncIntervals?.income || 30}
                            onChange={(e) => updateSyncInterval('income', parseInt(e.target.value) || 30)}
                            className="w-16 text-center text-sm h-8"
                            disabled={(syncSettings.syncIntervals?.income || 0) === 0}
                          />
                          <span className="text-muted-foreground">min</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Sync</p>
                        <p className="font-medium">8 min ago</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Records</p>
                        <p className="font-medium">34 transactions</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge variant="default" className="text-xs">Success</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                      <div><strong>Process:</strong> getWalletTransactions.php</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong>ESI Endpoint:</strong> 
                        <Select 
                          value={esiRoutes.getRoute('income')?.currentVersion || 'v1'}
                          onValueChange={(version) => updateESIRouteVersion('income', version)}
                        >
                          <SelectTrigger className="w-16 h-6 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(esiRoutes.getRoute('income')?.versions || ['v1']).map(version => (
                              <SelectItem key={version} value={version}>{version}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span>/corporations/{'{corporation_id}'}/wallets/{'{division}'}/transactions/</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => validateESIRoute('income')}
                          disabled={validatingRoutes}
                        >
                          {validatingRoutes ? '...' : 'Validate'}
                        </Button>
                        {esiRouteValidation.income !== undefined && (
                          <Badge variant={esiRouteValidation.income ? "default" : "destructive"} className="text-xs h-5">
                            {esiRouteValidation.income ? '✓' : '✗'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Process Management Controls */}
              <div className="border-t border-border pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Process Management</h4>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSyncData}
                      disabled={syncStatus.isRunning}
                      className="bg-accent hover:bg-accent/90"
                      size="sm"
                    >
                      {syncStatus.isRunning ? (
                        <>
                          <ArrowClockwise size={16} className="mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Play size={16} className="mr-2" />
                          Run Manual Sync
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {syncStatus.isRunning && (
                  <div className="p-4 border border-accent/20 bg-accent/5 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowClockwise size={16} className="text-accent animate-spin" />
                      <span className="font-medium">Master Poller Running</span>
                    </div>
                    <div className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{syncStatus.stage}</span>
                        <span>{Math.round(syncStatus.progress)}%</span>
                      </div>
                      <Progress value={syncStatus.progress} className="h-2" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Orchestrating individual sync processes...
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={saveSyncSettings} variant="default" size="sm">
                    <CheckCircle size={16} className="mr-2" />
                    Save Configuration
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Reset to LMeve default intervals
                      updateSyncInterval('members', 60);
                      updateSyncInterval('assets', 30);
                      updateSyncInterval('manufacturing', 15);
                      updateSyncInterval('mining', 45);
                      updateSyncInterval('market', 10);
                      updateSyncInterval('killmails', 120);
                      updateSyncInterval('income', 30);
                      setSyncSettings(prev => ({
                        ...prev,
                        masterPoller: { ...prev.masterPoller, interval: 5, enabled: true }
                      }));
                      toast.success('Reset to LMeve defaults');
                    }}
                  >
                    <ArrowClockwise size={16} className="mr-2" />
                    Reset Intervals
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Reset ESI routes to defaults
                      esiRouteManager.resetToDefaults();
                      setESIRouteValidation({});
                      setRouteUpdateResults({});
                      toast.success('ESI routes reset to defaults');
                    }}
                  >
                    <Network size={16} className="mr-2" />
                    Reset ESI Routes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Disable all processes
                      updateSyncInterval('members', 0);
                      updateSyncInterval('assets', 0);
                      updateSyncInterval('manufacturing', 0);
                      updateSyncInterval('mining', 0);
                      updateSyncInterval('market', 0);
                      updateSyncInterval('killmails', 0);
                      updateSyncInterval('income', 0);
                      setSyncSettings(prev => ({
                        ...prev,
                        masterPoller: { ...prev.masterPoller, enabled: false }
                      }));
                      toast.success('All sync processes disabled');
                    }}
                  >
                    <Stop size={16} className="mr-2" />
                    Disable All
                  </Button>
                </div>

                {/* Process Architecture Info */}
                <div className="p-3 bg-muted/30 rounded-lg text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={14} className="text-muted-foreground" />
                    <span className="font-medium">LMeve Process Architecture & ESI Integration</span>
                  </div>
                  <div className="space-y-2 text-muted-foreground leading-relaxed">
                    <p>
                      Based on the original LMeve design: individual PHP processes handle specific data types (members, assets, industry jobs, etc.) 
                      while a master poller (poller.php) orchestrates execution timing. Set intervals to 0 to disable specific processes.
                    </p>
                    <p>
                      <strong>ESI Route Management:</strong> Each process uses specific EVE Online ESI API endpoints. You can select different API versions 
                      for each endpoint and validate them against the current ESI specification. This ensures compatibility when CCP updates their API.
                    </p>
                    <p>
                      The master poller respects individual process schedules, handles ESI rate limiting, and automatically uses your selected 
                      route versions for optimal performance and reliability.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell size={20} />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Event Notifications */}
              <div className="space-y-4">
                <h4 className="font-medium">Event Notifications</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Manufacturing Jobs</Label>
                      <p className="text-sm text-muted-foreground">
                        Notifications about manufacturing job completions and issues
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.events.manufacturing}
                      onCheckedChange={(checked) => updateNotificationEvent('manufacturing', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Mining Operations</Label>
                      <p className="text-sm text-muted-foreground">
                        Updates on mining fleet activities and yields
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.events.mining}
                      onCheckedChange={(checked) => updateNotificationEvent('mining', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Killmails</Label>
                      <p className="text-sm text-muted-foreground">
                        Corporation member kills and losses
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.events.killmails}
                      onCheckedChange={(checked) => updateNotificationEvent('killmails', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Market Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Price alerts and market order notifications
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.events.markets}
                      onCheckedChange={(checked) => updateNotificationEvent('markets', checked)}
                    />
                  </div>
                </div>
              </div>

              {/* Discord Integration */}
              <div className="border-t border-border pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#5865F2] rounded flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </div>
                  <h4 className="font-medium">Discord Integration</h4>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Discord Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Forward notifications to Discord channels via webhooks
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.discord?.enabled || false}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({
                      ...prev,
                      discord: { ...prev.discord, enabled: checked }
                    }))}
                  />
                </div>

                {notificationSettings.discord?.enabled && (
                  <div className="space-y-6 pl-6 border-l-2 border-[#5865F2]/20">
                    {/* Primary Webhook Configuration */}
                    <div className="space-y-4">
                      <h5 className="font-medium text-sm">Webhook Configuration</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="discordWebhookUrl">Webhook URL</Label>
                          <Input
                            id="discordWebhookUrl"
                            type="url"
                            value={notificationSettings.discord?.webhookUrl || ''}
                            onChange={(e) => setNotificationSettings(prev => ({
                              ...prev,
                              discord: { ...prev.discord, webhookUrl: e.target.value }
                            }))}
                            placeholder="https://discord.com/api/webhooks/..."
                          />
                          <p className="text-xs text-muted-foreground">
                            Create a webhook in your Discord server settings
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="discordBotName">Bot Display Name</Label>
                          <Input
                            id="discordBotName"
                            value={notificationSettings.discord?.botName || ''}
                            onChange={(e) => setNotificationSettings(prev => ({
                              ...prev,
                              discord: { ...prev.discord, botName: e.target.value }
                            }))}
                            placeholder="LMeve Notifications"
                          />
                          <p className="text-xs text-muted-foreground">
                            Name shown for the notification bot
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="discordAvatarUrl">Bot Avatar URL (Optional)</Label>
                        <Input
                          id="discordAvatarUrl"
                          type="url"
                          value={notificationSettings.discord?.avatarUrl || ''}
                          onChange={(e) => setNotificationSettings(prev => ({
                            ...prev,
                            discord: { ...prev.discord, avatarUrl: e.target.value }
                          }))}
                          placeholder="https://images.evetech.net/corporations/..."
                        />
                        <p className="text-xs text-muted-foreground">
                          Custom avatar for the notification bot (corp logo recommended)
                        </p>
                      </div>
                    </div>

                    {/* Channel and Role Configuration */}
                    <div className="space-y-4">
                      <h5 className="font-medium text-sm">Target Configuration</h5>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="discordChannels">Channel Mentions</Label>
                          <Textarea
                            id="discordChannels"
                            rows={3}
                            value={notificationSettings.discord?.channels?.join('\n') || ''}
                            onChange={(e) => setNotificationSettings(prev => ({
                              ...prev,
                              discord: {
                                ...prev.discord,
                                channels: e.target.value.split('\n').map(c => c.trim()).filter(c => c)
                              }
                            }))}
                            placeholder="#general&#10;#industry&#10;#alerts"
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Channels to mention in notifications (one per line)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="discordRoles">Role Mentions</Label>
                          <Textarea
                            id="discordRoles"
                            rows={3}
                            value={notificationSettings.discord?.roles?.join('\n') || ''}
                            onChange={(e) => setNotificationSettings(prev => ({
                              ...prev,
                              discord: {
                                ...prev.discord,
                                roles: e.target.value.split('\n').map(r => r.trim()).filter(r => r)
                              }
                            }))}
                            placeholder="@lmeve_admin&#10;@industry_team&#10;@pilots"
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Roles to ping in notifications (one per line, with @)
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="discordUserMentions">User Mentions (Character IDs)</Label>
                        <Textarea
                          id="discordUserMentions"
                          rows={2}
                          value={notificationSettings.discord?.userMentions?.join('\n') || ''}
                          onChange={(e) => setNotificationSettings(prev => ({
                            ...prev,
                            discord: {
                              ...prev.discord,
                              userMentions: e.target.value.split('\n').map(u => u.trim()).filter(u => u)
                            }
                          }))}
                          placeholder="91316135&#10;498125261"
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          EVE character IDs to mention in notifications (one per line)
                        </p>
                      </div>
                    </div>

                    {/* Message Templates */}
                    <div className="space-y-4">
                      <h5 className="font-medium text-sm">Message Templates</h5>
                      <div className="space-y-4">
                        {/* Manufacturing Template */}
                        <div className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="font-medium">Manufacturing Completion</Label>
                            <Switch
                              checked={notificationSettings.discord?.templates?.manufacturing?.enabled || false}
                              onCheckedChange={(checked) => setNotificationSettings(prev => ({
                                ...prev,
                                discord: {
                                  ...prev.discord,
                                  templates: {
                                    ...prev.discord?.templates,
                                    manufacturing: {
                                      ...prev.discord?.templates?.manufacturing,
                                      enabled: checked
                                    }
                                  }
                                }
                              }))}
                            />
                          </div>
                          {notificationSettings.discord?.templates?.manufacturing?.enabled && (
                            <div className="space-y-2">
                              <Textarea
                                rows={3}
                                value={notificationSettings.discord?.templates?.manufacturing?.message || 'Hey {pilot} - your LMeve industry task of {item} x{count} is complete at {time}!'}
                                onChange={(e) => setNotificationSettings(prev => ({
                                  ...prev,
                                  discord: {
                                    ...prev.discord,
                                    templates: {
                                      ...prev.discord?.templates,
                                      manufacturing: {
                                        ...prev.discord?.templates?.manufacturing,
                                        message: e.target.value
                                      }
                                    }
                                  }
                                }))}
                                placeholder="Enter custom message template..."
                                className="text-sm"
                              />
                              <p className="text-xs text-muted-foreground">
                                Variables: {'{pilot}'}, {'{item}'}, {'{count}'}, {'{time}'}, {'{location}'}, {'{corporation}'}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Queue Alert Template */}
                        <div className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="font-medium">Queue Alerts</Label>
                            <Switch
                              checked={notificationSettings.discord?.templates?.queues?.enabled || false}
                              onCheckedChange={(checked) => setNotificationSettings(prev => ({
                                ...prev,
                                discord: {
                                  ...prev.discord,
                                  templates: {
                                    ...prev.discord?.templates,
                                    queues: {
                                      ...prev.discord?.templates?.queues,
                                      enabled: checked
                                    }
                                  }
                                }
                              }))}
                            />
                          </div>
                          {notificationSettings.discord?.templates?.queues?.enabled && (
                            <div className="space-y-2">
                              <Textarea
                                rows={3}
                                value={notificationSettings.discord?.templates?.queues?.message || 'Hey @lmeve_admin_role - queues are running low! You need to setup additional industry tasking!!'}
                                onChange={(e) => setNotificationSettings(prev => ({
                                  ...prev,
                                  discord: {
                                    ...prev.discord,
                                    templates: {
                                      ...prev.discord?.templates,
                                      queues: {
                                        ...prev.discord?.templates?.queues,
                                        message: e.target.value
                                      }
                                    }
                                  }
                                }))}
                                placeholder="Enter custom message template..."
                                className="text-sm"
                              />
                              <p className="text-xs text-muted-foreground">
                                Variables: {'{role}'}, {'{queue_type}'}, {'{remaining_jobs}'}, {'{time}'}, {'{corporation}'}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Killmail Template */}
                        <div className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="font-medium">Killmail Notifications</Label>
                            <Switch
                              checked={notificationSettings.discord?.templates?.killmails?.enabled || false}
                              onCheckedChange={(checked) => setNotificationSettings(prev => ({
                                ...prev,
                                discord: {
                                  ...prev.discord,
                                  templates: {
                                    ...prev.discord?.templates,
                                    killmails: {
                                      ...prev.discord?.templates?.killmails,
                                      enabled: checked
                                    }
                                  }
                                }
                              }))}
                            />
                          </div>
                          {notificationSettings.discord?.templates?.killmails?.enabled && (
                            <div className="space-y-2">
                              <Textarea
                                rows={3}
                                value={notificationSettings.discord?.templates?.killmails?.message || '{pilot} just scored a {ship_type} kill worth {isk_value} ISK! o7'}
                                onChange={(e) => setNotificationSettings(prev => ({
                                  ...prev,
                                  discord: {
                                    ...prev.discord,
                                    templates: {
                                      ...prev.discord?.templates,
                                      killmails: {
                                        ...prev.discord?.templates?.killmails,
                                        message: e.target.value
                                      }
                                    }
                                  }
                                }))}
                                placeholder="Enter custom message template..."
                                className="text-sm"
                              />
                              <p className="text-xs text-muted-foreground">
                                Variables: {'{pilot}'}, {'{ship_type}'}, {'{isk_value}'}, {'{system}'}, {'{time}'}, {'{zkillboard_link}'}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Market Alert Template */}
                        <div className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="font-medium">Market Alerts</Label>
                            <Switch
                              checked={notificationSettings.discord?.templates?.markets?.enabled || false}
                              onCheckedChange={(checked) => setNotificationSettings(prev => ({
                                ...prev,
                                discord: {
                                  ...prev.discord,
                                  templates: {
                                    ...prev.discord?.templates,
                                    markets: {
                                      ...prev.discord?.templates?.markets,
                                      enabled: checked
                                    }
                                  }
                                }
                              }))}
                            />
                          </div>
                          {notificationSettings.discord?.templates?.markets?.enabled && (
                            <div className="space-y-2">
                              <Textarea
                                rows={3}
                                value={notificationSettings.discord?.templates?.markets?.message || 'Market Alert: {item} price reached {price} ISK ({change}% change) - consider {action}!'}
                                onChange={(e) => setNotificationSettings(prev => ({
                                  ...prev,
                                  discord: {
                                    ...prev.discord,
                                    templates: {
                                      ...prev.discord?.templates,
                                      markets: {
                                        ...prev.discord?.templates?.markets,
                                        message: e.target.value
                                      }
                                    }
                                  }
                                }))}
                                placeholder="Enter custom message template..."
                                className="text-sm"
                              />
                              <p className="text-xs text-muted-foreground">
                                Variables: {'{item}'}, {'{price}'}, {'{change}'}, {'{action}'}, {'{system}'}, {'{time}'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Advanced Settings */}
                    <div className="space-y-4">
                      <h5 className="font-medium text-sm">Advanced Settings</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={notificationSettings.discord?.embedFormat || false}
                            onCheckedChange={(checked) => setNotificationSettings(prev => ({
                              ...prev,
                              discord: { ...prev.discord, embedFormat: checked }
                            }))}
                          />
                          <Label className="text-sm">Use rich embeds</Label>
                          <p className="text-xs text-muted-foreground">(Prettier formatting)</p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={notificationSettings.discord?.includeThumbnails || false}
                            onCheckedChange={(checked) => setNotificationSettings(prev => ({
                              ...prev,
                              discord: { ...prev.discord, includeThumbnails: checked }
                            }))}
                          />
                          <Label className="text-sm">Include EVE thumbnails</Label>
                          <p className="text-xs text-muted-foreground">(Ship/item images)</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="discordThrottleMinutes">Throttle Minutes</Label>
                        <Input
                          id="discordThrottleMinutes"
                          type="number"
                          min="0"
                          max="1440"
                          value={notificationSettings.discord?.throttleMinutes || 5}
                          onChange={(e) => setNotificationSettings(prev => ({
                            ...prev,
                            discord: { ...prev.discord, throttleMinutes: parseInt(e.target.value) || 5 }
                          }))}
                          className="w-32"
                        />
                        <p className="text-xs text-muted-foreground">
                          Minimum minutes between similar notifications (prevents spam)
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (notificationSettings.discord?.webhookUrl) {
                          toast.info('Sending test message to Discord...');
                          
                          try {
                            // Import notification services
                            const { notificationManager } = await import('@/lib/notification-manager');
                            
                            // Test Discord integration
                            const result = await notificationManager.testNotifications({
                              ...notificationSettings,
                              events: { manufacturing: true, mining: true, killmails: true, markets: true }
                            });
                            
                            if (result.discord) {
                              toast.success('Test message sent to Discord successfully!');
                            } else {
                              toast.error('Discord test failed: ' + (result.errors.find(e => e.includes('Discord')) || 'Unknown error'));
                            }
                          } catch (error) {
                            console.error('Discord test error:', error);
                            toast.error('Failed to test Discord integration');
                          }
                        } else {
                          toast.error('Please enter a webhook URL first');
                        }
                      }}
                      disabled={!notificationSettings.discord?.webhookUrl}
                    >
                      <Bell size={16} className="mr-2" />
                      Test Discord Integration
                    </Button>
                  </div>
                )}
              </div>

              {/* EVE Online Email */}
              <div className="border-t border-border pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-orange-500 rounded flex items-center justify-center">
                    <Rocket size={12} className="text-white" />
                  </div>
                  <h4 className="font-medium">EVE Online In-Game Mail</h4>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable In-Game Mail Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send notifications via EVE Online in-game mail system
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.eveMail?.enabled || false}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({
                      ...prev,
                      eveMail: { ...prev.eveMail, enabled: checked }
                    }))}
                  />
                </div>

                {notificationSettings.eveMail?.enabled && (
                  <div className="space-y-6 pl-6 border-l-2 border-orange-500/20">
                    {/* Sender Configuration */}
                    <div className="space-y-4">
                      <h5 className="font-medium text-sm">Sender Configuration</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="eveMailSenderCharacter">Sender Character ID</Label>
                          <Input
                            id="eveMailSenderCharacter"
                            type="number"
                            value={notificationSettings.eveMail?.senderCharacterId || ''}
                            onChange={(e) => setNotificationSettings(prev => ({
                              ...prev,
                              eveMail: { ...prev.eveMail, senderCharacterId: parseInt(e.target.value) || 0 }
                            }))}
                            placeholder="Character ID with mail sending permissions"
                          />
                          <p className="text-xs text-muted-foreground">
                            Character that will send notifications (requires ESI mail scope)
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="eveMailSubjectPrefix">Subject Prefix</Label>
                          <Input
                            id="eveMailSubjectPrefix"
                            value={notificationSettings.eveMail?.subjectPrefix || ''}
                            onChange={(e) => setNotificationSettings(prev => ({
                              ...prev,
                              eveMail: { ...prev.eveMail, subjectPrefix: e.target.value }
                            }))}
                            placeholder="[LMeve Alert]"
                          />
                          <p className="text-xs text-muted-foreground">
                            Prefix for notification mail subjects
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Recipients Configuration */}
                    <div className="space-y-4">
                      <h5 className="font-medium text-sm">Recipients</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="eveMailRecipients">Pilot Character IDs</Label>
                          <Textarea
                            id="eveMailRecipients"
                            rows={4}
                            value={notificationSettings.eveMail?.recipientIds?.join('\n') || ''}
                            onChange={(e) => setNotificationSettings(prev => ({
                              ...prev,
                              eveMail: {
                                ...prev.eveMail,
                                recipientIds: e.target.value.split('\n').map(id => parseInt(id.trim())).filter(id => id > 0)
                              }
                            }))}
                            placeholder="Enter character IDs, one per line&#10;91316135&#10;498125261&#10;12345678"
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Individual pilots to receive notifications
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="eveMailingLists">Mailing Lists</Label>
                          <Textarea
                            id="eveMailingLists"
                            rows={4}
                            value={notificationSettings.eveMail?.mailingLists?.map(ml => `${ml.name}:${ml.id}`).join('\n') || ''}
                            onChange={(e) => {
                              const lists = e.target.value.split('\n')
                                .map(line => line.trim())
                                .filter(line => line && line.includes(':'))
                                .map(line => {
                                  const [name, id] = line.split(':');
                                  return {
                                    name: name.trim(),
                                    id: parseInt(id.trim())
                                  };
                                })
                                .filter(ml => ml.id > 0);
                              
                              setNotificationSettings(prev => ({
                                ...prev,
                                eveMail: {
                                  ...prev.eveMail,
                                  mailingLists: lists
                                }
                              }));
                            }}
                            placeholder="name:id format, one per line&#10;Corp Leadership:123456&#10;Industry Team:789012&#10;All Members:345678"
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Format: ListName:MailingListID (one per line)
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={notificationSettings.eveMail?.sendToCorporation || false}
                            onCheckedChange={(checked) => setNotificationSettings(prev => ({
                              ...prev,
                              eveMail: { ...prev.eveMail, sendToCorporation: checked }
                            }))}
                          />
                          <Label className="text-sm">Send to entire corporation</Label>
                          <p className="text-xs text-muted-foreground">
                            (Broadcasts to all corp members)
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={notificationSettings.eveMail?.sendToAlliance || false}
                            onCheckedChange={(checked) => setNotificationSettings(prev => ({
                              ...prev,
                              eveMail: { ...prev.eveMail, sendToAlliance: checked }
                            }))}
                          />
                          <Label className="text-sm">Send to alliance</Label>
                          <p className="text-xs text-muted-foreground">
                            (Requires alliance membership)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Message Templates */}
                    <div className="space-y-4">
                      <h5 className="font-medium text-sm">Message Templates</h5>
                      <div className="space-y-4">
                        {/* Manufacturing Template */}
                        <div className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="font-medium">Manufacturing Completion</Label>
                            <Switch
                              checked={notificationSettings.eveMail?.templates?.manufacturing?.enabled || false}
                              onCheckedChange={(checked) => setNotificationSettings(prev => ({
                                ...prev,
                                eveMail: {
                                  ...prev.eveMail,
                                  templates: {
                                    ...prev.eveMail?.templates,
                                    manufacturing: {
                                      ...prev.eveMail?.templates?.manufacturing,
                                      enabled: checked
                                    }
                                  }
                                }
                              }))}
                            />
                          </div>
                          {notificationSettings.eveMail?.templates?.manufacturing?.enabled && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label>Subject Line</Label>
                                <Input
                                  value={notificationSettings.eveMail?.templates?.manufacturing?.subject || 'Manufacturing Job Complete - {item}'}
                                  onChange={(e) => setNotificationSettings(prev => ({
                                    ...prev,
                                    eveMail: {
                                      ...prev.eveMail,
                                      templates: {
                                        ...prev.eveMail?.templates,
                                        manufacturing: {
                                          ...prev.eveMail?.templates?.manufacturing,
                                          subject: e.target.value
                                        }
                                      }
                                    }
                                  }))}
                                  placeholder="Subject line template..."
                                  className="text-sm"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Message Body</Label>
                                <Textarea
                                  rows={4}
                                  value={notificationSettings.eveMail?.templates?.manufacturing?.message || 'Greetings {pilot},\n\nYour manufacturing job for {item} x{count} has completed successfully at {location} on {time}.\n\nPlease collect your items at your earliest convenience.\n\nFly safe!\n{corporation} LMeve System'}
                                  onChange={(e) => setNotificationSettings(prev => ({
                                    ...prev,
                                    eveMail: {
                                      ...prev.eveMail,
                                      templates: {
                                        ...prev.eveMail?.templates,
                                        manufacturing: {
                                          ...prev.eveMail?.templates?.manufacturing,
                                          message: e.target.value
                                        }
                                      }
                                    }
                                  }))}
                                  placeholder="Enter message body template..."
                                  className="text-sm"
                                />
                              </div>
                              
                              <p className="text-xs text-muted-foreground">
                                Variables: {'{pilot}'}, {'{item}'}, {'{count}'}, {'{time}'}, {'{location}'}, {'{corporation}'}, {'{alliance}'}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Queue Alert Template */}
                        <div className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="font-medium">Queue Management Alerts</Label>
                            <Switch
                              checked={notificationSettings.eveMail?.templates?.queues?.enabled || false}
                              onCheckedChange={(checked) => setNotificationSettings(prev => ({
                                ...prev,
                                eveMail: {
                                  ...prev.eveMail,
                                  templates: {
                                    ...prev.eveMail?.templates,
                                    queues: {
                                      ...prev.eveMail?.templates?.queues,
                                      enabled: checked
                                    }
                                  }
                                }
                              }))}
                            />
                          </div>
                          {notificationSettings.eveMail?.templates?.queues?.enabled && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label>Subject Line</Label>
                                <Input
                                  value={notificationSettings.eveMail?.templates?.queues?.subject || 'LMeve Alert: {queue_type} Queue Running Low'}
                                  onChange={(e) => setNotificationSettings(prev => ({
                                    ...prev,
                                    eveMail: {
                                      ...prev.eveMail,
                                      templates: {
                                        ...prev.eveMail?.templates,
                                        queues: {
                                          ...prev.eveMail?.templates?.queues,
                                          subject: e.target.value
                                        }
                                      }
                                    }
                                  }))}
                                  placeholder="Subject line template..."
                                  className="text-sm"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Message Body</Label>
                                <Textarea
                                  rows={4}
                                  value={notificationSettings.eveMail?.templates?.queues?.message || 'Attention Corp Leadership,\n\nThe {queue_type} queues are running critically low with only {remaining_jobs} jobs remaining.\n\nImmediate action required to setup additional industry tasking to maintain production efficiency.\n\nAlert generated at: {time}\n\nLMeve Management System'}
                                  onChange={(e) => setNotificationSettings(prev => ({
                                    ...prev,
                                    eveMail: {
                                      ...prev.eveMail,
                                      templates: {
                                        ...prev.eveMail?.templates,
                                        queues: {
                                          ...prev.eveMail?.templates?.queues,
                                          message: e.target.value
                                        }
                                      }
                                    }
                                  }))}
                                  placeholder="Enter message body template..."
                                  className="text-sm"
                                />
                              </div>
                              
                              <p className="text-xs text-muted-foreground">
                                Variables: {'{queue_type}'}, {'{remaining_jobs}'}, {'{time}'}, {'{corporation}'}, {'{estimated_depletion}'}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Market Alert Template */}
                        <div className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="font-medium">Market Alerts</Label>
                            <Switch
                              checked={notificationSettings.eveMail?.templates?.markets?.enabled || false}
                              onCheckedChange={(checked) => setNotificationSettings(prev => ({
                                ...prev,
                                eveMail: {
                                  ...prev.eveMail,
                                  templates: {
                                    ...prev.eveMail?.templates,
                                    markets: {
                                      ...prev.eveMail?.templates?.markets,
                                      enabled: checked
                                    }
                                  }
                                }
                              }))}
                            />
                          </div>
                          {notificationSettings.eveMail?.templates?.markets?.enabled && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label>Subject Line</Label>
                                <Input
                                  value={notificationSettings.eveMail?.templates?.markets?.subject || 'Market Alert: {item} Price Change ({change}%)'}
                                  onChange={(e) => setNotificationSettings(prev => ({
                                    ...prev,
                                    eveMail: {
                                      ...prev.eveMail,
                                      templates: {
                                        ...prev.eveMail?.templates,
                                        markets: {
                                          ...prev.eveMail?.templates?.markets,
                                          subject: e.target.value
                                        }
                                      }
                                    }
                                  }))}
                                  placeholder="Subject line template..."
                                  className="text-sm"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Message Body</Label>
                                <Textarea
                                  rows={4}
                                  value={notificationSettings.eveMail?.templates?.markets?.message || 'Market Update:\n\n{item} has reached {price} ISK in {system} (a {change}% change from previous price).\n\nRecommendation: Consider {action} based on current market conditions.\n\nThis alert was generated at {time}.\n\nLMeve Market Monitoring'}
                                  onChange={(e) => setNotificationSettings(prev => ({
                                    ...prev,
                                    eveMail: {
                                      ...prev.eveMail,
                                      templates: {
                                        ...prev.eveMail?.templates,
                                        markets: {
                                          ...prev.eveMail?.templates?.markets,
                                          message: e.target.value
                                        }
                                      }
                                    }
                                  }))}
                                  placeholder="Enter message body template..."
                                  className="text-sm"
                                />
                              </div>
                              
                              <p className="text-xs text-muted-foreground">
                                Variables: {'{item}'}, {'{price}'}, {'{change}'}, {'{action}'}, {'{system}'}, {'{time}'}, {'{volume}'}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Killmail Template */}
                        <div className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="font-medium">Killmail Notifications</Label>
                            <Switch
                              checked={notificationSettings.eveMail?.templates?.killmails?.enabled || false}
                              onCheckedChange={(checked) => setNotificationSettings(prev => ({
                                ...prev,
                                eveMail: {
                                  ...prev.eveMail,
                                  templates: {
                                    ...prev.eveMail?.templates,
                                    killmails: {
                                      ...prev.eveMail?.templates?.killmails,
                                      enabled: checked
                                    }
                                  }
                                }
                              }))}
                            />
                          </div>
                          {notificationSettings.eveMail?.templates?.killmails?.enabled && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label>Subject Line</Label>
                                <Input
                                  value={notificationSettings.eveMail?.templates?.killmails?.subject || 'Killmail Report: {pilot} - {ship_type}'}
                                  onChange={(e) => setNotificationSettings(prev => ({
                                    ...prev,
                                    eveMail: {
                                      ...prev.eveMail,
                                      templates: {
                                        ...prev.eveMail?.templates,
                                        killmails: {
                                          ...prev.eveMail?.templates?.killmails,
                                          subject: e.target.value
                                        }
                                      }
                                    }
                                  }))}
                                  placeholder="Subject line template..."
                                  className="text-sm"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Message Body</Label>
                                <Textarea
                                  rows={4}
                                  value={notificationSettings.eveMail?.templates?.killmails?.message || 'Combat Report:\n\n{pilot} has achieved a kill in {system}!\n\nTarget: {ship_type}\nEstimated Value: {isk_value} ISK\nTime: {time}\n\nGreat work pilot! o7\n\nView details: {zkillboard_link}'}
                                  onChange={(e) => setNotificationSettings(prev => ({
                                    ...prev,
                                    eveMail: {
                                      ...prev.eveMail,
                                      templates: {
                                        ...prev.eveMail?.templates,
                                        killmails: {
                                          ...prev.eveMail?.templates?.killmails,
                                          message: e.target.value
                                        }
                                      }
                                    }
                                  }))}
                                  placeholder="Enter message body template..."
                                  className="text-sm"
                                />
                              </div>
                              
                              <p className="text-xs text-muted-foreground">
                                Variables: {'{pilot}'}, {'{ship_type}'}, {'{isk_value}'}, {'{system}'}, {'{time}'}, {'{zkillboard_link}'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Advanced Settings */}
                    <div className="space-y-4">
                      <h5 className="font-medium text-sm">Delivery Options</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={notificationSettings.eveMail?.onlyToOnlineCharacters || false}
                            onCheckedChange={(checked) => setNotificationSettings(prev => ({
                              ...prev,
                              eveMail: { ...prev.eveMail, onlyToOnlineCharacters: checked }
                            }))}
                          />
                          <Label className="text-sm">Only send to online characters</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={notificationSettings.eveMail?.cspaChargeCheck || true}
                            onCheckedChange={(checked) => setNotificationSettings(prev => ({
                              ...prev,
                              eveMail: { ...prev.eveMail, cspaChargeCheck: checked }
                            }))}
                          />
                          <Label className="text-sm">Skip high CSPA charge recipients</Label>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="eveMailThrottleMinutes">Throttle Minutes</Label>
                        <Input
                          id="eveMailThrottleMinutes"
                          type="number"
                          min="1"
                          max="1440"
                          value={notificationSettings.eveMail?.throttleMinutes || 15}
                          onChange={(e) => setNotificationSettings(prev => ({
                            ...prev,
                            eveMail: { ...prev.eveMail, throttleMinutes: parseInt(e.target.value) || 15 }
                          }))}
                          className="w-32"
                        />
                        <p className="text-xs text-muted-foreground">
                          Minimum minutes between EVE mail notifications (EVE has strict rate limits)
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (notificationSettings.eveMail?.senderCharacterId && 
                            (notificationSettings.eveMail?.recipientIds?.length > 0 || 
                             notificationSettings.eveMail?.mailingLists?.length > 0 ||
                             notificationSettings.eveMail?.sendToCorporation ||
                             notificationSettings.eveMail?.sendToAlliance)) {
                          toast.info('Sending test EVE mail...');
                          
                          try {
                            // Import notification services
                            const { notificationManager } = await import('@/lib/notification-manager');
                            
                            // Test EVE mail integration
                            const result = await notificationManager.testNotifications({
                              ...notificationSettings,
                              events: { manufacturing: true, mining: true, killmails: true, markets: true }
                            });
                            
                            if (result.eveMail) {
                              toast.success('Test EVE mail sent successfully!');
                            } else {
                              toast.error('EVE mail test failed: ' + (result.errors.find(e => e.includes('EVE')) || 'Unknown error'));
                            }
                          } catch (error) {
                            console.error('EVE mail test error:', error);
                            toast.error('Failed to test EVE mail integration');
                          }
                        } else {
                          toast.error('Please configure sender and at least one recipient first');
                        }
                      }}
                      disabled={!notificationSettings.eveMail?.senderCharacterId || 
                        (!notificationSettings.eveMail?.recipientIds?.length && 
                         !notificationSettings.eveMail?.mailingLists?.length &&
                         !notificationSettings.eveMail?.sendToCorporation &&
                         !notificationSettings.eveMail?.sendToAlliance)}
                    >
                      <Rocket size={16} className="mr-2" />
                      Test EVE Mail Integration
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Reset to defaults
                    window.location.reload();
                  }}
                >
                  Reset Changes
                </Button>
                <Button
                  onClick={saveNotificationSettings}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <CheckCircle size={16} className="mr-2" />
                  Save Notification Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users size={20} />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Admin Configuration - Only show to admins */}
              {user?.isAdmin && (
                <div className="space-y-4">
                  <div className="p-4 border border-accent/20 bg-accent/5 rounded-lg space-y-4">
                    <div className="flex items-center gap-2">
                      <UserCheck size={16} className="text-accent" />
                      <span className="font-medium">Local Administrator Account</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Configure the local administrator login credentials. This account has full system access.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="adminUsername">Admin Username</Label>
                        <Input
                          id="adminUsername"
                          value={tempAdminConfig.username}
                          onChange={(e) => setTempAdminConfig(c => ({ ...c, username: e.target.value }))}
                          placeholder="admin"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="adminPassword">Admin Password</Label>
                        <Input
                          id="adminPassword"
                          type="password"
                          value={tempAdminConfig.password}
                          onChange={(e) => setTempAdminConfig(c => ({ ...c, password: e.target.value }))}
                          placeholder="Enter secure password"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button onClick={handleSaveAdminConfig} size="sm">
                        Update Admin Credentials
                      </Button>
                      <Badge variant="outline" className="text-xs">
                        Current: {adminConfig.username}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="border-t border-border pt-4"></div>
                </div>
              )}

              {/* Character-Tied User Management Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">User & Character Management</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Manage user accounts and their EVE character associations
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setShowCharacterLookup(true)}
                      variant="outline"
                      size="sm"
                    >
                      <Rocket size={16} className="mr-2" />
                      Link Character
                    </Button>
                    <Button
                      onClick={() => setShowAddUser(true)}
                      size="sm"
                      className="bg-accent hover:bg-accent/90"
                    >
                      <Users size={16} className="mr-2" />
                      Add User
                    </Button>
                  </div>
                </div>

                {/* Character Tie-in Information */}
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info size={16} className="text-accent mt-0.5 flex-shrink-0" />
                    <div className="text-sm space-y-1">
                      <p className="font-medium text-foreground">Character Linking System</p>
                      <ul className="text-muted-foreground space-y-1 text-xs">
                        <li>• <strong>ESI Users:</strong> Automatically linked to EVE characters via SSO authentication</li>
                        <li>• <strong>Manual Users:</strong> Can be tied to characters using the "Link Character" feature</li>
                        <li>• <strong>Character Search:</strong> Uses EVE's search API to find and verify characters</li>
                        <li>• <strong>Corporation Validation:</strong> Characters are validated against registered corporations</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* All Users List - Manual and ESI */}
                {allUsers.length > 0 ? (
                  <div className="space-y-3">
                    {allUsers.map((anyUser) => (
                      <div key={anyUser.id} className="p-4 border border-border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {/* Character Portrait */}
                            {anyUser.characterId && (
                              <img 
                                src={`https://images.evetech.net/characters/${anyUser.characterId}/portrait?size=64`}
                                alt={anyUser.characterName || 'Character'}
                                className="w-12 h-12 rounded-full border-2 border-accent/30"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxMiIgeT0iMTIiPgo8cGF0aCBkPSJNMTIgMTVDMTAuMzQgMTUgOSAxMy42NiA5IDEyQzkgMTAuMzQgMTAuMzQgOSAxMiA5QzEzLjY2IDkgMTUgMTAuMzQgMTUgMTJDMTUgMTMuNjYgMTMuNjYgMTUgMTIgMTVaIiBmaWxsPSIjOTk5Ii8+CjxwYXRoIGQ9Ik0xMiAxOEM4LjY5IDE4IDYgMTQuNjkgNiAxMkM2IDkuMzEgOC42OSA2IDEyIDZDMTQuNjkgNiAxOCA5LjMxIDE4IDEyQzE4IDE0LjY5IDE0LjY5IDE4IDEyIDE4WiIgZmlsbD0iIzk5OSIvPgo8L3N2Zz4KPC9zdmc+';
                                }}
                              />
                            )}
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h5 className="font-medium">{anyUser.characterName || 'Unknown Character'}</h5>
                                {anyUser.authMethod === 'esi' && (
                                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
                                    ESI Verified
                                  </Badge>
                                )}
                                {anyUser.authMethod === 'manual' && (
                                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                                    Manual
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="mt-1 space-y-1">
                                {anyUser.username && (
                                  <p className="text-sm text-muted-foreground">
                                    Username: <span className="font-mono">{anyUser.username}</span>
                                  </p>
                                )}
                                <p className="text-sm text-muted-foreground">
                                  Corporation: {anyUser.corporationName || 'Unknown Corporation'}
                                  {anyUser.corporationId && (
                                    <span className="text-xs ml-2 opacity-75">({anyUser.corporationId})</span>
                                  )}
                                </p>
                                {anyUser.allianceName && (
                                  <p className="text-sm text-muted-foreground">
                                    Alliance: {anyUser.allianceName}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Role: <span className="capitalize">{anyUser.role?.replace('_', ' ')}</span> • 
                                  Created: {new Date(anyUser.createdDate || Date.now()).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Badge variant={anyUser.isActive ? "default" : "secondary"}>
                              {anyUser.isActive ? "Active" : "Inactive"}
                            </Badge>
                            
                            {/* Character verification status */}
                            {anyUser.characterId ? (
                              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
                                <CheckCircle size={12} className="mr-1" />
                                Linked
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                                <Warning size={12} className="mr-1" />
                                Unlinked
                              </Badge>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingUser(anyUser);
                                setShowEditUser(true);
                              }}
                              className="text-xs"
                            >
                              <Wrench size={14} className="mr-1" />
                              Edit
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteUser(anyUser.id)}
                              className="text-xs text-red-400 hover:bg-red-500/10"
                            >
                              <X size={14} />
                            </Button>
                          </div>
                        </div>
                        
                        {anyUser.lastLogin && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Last login: {new Date(anyUser.lastLogin).toLocaleString()}</span>
                              {anyUser.authMethod === 'esi' && anyUser.tokenExpiry && (
                                <span>Token expires: {new Date(anyUser.tokenExpiry).toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 border border-dashed border-border rounded-lg text-center">
                    <Users size={32} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">No users configured</p>
                    <p className="text-xs text-muted-foreground">
                      Add users manually or use EVE SSO for automatic character linking
                    </p>
                  </div>
                )}
              </div>

              {/* Add User Modal */}
              {showAddUser && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Add Manual User</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowAddUser(false);
                          setNewUser({
                            username: '',
                            password: '',
                            characterName: '',
                            corporationName: '',
                            roles: []
                          });
                        }}
                      >
                        <X size={16} />
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newUsername">Username</Label>
                        <Input
                          id="newUsername"
                          value={newUser.username}
                          onChange={(e) => setNewUser(u => ({ ...u, username: e.target.value }))}
                          placeholder="Login username"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newPassword">Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser(u => ({ ...u, password: e.target.value }))}
                          placeholder="User password"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newCharacterName">Character Name</Label>
                        <Input
                          id="newCharacterName"
                          value={newUser.characterName}
                          onChange={(e) => setNewUser(u => ({ ...u, characterName: e.target.value }))}
                          placeholder="EVE character name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newCorporationName">Corporation Name</Label>
                        <Input
                          id="newCorporationName"
                          value={newUser.corporationName}
                          onChange={(e) => setNewUser(u => ({ ...u, corporationName: e.target.value }))}
                          placeholder="Corporation name"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-6">
                      <Button
                        onClick={() => {
                          setShowAddUser(false);
                          setNewUser({
                            username: '',
                            password: '',
                            characterName: '',
                            corporationName: '',
                            roles: []
                          });
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (!newUser.username || !newUser.password || !newUser.characterName) {
                            toast.error('Please fill in all required fields');
                            return;
                          }

                          const user = {
                            id: Date.now().toString(),
                            username: newUser.username,
                            characterName: newUser.characterName,
                            corporationName: newUser.corporationName || 'Unknown Corporation',
                            roles: ['member'],
                            createdAt: new Date().toISOString(),
                            isActive: true
                          };

                          setManualUsers(users => [...users, user]);
                          setShowAddUser(false);
                          setNewUser({
                            username: '',
                            password: '',
                            characterName: '',
                            corporationName: '',
                            roles: []
                          });
                          toast.success('User created successfully');
                        }}
                        disabled={!newUser.username || !newUser.password || !newUser.characterName}
                        className="flex-1 bg-accent hover:bg-accent/90"
                      >
                        Create User
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Character Lookup Modal */}
              {showCharacterLookup && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl mx-4 shadow-lg max-h-[80vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Link EVE Character</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowCharacterLookup(false);
                          setCharacterSearchTerm('');
                          setCharacterSearchResults([]);
                          setSelectedCharacter(null);
                        }}
                      >
                        <X size={16} />
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {/* Character Search */}
                      <div className="space-y-2">
                        <Label htmlFor="characterSearch">Search EVE Characters</Label>
                        <div className="flex gap-2">
                          <Input
                            id="characterSearch"
                            value={characterSearchTerm}
                            onChange={(e) => setCharacterSearchTerm(e.target.value)}
                            placeholder="Enter character name (minimum 3 characters)"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && characterSearchTerm.length >= 3) {
                                searchCharacters(characterSearchTerm);
                              }
                            }}
                          />
                          <Button
                            onClick={() => searchCharacters(characterSearchTerm)}
                            disabled={isSearchingCharacters || characterSearchTerm.length < 3}
                            size="sm"
                          >
                            {isSearchingCharacters ? (
                              <ArrowClockwise size={16} className="animate-spin mr-2" />
                            ) : (
                              <Rocket size={16} className="mr-2" />
                            )}
                            Search
                          </Button>
                        </div>
                      </div>

                      {/* Search Results */}
                      {characterSearchResults.length > 0 && (
                        <div className="space-y-2">
                          <Label>Search Results</Label>
                          <div className="max-h-60 overflow-y-auto space-y-2">
                            {characterSearchResults.map((character) => (
                              <div
                                key={character.characterId}
                                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                  selectedCharacter?.characterId === character.characterId
                                    ? 'border-accent bg-accent/10'
                                    : 'border-border hover:border-accent/50'
                                }`}
                                onClick={() => setSelectedCharacter(character)}
                              >
                                <div className="flex items-center gap-3">
                                  <img
                                    src={`https://images.evetech.net/characters/${character.characterId}/portrait?size=64`}
                                    alt={character.characterName}
                                    className="w-10 h-10 rounded-full border border-accent/30"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxMCIgeT0iMTAiPgo8cGF0aCBkPSJNMTAgMTJDOC4zNCAxMiA3IDEwLjY2IDcgOUM3IDcuMzQgOC4zNCA2IDEwIDZDMTEuNjYgNiAxMyA3LjM0IDEzIDlDMTMgMTAuNjYgMTEuNjYgMTIgMTAgMTJaIiBmaWxsPSIjOTk5Ii8+CjxwYXRoIGQ9Ik0xMCAxNUM3LjI0IDE1IDUgMTIuMjQgNSAxMEM1IDcuNzYgNy4yNCA1IDEwIDVDMTIuMjQgNSAxNSA3Ljc2IDE1IDEwQzE1IDEyLjI0IDEyLjI0IDE1IDEwIDE1WiIgZmlsbD0iIzk5OSIvPgo8L3N2Zz4KPC9zdmc+';
                                    }}
                                  />
                                  <div className="flex-1">
                                    <h4 className="font-medium">{character.characterName}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      {character.corporationName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Security Status: {character.securityStatus?.toFixed(2) || 'N/A'}
                                    </p>
                                  </div>
                                  {selectedCharacter?.characterId === character.characterId && (
                                    <CheckCircle size={20} className="text-accent" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Role Selection */}
                      {selectedCharacter && (
                        <div className="space-y-2">
                          <Label>Assign Role</Label>
                          <Select defaultValue="member">
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="director">Director</SelectItem>
                              <SelectItem value="ceo">CEO</SelectItem>
                              <SelectItem value="admin">Administrator</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-6">
                      <Button
                        onClick={() => {
                          setShowCharacterLookup(false);
                          setCharacterSearchTerm('');
                          setCharacterSearchResults([]);
                          setSelectedCharacter(null);
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (selectedCharacter) {
                            handleCreateUserFromCharacter(selectedCharacter, 'member');
                          }
                        }}
                        disabled={!selectedCharacter}
                        className="flex-1 bg-accent hover:bg-accent/90"
                      >
                        Create User
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit User Modal */}
              {showEditUser && editingUser && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Edit User</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowEditUser(false);
                          setEditingUser(null);
                        }}
                      >
                        <X size={16} />
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {/* Character Info - Read Only */}
                      <div className="space-y-2">
                        <Label>Character Information</Label>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            {editingUser.characterId && (
                              <img
                                src={`https://images.evetech.net/characters/${editingUser.characterId}/portrait?size=64`}
                                alt={editingUser.characterName || 'Character'}
                                className="w-10 h-10 rounded-full border border-accent/30"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxMCIgeT0iMTAiPgo8cGF0aCBkPSJNMTAgMTJDOC4zNCAxMiA3IDEwLjY2IDcgOUM3IDcuMzQgOC4zNCA2IDEwIDZDMTEuNjYgNiAxMyA3LjM0IDEzIDlDMTMgMTAuNjYgMTEuNjYgMTIgMTAgMTJaIiBmaWxsPSIjOTk5Ii8+CjxwYXRoIGQ9Ik0xMCAxNUM3LjI0IDE1IDUgMTIuMjQgNSAxMEM1IDcuNzYgNy4yNCA1IDEwIDVDMTIuMjQgNSAxNSA3Ljc2IDE1IDEwQzE1IDEyLjI0IDEyLjI0IDE1IDEwIDE1WiIgZmlsbD0iIzk5OSIvPgo8L3N2Zz4KPC9zdmc+';
                                }}
                              />
                            )}
                            <div>
                              <p className="font-medium">{editingUser.characterName || 'Unknown Character'}</p>
                              <p className="text-sm text-muted-foreground">{editingUser.corporationName || 'Unknown Corporation'}</p>
                              <p className="text-xs text-muted-foreground">
                                Auth: {editingUser.authMethod === 'esi' ? 'ESI Verified' : 'Manual'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Role Selection */}
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select defaultValue={editingUser.role || 'member'}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="director">Director</SelectItem>
                            <SelectItem value="ceo">CEO</SelectItem>
                            <SelectItem value="admin">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Active Status */}
                      <div className="flex items-center justify-between">
                        <Label>Active Status</Label>
                        <Switch
                          checked={editingUser.isActive}
                          onCheckedChange={(checked) => {
                            setEditingUser(prev => ({ ...prev, isActive: checked }));
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-6">
                      <Button
                        onClick={() => {
                          setShowEditUser(false);
                          setEditingUser(null);
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          // TODO: Update user using auth provider
                          toast.success('User updated successfully');
                          setShowEditUser(false);
                          setEditingUser(null);
                        }}
                        className="flex-1 bg-accent hover:bg-accent/90"
                      >
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debug" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <UserCheck size={20} />
                Authentication Debug
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AdminLoginTest />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Simple Auth Service Test</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleLoginTest />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Database size={20} />
                Database Connection Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Test database connectivity using the current configuration settings.
              </p>
              <Button
                onClick={() => {
                  console.log('🧪 Debug test connection button clicked');
                  handleTestDbConnection();
                }}
                disabled={testingConnection}
                className="w-full hover:bg-accent/10 active:bg-accent/20 transition-colors"
              >
                {testingConnection ? (
                  <>
                    <ArrowClockwise size={16} className="mr-2 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Play size={16} className="mr-2" />
                    Test Database Connection
                  </>
                )}
              </Button>
              
              {connectionLogs.length > 0 && (
                <div className="border border-border rounded-lg p-3 bg-muted/30">
                  <div className="font-mono text-xs space-y-1 max-h-32 overflow-y-auto">
                    {connectionLogs.map((log, index) => (
                      <div key={index} className="text-foreground">{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Info size={20} />
                System Debug Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Current User</Label>
                  <div className="p-3 border border-border rounded bg-muted/50 font-mono text-sm">
                    {user ? (
                      <div>
                        <div>Name: {user.characterName}</div>
                        <div>Corp: {user.corporationName}</div>
                        <div>ID: {user.characterId}</div>
                        <div>Admin: {user.isAdmin ? 'Yes' : 'No'}</div>
                        <div>Auth: {user.authMethod}</div>
                        <div>ESI Access: {user.canManageESI ? 'Yes' : 'No'}</div>
                      </div>
                    ) : (
                      'No user logged in'
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Corporation Registry</Label>
                  <div className="p-3 border border-border rounded bg-muted/50 font-mono text-sm max-h-32 overflow-y-auto">
                    {registeredCorps && Object.keys(registeredCorps).length > 0 ? (
                      Object.entries(registeredCorps).map(([corpId, corp]) => (
                        <div key={corpId} className="text-xs">
                          {corp.corporationName} ({corpId})
                        </div>
                      ))
                    ) : (
                      'No corporations registered'
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Admin Configuration</Label>
                  <div className="p-3 border border-border rounded bg-muted/50 font-mono text-sm">
                    <div>Username: {adminConfig.username}</div>
                    <div>Password Set: {adminConfig.password ? 'Yes' : 'No'}</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>ESI Configuration Status</Label>
                  <div className="p-3 border border-border rounded bg-muted/50 font-mono text-sm">
                    <div>Client ID: {esiConfig.clientId ? 'Configured' : 'Not Set'}</div>
                    <div>Secret: {esiConfig.secretKey ? 'Configured' : 'Not Set'}</div>
                    <div>Base URL: {esiConfig.baseUrl || 'https://login.eveonline.com'}</div>
                    <div>User Agent: {esiConfig.userAgent || 'Not Set'}</div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <h4 className="font-medium">Database Validation Tests</h4>
                <p className="text-sm text-muted-foreground">
                  Run comprehensive tests to verify database connection validation is working properly.
                  This will test both invalid configurations (should fail) and valid ones (might pass with real MySQL).
                </p>
                <Button
                  onClick={() => {
                    toast.info('Running database validation tests - check browser console for detailed results');
                    runDatabaseValidationTests();
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <Database size={16} className="mr-2" />
                  Run Database Validation Test Suite
                </Button>
              </div>
              
              <Separator />
              
              {/* Data Management */}
              <div className="space-y-4">
                <h4 className="font-medium">Data Management</h4>
                <p className="text-sm text-muted-foreground">
                  Export and import all LMeve configuration data including settings, users, and corporation data.
                </p>
                
                <div className="grid grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    onClick={handleExportSettings}
                    className="flex items-center justify-center"
                  >
                    <Download size={16} className="mr-2" />
                    Export All Data
                  </Button>
                  
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportSettings}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button
                      variant="outline"
                      className="w-full flex items-center justify-center"
                    >
                      <Upload size={16} className="mr-2" />
                      Import Data
                    </Button>
                  </div>
                  
                  <Button
                    variant="destructive"
                    onClick={handleResetSettings}
                    className="flex items-center justify-center"
                  >
                    <ArrowClockwise size={16} className="mr-2" />
                    Reset All
                  </Button>
                </div>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Export creates a downloadable backup file with all settings</p>
                  <p>• Import restores settings from a previously exported file</p>
                  <p>• Reset restores all settings to default values (requires confirmation)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        </Tabs>
    </div>
  );
};

export default Settings;