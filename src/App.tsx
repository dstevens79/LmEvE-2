import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import {
  Gear,
  SignOut,
  Rocket,
  SignIn,
  Eye,
  EyeSlash,
  DeviceMobile,
  Monitor,
  List,
} from '@phosphor-icons/react';
import { useLocalKV, bootstrapSettingsFromServerIfEmpty, useGeneralSettings, useDatabaseSettings } from '@/lib/persistenceService';
import { useSDEManager } from '@/lib/sdeService';
import { TabType } from '@/lib/types';
import { DatabaseProvider } from '@/lib/DatabaseContext';
import { LMeveDataProvider } from '@/lib/LMeveDataContext';
import { useAuth } from '@/lib/auth-provider';
import { ESICallback } from '@/components/ESICallback';
import { EVELoginButton } from '@/components/EVELoginButton';
import { useThemeManager } from '@/lib/themeManager';
import { PRIMARY_NAV_TABS, findPrimaryTab } from '@/lib/app-navigation';
import { startEsiLogin } from '@/lib/start-esi-login';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import { AppPrimaryNav } from '@/components/layout/AppPrimaryNav';

const Settings = React.lazy(() =>
  import('@/components/tabs/Settings').then((m) => ({ default: m.Settings }))
);

function AppContent() {
  // NUCLEAR RESET: Clear ALL browser data on first load to eliminate stale state issues
  React.useEffect(() => {
    try {
      const RESET_FLAG = 'lmeve-reset-v3'; // Increment version to force re-reset
      const resetMarker = localStorage.getItem(RESET_FLAG);
      
      if (!resetMarker) {
        console.log('🧹 NUCLEAR RESET: Clearing ALL browser storage...');
        
        // 1. Clear ALL localStorage (will restore reset flag after)
        const keysToPreserve: string[] = [];
        localStorage.clear();
        
        // 2. Clear ALL sessionStorage
        sessionStorage.clear();
        
        // 3. Clear IndexedDB databases
        if (window.indexedDB && window.indexedDB.databases) {
          window.indexedDB.databases().then(databases => {
            databases.forEach(db => {
              if (db.name) {
                console.log(`🗑️ Deleting IndexedDB: ${db.name}`);
                window.indexedDB.deleteDatabase(db.name);
              }
            });
          }).catch(() => {});
        }
        
        // 4. Clear service worker caches
        if ('caches' in window) {
          caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
              console.log(`🗑️ Deleting cache: ${cacheName}`);
              caches.delete(cacheName);
            });
          }).catch(() => {});
        }
        
        // 5. Unregister service workers
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => {
              console.log('🗑️ Unregistering service worker');
              registration.unregister();
            });
          }).catch(() => {});
        }
        
        // Mark reset as complete
        localStorage.setItem(RESET_FLAG, String(Date.now()));
        
        console.log('🧹 NUCLEAR RESET completed - browser storage cleared');
        console.log('🔄 Reloading page to start fresh...');
        
        // Force reload to start completely fresh
        window.location.reload();
      }
    } catch (err) {
      console.error('❌ Reset error:', err);
    }
  }, []);

  // One-time settings hydration on first load only if local storage is empty; avoid reload loops
  React.useEffect(() => {
    (async () => {
      try {
        // Skip if we've already hydrated once this session
        if (sessionStorage.getItem('settings-hydrated') === '1') return;
        const result = await bootstrapSettingsFromServerIfEmpty();
        if (result === 'loaded') {
          sessionStorage.setItem('settings-hydrated', '1');
          // Reload once to let components pick up hydrated values without repeated cycles
          window.location.reload();
        }
      } catch {}
    })();
    // Legacy cleanup: remove browser-only setup status in favor of server-backed site-data
    try { localStorage.removeItem('lmeve-setup-status'); } catch {}
  }, []);
  const [activeTab, setActiveTab] = useLocalKV<TabType>('active-tab', 'dashboard');
  const [activeSettingsTab, setActiveSettingsTab] = useLocalKV<string>('active-settings-tab', 'general');
  const [settingsExpanded, setSettingsExpanded] = useLocalKV<boolean>('settings-expanded', false);
  const [isMobileView, setIsMobileView] = useLocalKV<boolean>('mobile-view', false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { 
    user, 
    isAuthenticated, 
    logout, 
    refreshUserToken, 
    isTokenExpired, 
    authTrigger,
    loginWithCredentials,
    loginWithESI,
    handleESICallback,
    esiConfig,
    getRegisteredCorporations,
    hydrateSessionFromServer,
    getAllUsers
  } = useAuth();
  const [generalSettings] = useGeneralSettings();
  const [databaseSettings] = useDatabaseSettings();
  // Global, lightweight status for quick inline display in desktop nav
  const [dbConnected, setDbConnected] = useLocalKV<boolean>('lmeve-database-connected', false);
  const { sdeStatus, checkForUpdates } = useSDEManager();
  const [serverHostname, setServerHostname] = React.useState<string | null>(null);
  const [serverPublicIp, setServerPublicIp] = React.useState<string | null>(null);
  const [manualLoginCount, setManualLoginCount] = React.useState<number>(0);
  const [ssoLoginCount, setSsoLoginCount] = React.useState<number>(0);
  // ESI service and EVE server status (simple ping + players)
  const [esiServiceStatus, setEsiServiceStatus] = React.useState<'online' | 'offline' | 'unknown'>('unknown');
  const [eveServerStatus, setEveServerStatus] = React.useState<'online' | 'offline' | 'unknown'>('unknown');
  const [evePlayersOnline, setEvePlayersOnline] = React.useState<number>(0);
  const [registeredPilots, setRegisteredPilots] = React.useState<number>(0);
  const [registeredCorpsCount, setRegisteredCorpsCount] = React.useState<number>(0);
  // SDE status (throttled via server)
  const [sdeLatestVersion, setSdeLatestVersion] = React.useState<string | null>(null);
  const [sdeIsOutdated, setSdeIsOutdated] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    // Listen for cross-component DB connection updates
    const handler = (e: any) => {
      if (e && typeof e.detail === 'boolean') {
        setDbConnected(e.detail);
      }
    };
    window.addEventListener('lmeve-db-connected' as any, handler as any);
    return () => window.removeEventListener('lmeve-db-connected' as any, handler as any);
  }, [setDbConnected]);

  // Listen for login success to refresh metrics immediately
  React.useEffect(() => {
    const refreshMetrics = async () => {
      try {
        const m = await fetch('/api/app-metrics.php', { method: 'GET', credentials: 'include' });
        if (m.ok) {
          const data = await m.json();
          if (data && typeof data === 'object') {
            if (typeof data.manualLoginCount === 'number') setManualLoginCount(data.manualLoginCount);
            if (typeof data.ssoLoginCount === 'number') setSsoLoginCount(data.ssoLoginCount);
            if (typeof data.registeredPilotsCount === 'number') setRegisteredPilots(data.registeredPilotsCount);
            if (typeof data.registeredCorpsCount === 'number') setRegisteredCorpsCount(data.registeredCorpsCount);
          }
        }
      } catch {}
    };
    window.addEventListener('lmeve-login-success' as any, refreshMetrics as any);
    return () => window.removeEventListener('lmeve-login-success' as any, refreshMetrics as any);
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        // Use aggregated system status for initial values
        const ss = await fetch('/api/system-status.php', { method: 'GET', credentials: 'include' });
        if (ss.ok) {
          const j = await ss.json();
          const s = j?.status || {};
          setServerHostname(s?.server?.hostname || null);
          setServerPublicIp(s?.server?.publicIp || null);
          setDbConnected(!!s?.database?.connected);
          const esiOk = s?.esi?.status === 'online';
          setEsiServiceStatus(esiOk ? 'online' : 'offline');
          const eveOk = s?.eve?.status === 'online';
          setEveServerStatus(eveOk ? 'online' : 'offline');
          setEvePlayersOnline(typeof s?.eve?.players === 'number' ? s.eve.players : 0);
          setRegisteredCorpsCount(typeof s?.corpEsi?.corpCount === 'number' ? s.corpEsi.corpCount : 0);
          // SDE status mapping
          if (typeof s?.sde?.latestVersion === 'string') setSdeLatestVersion(s.sde.latestVersion);
          if (typeof s?.sde?.status === 'string') {
            setSdeIsOutdated(s.sde.status === 'red' ? true : s.sde.status === 'green' ? false : null);
          }
        }
      } catch {}
      // Pull minimal app metrics to drive first-run UX (fallback)
      try {
        const m = await fetch('/api/app-metrics.php', { method: 'GET', credentials: 'include' });
        if (m.ok) {
          const data = await m.json();
          if (data && typeof data === 'object') {
            if (typeof data.manualLoginCount === 'number') setManualLoginCount(data.manualLoginCount);
            if (typeof data.ssoLoginCount === 'number') setSsoLoginCount(data.ssoLoginCount);
            if (typeof data.registeredPilotsCount === 'number') setRegisteredPilots(data.registeredPilotsCount);
            if (typeof data.registeredCorpsCount === 'number') setRegisteredCorpsCount(data.registeredCorpsCount);
            if (typeof data.dbConnected === 'boolean') setDbConnected(!!data.dbConnected);
          }
        }
      } catch {}
    })();
    // Opportunistically trigger SDE status check (respects internal cooldowns)
    try { checkForUpdates(); } catch {}
  }, []);

  // Poll aggregated system status every 10 minutes
  React.useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const ss = await fetch('/api/system-status.php', { method: 'GET', credentials: 'include' });
        if (!ss.ok) return;
        const j = await ss.json();
        const s = j?.status || {};
        setDbConnected(!!s?.database?.connected);
        setEsiServiceStatus(s?.esi?.status === 'online' ? 'online' : 'offline');
        setEveServerStatus(s?.eve?.status === 'online' ? 'online' : 'offline');
        setEvePlayersOnline(typeof s?.eve?.players === 'number' ? s.eve.players : 0);
        setRegisteredCorpsCount(typeof s?.corpEsi?.corpCount === 'number' ? s.corpEsi.corpCount : 0);
        if (typeof s?.sde?.latestVersion === 'string') setSdeLatestVersion(s.sde.latestVersion);
        if (typeof s?.sde?.status === 'string') setSdeIsOutdated(s.sde.status === 'red' ? true : s.sde.status === 'green' ? false : null);
      } catch {}
    }, 10 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);
  // Database setup completion check
  // Only require setup if DB is NOT connected AND no credentials saved
  const needsDBSetup = React.useMemo(() => {
    // If database is connected, setup is complete
    if (dbConnected) return false;
    
    // Check if credentials are actually configured (not just default empty values)
    const hostOk = !!databaseSettings?.host && databaseSettings.host.trim() !== '';
    const userOk = !!databaseSettings?.username && databaseSettings.username.trim() !== '';
    const passOk = !!databaseSettings?.password && databaseSettings.password.trim() !== '' && databaseSettings.password !== '***';
    const hasCredentials = hostOk && userOk && passOk;
    
    // If credentials exist but not connected, don't force setup (user can test/connect manually)
    // Only force setup if NO credentials exist at all
    return !hasCredentials;
  }, [dbConnected, databaseSettings]);
  const [isESICallback, setIsESICallback] = useState(false);
  const [forceRender, setForceRender] = useState(0);
  
  // Initialize theme system
  const { currentTheme } = useThemeManager();
  
  // Simple login form state
  const [showQuickLogin, setShowQuickLogin] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Auth provider already nulls `user` until session is real — use it directly.
  // (Do not double-gate; that previously left nav dead after a successful login.)
  const currentUser = user;
  const currentAuth = isAuthenticated && !!user;
  const currentLogout = logout;
  
  // Get corporation status for EVE login button
  const registeredCorps = getRegisteredCorporations();
  const getValidationStatus = () => {
    if (!esiConfig?.clientId) return 'not-configured';
    if (registeredCorps.length === 0) return 'no-corps';
    return 'configured';
  };

  // Debug ESI config (never assume clientId is a string — bad saves used to store an object)
  React.useEffect(() => {
      const rawId = esiConfig?.clientId;
      const idStr = typeof rawId === 'string' ? rawId : (rawId == null ? '' : String(rawId));
      console.log('ESI Config Debug:', {
        hasClientId: !!idStr,
        clientId: idStr ? `${idStr.slice(0, 8)}...` : 'none',
        clientIdType: rawId == null ? 'null' : typeof rawId,
        hasSecret: !!esiConfig?.clientSecret,
        isConfigured: esiConfig?.isConfigured,
        registeredCorpsCount: registeredCorps.length,
        validationStatus: getValidationStatus()
      });
    }, [esiConfig, registeredCorps]);

  // Force re-render when user changes to ensure UI updates
  React.useEffect(() => {
    console.log('🔄 User state changed:', {
      hasUser: !!currentUser,
      characterName: currentUser?.characterName,
      corporationName: currentUser?.corporationName,
      role: currentUser?.role,
      authMethod: currentUser?.authMethod,
      timestamp: Date.now()
    });
    
    if (currentUser) {
      console.log('✅ User object exists - should show main app');
      console.log('👤 User details:', {
        id: currentUser.characterId,
        name: currentUser.characterName,
        corp: currentUser.corporationName,
        role: currentUser.role,
        authMethod: currentUser.authMethod
      });
      setForceRender(prev => prev + 1);
      
      // Clear test marker since login was successful
      sessionStorage.removeItem('login-test-run');
      
      // Close quick login if open
      setShowQuickLogin(false);
      setLoginUsername('');
      setLoginPassword('');
      setIsLoggingIn(false);
    } else {
      console.log('❌ No user object - should show login');
    }
  }, [currentUser]);

  React.useEffect(() => {
    console.log('🔄 Auth trigger changed:', authTrigger);
    
    // Force component re-render when auth state changes
    if (authTrigger > 0) {
      setForceRender(prev => prev + 1);
    }
  }, [authTrigger]);

  // Simple, clear auth state logging
  React.useEffect(() => {
    console.log('🏠 App render state:', { 
      hasUser: !!currentUser,
      characterName: currentUser?.characterName, 
      corporationName: currentUser?.corporationName,
      isAuthenticated: currentAuth, 
      shouldShowApp: !!currentUser,
      forceRender,
      authTrigger,
      timestamp: Date.now()
    });
    
    // Unauthenticated always stays on dashboard. Never auto-open Settings/Database.
    if (!currentAuth || !currentUser) {
      if (activeTab !== 'dashboard' || settingsExpanded) {
        console.log('🔄 Not authenticated - forcing dashboard (no setup UI)');
        setActiveTab('dashboard');
        setSettingsExpanded(false);
      }
      return;
    }
  }, [currentUser, currentAuth, forceRender, authTrigger, activeTab, settingsExpanded, setSettingsExpanded, setActiveTab]);

  // Check if this is an ESI callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const auth = urlParams.get('auth');
    const esiLoginAttempt = sessionStorage.getItem('esi-login-attempt');
    
    // Only process ESI callback if:
    // 1. We have code and state parameters
    // Let the ESICallback + auth service handle state validation and fallbacks.
    // This prevents silently dropping a valid callback when storage is slow or lost.
    if (code && state) {
      console.log('🔗 Detected ESI callback parameters - delegating to ESICallback');
      setIsESICallback(true);
    } else if (code || state) {
      // Clear any stray ESI parameters that aren't valid
      console.log('⚠️ Clearing invalid ESI callback parameters');
      window.history.replaceState({}, document.title, window.location.pathname);
      sessionStorage.removeItem('esi-login-attempt');
    } else if (auth === 'ok') {
      // Server-side callback completed; hydrate session from server
      const setup = urlParams.get('setup');
      const handoff = urlParams.get('handoff');
      (async () => {
        console.log('🔗 Detected server auth completion (?auth=ok) - hydrating session', { setup, handoff });
        await hydrateSessionFromServer();
        // Clean URL params before optional navigation
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
          if (handoff === 'admin') {
            toast.success('Admin linked to EVE character - full site access retained');
          } else {
            toast.success('Authenticated via EVE SSO');
          }
        } catch {}

        // Bootstrap path: admin/CEO just logged in and needs corp ESI next.
        if (setup === 'corp') {
          try {
            setActiveTab('corporations');
            setSettingsExpanded(false);
            toast.info('Next step: register/authorize your corporation ESI access');
          } catch {}
        }
      })();
    } else if (auth === 'error') {
      const reason = urlParams.get('reason') || 'unknown';
      console.error('❌ ESI server callback failed:', reason);
      window.history.replaceState({}, document.title, window.location.pathname);
      try { toast.error(`EVE SSO failed (${reason})`); } catch {}
    }
  }, []);

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (isAuthenticated && isTokenExpired()) {
      refreshUserToken();
    }
  }, [isAuthenticated, isTokenExpired, refreshUserToken]);

  useInactivityLogout(
    generalSettings?.sessionTimeout,
    generalSettings?.sessionTimeoutMinutes,
    logout
  );

  // Handle successful authentication
  const handleLoginSuccess = () => {
    console.log('🎉 Login success - clearing ESI callback state');
    setIsESICallback(false);
    setActiveTab('dashboard');
    setSettingsExpanded(false);
    
    // Clean up ESI-related session storage
    sessionStorage.removeItem('esi-login-attempt');
    sessionStorage.removeItem('esi-auth-state');
    try { localStorage.removeItem('esi-auth-state'); } catch {}
    
    // Clear URL parameters after successful auth
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  // Handle quick login form submission
  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginUsername.trim() || !loginPassword.trim()) {
      toast.error('Please enter both username and password');
      return;
    }
    
    setIsLoggingIn(true);
    
    try {
      console.log('🔐 Quick login attempt:', loginUsername);
      await loginWithCredentials(loginUsername.trim(), loginPassword.trim());
      console.log('✅ Quick login successful');

      // Always land on dashboard after login. Setup is available under Settings when admin.
      setActiveTab('dashboard');
      setSettingsExpanded(false);
      if (needsDBSetup) {
        toast.success('Signed in — open Settings → Database to finish setup');
      } else {
        toast.success('Login successful!');
      }
    } catch (error) {
      console.error('❌ Quick login failed:', error);
      const msg = error instanceof Error ? error.message : 'Please check your credentials.';
      toast.error(`Login failed: ${msg}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Canonical ESI SSO start (header, welcome, admin handoff)
  const handleESILogin = useCallback(async (scopeType?: 'basic' | 'enhanced' | 'corporation') => {
    await startEsiLogin(loginWithESI, {
      scopeType,
      role: currentUser?.role,
      clientId: esiConfig?.clientId,
    });
  }, [loginWithESI, currentUser?.role, esiConfig?.clientId]);

  // Handle failed authentication
  const handleLoginError = () => {
    console.log('❌ Login error - clearing ESI callback state');
    setIsESICallback(false);
    
    // Clean up ESI-related session storage
    sessionStorage.removeItem('esi-login-attempt'); 
    sessionStorage.removeItem('esi-auth-state');
    try { localStorage.removeItem('esi-auth-state'); } catch {}
    
    // Clear URL parameters after failed auth
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const tabs = PRIMARY_NAV_TABS;

    const { handleTabChange, handleSettingsTabChange } = useTabNavigation({
      currentUser,
      settingsExpanded,
      setActiveTab,
      setActiveSettingsTab,
      setSettingsExpanded,
      onRequireLogin: () => setShowQuickLogin(true),
    });

    // Show ESI callback handler if this is a callback (after all hooks)
    if (isESICallback) {
      return (
        <ESICallback
          onLoginSuccess={handleLoginSuccess}
          onLoginError={handleLoginError}
        />
      );
    }

    return (
    <DatabaseProvider>
      <LMeveDataProvider>
        <div className="min-h-screen bg-background text-foreground">
        <Toaster position="top-right" />
        

        
        {/* Quick Login Overlay */}
        {showQuickLogin && !currentUser && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4 shadow-lg">
              <div className="text-center mb-6">
                <Rocket size={32} className="mx-auto text-accent mb-3" />
                <h2 className="text-xl font-semibold mb-2">
                  {needsDBSetup ? 'Admin sign-in required' : 'Sign In to LMeve'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {needsDBSetup
                    ? 'Use the offline local admin account before configuring database or ESI.'
                    : 'Enter your credentials to access corporation management'}
                </p>
              </div>
              
              <form onSubmit={handleQuickLogin} className="space-y-4">
                <div>
                  <Input
                    type="text"
                    placeholder="Username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    disabled={isLoggingIn}
                    className="w-full"
                    autoFocus
                  />
                </div>
                
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isLoggingIn}
                    className="w-full pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoggingIn}
                  >
                    {showPassword ? (
                      <EyeSlash size={16} className="text-muted-foreground" />
                    ) : (
                      <Eye size={16} className="text-muted-foreground" />
                    )}
                  </Button>
                </div>
                
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowQuickLogin(false);
                      setLoginUsername('');
                      setLoginPassword('');
                    }}
                    disabled={isLoggingIn}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoggingIn || !loginUsername.trim() || !loginPassword.trim()}
                    className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {isLoggingIn ? 'Signing In...' : 'Sign In'}
                  </Button>
                </div>
              </form>
              
              <div className="text-xs text-muted-foreground text-center mt-4">
                Default admin: <strong>admin</strong> / <strong>12345</strong><br />
                <span className="opacity-75">Use EVE SSO button in header for corporation authentication</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <Rocket size={28} className="text-accent" />
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">LmEvEv2</h1>
                    <p className="text-sm text-muted-foreground">Corporation Management</p>
                  </div>
                </div>
                {currentUser && (
                  <Badge variant="secondary" className="text-xs bg-accent/20 text-accent border-accent/30">
                    {currentUser.corporationName
                      || (currentUser.authMethod === 'manual' ? 'Site Admin' : 'Unknown Corporation')}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {currentUser ? (
                  // Authenticated user section
                  <>
                    {/* Identity chip — ESI portrait or local/bootstrap admin label */}
                    <div className="flex items-center gap-2">
                      {currentUser.authMethod === 'esi' && currentUser.characterId && (
                        <img
                          src={`https://images.evetech.net/characters/${currentUser.characterId}/portrait?size=64`}
                          alt={currentUser.characterName || 'Character'}
                          className="w-10 h-10 rounded-full border-2 border-accent/30"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTggMTBDNi45IDEwIDYgOS4xIDYgOEM2IDYuOSA2LjkgNiA4IDZDOS4xIDYgMTAgNi45IDEwIDhDMTAgOS4xIDkuMSAxMCA4IDEwWiIgZmlsbD0iIzk5OSIvPgo8cGF0aCBkPSJNOCAxMkM1LjggMTIgNCA5LjggNCA4QzQgNi4yIDUuOCA0IDggNEM5LjggNCA4IDUuOCA4IDhDOCA5LjggOS44IDEyIDggMTJaIiBmaWxsPSIjOTk5Ii8+Cjwvc3ZnPgo8L3N2Zz4K';
                          }}
                        />
                      )}
                      <div className="leading-tight">
                        <p className="text-sm font-semibold">
                          {currentUser.characterName || currentUser.username || 'Signed in'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {currentUser.authMethod === 'manual'
                            ? (currentUser.role === 'super_admin' ? 'Local administrator' : 'Local account')
                            : (currentUser.corporationName || 'Unknown Corporation')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Test Login Button - Development Only */}
                      {(import.meta as any)?.env?.DEV && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                          onClick={async () => {
                            try {
                              await loginWithCredentials('admin', '12345');
                              console.log('🧪 Direct login test completed');
                            } catch (error) {
                              console.error('🧪 Direct login test failed:', error);
                            }
                          }}
                          title="Development: Test Admin Login"
                        >
                          Test Login
                        </Button>
                      )}
                      
                      {/* View Mode Toggle */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsMobileView(!isMobileView)}
                        className="border-border hover:bg-muted"
                        title={isMobileView ? "Switch to Desktop View" : "Switch to Mobile View"}
                      >
                        {isMobileView ? (
                          <Monitor size={16} className="sm:mr-2" />
                        ) : (
                          <DeviceMobile size={16} className="sm:mr-2" />
                        )}
                        <span className="hidden sm:inline">
                          {isMobileView ? 'Desktop' : 'Mobile'}
                        </span>
                      </Button>
                      
                      {/* Show EVE SSO button for manual users if ESI is configured */}
                      {currentUser.authMethod === 'manual' && esiConfig?.clientId && (
                        <EVELoginButton
                          onClick={() => handleESILogin()}
                          size="small"
                          disabled={!esiConfig?.clientId}
                          showCorporationCount={registeredCorps.length}
                          showValidationStatus={getValidationStatus()}
                        />
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-border hover:bg-muted"
                        onClick={currentLogout}
                      >
                        <SignOut size={16} className="sm:mr-2" />
                        <span className="hidden sm:inline">Logout</span>
                      </Button>
                    </div>
                  </>
                ) : (
                  // Unauthenticated user section
                  <div className="flex items-center gap-2">
                    {/* Test Login Button - Development Only */}
                    {(import.meta as any)?.env?.DEV && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                        onClick={async () => {
                          try {
                            await loginWithCredentials('admin', '12345');
                            console.log('🧪 Direct login test completed');
                          } catch (error) {
                            console.error('🧪 Direct login test failed:', error);
                          }
                        }}
                        title="Development: Test Admin Login"
                      >
                        Test Login
                      </Button>
                    )}
                    
                    {/* View Mode Toggle - always visible */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsMobileView(!isMobileView)}
                      className="border-border hover:bg-muted"
                      title={isMobileView ? "Switch to Desktop View" : "Switch to Mobile View"}
                    >
                      {isMobileView ? (
                        <Monitor size={16} className="sm:mr-2" />
                      ) : (
                        <DeviceMobile size={16} className="sm:mr-2" />
                      )}
                      <span className="hidden sm:inline">
                        {isMobileView ? 'Desktop' : 'Mobile'}
                      </span>
                    </Button>
                    
                    <Button 
                      onClick={() => setShowQuickLogin(true)}
                      variant="outline"
                      size="sm"
                    >
                      <SignIn size={16} className="sm:mr-2" />
                      <span className="hidden sm:inline">Local Sign In</span>
                    </Button>
                    {/* EVE SSO only after install setup (admin configures ESI first) */}
                    {!needsDBSetup && (
                      <EVELoginButton
                        onClick={() => handleESILogin()}
                        size="small"
                        disabled={!esiConfig?.clientId}
                        showCorporationCount={registeredCorps.length}
                        showValidationStatus={getValidationStatus()}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex h-[calc(100vh-5rem)]">
          {/* Desktop Layout - Left Sidebar Navigation */}
          {!isMobileView && (
            <div className="w-64 bg-card border-r border-border flex flex-col">
              <div className="p-4 space-y-2 flex-1 overflow-y-auto">
                {/* System Status (merged block) */}
                <div className="mb-3 space-y-2 text-xs">
                  <div className="text-foreground font-semibold">--=System Status=--</div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Database</span>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="font-medium">{dbConnected ? 'Online' : 'Offline'}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>ESI</span>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${esiServiceStatus === 'online' ? 'bg-green-500' : esiServiceStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      <span className="font-medium">{esiServiceStatus === 'online' ? 'Online' : esiServiceStatus === 'offline' ? 'Offline' : 'Unknown'}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>EVE Server</span>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${eveServerStatus === 'online' ? 'bg-green-500' : eveServerStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      <span className="font-medium">{eveServerStatus === 'online' ? 'Online' : eveServerStatus === 'offline' ? 'Offline' : 'Unknown'}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Corp ESI</span>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${(esiConfig?.clientId && registeredCorps.length > 0) ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="font-medium">{(esiConfig?.clientId && registeredCorps.length > 0) ? 'Online' : 'Offline'}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>SDE</span>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${sdeIsOutdated === null ? 'bg-yellow-500' : sdeIsOutdated ? 'bg-red-500' : 'bg-green-500'}`} />
                      <span className="font-medium">{sdeIsOutdated === null ? 'Unknown' : sdeIsOutdated ? 'Outdated' : 'Current'}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Overall</span>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${(dbConnected && esiServiceStatus === 'online' && eveServerStatus === 'online') ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="font-medium">{(dbConnected && esiServiceStatus === 'online' && eveServerStatus === 'online') ? 'Online' : 'Offline'}</span>
                    </span>
                  </div>
                  <div className="text-foreground font-semibold pt-1">-==Eve Status=--</div>
                  <div className="flex items-center justify-between text-muted-foreground"><span>Pilots Online</span><span className="font-medium">{evePlayersOnline.toLocaleString()}</span></div>
                  <div className="flex items-center justify-between text-muted-foreground"><span>Registered Corps</span><span className="font-medium">{registeredCorpsCount}</span></div>
                  <div className="flex items-center justify-between text-muted-foreground"><span>Registered Pilots</span><span className="font-medium">{registeredPilots}</span></div>
                  <div className="text-foreground font-semibold pt-1">Server Info</div>
                  <div className="flex items-center justify-between text-muted-foreground"><span>Server</span><span className="font-medium truncate max-w-[10rem]" title={serverHostname || undefined}>{serverHostname || 'Unknown'}</span></div>
                  <div className="flex items-center justify-between text-muted-foreground"><span>External IP</span><span className="font-medium">{serverPublicIp || 'Unknown'}</span></div>
                  <div className="border-b border-border pt-1" />
                </div>
                <AppPrimaryNav
                  variant="desktop"
                  currentUser={currentUser}
                  activeTab={activeTab}
                  activeSettingsTab={activeSettingsTab}
                  settingsExpanded={settingsExpanded}
                  onTabChange={handleTabChange}
                  onSettingsTabChange={handleSettingsTabChange}
                  tabs={tabs}
                />
              </div>
            </div>
          )}

          {/* Main Content Container */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Mobile Layout - Top Navigation Bar */}
            {isMobileView && (
              <div className="bg-card border-b border-border">
                <div className="flex items-center justify-between p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMobileMenu(!showMobileMenu)}
                    className="flex items-center gap-2"
                  >
                    <List size={20} />
                    <span className="text-sm font-medium">Menu</span>
                  </Button>
                  
                  {/* Current tab indicator */}
                  <div className="flex items-center gap-2 text-sm">
                    {activeTab === 'settings' ? (
                      <>
                        <Gear size={16} />
                        <span>Settings</span>
                        {activeSettingsTab && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <span className="capitalize">{activeSettingsTab}</span>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {(() => {
                          const currentTab = tabs.find(t => t.id === activeTab);
                          if (currentTab) {
                            const IconComponent = currentTab.icon;
                            return (
                              <>
                                <IconComponent size={16} />
                                <span>{currentTab.label}</span>
                                {'badge' in currentTab && currentTab.badge && (
                                  <Badge variant="secondary" className="text-xs h-5">
                                    {currentTab.badge}
                                  </Badge>
                                )}
                              </>
                            );
                          }
                          return null;
                        })()}
                      </>
                    )}
                  </div>
                </div>

                {showMobileMenu && (
                  <div className="border-t border-border bg-card">
                    <AppPrimaryNav
                      variant="mobile"
                      currentUser={currentUser}
                      activeTab={activeTab}
                      activeSettingsTab={activeSettingsTab}
                      settingsExpanded={settingsExpanded}
                      onTabChange={handleTabChange}
                      onSettingsTabChange={handleSettingsTabChange}
                      onNavigateComplete={() => setShowMobileMenu(false)}
                      tabs={tabs}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto">
                <div className={`${isMobileView ? 'px-4 py-4' : 'container mx-auto px-6 py-6'}`}>
                  {!currentUser ? (
                    // Never expose Settings/DB/ESI setup without an authenticated admin session.
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center space-y-4 max-w-md">
                        <Rocket size={48} className="mx-auto text-accent" />
                        <h2 className="text-2xl font-bold">
                          {needsDBSetup ? 'Finish setup' : 'Welcome to LMeve'}
                        </h2>
                        <p className="text-muted-foreground">
                          {needsDBSetup
                            ? 'Sign in with the local admin account first. Database and ESI configuration are only available after authentication.'
                            : 'LMeve is a comprehensive corporation management tool for EVE Online. Sign in to access your corporation\'s data and management features.'}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <Button
                            onClick={() => setShowQuickLogin(true)}
                            className="bg-accent hover:bg-accent/90 text-accent-foreground"
                          >
                            <SignIn size={16} className="mr-2" />
                            Local Sign In
                          </Button>
                          {!needsDBSetup && (
                            <EVELoginButton
                              onClick={() => handleESILogin()}
                              showCorporationCount={registeredCorps.length}
                              showValidationStatus={getValidationStatus()}
                            />
                          )}
                        </div>
                        {needsDBSetup && (
                          <p className="text-xs text-muted-foreground">
                            Default offline admin: <strong>admin</strong> / <strong>12345</strong> — change this password after first login.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : activeTab === 'settings' ? (
                                      <Suspense
                                        fallback={
                                          <div className="py-16 text-center text-muted-foreground">Loading settings…</div>
                                        }
                                      >
                                        <Settings
                                          activeTab={activeSettingsTab || 'general'}
                                          onTabChange={handleSettingsTabChange}
                                          isMobileView={isMobileView}
                                        />
                                      </Suspense>
                                    ) : (
                                      <Suspense
                                        fallback={
                                          <div className="py-16 text-center text-muted-foreground">Loading…</div>
                                        }
                                      >
                                        <Tabs value={activeTab} onValueChange={handleTabChange}>
                                          {tabs.map((tab) => {
                                            const Component = tab.component;
                                            if (!Component) return null;
                                            return (
                                              <TabsContent key={tab.id} value={tab.id} className="mt-0">
                                                <Component
                                                  onLoginClick={() => setShowQuickLogin(true)}
                                                  isMobileView={isMobileView}
                                                />
                                              </TabsContent>
                                            );
                                          })}
                                        </Tabs>
                                      </Suspense>
                                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </LMeveDataProvider>
    </DatabaseProvider>
  );
}

function App() {
  return <AppContent />;
}

export default App;