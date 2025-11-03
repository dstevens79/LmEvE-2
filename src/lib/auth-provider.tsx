import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useKV } from '@/lib/kv';
import { useGeneralSettings, useDatabaseSettings } from '@/lib/persistenceService';
import { toast } from 'sonner';
import { LMeveUser, UserRole, CorporationConfig } from './types';
import { createUserWithRole, isSessionValid, refreshUserSession } from './roles';
import { getESIAuthService, initializeESIAuth } from './esi-auth';
import { createDefaultCorporationConfig } from './corp-validation';
import { CorporationTokenManager } from './corp-token-manager';

interface CharacterInfo {
  characterId?: number;
  characterName?: string;
  corporationId?: number;
  corporationName?: string;
  allianceId?: number;
  allianceName?: string;
}

interface AuthContextType {
  // Current user state
  user: LMeveUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Authentication methods
  loginWithCredentials: (username: string, password: string) => Promise<void>;
  loginWithESI: (scopeType?: 'basic' | 'enhanced' | 'corporation', scopesOverride?: string[]) => Promise<string>;
  handleESICallback: (code: string, state: string) => Promise<LMeveUser>;
  logout: () => void;
  
  // Token management
  refreshUserToken: () => Promise<void>;
  isTokenExpired: () => boolean;
  
  // User management
  createManualUser: (username: string, password: string, role: UserRole, characterInfo?: CharacterInfo) => Promise<LMeveUser>;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
  updateUserPermissions: (userId: string, permissions: Partial<import('./types').RolePermissions>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  getAllUsers: () => LMeveUser[];
  // Manual linking between local users and ESI characters
  linkUserToCharacter: (userId: string, character: { characterId: number; characterName: string; corporationId?: number; corporationName?: string; allianceId?: number; allianceName?: string }) => Promise<void>;
  unlinkUserCharacter: (userId: string) => Promise<void>;
  
  // Corporation management
  registerCorporation: (config: CorporationConfig) => Promise<void>;
  updateCorporation: (corporationId: number, config: Partial<CorporationConfig>) => Promise<void>;
  deleteCorporation: (corporationId: number) => Promise<void>;
  getRegisteredCorporations: () => CorporationConfig[];
  
  // Configuration
  esiConfig: { clientId?: string; clientSecret?: string; isConfigured: boolean };
  updateESIConfig: (clientId: string, clientSecret?: string) => void;
  adminConfig: { username: string; password: string };
  updateAdminConfig: (config: { username: string; password: string }) => void;
  
  // Force refresh trigger
  authTrigger: number;

  // Server session hydration (HTTP-friendly auth)
  hydrateSessionFromServer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Site general settings (for auth flow selection)
  const [generalSettings] = useGeneralSettings();
  // Database settings (server-backed) for manual login endpoint
  const [databaseSettings] = useDatabaseSettings();
  // Persistent storage
  const [currentUser, setCurrentUser] = useKV<LMeveUser | null>('lmeve-current-user', null);
  const [users, setUsers] = useKV<LMeveUser[]>('lmeve-users', []);
  // Remove browser-stored credentials; use DB-backed auth only
  const [esiConfiguration, setESIConfiguration] = useKV<{ clientId?: string; clientSecret?: string }>('lmeve-esi-config', {});
  const [registeredCorporations, setRegisteredCorporations] = useKV<CorporationConfig[]>('lmeve-registered-corps', []);
  // Keep an editable admin username reference locally without any password
  const [adminConfig, setAdminConfig] = useKV<{ username: string; password: string }>('admin-config', { username: '', password: '' });
  // Character to user linking map: characterId -> userId
  const [userLinks, setUserLinks] = useKV<Record<string, string>>('lmeve-user-links', {});
  
  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [authTrigger, setAuthTrigger] = useState(0);

  // Ensure we never persist tokens in the users[] list (local storage collection)
  const sanitizeUserForPersistence = useCallback((u: LMeveUser): LMeveUser => {
    const { accessToken, refreshToken, tokenExpiry, ...rest } = u as any;
    return {
      ...(rest as LMeveUser),
      accessToken: undefined as any,
      refreshToken: undefined as any,
      tokenExpiry: undefined as any,
    };
  }, []);

  // Session-only token state (in-memory) with sessionStorage backup for reloads during the same session
  const [sessionTokens, setSessionTokens] = useState<{
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: string;
  } | null>(null);

  // Load session tokens on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('lmeve-session-tokens');
      if (raw) {
        setSessionTokens(JSON.parse(raw));
      }
    } catch {}
  }, []);

  const setAndPersistSessionTokens = useCallback((tokens: {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: string;
  } | null) => {
    setSessionTokens(tokens);
    try {
      if (tokens) {
        sessionStorage.setItem('lmeve-session-tokens', JSON.stringify(tokens));
      } else {
        sessionStorage.removeItem('lmeve-session-tokens');
      }
    } catch {}
  }, []);

  // Do not create admin locally. Admin should be provisioned in DB setup script.

  // Initialize ESI service when configuration changes (respect auth flow from settings)
  useEffect(() => {
    if (esiConfiguration.clientId) {
      try {
        const useSpa = (generalSettings?.authFlow || 'server') === 'spa';
        const callbackRedirect = useSpa
          ? `${window.location.origin}/`
          : `${window.location.origin}/api/auth/esi/callback.php`;
        initializeESIAuth(esiConfiguration.clientId, esiConfiguration.clientSecret, registeredCorporations, callbackRedirect);
        console.log(`✅ ESI Auth initialized (${useSpa ? 'SPA' : 'Server'} callback mode)`, { redirectUri: callbackRedirect });
      } catch (error) {
        console.error('❌ Failed to initialize ESI Auth:', error);
      }
    }
  }, [esiConfiguration, registeredCorporations, generalSettings?.authFlow]);
  
  // Session validation for manual logins
  useEffect(() => {
    if (currentUser && currentUser.authMethod === 'manual' && !isSessionValid(currentUser)) {
      console.log('⚠️ Manual user session expired');
      setCurrentUser(null);
      toast.info('Session expired. Please sign in again.');
    }
  }, [currentUser, setCurrentUser]);

  // Trigger auth state changes
  const triggerAuthChange = useCallback(() => {
    setAuthTrigger(prev => prev + 1);
  }, []);

  // Check if token is expired (must be defined before used in effects)
  const isTokenExpired = useCallback(() => {
    const expiry = sessionTokens?.tokenExpiry || currentUser?.tokenExpiry;
    if (!currentUser || currentUser.authMethod !== 'esi' || !expiry) {
      return false;
    }

    const expiryTime = new Date(expiry).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    return expiryTime - now < fiveMinutes;
  }, [currentUser, sessionTokens]);

  // Manual login with username/password
  // NOTE: This is a USER action, completely separate from database setup.
  // The server must already have valid DB settings configured by an admin.
  // We never pass DB credentials here - the server uses its saved config.
  const loginWithCredentials = useCallback(async (username: string, password: string) => {
    console.log('🔐 Attempting manual login (DB):', username);
    setIsLoading(true);
    try {
      // Server uses saved DB settings (single source of truth)
      const url = `/api/auth/manual-login.php`;

      // Add a timeout to prevent indefinite hang
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 10000);
      let resp: Response;
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timer);
      }

      // Try to parse JSON regardless of HTTP code; server may return HTTP 200 with ok:false
      let json: any = null;
      try { json = await resp.json(); } catch {}

      // Prefer server error message when provided
      if (!resp.ok || (json && json.ok === false)) {
        const statusInfo = `HTTP ${resp.status}`;
        const serverErr = json && (json.error || json.message);
        // MySQL connect failed or other DB/setup errors come through here
        throw new Error(serverErr ? `${serverErr} (${statusInfo})` : `Login failed (${statusInfo})`);
      }

      const row = json?.user;
      if (!row) {
        // Provide clearer guidance when server responded but no user payload is present
        const serverErr = json && (json.error || json.message);
        throw new Error(serverErr || 'Invalid server response');
      }
      const roleFromServer = (row.role || 'corp_member') as UserRole;
      const userData: Partial<LMeveUser> = {
        id: String(row.id ?? `user_${Date.now()}`),
        username: row.username || username,
        characterName: row.character_name || 'Local Administrator',
        corporationId: row.corporation_id || undefined,
        corporationName: row.corporation_name || undefined,
        authMethod: 'manual',
      };
      const fullUser = createUserWithRole(userData, roleFromServer);
      // Persist sanitized user and set current
      setUsers(prev => {
        const exists = prev.find(u => u.id === fullUser.id);
        return exists ? prev.map(u => u.id === fullUser.id ? fullUser : u) : [...prev, fullUser];
      });
      setCurrentUser(fullUser);
      console.log('✅ Manual login successful via DB:', username);
      triggerAuthChange();
    } catch (error: any) {
      // Map AbortError to a friendly timeout message
      if (error?.name === 'AbortError' || /aborted/i.test(String(error?.message))) {
        const hint = 'Login request timed out. Ensure the PHP API is running and database settings are correct.';
        const e = new Error(hint);
        console.error('❌ Manual login failed (timeout):', e);
        throw e;
      }
      console.error('❌ Manual login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [setUsers, setCurrentUser, triggerAuthChange, databaseSettings]);

  // ESI SSO login
  const loginWithESI = useCallback(async (scopeType: 'basic' | 'enhanced' | 'corporation' = 'basic', scopesOverride?: string[]) => {
    console.log('🚀 Starting ESI login with scope type:', scopeType);
    
    if (!esiConfiguration.clientId) {
      throw new Error('ESI is not configured');
    }
    
    try {
      // Mark corp-consent mode for corporation scope so callback doesn't replace current user
      try {
        if (scopeType === 'corporation') {
          sessionStorage.setItem('esi-corp-consent', 'true');
        } else {
          sessionStorage.removeItem('esi-corp-consent');
        }
      } catch {}

      // Use site setting to determine callback behavior
  const useSpa = (generalSettings?.authFlow || 'server') === 'spa';
  const callbackRedirect = useSpa
    ? `${window.location.origin}/`
    : `${window.location.origin}/api/auth/esi/callback.php`;
      initializeESIAuth(esiConfiguration.clientId, esiConfiguration.clientSecret, registeredCorporations, callbackRedirect);
      const esiService = getESIAuthService();
      const url = scopesOverride && scopesOverride.length > 0
        ? await esiService.initiateLoginWithScopes(scopesOverride)
        : await esiService.initiateLogin(scopeType);
      return url;
    } catch (error) {
      console.error('❌ ESI login initiation failed:', error);
      throw error;
    }
  }, [esiConfiguration, registeredCorporations]);

  // Handle ESI callback
  const handleESICallback = useCallback(async (code: string, state: string): Promise<LMeveUser> => {
    console.log('🔄 Processing ESI callback with corporation validation');
    setIsLoading(true);
    
    try {
      // Detect whether this callback is for corporation consent (rather than user login)
      let corpConsentMode = false;
      try { corpConsentMode = sessionStorage.getItem('esi-corp-consent') === 'true'; } catch {}

      const esiService = getESIAuthService();
    const esiUser = await esiService.handleCallback(code, state, registeredCorporations);

      // Store token in token manager
    const tokenManager = CorporationTokenManager.getInstance();
    await tokenManager.storeToken(esiUser);
      
      // If this was a corp consent flow, register/update the corporation without switching current user
      if (corpConsentMode) {
        // Warn if no corporation scopes were granted (likely wrong character or missing director/CEO role)
        const hasCorpScopes = (esiUser.corporationScopes && esiUser.corporationScopes.length > 0);
        if (!hasCorpScopes) {
          try { toast.warning('No corporation scopes were granted. Make sure you select a character with Director/CEO roles.'); } catch {}
        }
        try {
          const corpId = esiUser.corporationId!;
          const corpName = esiUser.corporationName || `Corporation ${corpId}`;
          const corpScopes = esiUser.corporationScopes || [];

          const exists = registeredCorporations.some(c => c.corporationId === corpId);
          if (!exists) {
            const newConfig = createDefaultCorporationConfig(corpId, corpName, esiUser.characterId || 0);
            // Prefer the actual granted corp scopes if available
            newConfig.registeredScopes = corpScopes.length > 0 ? corpScopes : (newConfig.registeredScopes || []);
            setRegisteredCorporations(prev => [...prev, newConfig]);
            console.log('🏢 Registered new corporation from consent:', { corpId, corpName, scopes: newConfig.registeredScopes.length });
          } else {
            setRegisteredCorporations(prev => prev.map(c => c.corporationId === corpId 
              ? { 
                  ...c, 
                  registeredScopes: Array.from(new Set([...(c.registeredScopes || []), ...corpScopes]))
                }
              : c
            ));
            console.log('🔄 Updated corporation scopes from consent:', { corpId, added: corpScopes.length });
          }
        } catch (e) {
          console.warn('Failed to register/update corporation after consent:', e);
        }

        // Clear corp-consent marker
        try { sessionStorage.removeItem('esi-corp-consent'); } catch {}

        try {
          toast.success(`Corporation access granted for ${esiUser.corporationName || 'corporation'}${(esiUser.corporationScopes?.length || 0) ? ` (${esiUser.corporationScopes!.length} scopes)` : ''}`);
        } catch {}

        // Do NOT replace current user session; return current user if exists, else sanitized ESI user
        if (currentUser) {
          return currentUser;
        } else {
          // No current session; don't persist tokens into users list
          setAndPersistSessionTokens({
            accessToken: esiUser.accessToken,
            refreshToken: esiUser.refreshToken,
            tokenExpiry: esiUser.tokenExpiry,
          });
          return esiUser;
        }
      }
      
      // Check if this replaces an existing manual login
      if (currentUser && currentUser.authMethod === 'manual') {
        console.log('🔄 Replacing manual login with ESI login');
        
        // Keep the same user ID but update with ESI data
        const updatedUser = {
          ...esiUser,
          id: currentUser.id,
          createdDate: currentUser.createdDate,
          updatedBy: currentUser.id
        };
        
        // Update in users list without tokens and persist current user sanitized
        setUsers(prev => prev.map(u => u.id === currentUser.id ? sanitizeUserForPersistence(updatedUser) : u));
        setCurrentUser(sanitizeUserForPersistence(updatedUser));
        // Keep tokens session-only
        setAndPersistSessionTokens({
          accessToken: updatedUser.accessToken,
          refreshToken: updatedUser.refreshToken,
          tokenExpiry: updatedUser.tokenExpiry,
        });
        
        console.log('✅ Manual login replaced with ESI login');
        triggerAuthChange();
        return updatedUser;
      } else {
        // New ESI login
        // First, try linked manual user mapping by characterId
        const linkedUserId = esiUser.characterId ? userLinks[String(esiUser.characterId)] : undefined;
        let existingUser = users.find(u => (u.characterId && u.characterId === esiUser.characterId) || (linkedUserId && u.id === linkedUserId));
        
        if (existingUser) {
          // Update existing ESI user
          const updatedUser = refreshUserSession({
            ...existingUser,
            ...esiUser,
            id: existingUser.id,
            createdDate: existingUser.createdDate
          });
          
          // Persist without tokens and keep current user sanitized
          setUsers(prev => prev.map(u => u.id === existingUser.id ? sanitizeUserForPersistence(updatedUser) : u));
          setCurrentUser(sanitizeUserForPersistence(updatedUser));
          setAndPersistSessionTokens({
            accessToken: updatedUser.accessToken,
            refreshToken: updatedUser.refreshToken,
            tokenExpiry: updatedUser.tokenExpiry,
          });
          
          console.log('✅ Existing ESI user updated');
          triggerAuthChange();
          return updatedUser;
        } else {
          // Create new ESI user if no mapping and no existing user found
          // Persist without tokens and keep current user sanitized
          setUsers(prev => [...prev, sanitizeUserForPersistence(esiUser)]);
          setCurrentUser(sanitizeUserForPersistence(esiUser));
          setAndPersistSessionTokens({
            accessToken: esiUser.accessToken,
            refreshToken: esiUser.refreshToken,
            tokenExpiry: esiUser.tokenExpiry,
          });
          
          console.log('✅ New ESI user created');
          triggerAuthChange();
          return esiUser;
        }
      }
    } catch (error) {
      console.error('❌ ESI callback processing failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, users, registeredCorporations, setUsers, setCurrentUser, setRegisteredCorporations, triggerAuthChange]);

  // Logout
  const logout = useCallback(async () => {
    console.log('🚪 Logging out user');
    
    // Revoke ESI tokens if present (access + refresh)
    const acc = sessionTokens?.accessToken || currentUser?.accessToken;
    const ref = sessionTokens?.refreshToken || currentUser?.refreshToken;
    if (currentUser?.authMethod === 'esi' && (acc || ref)) {
      try {
        const esiService = getESIAuthService();
        await esiService.revokeTokens(acc, ref);
      } catch (error) {
        console.warn('Failed to revoke ESI tokens:', error);
      }
    }
    
    // Clear session artifacts
    try {
      sessionStorage.removeItem('esi-auth-state');
      sessionStorage.removeItem('esi-login-attempt');
      sessionStorage.removeItem('esi-corp-consent');
      sessionStorage.removeItem('lmeve-session-tokens');
    } catch {}

    // Scrub tokens from stored users (minimize retention after logout)
    if (currentUser) {
      setUsers(prev => prev.map(u => u.id === currentUser.id ? {
        ...u,
        accessToken: undefined as any,
        refreshToken: undefined as any,
        tokenExpiry: undefined as any
      } : u));
    }

  setCurrentUser(null);
  setAndPersistSessionTokens(null);
    triggerAuthChange();
    
    console.log('✅ User logged out');
  }, [currentUser, setCurrentUser, triggerAuthChange]);

  // Hydrate current user from server session/DB (best-effort)
  const hydrateSessionFromServer = useCallback(async () => {
    try {
      const resp = await fetch('/api/auth/session.php', { method: 'GET' });
      if (!resp.ok) return;
      const json = await resp.json();
      const row = json?.user;
      if (!row) return;

      // Map server row to LMeveUser (tokens never stored client-side)
      const roleFromServer = (row.role || 'corp_member') as UserRole;
      const scopes: string[] = typeof row.scopes === 'string' ? row.scopes.split(' ').filter((s: string) => !!s) : [];
      const userData: Partial<LMeveUser> = {
        id: String(row.id ?? `user_${Date.now()}`),
        username: row.username || undefined,
        characterId: row.character_id || undefined,
        characterName: row.character_name || undefined,
        corporationId: row.corporation_id || undefined,
        authMethod: 'esi',
        scopes,
      };

      const fullUser = createUserWithRole(userData, roleFromServer);
      // Persist sanitized user (no tokens) and set as current
      setUsers(prev => {
        const existing = prev.find(u => u.id === fullUser.id);
        if (existing) {
          return prev.map(u => u.id === fullUser.id ? {
            ...fullUser,
            accessToken: undefined as any,
            refreshToken: undefined as any,
            tokenExpiry: undefined as any,
          } : u);
        }
        return [...prev, {
          ...fullUser,
          accessToken: undefined as any,
          refreshToken: undefined as any,
          tokenExpiry: undefined as any,
        }];
      });
      setCurrentUser({
        ...fullUser,
        accessToken: undefined as any,
        refreshToken: undefined as any,
        tokenExpiry: undefined as any,
      });
      // Clear any SPA auth artifacts just in case
      try {
        sessionStorage.removeItem('esi-auth-state');
        sessionStorage.removeItem('esi-login-attempt');
        sessionStorage.removeItem('esi-corp-consent');
      } catch {}
      triggerAuthChange();
    } catch (_) {
      // best-effort only
    }
  }, [setUsers, setCurrentUser, triggerAuthChange]);

  // Refresh ESI token
  const refreshUserToken = useCallback(async () => {
    const refreshToken = sessionTokens?.refreshToken || currentUser?.refreshToken;
    if (!currentUser || !refreshToken || currentUser.authMethod !== 'esi') {
      return;
    }
    
    console.log('🔄 Refreshing user token');
    
    try {
  const esiService = getESIAuthService();
  const tokenResponse = await esiService.refreshToken(refreshToken);
      
      // Parse and separate scopes
      const userScopes = tokenResponse.scope?.split(' ') || currentUser.scopes || [];
      const CHARACTER_SCOPES_LIST = [
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
      const CORP_SCOPES_LIST = [
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
      
      const characterOnlyScopes = userScopes.filter(scope => CHARACTER_SCOPES_LIST.includes(scope));
      const corpOnlyScopes = userScopes.filter(scope => CORP_SCOPES_LIST.includes(scope));
      
      const updatedUser = refreshUserSession({
        ...currentUser,
        scopes: userScopes,
        characterScopes: characterOnlyScopes,
        corporationScopes: corpOnlyScopes
      });

      // Persist without tokens and keep tokens in session-only state
      setUsers(prev => prev.map(u => u.id === currentUser.id ? sanitizeUserForPersistence(updatedUser) : u));
      setCurrentUser(sanitizeUserForPersistence(updatedUser));
      setAndPersistSessionTokens({
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || refreshToken,
        tokenExpiry: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
      });
      
      console.log('✅ Token refreshed successfully', {
        totalScopes: userScopes.length,
        characterScopes: characterOnlyScopes.length,
        corporationScopes: corpOnlyScopes.length,
        expiresIn: tokenResponse.expires_in
      });
      triggerAuthChange();
      
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      // If refresh fails, log out the user
      logout();
    }
  }, [currentUser, setUsers, setCurrentUser, logout, triggerAuthChange]);

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    const refreshToken = sessionTokens?.refreshToken || currentUser?.refreshToken;
    if (!currentUser || currentUser.authMethod !== 'esi' || !refreshToken) {
      return;
    }
    
    // Check token expiration every minute
    const intervalId = setInterval(() => {
      if (isTokenExpired()) {
        console.log('⏰ Token expiring soon - auto-refreshing');
        refreshUserToken().catch(error => {
          console.error('❌ Auto-refresh failed:', error);
        });
      }
    }, 60 * 1000); // Check every minute
    
    // Also check immediately on mount
    if (isTokenExpired()) {
      console.log('⏰ Token already expired - refreshing immediately');
      refreshUserToken().catch(error => {
        console.error('❌ Initial refresh failed:', error);
      });
    }
    
    return () => clearInterval(intervalId);
  }, [currentUser, sessionTokens, isTokenExpired, refreshUserToken]);

  // Create manual user
  const createManualUser = useCallback(async (username: string, password: string, role: UserRole, characterInfo?: CharacterInfo): Promise<LMeveUser> => {
    console.log('👤 Creating manual user:', username, characterInfo ? 'with character info' : 'without character info');
    
    // Check if username already exists
    if (users.some(u => u.username === username)) {
      throw new Error('Username already exists');
    }
    
    // Passwords are NOT stored client-side; manual users should be created via server API in production.
    
    const user = createUserWithRole({
      username,
      characterName: characterInfo?.characterName || username,
      authMethod: 'manual',
      createdBy: currentUser?.id,
      characterId: characterInfo?.characterId,
      corporationId: characterInfo?.corporationId,
      corporationName: characterInfo?.corporationName,
      allianceId: characterInfo?.allianceId,
      allianceName: characterInfo?.allianceName
    }, role);
    
  setUsers(prev => [...prev, user]);
    
    console.log('✅ Manual user created:', username, characterInfo ? `linked to ${characterInfo.characterName}` : 'no character link');
    return user;
  }, [users, currentUser, setUsers]);

  // Update user role
  const updateUserRole = useCallback(async (userId: string, newRole: UserRole) => {
    console.log('🔄 Updating user role:', userId, newRole);
    
    setUsers(prev => prev.map(user => {
      if (user.id === userId) {
        const updatedUser = createUserWithRole(user, newRole);
        return {
          ...updatedUser,
          id: user.id,
          createdDate: user.createdDate,
          updatedBy: currentUser?.id
        };
      }
      return user;
    }));
    
    // Update current user if it's the same user
    if (currentUser?.id === userId) {
      const updatedCurrentUser = createUserWithRole(currentUser, newRole);
      setCurrentUser({
        ...updatedCurrentUser,
        id: currentUser.id,
        createdDate: currentUser.createdDate,
        updatedBy: currentUser.id
      });
      triggerAuthChange();
    }
    
    console.log('✅ User role updated');
  }, [users, currentUser, setUsers, setCurrentUser, triggerAuthChange]);

  // Update user permissions
  const updateUserPermissions = useCallback(async (userId: string, permissions: Partial<import('./types').RolePermissions>) => {
    console.log('🔄 Updating user permissions:', userId);
    
    setUsers(prev => prev.map(user => {
      if (user.id === userId) {
        return {
          ...user,
          permissions: { ...user.permissions, ...permissions },
          updatedDate: new Date().toISOString(),
          updatedBy: currentUser?.id
        };
      }
      return user;
    }));
    
    // Update current user if it's the same user
    if (currentUser?.id === userId) {
      setCurrentUser(prev => prev ? {
        ...prev,
        permissions: { ...prev.permissions, ...permissions },
        updatedDate: new Date().toISOString(),
        updatedBy: currentUser.id
      } : null);
      triggerAuthChange();
    }
    
    console.log('✅ User permissions updated');
  }, [users, currentUser, setUsers, setCurrentUser, triggerAuthChange]);

  // Delete user
  const deleteUser = useCallback(async (userId: string) => {
    console.log('🗑️ Deleting user:', userId);
    
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) {
      throw new Error('User not found');
    }
    
    // Cannot delete currently logged in user
    if (currentUser?.id === userId) {
      throw new Error('Cannot delete currently logged in user');
    }
    
    // Remove user (no client-side credentials persisted)
    setUsers(prev => prev.filter(u => u.id !== userId));
    
    console.log('✅ User deleted');
  }, [users, currentUser, setUsers]);

  // Get all users
  const getAllUsers = useCallback(() => {
    return users;
  }, [users]);

  // Link a manual/local user to an ESI character for future auto-merge on SSO
  const linkUserToCharacter = useCallback(async (
    userId: string,
    character: { characterId: number; characterName: string; corporationId?: number; corporationName?: string; allianceId?: number; allianceName?: string }
  ) => {
    // Update user record with character fields for visibility and set mapping
    setUsers(prev => prev.map(u => u.id === userId ? {
      ...u,
      characterId: character.characterId,
      characterName: character.characterName || u.characterName,
      corporationId: character.corporationId ?? u.corporationId,
      corporationName: character.corporationName ?? u.corporationName,
      allianceId: character.allianceId ?? u.allianceId,
      allianceName: character.allianceName ?? u.allianceName,
      updatedDate: new Date().toISOString(),
      updatedBy: currentUser?.id
    } : u));
    setUserLinks(prev => ({ ...prev, [String(character.characterId)]: userId }));
  }, [setUsers, setUserLinks, currentUser?.id]);

  // Unlink a user from any associated character
  const unlinkUserCharacter = useCallback(async (userId: string) => {
    let removedCharId: number | undefined;
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        removedCharId = u.characterId;
        return {
          ...u,
          characterId: undefined,
          characterName: u.username || u.characterName,
          updatedDate: new Date().toISOString(),
          updatedBy: currentUser?.id
        } as LMeveUser;
      }
      return u;
    }));
    if (removedCharId) {
      setUserLinks(prev => {
        const clone = { ...prev };
        delete clone[String(removedCharId!)];
        return clone;
      });
    }
  }, [setUsers, setUserLinks, currentUser?.id]);

  // Register corporation
  const registerCorporation = useCallback(async (config: CorporationConfig) => {
    console.log('🏢 Registering corporation:', config.corporationName);
    
    // Check if corporation already exists
    const existingCorp = registeredCorporations.find(corp => 
      corp.corporationId === config.corporationId
    );
    
    if (existingCorp) {
      throw new Error('Corporation is already registered');
    }
    
    setRegisteredCorporations(prev => [...prev, config]);
    
    // Update ESI service with new corporation list
    if (esiConfiguration.clientId) {
      try {
        const esiService = getESIAuthService();
        esiService.updateRegisteredCorporations([...registeredCorporations, config]);
      } catch (error) {
        console.warn('Failed to update ESI service corporations:', error);
      }
    }
    
    console.log('✅ Corporation registered successfully');
  }, [registeredCorporations, esiConfiguration, setRegisteredCorporations]);

  // Update corporation
  const updateCorporation = useCallback(async (corporationId: number, updates: Partial<CorporationConfig>) => {
    console.log('🔄 Updating corporation:', corporationId);
    
    setRegisteredCorporations(prev => prev.map(corp => 
      corp.corporationId === corporationId ? { ...corp, ...updates } : corp
    ));
    
    // Update ESI service
    if (esiConfiguration.clientId) {
      try {
        const esiService = getESIAuthService();
        const updatedCorps = registeredCorporations.map(corp => 
          corp.corporationId === corporationId ? { ...corp, ...updates } : corp
        );
        esiService.updateRegisteredCorporations(updatedCorps);
      } catch (error) {
        console.warn('Failed to update ESI service corporations:', error);
      }
    }
    
    console.log('✅ Corporation updated successfully');
  }, [registeredCorporations, esiConfiguration, setRegisteredCorporations]);

  // Delete corporation
  const deleteCorporation = useCallback(async (corporationId: number) => {
    console.log('🗑️ Deleting corporation:', corporationId);
    
    const corpToDelete = registeredCorporations.find(corp => corp.corporationId === corporationId);
    if (!corpToDelete) {
      throw new Error('Corporation not found');
    }
    
    // Remove corporation
    const updatedCorps = registeredCorporations.filter(corp => corp.corporationId !== corporationId);
    setRegisteredCorporations(updatedCorps);
    
    // Update ESI service
    if (esiConfiguration.clientId) {
      try {
        const esiService = getESIAuthService();
        esiService.updateRegisteredCorporations(updatedCorps);
      } catch (error) {
        console.warn('Failed to update ESI service corporations:', error);
      }
    }
    
    // Logout any users from this corporation
    const usersFromCorp = users.filter(u => u.corporationId === corporationId);
    if (usersFromCorp.length > 0) {
      console.log(`🚪 Logging out ${usersFromCorp.length} users from deleted corporation`);
      
      // Remove users from this corporation
      setUsers(prev => prev.filter(u => u.corporationId !== corporationId));
      
      // If current user is from this corp, log them out
      if (currentUser && currentUser.corporationId === corporationId) {
        setCurrentUser(null);
        triggerAuthChange();
        toast.info('You have been logged out because your corporation was removed.');
      }
    }
    
    console.log('✅ Corporation deleted successfully');
  }, [registeredCorporations, users, currentUser, esiConfiguration, setRegisteredCorporations, setUsers, setCurrentUser, triggerAuthChange]);

  // Get registered corporations
  const getRegisteredCorporations = useCallback(() => {
    return registeredCorporations;
  }, [registeredCorporations]);

  // Update ESI configuration
  const updateESIConfig = useCallback((clientId: string, clientSecret?: string) => {
    console.log('🔧 Updating ESI configuration');
    
    const newConfig = { clientId, clientSecret };
    setESIConfiguration(newConfig);
    
    // Initialize ESI service with new config
    try {
  const useSpa2 = (generalSettings?.authFlow || 'server') === 'spa';
  const callbackRedirect = useSpa2
    ? `${window.location.origin}/`
    : `${window.location.origin}/api/auth/esi/callback.php`;
      initializeESIAuth(clientId, clientSecret, registeredCorporations, callbackRedirect);
    console.log('✅ ESI configuration updated (Server callback mode)');
    } catch (error) {
      console.error('❌ Failed to update ESI configuration:', error);
      throw error;
    }
  }, [registeredCorporations, setESIConfiguration]);

  // Update admin configuration
  const updateAdminConfig = useCallback((config: { username: string; password: string }) => {
    console.log('🔧 Updating admin configuration');
    setAdminConfig(config);
    console.log('✅ Admin configuration updated');
  }, [setAdminConfig]);

  // Merge persisted user with session-only tokens for runtime context
  const mergedUser: LMeveUser | null = currentUser
    ? {
        ...currentUser,
        accessToken: sessionTokens?.accessToken,
        refreshToken: sessionTokens?.refreshToken,
        tokenExpiry: sessionTokens?.tokenExpiry,
      }
    : null;

  const contextValue: AuthContextType = {
    // Current user state
    user: mergedUser,
    isAuthenticated: !!currentUser && isSessionValid(currentUser),
    isLoading,
    
    // Authentication methods
    loginWithCredentials,
    loginWithESI,
    handleESICallback,
    logout,
    
    // Token management
    refreshUserToken,
    isTokenExpired,
    
    // User management
    createManualUser,
    updateUserRole,
    updateUserPermissions,
    deleteUser,
    getAllUsers,
  linkUserToCharacter,
  unlinkUserCharacter,
    
    // Corporation management
    registerCorporation,
    updateCorporation,
    deleteCorporation,
    getRegisteredCorporations,
    
    // Configuration
    esiConfig: {
      clientId: esiConfiguration.clientId,
      clientSecret: esiConfiguration.clientSecret,
      isConfigured: !!esiConfiguration.clientId
    },
    updateESIConfig,
    adminConfig,
    updateAdminConfig,
    
    // Force refresh trigger
    authTrigger,

    // Server session hydration
    hydrateSessionFromServer
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}