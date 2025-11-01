import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useKV } from '@/lib/kv';
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
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Persistent storage
  const [currentUser, setCurrentUser] = useKV<LMeveUser | null>('lmeve-current-user', null);
  const [users, setUsers] = useKV<LMeveUser[]>('lmeve-users', []);
  const [userCredentials, setUserCredentials] = useKV<Record<string, string>>('lmeve-credentials', {});
  const [esiConfiguration, setESIConfiguration] = useKV<{ clientId?: string; clientSecret?: string }>('lmeve-esi-config', {});
  const [registeredCorporations, setRegisteredCorporations] = useKV<CorporationConfig[]>('lmeve-registered-corps', []);
  const [adminConfig, setAdminConfig] = useKV<{ username: string; password: string }>('admin-config', { username: 'admin', password: '12345' });
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

  // Initialize with default admin user
  useEffect(() => {
    if (users.length === 0) {
      console.log('🔧 Creating default admin user');
      
      const adminUser = createUserWithRole({
        username: 'admin',
        characterName: 'Local Administrator',
        authMethod: 'manual'
      }, 'super_admin');
      
      setUsers([adminUser]);
      setUserCredentials({ admin: '12345' });
      
      console.log('✅ Default admin user created');
    }
  }, [users, setUsers, setUserCredentials]);

  // Initialize ESI service when configuration changes (SPA-only callback)
  useEffect(() => {
    if (esiConfiguration.clientId) {
      try {
        const spaRedirect = `${window.location.origin}/`;
        initializeESIAuth(esiConfiguration.clientId, esiConfiguration.clientSecret, registeredCorporations, spaRedirect);
        console.log('✅ ESI Auth initialized (SPA mode)', { redirectUri: spaRedirect });
      } catch (error) {
        console.error('❌ Failed to initialize ESI Auth:', error);
      }
    }
  }, [esiConfiguration, registeredCorporations]);
  
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
  const loginWithCredentials = useCallback(async (username: string, password: string) => {
    console.log('🔐 Attempting manual login:', username);
    setIsLoading(true);
    
    try {
      // Check credentials
      const storedPassword = userCredentials[username];
      if (!storedPassword || storedPassword !== password) {
        throw new Error('Invalid username or password');
      }
      
      // Find user
      const user = users.find(u => u.username === username);
      if (!user) {
        throw new Error('User not found');
      }
      
      if (!user.isActive) {
        throw new Error('User account is disabled');
      }
      
      // Refresh session
      const refreshedUser = refreshUserSession(user);
      
      // Update user in storage
      setUsers(prev => prev.map(u => u.id === user.id ? refreshedUser : u));
      setCurrentUser(refreshedUser);
      
      console.log('✅ Manual login successful:', username);
      triggerAuthChange();
      
    } catch (error) {
      console.error('❌ Manual login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [userCredentials, users, setUsers, setCurrentUser, triggerAuthChange]);

  // ESI SSO login
  const loginWithESI = useCallback(async (scopeType: 'basic' | 'enhanced' | 'corporation' = 'basic', scopesOverride?: string[]) => {
    console.log('🚀 Starting ESI login with scope type:', scopeType);
    
    if (!esiConfiguration.clientId) {
      throw new Error('ESI is not configured');
    }
    
    try {
      // SPA-only redirect to current origin root to keep state in same tab
      const spaRedirect = `${window.location.origin}/`;
      initializeESIAuth(esiConfiguration.clientId, esiConfiguration.clientSecret, registeredCorporations, spaRedirect);
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
      const esiService = getESIAuthService();
    const esiUser = await esiService.handleCallback(code, state, registeredCorporations);

    // Store token in token manager
    const tokenManager = CorporationTokenManager.getInstance();
    await tokenManager.storeToken(esiUser);
      
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
    
    if (userCredentials[username]) {
      throw new Error('Username already exists');
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
    setUserCredentials(prev => ({ ...prev, [username]: password }));
    
    console.log('✅ Manual user created:', username, characterInfo ? `linked to ${characterInfo.characterName}` : 'no character link');
    return user;
  }, [users, userCredentials, currentUser, setUsers, setUserCredentials]);

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
    
    // Remove user and credentials
    setUsers(prev => prev.filter(u => u.id !== userId));
    
    if (userToDelete.username) {
      setUserCredentials(prev => {
        const updated = { ...prev };
        delete updated[userToDelete.username!];
        return updated;
      });
    }
    
    console.log('✅ User deleted');
  }, [users, currentUser, setUsers, setUserCredentials]);

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
      const spaRedirect = `${window.location.origin}/`;
      initializeESIAuth(clientId, clientSecret, registeredCorporations, spaRedirect);
      console.log('✅ ESI configuration updated (SPA mode)');
    } catch (error) {
      console.error('❌ Failed to update ESI configuration:', error);
      throw error;
    }
  }, [registeredCorporations, setESIConfiguration]);

  // Update admin configuration
  const updateAdminConfig = useCallback((config: { username: string; password: string }) => {
    console.log('🔧 Updating admin configuration');
    setAdminConfig(config);
    
    // Update the credentials storage for the admin user
    setUserCredentials(prev => ({
      ...prev,
      [config.username]: config.password
    }));
    
    console.log('✅ Admin configuration updated');
  }, [setAdminConfig, setUserCredentials]);

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
    authTrigger
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