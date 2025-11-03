import { eveApi, type CharacterInfo, type CorporationInfo, fetchESI } from '@/lib/eveApi';
import React, { useState, useEffect, useRef } from 'react';
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
// Removed DatabaseSchemaManager and schema dropdown per UX cleanup
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
  Settings as SettingsIcon
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-provider';
import { initializeESIAuth, getESIAuthService } from '@/lib/esi-auth';
import { CorpSettings } from '@/lib/types';
import { toast } from 'sonner';
// merged into the eveApi import above to include fetchESI
import { runDatabaseValidationTests } from '@/lib/databaseTestCases';
import { hasPermission } from '@/lib/roles';
import { useGeneralSettings,
  useDatabaseSettings,
  useESISettings,
  useSyncSettings,
  useNotificationSettings,
  useIncomeSettings, 
  useApplicationData,
  useManualUsers,
  useCorporationData,
  useLocalKV,
  backupSettings,
  exportAllSettings,
  importAllSettings,
  resetAllSettings,
  validateSettings
} from '@/lib/persistenceService';
import { UserManagement } from '@/components/UserManagement';
import { SyncSetupPanel } from '@/components/settings/SyncSetupPanel';
import { PermissionsTab } from '@/components/settings/PermissionsTab';
import { SyncMonitoring } from '@/components/tabs/SyncMonitoring';
// Database tab containerized
import DatabaseTabContainer from '@/components/settings/DatabaseTab/DatabaseTabContainer';
import { DatabaseConfigPanel } from '@/components/settings/DatabaseTab/DatabaseConfigPanel';
import { ESICredentialsPanel } from '@/components/settings/ESITab/ESICredentialsPanel';
import { ESIScopesPanel } from '@/components/settings/ESITab/ESIScopesPanel';
import { CorpESIManagementPanel } from '@/components/settings/ESITab/CorpESIManagementPanel';
import { ESISettings } from '../settings/ESISettings';
import { NotificationSettings } from '../settings/NotificationSettings';

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
  // (moved) imports are already declared at the module top from '@/lib/persistenceService'
  const {
    user,
    loginWithESI,
    logout,
    esiConfig,
    updateESIConfig,
    adminConfig,
    updateAdminConfig,
    getRegisteredCorporations,
    getAllUsers,
    deleteUser,
    updateCorporation,
    deleteCorporation,
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
  
  // SDE manager removed from this tab
  const [generalSettings, setGeneralSettings] = useGeneralSettings();
  const [databaseSettings, setDatabaseSettings] = useDatabaseSettings();
  const [esiSettings, setESISettings] = useESISettings();

  // (Lifecycle to be moved into SettingsShell in next step)
  // Removed SDE manager usage in Settings tab (managed elsewhere)
  const [syncSettings, setSyncSettings] = useSyncSettings();
  const [notificationSettings, setNotificationSettings] = useNotificationSettings();
  const [incomeSettings, setIncomeSettings] = useIncomeSettings();
  const [applicationData, setApplicationData] = useApplicationData();
  const [manualUsers, setManualUsers] = useManualUsers();
  const [corporationData, setCorporationData] = useCorporationData();

  // ESI Scopes catalogs and selections
  const CHARACTER_SCOPE_CATALOG: string[] = [
    'esi-calendar.respond_calendar_events.v1',
    'esi-calendar.read_calendar_events.v1',
    'esi-location.read_location.v1',
    'esi-location.read_ship_type.v1',
    'esi-location.read_online.v1',
    'esi-mail.organize_mail.v1',
    'esi-mail.read_mail.v1',
    'esi-mail.send_mail.v1',
    'esi-skills.read_skills.v1',
    'esi-skills.read_skillqueue.v1',
    'esi-wallet.read_character_wallet.v1',
    'esi-search.search_structures.v1',
    'esi-clones.read_clones.v1',
    'esi-clones.read_implants.v1',
    'esi-characters.read_contacts.v1',
    'esi-characters.write_contacts.v1',
    'esi-characters.read_loyalty.v1',
    'esi-characters.read_chat_channels.v1',
    'esi-characters.read_medals.v1',
    'esi-characters.read_standings.v1',
    'esi-characters.read_agents_research.v1',
    'esi-characters.read_blueprints.v1',
    'esi-characters.read_corporation_roles.v1',
    'esi-characters.read_fatigue.v1',
    'esi-characters.read_notifications.v1',
    'esi-characters.read_titles.v1',
    'esi-fittings.read_fittings.v1',
    'esi-fittings.write_fittings.v1',
    'esi-fleets.read_fleet.v1',
    'esi-fleets.write_fleet.v1',
    'esi-industry.read_character_jobs.v1',
    'esi-industry.read_character_mining.v1',
    'esi-markets.read_character_orders.v1',
    'esi-markets.structure_markets.v1',
    'esi-ui.open_window.v1',
    'esi-ui.write_waypoint.v1',
    'esi-killmails.read_killmails.v1',
    'esi-universe.read_structures.v1',
    'esi-alliances.read_contacts.v1',
    'esi-characters.read_fw_stats.v1',
  ];
  const CORPORATION_SCOPE_CATALOG: string[] = [
    'esi-corporations.read_corporation_membership.v1',
    'esi-assets.read_corporation_assets.v1',
    'esi-corporations.read_blueprints.v1',
    'esi-corporations.read_container_logs.v1',
    'esi-corporations.read_divisions.v1',
    'esi-corporations.read_contacts.v1',
    'esi-corporations.read_facilities.v1',
    'esi-corporations.read_medals.v1',
    'esi-corporations.read_standings.v1',
    'esi-corporations.read_structures.v1',
    'esi-corporations.read_starbases.v1',
    'esi-corporations.read_titles.v1',
    'esi-contracts.read_corporation_contracts.v1',
    'esi-industry.read_corporation_jobs.v1',
    'esi-industry.read_corporation_mining.v1',
    'esi-killmails.read_corporation_killmails.v1',
    'esi-markets.read_corporation_orders.v1',
    'esi-planets.read_customs_offices.v1',
    'esi-wallet.read_corporation_wallets.v1',
    'esi-corporations.track_members.v1',
    'esi-corporations.read_fw_stats.v1',
  ];
  const [requestedCharScopes, setRequestedCharScopes] = useLocalKV<string[]>(
    'lmeve-esi-requested-character-scopes',
    [
      'esi-characters.read_corporation_roles.v1',
      'esi-industry.read_character_jobs.v1',
      'esi-wallet.read_character_wallet.v1'
    ]
  );
  const [requestedCorpScopes, setRequestedCorpScopes] = useLocalKV<string[]>(
    'lmeve-esi-requested-corporation-scopes',
    [
      'esi-corporations.read_corporation_membership.v1',
      'esi-assets.read_corporation_assets.v1',
      'esi-industry.read_corporation_jobs.v1',
      'esi-markets.read_corporation_orders.v1',
      'esi-wallet.read_corporation_wallets.v1',
      'esi-universe.read_structures.v1'
    ]
  );

  // EVE Online server and corporation ESI status (server-backed, not in browser storage)
  const [eveServerStatus, _setEveServerStatus] = React.useState({
    status: 'unknown' as 'online' | 'offline' | 'unknown',
    players: 0,
    lastCheck: null as string | null
  });
  // Scope corporation ESI status per-corporation so multiple corps don't collide
  const corpStatusKey = user?.corporationId ? `corporation-esi-status:${user.corporationId}` : 'corporation-esi-status';
  const [corporationESIStatus, _setCorporationESIStatus] = React.useState({
    hasActiveCorporation: false,
    corporationCount: 0,
    hasCEODirectorAuth: false,
    lastAuthCheck: null as string | null
  });

  // Site-data helpers with graceful fallback when server storage isn't ready
  const SITE_DATA_FALLBACK_PREFIX = 'lmeve-site-data-fallback:';
  const warnedSiteDataFailureRef = React.useRef(false);
  // Track last-saved value and time per key to avoid redundant writes
  const lastSavedByKeyRef = React.useRef(new Map<string, { valueHash: string; at: number }>());
  const loadSiteData = async (key: string) => {
    try {
      const resp = await fetch(`/api/site-data.php?key=${encodeURIComponent(key)}`);
      if (resp.ok) {
        const json = await resp.json();
        return json?.value ?? null;
      }
      // If server returned diagnostics, log once for debugging
      try {
        const diag = await resp.json();
        if (!warnedSiteDataFailureRef.current) {
          console.warn('site-data.php load diagnostics:', diag);
          warnedSiteDataFailureRef.current = true;
        }
      } catch {}
    } catch {}
    // Fallback to local ephemeral storage so UI can continue working
    try {
      const raw = localStorage.getItem(`${SITE_DATA_FALLBACK_PREFIX}${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const saveSiteData = async (key: string, value: any) => {
    // Idempotence + light throttling: skip if unchanged or saved very recently
    try {
      const valueHash = JSON.stringify(value);
      const now = Date.now();
      const last = lastSavedByKeyRef.current.get(key);
      if (last && last.valueHash === valueHash) {
        return; // no change
      }
      if (last && now - last.at < 1000) {
        // too soon since last write; coalesce by updating cache and delaying the write slightly
        lastSavedByKeyRef.current.set(key, { valueHash, at: now });
        setTimeout(() => {
          // best-effort delayed write; ignore result
          fetch('/api/site-data.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value })
          }).catch(() => {});
        }, 300);
        return;
      }
      // record intent to save
      lastSavedByKeyRef.current.set(key, { valueHash, at: now });
    } catch {}
    try {
      const resp = await fetch('/api/site-data.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      if (resp.ok) return;
      // Not OK – attempt to read diagnostics and warn once
      try {
        const diag = await resp.json();
        if (!warnedSiteDataFailureRef.current) {
          console.warn('site-data.php save diagnostics:', diag);
          warnedSiteDataFailureRef.current = true;
        }
      } catch {}
    } catch {}
    // Persist to local ephemeral storage as a temporary fallback
    try { localStorage.setItem(`${SITE_DATA_FALLBACK_PREFIX}${key}`, JSON.stringify(value)); } catch {}
  };
  const setEveServerStatus = (next: typeof eveServerStatus) => {
    try {
      // Skip if unchanged to avoid redundant saves/renders
      const currentHash = JSON.stringify(eveServerStatus);
      const nextHash = JSON.stringify(next);
      if (currentHash === nextHash) return;
    } catch {}
    _setEveServerStatus(next);
    saveSiteData('eve-server-status', next);
  };
  const setCorporationESIStatus = (next: typeof corporationESIStatus) => {
    try {
      const currentHash = JSON.stringify(corporationESIStatus);
      const nextHash = JSON.stringify(next);
      if (currentHash === nextHash) return;
    } catch {}
    _setCorporationESIStatus(next);
    saveSiteData(corpStatusKey, next);
  };

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

  const [esiConfigLocal, setESIConfigLocal] = useLocalKV<any>('esi-config-legacy', {
    clientId: '',
    secretKey: '',
    baseUrl: 'https://login.eveonline.com',
    userAgent: 'LMeve Corporation Management Tool'
  });

  const [oauthState, setOAuthState] = useLocalKV<ESIOAuthState>('esi-oauth', {
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
  
  // UI state management for modals and forms
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

  // Helper functions to update settings
  const updateGeneralSetting = <K extends keyof typeof generalSettings>(key: K, value: typeof generalSettings[K]) => {
    setGeneralSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateDatabaseSetting = <K extends keyof typeof databaseSettings>(key: K, value: typeof databaseSettings[K]) => {
    setDatabaseSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateESISetting = <K extends keyof typeof esiSettings>(key: K, value: typeof esiSettings[K]) => {
    setESISettings(prev => ({ ...prev, [key]: value }));
  };

  const updateSyncSetting = <K extends keyof typeof syncSettings>(key: K, value: typeof syncSettings[K]) => {
    setSyncSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateNotificationSetting = <K extends keyof typeof notificationSettings>(key: K, value: typeof notificationSettings[K]) => {
    setNotificationSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateIncomeSetting = <K extends keyof typeof incomeSettings>(key: K, value: typeof incomeSettings[K]) => {
    setIncomeSettings(prev => ({ ...prev, [key]: value }));
  };

  // Save functions (settings are auto-persisted by hooks, these just provide feedback)
  const saveGeneralSettings = () => {
    toast.success('General settings saved');
  };

  const saveDatabaseSettings = () => {
    toast.success('Database settings saved');
  };

  const saveESISettings = () => {
    toast.success('ESI settings saved');
  };

  const saveSyncSettings = () => {
    toast.success('Sync settings saved');
  };

  const saveNotificationSettings = () => {
    toast.success('Notification settings saved');
  };

  const saveIncomeSettings = () => {
    toast.success('Income settings saved');
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

  // Generate OAuth authorization URL for testing from Settings
  // SPA-only: always use the current origin root as redirect_uri
  const generateAuthUrl = () => {
    const state = Math.random().toString(36).substring(2, 15);
    const scopes = ESI_SCOPES.join(' ');
    const redirectUri: string = `${window.location.origin}/`;
    
    const authUrl = `https://login.eveonline.com/v2/oauth/authorize/?` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
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
    toast.info('Redirecting to EVE SSO...');
    window.location.href = authUrl;
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
    updateESIConfig(esiConfig.clientId || '', esiConfig.clientSecret);
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

  // Load corporation and character info on mount (only when ESI configured)
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

    // Gate EVE API fetches until ESI is configured to avoid noise during status checks
    if (eveOnlineSync.enabled && !!esiConfig?.clientId) {
      loadEVEData();
    }
  }, [eveOnlineSync.enabled, eveOnlineSync.corporationId, eveOnlineSync.characterId, esiConfig?.clientId]);

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

  // Removed SDE stats and update checks

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
    saveSyncSettings();
    saveNotificationSettings();
    saveIncomeSettings();
    toast.success('All settings saved successfully');
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

  // Removed legacy system status refresh and checks

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Gear size={24} />
          Settings
        </h2>
        <p className="text-muted-foreground">
          Configure system and application settings
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
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
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

              {/* Cache Management */}
              <div className="space-y-4 border-t border-border pt-4">
                <h4 className="font-medium">Cache Management</h4>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Local Cache</Label>
                    <p className="text-sm text-muted-foreground">
                      Use machine-local cache for faster loads. This is not browser storage.
                    </p>
                  </div>
                  <Switch 
                    checked={!!generalSettings.cacheEnabled}
                    onCheckedChange={(checked) => updateGeneralSetting('cacheEnabled', checked)}
                  />
                </div>
                {generalSettings.cacheEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="cacheMaxSize">Cache Size (MB)</Label>
                    <Input
                      id="cacheMaxSize"
                      type="number"
                      value={(generalSettings.cacheMaxSizeMB ?? 256).toString()}
                      onChange={(e) => updateGeneralSetting('cacheMaxSizeMB', Math.max(16, parseInt(e.target.value) || 256))}
                      min="16"
                      max="32768"
                      placeholder="256"
                    />
                    <p className="text-xs text-muted-foreground">
                      Range: 16 MB – 32768 MB (32 GB). Actual implementation depends on server configuration.
                    </p>
                  </div>
                )}
              </div>

              {/* Site Configuration */}
              <div className="space-y-4 border-t border-border pt-4">
                <h4 className="font-medium">Site Configuration</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Deployment Protocol</Label>
                    <Select
                      value={generalSettings.deploymentProtocol || (window.location.protocol === 'https:' ? 'https' : 'http')}
                      onValueChange={(v) => updateGeneralSetting('deploymentProtocol', v as 'http'|'https')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select protocol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="http">HTTP</SelectItem>
                        <SelectItem value="https">HTTPS</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      If HTTPS is selected, ensure certificates and reverse proxy are configured.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Authentication Flow</Label>
                    <Select
                      value={generalSettings.authFlow || 'server'}
                      onValueChange={(v) => updateGeneralSetting('authFlow', v as 'spa'|'server')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select auth flow" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="server">PHP (Server Callback)</SelectItem>
                        <SelectItem value="spa">SPA (Client Callback)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Server callback is recommended for HTTP deployments. SPA callback requires HTTPS for PKCE.
                    </p>
                  </div>
                </div>
              </div>

              {/* ESI Application Credentials */}
              <div className="space-y-4 border-t border-border pt-4">
                <ESICredentialsPanel
                  userName={user?.characterName}
                  userCorp={user?.corporationName}
                  esiSettings={esiSettings}
                  esiConfig={{ clientId: esiConfig.clientId, clientSecret: esiConfig.clientSecret }}
                  generalSettings={generalSettings}
                  onUpdateESISetting={(k, v) => updateESISetting(k as any, v)}
                  onSaveESIConfig={(clientId, clientSecret) => {
                    if (!clientId) {
                      toast.error('Client ID is required');
                      return;
                    }
                    updateESIConfig(clientId, clientSecret || '');
                    setESISettings(prev => ({ ...prev, clientId: '', clientSecret: '' }));
                    toast.success('ESI configuration updated');
                  }}
                  onClearESIForm={() => {
                    setESISettings(prev => ({ ...prev, clientId: '', clientSecret: '' }));
                    toast.info('Form cleared');
                  }}
                  onTestESIConfig={async () => {
                    try {
                      const clientId = (esiSettings.clientId || esiConfig.clientId || '').trim();
                      const clientSecret = (esiSettings.clientSecret || esiConfig.clientSecret || '').trim() || undefined;
                      const callbackUrl = (generalSettings.authFlow || 'server') === 'spa'
                        ? `${(generalSettings.deploymentProtocol || (window.location.protocol === 'https:' ? 'https' : 'http'))}://${window.location.host}/`
                        : `${(generalSettings.deploymentProtocol || (window.location.protocol === 'https:' ? 'https' : 'http'))}://${window.location.host}/api/auth/esi/callback.php`;
                      if (!clientId) {
                        toast.error('Client ID is required to test ESI configuration');
                        return;
                      }
                      const corps = getRegisteredCorporations();
                      initializeESIAuth(clientId, clientSecret, corps, callbackUrl);
                      const svc = getESIAuthService();
                      const url = await svc.initiateLogin('basic');
                      toast.info('Redirecting to EVE SSO for basic test...');
                      window.location.href = url;
                    } catch (err) {
                      console.error('ESI config test failed:', err);
                      const message = err instanceof Error ? err.message : 'Failed to initialize ESI login';
                      toast.error(message);
                    }
                  }}
                />
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
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <DatabaseTabContainer />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="esi" className="space-y-6">
          <ESISettings isMobileView={isMobileView} />
        </TabsContent>
        <TabsContent value="notifications" className="space-y-6">
          <NotificationSettings />
        </TabsContent>
        <TabsContent value="sync-monitoring" className="space-y-6">
          <SyncMonitoring isMobileView={isMobileView} />
        </TabsContent>
        <TabsContent value="permissions" className="space-y-6">
          <PermissionsTab isMobileView={isMobileView} />
        </TabsContent>
        
        </Tabs>
    </div>
  );
};

export default Settings;
