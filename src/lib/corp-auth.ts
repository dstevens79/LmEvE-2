// Enhanced Corporate Authentication System for LMeve
import { useKV } from '@/lib/kv';
import React from 'react';

export interface CorporationESIConfig {
  corporationId: number;
  corporationName: string;
  refreshToken: string;
  scopes: string[];
  isActive: boolean;
  registeredBy: number;
  registeredAt: number;
}

export interface AuthenticatedUser {
  characterId: number;
  characterName: string;
  corporationId: number;
  corporationName: string;
  allianceId?: number;
  allianceName?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
  scopes: string[];
  isDirector: boolean;
  isCeo: boolean;
  isAdmin: boolean;
  canManageESI: boolean; // CEO/Director can manage corp ESI
  loginTime: number;
  authMethod: 'esi' | 'local'; // Track how user authenticated
}

export interface ESIAuthState {
  state: string;
  codeVerifier: string;
  timestamp: number;
  redirectUri: string;
}

export interface ESIConfig {
  clientId: string;
  secretKey: string;
  baseUrl: string;
  userAgent?: string;
}

/**
 * Enhanced Corporation Authentication Service
 * Handles ESI authentication with corporation-based access control
 */
class CorporationAuthService {
  private readonly ESI_BASE_URL = 'https://login.eveonline.com/v2/oauth';
  private readonly ESI_SCOPES = [
    'esi-corporations.read_corporation_membership.v1',
    'esi-industry.read_corporation_jobs.v1',
    'esi-assets.read_corporation_assets.v1',
    'esi-corporations.read_blueprints.v1',
    'esi-markets.read_corporation_orders.v1',
    'esi-wallet.read_corporation_wallets.v1',
    'esi-killmails.read_corporation_killmails.v1',
    'esi-contracts.read_corporation_contracts.v1',
    'esi-corporations.read_titles.v1',
  ];

  constructor(private esiConfig: ESIConfig) {}

  /**
   * Generate ESI OAuth URL for character authentication
   */
  generateESIAuthUrl(): { url: string; state: ESIAuthState } {
    const state = this.generateRandomString(32);
    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const redirectUri = `${window.location.origin}${window.location.pathname}`;

    const authState: ESIAuthState = {
      state,
      codeVerifier,
      timestamp: Date.now(),
      redirectUri
    };

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.esiConfig.clientId,
      redirect_uri: redirectUri,
      scope: this.ESI_SCOPES.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    return {
      url: `${this.ESI_BASE_URL}/authorize?${params.toString()}`,
      state: authState
    };
  }

  /**
   * Handle ESI OAuth callback and validate corporation access
   */
  async handleESICallback(
    code: string, 
    state: string,
    storedState: ESIAuthState,
    registeredCorps: CorporationESIConfig[]
  ): Promise<AuthenticatedUser> {
    if (state !== storedState.state) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    // Exchange authorization code for access token
    const tokenData = await this.exchangeCodeForToken(code, storedState);
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get character and corporation information
    const characterData = await this.verifyToken(access_token);
    const characterInfo = await this.getCharacterInfo(characterData.CharacterID, access_token);
    const corporationInfo = await this.getCorporationInfo(characterData.corporation_id, access_token);

    // Check corporation access permissions
    const corpAccess = await this.validateCorporationAccess(
      characterData.corporation_id,
      characterData.CharacterID,
      registeredCorps,
      access_token
    );

    if (!corpAccess.hasAccess) {
      throw new Error(corpAccess.reason || 'Access denied');
    }

    // Get user roles and permissions
    const roles = await this.getCharacterRoles(characterData.CharacterID, characterData.corporation_id, access_token);

    return {
      characterId: characterData.CharacterID,
      characterName: characterInfo.name,
      corporationId: characterData.corporation_id,
      corporationName: corporationInfo.name,
      allianceId: corporationInfo.alliance_id,
      allianceName: corporationInfo.alliance_id ? await this.getAllianceName(corporationInfo.alliance_id) : undefined,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiry: Date.now() + (expires_in * 1000),
      scopes: characterData.Scopes ? characterData.Scopes.split(' ') : [],
      isDirector: roles.isDirector,
      isCeo: corporationInfo.ceo_id === characterData.CharacterID,
      isAdmin: false,
      canManageESI: roles.isDirector || corporationInfo.ceo_id === characterData.CharacterID,
      loginTime: Date.now(),
      authMethod: 'esi'
    };
  }

  /**
   * Validate corporation access permissions
   */
  private async validateCorporationAccess(
    corporationId: number,
    characterId: number,
    registeredCorps: CorporationESIConfig[],
    accessToken: string
  ): Promise<{ hasAccess: boolean; reason?: string }> {
    
    // Check if corporation is already registered
    const registeredCorp = registeredCorps.find(corp => corp.corporationId === corporationId && corp.isActive);
    
    if (registeredCorp) {
      console.log(`✅ Corporation ${corporationId} is registered - access granted`);
      return { hasAccess: true };
    }

    // Corporation not registered - check if user is CEO/Director who can register it
    const corporationInfo = await this.getCorporationInfo(corporationId, accessToken);
    const roles = await this.getCharacterRoles(characterId, corporationId, accessToken);
    
    const isCeo = corporationInfo.ceo_id === characterId;
    const isDirector = roles.isDirector;
    
    if (isCeo || isDirector) {
      console.log(`✅ User is ${isCeo ? 'CEO' : 'Director'} of unregistered corp - access granted for registration`);
      return { hasAccess: true };
    }

    return { 
      hasAccess: false, 
      reason: `Corporation "${corporationInfo.name}" is not registered with LMeve. Contact your CEO or Directors to register corporation ESI access.`
    };
  }

  /**
   * Get character roles from ESI
   */
  private async getCharacterRoles(characterId: number, corporationId: number, token: string): Promise<{
    isDirector: boolean;
    roles: string[];
  }> {
    try {
      const response = await fetch(`https://esi.evetech.net/latest/characters/${characterId}/roles/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.warn('Could not fetch character roles - access may be limited');
        return { isDirector: false, roles: [] };
      }

      const roleData = await response.json();
      const roles = roleData.roles || [];
      const isDirector = roles.includes('Director');

      return { isDirector, roles };
    } catch (error) {
      console.warn('Error fetching character roles:', error);
      return { isDirector: false, roles: [] };
    }
  }

  /**
   * Register new corporation ESI access
   */
  async registerCorporationESI(
    corporationId: number,
    corporationName: string,
    refreshToken: string,
    registeredBy: number,
    scopes: string[]
  ): Promise<CorporationESIConfig> {
    const config: CorporationESIConfig = {
      corporationId,
      corporationName,
      refreshToken,
      scopes,
      registeredBy,
      registeredAt: Date.now(),
      isActive: true
    };

    console.log(`📝 Registering ESI access for corporation: ${corporationName} (${corporationId})`);
    return config;
  }

  /**
   * Local admin authentication (unchanged from existing system)
   */
  async loginWithCredentials(username: string, password: string, adminConfig: { username: string; password: string }): Promise<AuthenticatedUser> {
    console.log('🔐 Local login attempt for:', username);
    
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    
    // Check configured admin credentials
    if (trimmedUsername === adminConfig.username && trimmedPassword === adminConfig.password) {
      console.log('✅ Admin login successful');
      return {
        characterId: 999999999,
        characterName: 'Local Administrator',
        corporationId: 1000000000,
        corporationName: 'Local Administration',
        allianceId: undefined,
        allianceName: undefined,
        accessToken: 'admin-access-token',
        refreshToken: 'admin-refresh-token',
        tokenExpiry: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        scopes: [],
        isDirector: true,
        isCeo: true,
        isAdmin: true,
        canManageESI: true,
        loginTime: Date.now(),
        authMethod: 'local'
      };
    }

    throw new Error(`Invalid credentials for user: ${trimmedUsername}`);
  }

  /**
   * Refresh ESI access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await fetch(`${this.ESI_BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${this.esiConfig.clientId}:${this.esiConfig.secretKey}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in
    };
  }

  // Private helper methods
  private async exchangeCodeForToken(code: string, storedState: ESIAuthState) {
    const response = await fetch(`${this.ESI_BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${this.esiConfig.clientId}:${this.esiConfig.secretKey}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: storedState.redirectUri,
        code_verifier: storedState.codeVerifier
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange authorization code: ${error}`);
    }

    return response.json();
  }

  private async verifyToken(accessToken: string) {
    const response = await fetch('https://esi.evetech.net/verify/', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to verify token');
    }

    return response.json();
  }

  private async getCharacterInfo(characterId: number, token: string) {
    const response = await fetch(`https://esi.evetech.net/latest/characters/${characterId}/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get character info');
    }

    return response.json();
  }

  private async getCorporationInfo(corporationId: number, token: string) {
    const response = await fetch(`https://esi.evetech.net/latest/corporations/${corporationId}/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get corporation info');
    }

    return response.json();
  }

  private async getAllianceName(allianceId: number): Promise<string> {
    try {
      const response = await fetch(`https://esi.evetech.net/latest/alliances/${allianceId}/`);
      if (response.ok) {
        const data = await response.json();
        return data.name;
      }
    } catch {
      // Fallback if alliance info is not available
    }
    return 'Unknown Alliance';
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateCodeChallenge(verifier: string): string {
    // In a real implementation, this would use SHA256
    // For now, we'll use the verifier as-is (which is allowed but less secure)
    return verifier;
  }
}

/**
 * React hook for corporation-based authentication
 */
export function useCorporationAuth() {
  const [user, setUser] = useKV<AuthenticatedUser | null>('corp-auth-user', null);
  const [registeredCorps, setRegisteredCorps] = useKV<CorporationESIConfig[]>('registered-corporations', []);
  const [esiConfig, setESIConfig] = useKV<ESIConfig>('esi-config', {
    clientId: '',
    secretKey: '',
    baseUrl: 'https://login.eveonline.com'
  });
  const [adminConfig, setAdminConfig] = useKV<{ username: string; password: string }>('admin-config', {
    username: 'admin',
    password: '12345'
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [authTrigger, setAuthTrigger] = React.useState(0);

  const authService = React.useMemo(() => new CorporationAuthService(esiConfig), [esiConfig]);
  const isAuthenticated = Boolean(user);

  // Debug logging
  React.useEffect(() => {
    console.log('🔄 CORP AUTH - User state changed:', {
      hasUser: !!user,
      characterName: user?.characterName,
      corporationName: user?.corporationName,
      isAdmin: user?.isAdmin,
      authMethod: user?.authMethod,
      canManageESI: user?.canManageESI,
      timestamp: Date.now()
    });
  }, [user, authTrigger]);

  // Additional debugging for KV state
  React.useEffect(() => {
    console.log('🔍 KV RAW STATE DEBUG:', {
      userExists: !!user,
      userType: typeof user,
      userStringified: user ? JSON.stringify(user) : 'null',
      isAuthenticated,
      authTrigger
    });
    
    // Add detailed user state debugging
    if (user) {
      console.log('👤 USER OBJECT DETAILS:', {
        characterId: user.characterId,
        characterName: user.characterName,
        corporationId: user.corporationId,
        corporationName: user.corporationName,
        isAdmin: user.isAdmin,
        authMethod: user.authMethod,
        loginTime: user.loginTime,
        timestamp: Date.now()
      });
    }
  }, [user, isAuthenticated, authTrigger]);

  const loginWithCredentials = async (username: string, password: string): Promise<void> => {
    console.log('🧪 Starting login with credentials:', username);
    console.log('🔍 Before login: user=' + (user ? user.characterName : 'null') + ', authenticated=' + isAuthenticated);
    
    setIsLoading(true);
    try {
      const authUser = await authService.loginWithCredentials(username, password, adminConfig);
      console.log('🔍 Login service returned user:', authUser.characterName);
      console.log('🔍 Full auth user object:', JSON.stringify(authUser, null, 2));
      
      // Set user state directly - force update by creating new object
      const userToSet = { ...authUser, timestamp: Date.now() };
      console.log('🔍 Setting user object with timestamp:', userToSet);
      
      setUser(userToSet);
      
      // Add small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the user was set
      console.log('🔍 Checking if user state was updated...');
      
      // Trigger auth state change
      setAuthTrigger(prev => {
        const newTrigger = prev + 1;
        console.log('🔍 Auth trigger updated from', prev, 'to', newTrigger);
        return newTrigger;
      });
      
      console.log('✅ Login completed successfully');
      
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithESI = (): string => {
    if (!esiConfig.clientId) {
      throw new Error('ESI Client ID not configured. Please configure ESI settings first.');
    }
    
    const { url, state } = authService.generateESIAuthUrl();
    sessionStorage.setItem('esi-auth-state', JSON.stringify(state));
    sessionStorage.setItem('esi-login-attempt', 'true');
    return url;
  };

  const handleESICallback = async (code: string, state: string): Promise<void> => {
    setIsLoading(true);
    try {
      const storedStateData = sessionStorage.getItem('esi-auth-state');
      if (!storedStateData) {
        throw new Error('No stored ESI auth state found');
      }

      const storedState = JSON.parse(storedStateData) as ESIAuthState;
      const authUser = await authService.handleESICallback(code, state, storedState, registeredCorps);

      // Set user state directly with timestamp to force update
      const userToSet = { ...authUser, timestamp: Date.now() };
      setUser(userToSet);
      
      // Add small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setAuthTrigger(prev => prev + 1);

      // Clean up session storage
      sessionStorage.removeItem('esi-auth-state');
      sessionStorage.removeItem('esi-login-attempt');
    } catch (error) {
      console.error('❌ ESI login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    console.log('🚪 CORP AUTH - Logging out user:', user?.characterName || 'null');
    setUser(null);
    setAuthTrigger(prev => {
      console.log('🔄 CORP AUTH - Auth trigger updated on logout:', prev + 1);
      return prev + 1;
    });
    
    // Clean up any stored auth state
    sessionStorage.removeItem('esi-auth-state');
    sessionStorage.removeItem('esi-login-attempt');
    console.log('✅ CORP AUTH - Logout completed');
  };

  const refreshUserToken = async (): Promise<void> => {
    if (!user || !user.refreshToken || user.authMethod === 'local') {
      return;
    }

    try {
      const tokenData = await authService.refreshToken(user.refreshToken);
      setUser(prevUser => prevUser ? {
        ...prevUser,
        accessToken: tokenData.accessToken,
        tokenExpiry: Date.now() + (tokenData.expiresIn * 1000)
      } : null);
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      // If refresh fails, logout user
      logout();
    }
  };

  const isTokenExpired = (): boolean => {
    if (!user || user.authMethod === 'local') {
      return false;
    }
    return Date.now() >= user.tokenExpiry - (5 * 60 * 1000); // 5 minute buffer
  };

  const registerCorporation = async (corporationData: Omit<CorporationESIConfig, 'registeredAt' | 'isActive'>): Promise<void> => {
    const newCorp = await authService.registerCorporationESI(
      corporationData.corporationId,
      corporationData.corporationName,
      corporationData.refreshToken,
      corporationData.registeredBy,
      corporationData.scopes
    );

    setRegisteredCorps(prev => [...prev.filter(corp => corp.corporationId !== newCorp.corporationId), newCorp]);
  };

  const updateESIConfig = (config: ESIConfig): void => {
    setESIConfig(config);
  };

  const updateAdminConfig = (config: { username: string; password: string }): void => {
    setAdminConfig(config);
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    authTrigger,
    registeredCorps,
    esiConfig,
    adminConfig,
    loginWithCredentials,
    loginWithESI,
    handleESICallback,
    logout,
    refreshUserToken,
    isTokenExpired,
    registerCorporation,
    updateESIConfig,
    updateAdminConfig
  };
}