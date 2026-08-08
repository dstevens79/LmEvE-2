import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useKV } from '@/lib/kv';
import { useGeneralSettings, useDatabaseSettings } from '@/lib/persistenceService';
import { toast } from 'sonner';
import { LMeveUser, UserRole, CorporationConfig } from './types';
import { createUserWithRole, isLocalSiteAdmin, isSessionValid, normalizeUserRole, refreshUserSession } from './roles';
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

/**
 * Normalize ESI credentials.
 * Accepts correct (clientId, clientSecret) args and the legacy mistaken object form
 * updateESIConfig({ clientId, clientSecret }) that stored an object as clientId.
 */
function normalizeEsiCredentials(
  clientIdOrConfig: unknown,
  clientSecret?: unknown
): { clientId: string; clientSecret?: string } {
  let idRaw: unknown = clientIdOrConfig;
  let secretRaw: unknown = clientSecret;

  if (idRaw && typeof idRaw === 'object' && !Array.isArray(idRaw)) {
    const obj = idRaw as Record<string, unknown>;
    if (obj.clientId && typeof obj.clientId === 'object') {
      return normalizeEsiCredentials(obj.clientId, obj.clientSecret ?? secretRaw);
    }
    idRaw = obj.clientId ?? obj.client_id ?? '';
    if (secretRaw == null) {
      secretRaw = obj.clientSecret ?? obj.client_secret;
    }
  }

  const clientId = idRaw == null ? '' : String(idRaw).trim();
  const secret =
    secretRaw == null || secretRaw === ''
      ? undefined
      : String(secretRaw).trim();

  return { clientId, clientSecret: secret };
}

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
  // Prevent treating stale localStorage users as authenticated until server session is checked
  const [sessionReady, setSessionReady] = useState(false);
  const [serverSessionChecked, setServerSessionChecked] = useState(false);
  // Bumped on login/logout so an in-flight boot hydrate cannot wipe a fresh login.
  const authEpochRef = useRef(0);

  // Ensure we never persist tokens in the users[] list (local storage collection)
  const sanitizeUserForPersistence = useCallback((u: LMeveUser): LMeveUser => {
    // Keep tokenExpiry metadata for refresh scheduling; never persist raw tokens.
    const { accessToken, refreshToken, ...rest } = u as any;
    return {
      ...(rest as LMeveUser),
      accessToken: undefined as any,
      refreshToken: undefined as any,
      tokenExpiry: u.tokenExpiry,
    };
  }, []);

  // Map server session/login payloads into the client LMeveUser shape.
  // Server is the source of truth for role / is_admin / bootstrap (api_finalize_public_user).
  const mapServerUser = useCallback((row: any, fallbackAuth: 'manual' | 'esi' = 'manual'): LMeveUser => {
    const authMethod = (row?.auth_method === 'esi' || row?.authMethod === 'esi')
      ? 'esi'
      : (row?.auth_method === 'manual' || row?.authMethod === 'manual')
        ? 'manual'
        : fallbackAuth;
    const scopes: string[] = Array.isArray(row?.scopes)
      ? row.scopes.filter((s: any) => !!s).map(String)
      : (typeof row?.scopes === 'string' ? row.scopes.split(/\s+/).filter(Boolean) : []);

    const sessionExpiry = row?.session_expiry || row?.sessionExpiry || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const username = row?.username ? String(row.username) : undefined;
    const characterName = row?.character_name || row?.characterName || username || (authMethod === 'manual' ? 'Local Administrator' : 'EVE Character');
    const id = String(row?.id ?? `user_${Date.now()}`);
    const idLower = id.toLowerCase();
    const bootstrap =
      row?.bootstrap === true ||
      row?.bootstrap === 1 ||
      row?.bootstrap === '1' ||
      idLower === 'bootstrap-admin' ||
      idLower.startsWith('bootstrap');

    // Prefer explicit server capability flags over id heuristics.
    const serverSaysAdmin =
      row?.is_admin === true ||
      row?.is_admin === 1 ||
      row?.is_admin === '1' ||
      row?.isAdmin === true ||
      row?.isAdmin === 1 ||
      idLower === 'bootstrap-admin' ||
      (typeof row?.role === 'string' && normalizeUserRole(row.role) === 'super_admin');

    let roleFromServer = normalizeUserRole(row?.role || (serverSaysAdmin ? 'super_admin' : 'corp_member'));
    if (serverSaysAdmin) {
      roleFromServer = 'super_admin';
    }

    const userData: Partial<LMeveUser> & { bootstrap?: boolean } = {
      id,
      username,
      characterId: row?.character_id ?? row?.characterId ?? undefined,
      characterName,
      corporationId: row?.corporation_id ?? row?.corporationId ?? undefined,
      corporationName: row?.corporation_name ?? row?.corporationName ?? undefined,
      allianceId: row?.alliance_id ?? row?.allianceId ?? undefined,
      allianceName: row?.alliance_name ?? row?.allianceName ?? undefined,
      authMethod,
      scopes,
      lastLogin: row?.last_login || row?.lastLogin || new Date().toISOString(),
      sessionExpiry,
      // Expiry only — never hydrate access/refresh tokens from the server session payload.
      tokenExpiry: row?.token_expiry || row?.tokenExpiry || undefined,
      isActive: row?.is_active === undefined && row?.isActive === undefined ? true : !!(row.is_active || row.isActive),
      isAdmin: serverSaysAdmin || roleFromServer === 'super_admin',
      bootstrap: bootstrap || undefined,
    };

    const full = createUserWithRole(userData, roleFromServer);
    if (bootstrap) {
      (full as LMeveUser & { bootstrap?: boolean }).bootstrap = true;
    }
    // Site-admin free-pass only when server/capability says so — not every offline account.
    if (isLocalSiteAdmin(full) || full.isAdmin || roleFromServer === 'super_admin') {
      full.isAdmin = true;
      full.role = 'super_admin';
      full.permissions = createUserWithRole({ ...full, role: 'super_admin' }, 'super_admin').permissions;
    }

    return sanitizeUserForPersistence(full);
  }, [sanitizeUserForPersistence]);

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

  // Repair corrupted ESI config shape (object stored as clientId from bad save path).
  useEffect(() => {
    const raw = esiConfiguration as any;
    if (!raw || typeof raw !== 'object') return;
    const needsRepair =
      (raw.clientId != null && typeof raw.clientId !== 'string') ||
      (raw.clientSecret != null && typeof raw.clientSecret !== 'string');
    if (!needsRepair) return;

    const fixed = normalizeEsiCredentials(raw);
    console.warn('Repairing corrupted lmeve-esi-config shape', {
      wasType: typeof raw.clientId,
      fixedIdLen: fixed.clientId.length,
    });
    setESIConfiguration({
      clientId: fixed.clientId || undefined,
      clientSecret: fixed.clientSecret,
    });
  }, [esiConfiguration, setESIConfiguration]);

  // Initialize ESI service when configuration changes (respect auth flow from settings).
  // Server mode: callback URL is owned by PHP settings — do not bind to browser host.
  useEffect(() => {
    const clientId =
      typeof esiConfiguration.clientId === 'string' ? esiConfiguration.clientId.trim() : '';
    if (!clientId) return;
    try {
      const useSpa = (generalSettings?.authFlow || 'server') === 'spa';
      // Placeholder only for client helper init; real OAuth start uses server callbackUrl.
      const callbackRedirect = useSpa
        ? `${window.location.origin}/`
        : (esiConfiguration as any).callbackUrl || 'about:blank';
      const secret =
        typeof esiConfiguration.clientSecret === 'string'
          ? esiConfiguration.clientSecret
          : undefined;
      initializeESIAuth(clientId, secret, registeredCorporations, callbackRedirect);
      console.log(`ESI Auth initialized (${useSpa ? 'SPA' : 'Server'} callback mode)`);
    } catch (error) {
      console.error('Failed to initialize ESI Auth:', error);
    }
  }, [esiConfiguration, registeredCorporations, generalSettings?.authFlow]);
  
  // Session validation for ESI only. Manual/bootstrap admin is server-cookie backed —
  // never log them out on a flaky client-side expiry mirror.
  useEffect(() => {
    if (!serverSessionChecked) return;
    if (currentUser && currentUser.authMethod === 'esi' && !isSessionValid(currentUser)) {
      console.log('⚠️ ESI user session expired (client mirror)');
      // Soft: re-check server; do not hard-clear here (hydrate owns clears).
    }
  }, [currentUser, serverSessionChecked]);

  // Trigger auth state changes
  const triggerAuthChange = useCallback(() => {
    setAuthTrigger(prev => prev + 1);
  }, []);

  // Check if token is expired (must be defined before used in effects)
  const isTokenExpired = useCallback(() => {
    const expiry = sessionTokens?.tokenExpiry || currentUser?.tokenExpiry;
    if (!currentUser || currentUser.authMethod !== 'esi') {
      return false;
    }
    // No known expiry yet (fresh vault session) — treat as needing a soft refresh check only when forced.
    if (!expiry) {
      return false;
    }

    const expiryTime = new Date(expiry).getTime();
    if (Number.isNaN(expiryTime)) return false;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    return expiryTime - now < fiveMinutes;
  }, [currentUser, sessionTokens]);

  // Manual login with username/password.
  // Offline bootstrap accounts (admin) authenticate without MySQL.
  // Database users are a secondary path once settings exist.
  const loginWithCredentials = useCallback(async (username: string, password: string) => {
    console.log('🔐 Attempting manual login:', username);
    
    // Guard against concurrent requests
    if (isLoading) {
      console.warn('⚠️ Login already in progress, ignoring duplicate request');
      return;
    }
    
    setIsLoading(true);
    try {
      // Server uses saved DB settings (single source of truth)
      const url = `/api/auth/manual-login.php`;

      const controller = new AbortController();
      const timer = window.setTimeout(() => {
        console.warn('⏰ Login request timeout (15s) - aborting...');
        controller.abort();
      }, 15000);
      
      let resp: Response;
      try {
        const fetchStart = performance.now();
        console.log('📤 Sending login request to:', url);
        
        resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username, password }),
          signal: controller.signal,
        });
        
        const fetchDuration = Math.round(performance.now() - fetchStart);
        console.log(`📥 Login response received: HTTP ${resp.status} (${fetchDuration}ms)`);
      } catch (fetchError: any) {
        clearTimeout(timer);
        
        // Enhanced diagnostics for fetch failures
        if (fetchError?.name === 'AbortError') {
          console.error('❌ Login fetch ABORTED - likely timeout');
          throw new Error('Login request timed out. Please try again.');
        } else if (fetchError instanceof TypeError) {
          console.error('❌ Login fetch NETWORK ERROR:', fetchError.message);
          console.error('💡 Possible causes: Server down, incorrect URL, CORS issue, or network disconnection');
          throw new Error(`Network error during login: ${fetchError.message}`);
        } else {
          console.error('❌ Login fetch ERROR:', fetchError);
          throw fetchError;
        }
      } finally {
        clearTimeout(timer);
      }

      // Try to parse JSON regardless of HTTP code; server may return HTTP 200 with ok:false
      let json: any = null;
      try { 
        json = await resp.json();
        console.log('📋 Login response parsed:', { ok: json?.ok, hasUser: !!json?.user, error: json?.error });
      } catch (parseError) {
        console.warn('⚠️ Failed to parse login response as JSON:', parseError);
      }

      // Prefer server error message when provided
      if (!resp.ok || (json && json.ok === false)) {
        const statusInfo = `HTTP ${resp.status}`;
        const serverErr = json && (json.error || json.message);
        // MySQL connect failed or other DB/setup errors come through here
        console.error(`❌ Login failed: ${serverErr || statusInfo}`);
        throw new Error(serverErr ? `${serverErr} (${statusInfo})` : `Login failed (${statusInfo})`);
      }

      const row = json?.user;
      if (!row) {
        // Provide clearer guidance when server responded but no user payload is present
        const serverErr = json && (json.error || json.message);
        console.error('❌ Login response missing user data');
        throw new Error(serverErr || 'Invalid server response');
      }
      const fullUser = mapServerUser({ ...row, auth_method: 'manual', username: row.username || username }, 'manual');
      // Invalidate any in-flight hydrate that started before this login.
      authEpochRef.current += 1;
      // Local admin bootstrap: no ESI tokens in browser
      setAndPersistSessionTokens(null);
      // Persist sanitized user and set current
      setUsers(prev => {
        const exists = prev.find(u => u.id === fullUser.id);
        return exists ? prev.map(u => u.id === fullUser.id ? fullUser : u) : [...prev, fullUser];
      });
      setCurrentUser(fullUser);
      setSessionReady(true);
      setServerSessionChecked(true);
      console.log('✅ Manual login successful:', username, {
        role: fullUser.role,
        id: fullUser.id,
        isAdmin: fullUser.isAdmin,
        authSource: json?.authSource || 'unknown',
      });
      triggerAuthChange();
      // Trigger metrics refresh so UI updates login counts immediately
      try {
        window.dispatchEvent(new CustomEvent('lmeve-login-success'));
      } catch {}
    } catch (error: any) {
      console.error('❌ Manual login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [setUsers, setCurrentUser, triggerAuthChange, mapServerUser, setAndPersistSessionTokens, isLoading]);

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
        sessionStorage.setItem('esi-login-attempt', 'true');
      } catch {}

      // Use site setting to determine callback behavior
      const useSpa = (generalSettings?.authFlow || 'server') === 'spa';

      // Canonical server flow: PHP owns the public callback URL + signed OAuth state.
      // Never send window.location.origin as redirect_uri — LAN IPs break EVE SSO.
      if (!useSpa) {
        const scopeList = scopesOverride && scopesOverride.length > 0
          ? scopesOverride
          : undefined;
        const resp = await fetch('/api/auth/esi/start.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            scopes: scopeList,
            scopeType,
          }),
        });
        const json = await resp.json().catch(() => null);
        if (!resp.ok || !json?.ok || !json?.authorizeUrl) {
          throw new Error(json?.error || 'Failed to start ESI login on server');
        }
        const serverCallback = (json.redirectUri as string) || '';
        if (serverCallback) {
          initializeESIAuth(esiConfiguration.clientId, esiConfiguration.clientSecret, registeredCorporations, serverCallback);
        }
        console.log('✅ Server ESI OAuth start ready', {
          redirectUri: serverCallback,
          callbackOrigin: json.callbackOrigin,
          browserOrigin: window.location.origin,
        });
        return json.authorizeUrl as string;
      }

      // SPA mode still needs an explicit callback; prefer saved ESI settings when present
      const spaCallback = `${window.location.origin}/`;
      initializeESIAuth(esiConfiguration.clientId, esiConfiguration.clientSecret, registeredCorporations, spaCallback);
      const esiService = getESIAuthService();
      const url = scopesOverride && scopesOverride.length > 0
        ? await esiService.initiateLoginWithScopes(scopesOverride)
        : await esiService.initiateLogin(scopeType);
      return url;
    } catch (error) {
      console.error('❌ ESI login initiation failed:', error);
      throw error;
    }
  }, [esiConfiguration, registeredCorporations, generalSettings?.authFlow]);

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

      // Bind a real server session from the verified access token (SPA path)
      try {
        const est = await fetch('/api/auth/esi/establish.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            accessToken: esiUser.accessToken,
            refreshToken: esiUser.refreshToken,
            expiresIn: esiUser.tokenExpiry ? Math.max(0, Math.floor((new Date(esiUser.tokenExpiry).getTime() - Date.now()) / 1000)) : undefined,
            scopes: esiUser.scopes || [],
          }),
        });
        const estJson = await est.json().catch(() => null);
        if (est.ok && estJson?.ok && estJson?.user) {
          console.log('✅ Server session established from SPA ESI callback');
        } else {
          console.warn('⚠️ ESI establish-session soft-failed', estJson);
        }
      } catch (e) {
        console.warn('⚠️ ESI establish-session error', e);
      }

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
    
    // Revoke ESI tokens if present in browser (SPA path). Server tokens remain vaulted unless revoked separately.
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

    // Destroy browser-bound PHP session (admin + ESI identity)
    try {
      await fetch('/api/auth/logout.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    } catch (error) {
      console.warn('Server logout failed (continuing local cleanup):', error);
    }
    
    // Clear session artifacts
    try {
      sessionStorage.removeItem('esi-auth-state');
      sessionStorage.removeItem('esi-login-attempt');
      sessionStorage.removeItem('esi-corp-consent');
      sessionStorage.removeItem('lmeve-session-tokens');
    } catch {}
    CorporationTokenManager.getInstance().clear();

    // Scrub tokens from stored users (minimize retention after logout)
    if (currentUser) {
      setUsers(prev => prev.map(u => u.id === currentUser.id ? {
        ...u,
        accessToken: undefined as any,
        refreshToken: undefined as any,
        tokenExpiry: undefined as any
      } : u));
    }

    authEpochRef.current += 1;
    setCurrentUser(null);
    setAndPersistSessionTokens(null);
    setSessionReady(true);
    setServerSessionChecked(true);
    triggerAuthChange();
    
    console.log('✅ User logged out');
  }, [currentUser, setCurrentUser, triggerAuthChange, sessionTokens, setUsers, setAndPersistSessionTokens]);

  // Hydrate current user from server session/DB (best-effort)
  const hydrateSessionFromServer = useCallback(async () => {
    const epochAtStart = authEpochRef.current;
    const applyIfCurrent = (fn: () => void) => {
      // A login/logout after this hydrate started owns auth state now.
      if (authEpochRef.current !== epochAtStart) {
        console.log('🔐 Ignoring stale session hydrate (auth epoch changed)');
        return false;
      }
      fn();
      return true;
    };

    try {
      const resp = await fetch('/api/auth/session.php', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });
      if (!resp.ok) {
        // No usable server session (401/5xx/missing API) => anonymous. Never keep a
        // localStorage ghost user that can open admin setup without a real login.
        console.log('🔐 Session check failed - treating as logged out', { status: resp.status });
        applyIfCurrent(() => {
          setCurrentUser(null);
          setAndPersistSessionTokens(null);
          setServerSessionChecked(true);
          setSessionReady(true);
          triggerAuthChange();
        });
        return;
      }
      const json = await resp.json();
      const row = json?.user;
      if (!row) {
        // No server session => not authenticated. Clear stale localStorage identity.
        console.log('🔐 No server session - clearing local auth identity');
        applyIfCurrent(() => {
          setCurrentUser(null);
          setAndPersistSessionTokens(null);
          setServerSessionChecked(true);
          setSessionReady(true);
          triggerAuthChange();
        });
        return;
      }

      const fullUser = mapServerUser(row, row.auth_method === 'esi' ? 'esi' : 'manual');
      if (!applyIfCurrent(() => {
        setUsers(prev => {
          const existing = prev.find(u => u.id === fullUser.id);
          if (existing) {
            return prev.map(u => u.id === fullUser.id ? fullUser : u);
          }
          return [...prev, fullUser];
        });
        setCurrentUser(fullUser);
        // Server mode keeps tokens vaulted server-side; do not invent client tokens.
        if (fullUser.authMethod !== 'esi') {
          setAndPersistSessionTokens(null);
        }
      })) {
        return;
      }

      // Pull server-seeded corporations so admin handoff / CEO login shows the corp immediately.
      try {
        const corpResp = await fetch('/api/lmeve/get-corporations.php', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ limit: 200 }),
        });
        const corpJson = await corpResp.json().catch(() => null);
        if (corpResp.ok && corpJson?.ok && Array.isArray(corpJson.rows)) {
          const fromServer: CorporationConfig[] = corpJson.rows
            .map((r: any) => {
              const corporationId = Number(r.corporation_id ?? r.corporationId ?? 0);
              if (!corporationId) return null;
              const scopesRaw = r.registered_scopes ?? r.registeredScopes ?? '';
              const registeredScopes = Array.isArray(scopesRaw)
                ? scopesRaw.map(String)
                : (typeof scopesRaw === 'string' && scopesRaw
                    ? scopesRaw.split(/[\s,]+/).filter(Boolean)
                    : []);
              return {
                corporationId,
                corporationName: String(r.corporation_name ?? r.corporationName ?? `Corporation ${corporationId}`),
                registeredScopes,
                isActive: r.is_active === undefined ? true : !!(r.is_active || r.isActive),
                registrationDate: r.registration_date ?? r.registrationDate ?? new Date().toISOString(),
                lastTokenRefresh: r.last_token_refresh ?? r.lastTokenRefresh ?? undefined,
              } as CorporationConfig;
            })
            .filter(Boolean) as CorporationConfig[];

          if (fromServer.length > 0) {
            setRegisteredCorporations(prev => {
              const byId = new Map<number, CorporationConfig>();
              for (const c of prev) byId.set(c.corporationId, c);
              for (const c of fromServer) {
                const existing = byId.get(c.corporationId);
                byId.set(c.corporationId, existing ? {
                  ...existing,
                  ...c,
                  // Prefer any already-known scopes from local consent flow
                  registeredScopes: (existing.registeredScopes?.length ? existing.registeredScopes : c.registeredScopes) || [],
                } : c);
              }
              return Array.from(byId.values());
            });
          }
        }
      } catch (e) {
        console.warn('⚠️ Failed to hydrate corporations from server', e);
      }

      try {
        sessionStorage.removeItem('esi-auth-state');
        sessionStorage.removeItem('esi-login-attempt');
        sessionStorage.removeItem('esi-corp-consent');
      } catch {}
      applyIfCurrent(() => {
        setServerSessionChecked(true);
        setSessionReady(true);
        triggerAuthChange();
        console.log('✅ Hydrated server session', { id: fullUser.id, authMethod: fullUser.authMethod, role: fullUser.role, name: fullUser.characterName, corp: fullUser.corporationName });
      });
    } catch (_) {
      applyIfCurrent(() => {
        setServerSessionChecked(true);
        setSessionReady(true);
      });
    }
  }, [setUsers, setCurrentUser, setRegisteredCorporations, triggerAuthChange, mapServerUser, setAndPersistSessionTokens]);
  // On app boot, trust the server session cookie over localStorage leftovers.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await hydrateSessionFromServer();
      } finally {
        if (!cancelled) {
          setServerSessionChecked(true);
          setSessionReady(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [hydrateSessionFromServer]);

  // Refresh ESI token
  const refreshUserToken = useCallback(async () => {
    if (!currentUser || currentUser.authMethod !== 'esi') {
      return;
    }

    const refreshToken = sessionTokens?.refreshToken || currentUser?.refreshToken;
    console.log('🔄 Refreshing user token', { hasClientRefresh: !!refreshToken, characterId: currentUser.characterId });

    try {
      // Server-vault path: browser has identity session but tokens stay on server
      if (!refreshToken && currentUser.characterId) {
        const resp = await fetch('/api/auth/esi/refresh.php', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterId: currentUser.characterId }),
        });
        const json = await resp.json().catch(() => null);
        if (!resp.ok || json?.ok === false) {
          console.warn('⚠️ Server token refresh failed', json);
          // Do not hard-logout on transient server refresh issues for vaulted tokens
          return;
        }
        const updatedUser = sanitizeUserForPersistence(refreshUserSession({
          ...currentUser,
          tokenExpiry: json?.expiresAt || currentUser.tokenExpiry,
        }));
        setCurrentUser(updatedUser);
        triggerAuthChange();
        console.log('✅ Server-side token refresh acknowledged', { expiresAt: json?.expiresAt });
        return;
      }

      if (!refreshToken) return;

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

  // Auto-refresh token when it's about to expire (client tokens OR server-vaulted ESI session)
  useEffect(() => {
    if (!currentUser || currentUser.authMethod !== 'esi') {
      return;
    }
    const refreshToken = sessionTokens?.refreshToken || currentUser?.refreshToken;
    const canServerRefresh = !!currentUser.characterId;
    if (!refreshToken && !canServerRefresh) {
      return;
    }

    const maybeRefresh = () => {
      if (isTokenExpired()) {
        console.log('⏰ Token expiring soon - auto-refreshing', { mode: refreshToken ? 'client' : 'server-vault' });
        refreshUserToken().catch(error => {
          console.error('❌ Auto-refresh failed:', error);
        });
      }
    };

    const intervalId = setInterval(maybeRefresh, 60 * 1000);
    maybeRefresh();
    return () => clearInterval(intervalId);
  }, [currentUser, sessionTokens, isTokenExpired, refreshUserToken]);

  // Create manual user
  const createManualUser = useCallback(async (username: string, password: string, role: UserRole, characterInfo?: CharacterInfo): Promise<LMeveUser> => {
    console.log('👤 Creating manual user:', username, characterInfo ? 'with character info' : 'without character info');
    
    // Check if username already exists locally
    if (users.some(u => u.username === username)) {
      throw new Error('Username already exists');
    }

    // Persist offline/maintenance accounts on the server (works without MySQL).
    try {
      const resp = await fetch('/api/auth/bootstrap-users.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', username, password, role }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || json?.ok === false) {
        throw new Error(json?.error || `Failed to save offline account (HTTP ${resp.status})`);
      }
    } catch (e: any) {
      console.error('❌ Offline account create failed:', e);
      throw e;
    }
    
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
    console.log('Updating ESI configuration');

    const normalized = normalizeEsiCredentials(clientId, clientSecret);
    if (!normalized.clientId) {
      throw new Error('ESI Client ID is required');
    }

    const newConfig = {
      clientId: normalized.clientId,
      clientSecret: normalized.clientSecret,
    };
    setESIConfiguration(newConfig);

    // Initialize ESI service with new config (server owns real callback URL)
    try {
      const useSpa2 = (generalSettings?.authFlow || 'server') === 'spa';
      const callbackRedirect = useSpa2
        ? `${window.location.origin}/`
        : 'about:blank';
      initializeESIAuth(normalized.clientId, normalized.clientSecret, registeredCorporations, callbackRedirect);
      console.log('ESI configuration updated');
    } catch (error) {
      console.error('Failed to update ESI configuration:', error);
      throw error;
    }
  }, [registeredCorporations, setESIConfiguration, generalSettings?.authFlow]);

  // Update admin configuration
  const updateAdminConfig = useCallback((config: { username: string; password: string }) => {
    console.log('🔧 Updating admin configuration (offline store)');
    // Keep a non-secret local username hint only
    setAdminConfig({ username: config.username || 'admin', password: '' });

    const username = (config.username || 'admin').trim() || 'admin';
    const password = config.password || '';
    if (!password) {
      console.warn('⚠️ updateAdminConfig called without password; offline store unchanged');
      return;
    }

    // Fire-and-forget server persist; callers that need await should use createManualUser / bootstrap API directly
    void (async () => {
      try {
        const resp = await fetch('/api/auth/bootstrap-users.php', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_password', username, password }),
        });
        const json = await resp.json().catch(() => null);
        if (!resp.ok || json?.ok === false) {
          console.error('❌ Failed to update offline admin password', json);
          return;
        }
        console.log('✅ Offline admin password updated');
      } catch (e) {
        console.error('❌ Offline admin password update error', e);
      }
    })();
  }, [setAdminConfig]);

  // Merge persisted user with session-only tokens for runtime context.
  // Never expose a localStorage identity until the server session check finishes —
  // otherwise App treats a stale user as logged-in and can open admin setup anonymously.
  // Manual/bootstrap accounts are cookie-backed; do not hard-gate them on client expiry.
  const sessionIsAuthenticated = !!(
    sessionReady &&
    currentUser &&
    currentUser.isActive !== false &&
    (currentUser.authMethod === 'manual' || isLocalSiteAdmin(currentUser) || isSessionValid(currentUser))
  );
  const mergedUser: LMeveUser | null = sessionIsAuthenticated && currentUser
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
    isAuthenticated: sessionIsAuthenticated,
    isLoading: isLoading || !sessionReady,
    
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
    
    // Configuration — always expose string clientId/secret (repair nested corruption)
    esiConfig: (() => {
      const n = normalizeEsiCredentials(esiConfiguration);
      return {
        clientId: n.clientId || undefined,
        clientSecret: n.clientSecret,
        isConfigured: !!n.clientId,
      };
    })(),
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