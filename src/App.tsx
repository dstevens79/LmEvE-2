import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  House, 
  Users, 
  Package, 
  Factory, 
  TrendUp, 
  Gear,
  SignOut,
  Rocket,
  CurrencyDollar,
  CaretDown,
  CaretRight,
  Globe,
  Database,
  Building,
  Clock,
  Bell,
  Shield,
  Archive,
  SignIn,
  Eye,
  EyeSlash,
  DeviceMobile,
  Monitor,
  List,
  Palette,
  Planet,
  ChartLine,
  Key
} from '@phosphor-icons/react';
import { useKV } from '@github/spark/hooks';
import { TabType } from '@/lib/types';
import { DatabaseProvider } from '@/lib/DatabaseContext';
import { LMeveDataProvider } from '@/lib/LMeveDataContext';
import { useAuth, AuthProvider } from '@/lib/auth-provider';
import { ESICallback } from '@/components/ESICallback';
import { canAccessTab, canAccessSettingsTab } from '@/lib/roles';
import { EVELoginButton } from '@/components/EVELoginButton';
import { useThemeManager } from '@/lib/themeManager';

// Tab Components (will be implemented)
import { Dashboard } from '@/components/tabs/Dashboard';
import { Members } from '@/components/tabs/Members';
import { Assets } from '@/components/tabs/Assets';
import { Manufacturing } from '@/components/tabs/Manufacturing';
import { Market } from '@/components/tabs/Market';
import { Wallet } from '@/components/tabs/Wallet';
import { Settings } from '@/components/tabs/Settings';
import { Notifications } from '@/components/tabs/Notifications';
import { Corporations } from '@/components/Corporations';
import { Theme } from '@/components/tabs/Theme';
import { PlanetaryInteraction } from '@/components/tabs/PlanetaryInteraction';
import { Projects } from '@/components/tabs/Projects';

function AppContent() {
  const [activeTab, setActiveTab] = useKV<TabType>('active-tab', 'dashboard');
  const [activeSettingsTab, setActiveSettingsTab] = useKV<string>('active-settings-tab', 'general');
  const [settingsExpanded, setSettingsExpanded] = useKV<boolean>('settings-expanded', false);
  const [isMobileView, setIsMobileView] = useKV<boolean>('mobile-view', false);
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
    getRegisteredCorporations
  } = useAuth();
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

  // Use corporation auth system
  const currentUser = user;
  const currentAuth = isAuthenticated;
  const currentLogout = logout;
  
  // Get corporation status for EVE login button
  const registeredCorps = getRegisteredCorporations();
  const getValidationStatus = () => {
    if (!esiConfig?.clientId) return 'not-configured';
    if (registeredCorps.length === 0) return 'no-corps';
    return 'configured';
  };

  // Debug ESI config
  React.useEffect(() => {
    console.log('🔧 ESI Config Debug:', {
      hasClientId: !!esiConfig?.clientId,
      clientId: esiConfig?.clientId ? esiConfig.clientId.substring(0, 8) + '...' : 'none',
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
    
    // Reset tab to dashboard when user logs out or on any tab that requires auth
    if (!currentUser) {
      if (activeTab !== 'dashboard') {
        console.log('🔄 User not authenticated - resetting to dashboard tab');
        setActiveTab('dashboard');
        setSettingsExpanded(false);
      }
    }
  }, [currentUser, currentAuth, forceRender, authTrigger, activeTab]);

  // Check if this is an ESI callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const esiLoginAttempt = sessionStorage.getItem('esi-login-attempt');
    
    // Only process ESI callback if:
    // 1. We have code and state parameters 
    // 2. We have stored ESI auth state
    // 3. There was an explicit ESI login attempt
    if (code && state && esiLoginAttempt) {
      const storedStateData = sessionStorage.getItem('esi-auth-state');
      if (storedStateData) {
        console.log('🔗 Detected valid ESI callback - showing ESI processor');
        setIsESICallback(true);
      } else {
        console.log('⚠️ ESI callback detected but no stored state - clearing URL');
        // Clear invalid callback state
        sessionStorage.removeItem('esi-login-attempt');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else if (code || state) {
      // Clear any stray ESI parameters that aren't valid
      console.log('⚠️ Clearing invalid ESI callback parameters');
      window.history.replaceState({}, document.title, window.location.pathname);
      sessionStorage.removeItem('esi-login-attempt');
    }
  }, []);

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (isAuthenticated && isTokenExpired()) {
      refreshUserToken();
    }
  }, [isAuthenticated, isTokenExpired, refreshUserToken]);

  // Handle successful authentication
  const handleLoginSuccess = () => {
    console.log('🎉 Login success - clearing ESI callback state');
    setIsESICallback(false);
    setActiveTab('dashboard');
    setSettingsExpanded(false);
    
    // Clean up ESI-related session storage
    sessionStorage.removeItem('esi-login-attempt');
    sessionStorage.removeItem('esi-auth-state');
    
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
      toast.success('Login successful!');
    } catch (error) {
      console.error('❌ Quick login failed:', error);
      toast.error('Login failed. Please check your credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle ESI SSO login
  const handleESILogin = (scopeType: 'basic' | 'enhanced' | 'corporation' = 'basic') => {
    try {
      if (!esiConfig?.clientId) {
        toast.error('ESI authentication is not configured. Please contact your administrator.');
        return;
      }
      
      console.log('🚀 Starting ESI SSO login with scope type:', scopeType);
      const authUrl = loginWithESI(scopeType);
      
      // Redirect to EVE Online SSO
      window.location.href = authUrl;
    } catch (error) {
      console.error('❌ ESI login error:', error);
      toast.error('Failed to initiate ESI login. Please try again.');
    }
  };

  // Handle failed authentication
  const handleLoginError = () => {
    console.log('❌ Login error - clearing ESI callback state');
    setIsESICallback(false);
    
    // Clean up ESI-related session storage
    sessionStorage.removeItem('esi-login-attempt'); 
    sessionStorage.removeItem('esi-auth-state');
    
    // Clear URL parameters after failed auth
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  // Show ESI callback handler if this is a callback
  if (isESICallback) {
    return (
      <ESICallback 
        onLoginSuccess={handleLoginSuccess}
        onLoginError={handleLoginError}
      />
    );
  }

  // App is always visible - authentication handled via modal
  // No dedicated login page blocking access

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: House, component: Dashboard },
    { id: 'members', label: 'Members', icon: Users, component: Members, badge: '42' },
    { id: 'assets', label: 'Assets', icon: Package, component: Assets },
    { id: 'manufacturing', label: 'Manufacturing', icon: Factory, component: Manufacturing, badge: '3' },
    { id: 'planetary', label: 'Planetary Interaction', icon: Planet, component: PlanetaryInteraction, badge: '5' },
    { id: 'projects', label: 'Projects', icon: Archive, component: Projects, badge: '2' },
    { id: 'market', label: 'Market', icon: TrendUp, component: Market },
    { id: 'wallet', label: 'Wallet', icon: CurrencyDollar, component: Wallet },
    { id: 'notifications', label: 'Notifications', icon: Bell, component: Notifications },
    { id: 'corporations', label: 'ESI', icon: Key, component: Corporations },
    { id: 'theme', label: 'Theme', icon: Palette, component: Theme },
  ];

  const settingsTabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'sync', label: 'Data Sync', icon: Clock },
    { id: 'sync-monitoring', label: 'Sync Monitoring', icon: ChartLine },
    { id: 'permissions', label: 'Permissions', icon: Shield },
  ];

  const handleTabChange = (value: string) => {
    console.log('🔄 Tab change request:', value, 'Current user:', currentUser?.characterName || 'null');
    console.log('🔄 Tab change - Auth state:', { hasUser: !!currentUser, isAuthenticated: currentAuth, authTrigger });
    
    // Restrict navigation when not authenticated - except dashboard
    if (!currentUser && value !== 'dashboard') {
      console.log('❌ Tab change blocked - user not authenticated');
      setShowQuickLogin(true);
      return;
    }
    
    // Check tab access permissions for authenticated users
    if (currentUser && !canAccessTab(currentUser, value)) {
      console.log('❌ Tab change blocked - insufficient permissions');
      toast.error('You do not have permission to access this section');
      return;
    }
    
    console.log('🔄 Allowing tab change to:', value);
    
    if (value === 'settings') {
      // Only allow settings access if authenticated
      if (!currentUser) {
        setShowQuickLogin(true);
        return;
      }
      setSettingsExpanded(!settingsExpanded);
      if (!settingsExpanded) {
        setActiveTab('settings' as TabType);
      } else {
        setActiveTab('dashboard');
      }
    } else {
      setActiveTab(value as TabType);
      setSettingsExpanded(false);
    }
    
    console.log('✅ Tab change complete - new active tab:', value);
  };

  const handleSettingsTabChange = (value: string) => {
    // Check settings tab access permissions
    if (currentUser && !canAccessSettingsTab(currentUser, value)) {
      console.log('❌ Settings tab change blocked - insufficient permissions');
      toast.error('You do not have permission to access this section');
      return;
    }
    
    setActiveSettingsTab(value);
  };

  return (
    <DatabaseProvider>
      <LMeveDataProvider>
        <div className="min-h-screen bg-background text-foreground">
        <Toaster />
        

        
        {/* Quick Login Overlay */}
        {showQuickLogin && !currentUser && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4 shadow-lg">
              <div className="text-center mb-6">
                <Rocket size={32} className="mx-auto text-accent mb-3" />
                <h2 className="text-xl font-semibold mb-2">Sign In to LMeve</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your credentials to access corporation management
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
                  {/* Character and Corporation images for ESI users */}
                  {currentUser && currentUser.authMethod === 'esi' && (
                    <div className="flex items-center gap-2">
                      {/* Character portrait */}
                      {currentUser.characterId && (
                        <img 
                          src={`https://images.evetech.net/characters/${currentUser.characterId}/portrait?size=64`}
                          alt={currentUser.characterName || 'Character'}
                          className="w-8 h-8 rounded-full border-2 border-accent/30"
                          onError={(e) => {
                            // Fallback to default avatar on error
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTggMTBDNi45IDEwIDYgOS4xIDYgOEM2IDYuOSA2LjkgNiA4IDZDOS4xIDYgMTAgNi45IDEwIDhDMTAgOS4xIDkuMSAxMCA4IDEwWiIgZmlsbD0iIzk5OSIvPgo8cGF0aCBkPSJNOCAxMkM1LjggMTIgNCA5LjggNCA4QzQgNi4yIDUuOCA0IDggNEM5LjggNCA4IDUuOCA4IDhDOCA5LjggOS44IDEyIDggMTJaIiBmaWxsPSIjOTk5Ii8+Cjwvc3ZnPgo8L3N2Zz4K';
                          }}
                        />
                      )}
                      
                      {/* Corporation logo */}
                      {currentUser.corporationId && (
                        <img 
                          src={`https://images.evetech.net/corporations/${currentUser.corporationId}/logo?size=64`}
                          alt={currentUser.corporationName || 'Corporation'}
                          className="w-8 h-8 rounded border border-accent/30"
                          onError={(e) => {
                            // Fallback to default corp logo on error
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjMjIyIi8+CjxwYXRoIGQ9Ik0xNiA4TDI0IDE2TDE2IDI0TDggMTZMMTYgOFoiIGZpbGw9IiM2NjYiLz4KPC9zdmc+';
                          }}
                        />
                      )}
                    </div>
                  )}
                  
                  <Rocket size={28} className="text-accent" />
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">LMeve</h1>
                    <p className="text-sm text-muted-foreground">Corporation Management</p>
                  </div>
                </div>
                {currentUser && (
                  <Badge variant="secondary" className="text-xs bg-accent/20 text-accent border-accent/30">
                    {currentUser.corporationName || 'Unknown Corporation'}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {currentUser ? (
                  // Authenticated user section
                  <>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium">{currentUser.characterName}</p>
                      <p className="text-xs text-muted-foreground">
                        {(currentUser as any).role?.replace('_', ' ').toUpperCase() || 'MEMBER'}
                        {currentUser.authMethod === 'esi' && ' • ESI'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Test Login Button - Development Only */}
                      {process.env.NODE_ENV === 'development' && (
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
                          onClick={() => handleESILogin('basic')}
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
                    {process.env.NODE_ENV === 'development' && (
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
                    {/* Always show EVE SSO button if configured */}
                    <EVELoginButton
                      onClick={() => handleESILogin('basic')}
                      size="small"
                      disabled={!esiConfig?.clientId}
                      showCorporationCount={registeredCorps.length}
                      showValidationStatus={getValidationStatus()}
                    />
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
                {/* Main navigation tabs */}
                {tabs.map((tab) => {
                  const IconComponent = tab.icon;
                  const isActive = activeTab === tab.id;
                  // Check accessibility based on authentication and permissions
                  const isAccessible = canAccessTab(currentUser, tab.id);
                  const isDisabled = !isAccessible;
                  return (
                    <Button
                      key={tab.id}
                      variant={isActive ? "default" : "ghost"}
                      disabled={isDisabled}
                      className={`w-full justify-start gap-3 ${
                        isActive 
                          ? "bg-accent text-accent-foreground shadow-sm" 
                          : isDisabled
                          ? "opacity-50 cursor-not-allowed text-muted-foreground"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => handleTabChange(tab.id)}
                    >
                      <IconComponent size={18} />
                      <span className="text-sm font-medium">{tab.label}</span>
                      {'badge' in tab && tab.badge && (
                        <Badge 
                          variant="secondary" 
                          className={`ml-auto text-xs h-5 px-1.5 ${
                            isActive 
                              ? "bg-accent-foreground/20 text-accent-foreground" 
                              : "bg-accent/20 text-accent"
                          }`}
                        >
                          {tab.badge}
                        </Badge>
                      )}
                    </Button>
                  );
                })}

                {/* Settings section with expandable sub-menu */}
                <div className="pt-2 border-t border-border">
                  <Button
                    variant={activeTab === 'settings' ? "default" : "ghost"}
                    disabled={!currentUser}
                    className={`w-full justify-start gap-3 ${
                      activeTab === 'settings'
                        ? "bg-accent text-accent-foreground shadow-sm" 
                        : !currentUser
                        ? "opacity-50 cursor-not-allowed text-muted-foreground"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => handleTabChange('settings')}
                  >
                    <Gear size={18} />
                    <span className="text-sm font-medium">Settings</span>
                    {settingsExpanded ? (
                      <CaretDown size={16} className="ml-auto" />
                    ) : (
                      <CaretRight size={16} className="ml-auto" />
                    )}
                  </Button>

                  {/* Settings sub-menu - only show when authenticated */}
                  {settingsExpanded && currentUser && (
                    <div className="mt-2 ml-6 space-y-1">
                      {settingsTabs.map((settingsTab) => {
                        const IconComponent = settingsTab.icon;
                        const isActiveSettings = activeSettingsTab === settingsTab.id;
                        const isAccessible = canAccessSettingsTab(currentUser, settingsTab.id);
                        
                        if (!isAccessible) return null;
                        
                        return (
                          <Button
                            key={settingsTab.id}
                            variant={isActiveSettings ? "secondary" : "ghost"}
                            size="sm"
                            className={`w-full justify-start gap-2 text-xs ${
                              isActiveSettings 
                                ? "bg-secondary text-secondary-foreground" 
                                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => handleSettingsTabChange(settingsTab.id)}
                          >
                            <IconComponent size={14} />
                            <span>{settingsTab.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
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

                {/* Mobile Menu Dropdown */}
                {showMobileMenu && (
                  <div className="border-t border-border bg-card">
                    <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
                      {/* Main navigation tabs */}
                      <div className="space-y-1">
                        {tabs.map((tab) => {
                          const IconComponent = tab.icon;
                          const isActive = activeTab === tab.id;
                          const isAccessible = canAccessTab(currentUser, tab.id);
                          const isDisabled = !isAccessible;
                          
                          return (
                            <Button
                              key={tab.id}
                              variant={isActive ? "default" : "ghost"}
                              disabled={isDisabled}
                              className={`w-full justify-start gap-3 ${
                                isActive 
                                  ? "bg-accent text-accent-foreground" 
                                  : isDisabled
                                  ? "opacity-50 cursor-not-allowed text-muted-foreground"
                                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
                              }`}
                              onClick={() => {
                                handleTabChange(tab.id);
                                setShowMobileMenu(false);
                              }}
                            >
                              <IconComponent size={18} />
                              <span className="text-sm font-medium">{tab.label}</span>
                              {'badge' in tab && tab.badge && (
                                <Badge variant="secondary" className="ml-auto text-xs">
                                  {tab.badge}
                                </Badge>
                              )}
                            </Button>
                          );
                        })}
                      </div>

                      {/* Settings section */}
                      {currentUser && (
                        <div className="pt-2 border-t border-border space-y-1">
                          <Button
                            variant={activeTab === 'settings' ? "default" : "ghost"}
                            className={`w-full justify-start gap-3 ${
                              activeTab === 'settings'
                                ? "bg-accent text-accent-foreground" 
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => {
                              handleTabChange('settings');
                              setShowMobileMenu(false);
                            }}
                          >
                            <Gear size={18} />
                            <span className="text-sm font-medium">Settings</span>
                          </Button>

                          {/* Settings sub-menu for mobile */}
                          {activeTab === 'settings' && (
                            <div className="ml-6 space-y-1">
                              {settingsTabs.map((settingsTab) => {
                                const IconComponent = settingsTab.icon;
                                const isActiveSettings = activeSettingsTab === settingsTab.id;
                                const isAccessible = canAccessSettingsTab(currentUser, settingsTab.id);
                                
                                if (!isAccessible) return null;
                                
                                return (
                                  <Button
                                    key={settingsTab.id}
                                    variant={isActiveSettings ? "secondary" : "ghost"}
                                    size="sm"
                                    className={`w-full justify-start gap-2 text-xs ${
                                      isActiveSettings 
                                        ? "bg-secondary text-secondary-foreground" 
                                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                    }`}
                                    onClick={() => {
                                      handleSettingsTabChange(settingsTab.id);
                                      setShowMobileMenu(false);
                                    }}
                                  >
                                    <IconComponent size={14} />
                                    <span>{settingsTab.label}</span>
                                  </Button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto">
                <div className={`${isMobileView ? 'px-4 py-4' : 'container mx-auto px-6 py-6'}`}>
                  {!currentUser ? (
                    // Always show dashboard with login prompt when not authenticated
                    activeTab === 'dashboard' ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center space-y-4 max-w-md">
                          <Rocket size={48} className="mx-auto text-accent" />
                          <h2 className="text-2xl font-bold">Welcome to LMeve</h2>
                          <p className="text-muted-foreground">
                            LMeve is a comprehensive corporation management tool for EVE Online. 
                            Sign in to access your corporation's data and management features.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button 
                              onClick={() => setShowQuickLogin(true)}
                              variant="outline"
                            >
                              <SignIn size={16} className="mr-2" />
                              Local Sign In
                            </Button>
                            <EVELoginButton
                              onClick={() => handleESILogin('basic')}
                              showCorporationCount={registeredCorps.length}
                              showValidationStatus={getValidationStatus()}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center space-y-4 max-w-md">
                          <Shield size={48} className="mx-auto text-muted-foreground" />
                          <h2 className="text-xl font-semibold">Authentication Required</h2>
                          <p className="text-muted-foreground">
                            You need to sign in to access this section.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button 
                              onClick={() => setShowQuickLogin(true)}
                              variant="outline"
                            >
                              <SignIn size={16} className="mr-2" />
                              Local Sign In
                            </Button>
                            <EVELoginButton
                              onClick={() => handleESILogin('basic')}
                              showCorporationCount={registeredCorps.length}
                              showValidationStatus={getValidationStatus()}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  ) : activeTab === 'settings' ? (
                    <Settings 
                      activeTab={activeSettingsTab || 'general'} 
                      onTabChange={handleSettingsTabChange}
                      isMobileView={isMobileView}
                    />
                  ) : (
                    <Tabs value={activeTab} onValueChange={handleTabChange}>
                      {tabs.map((tab) => {
                        const Component = tab.component;
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

// Main App component with AuthProvider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;