import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useKV } from '@/lib/kv';
import { toast } from 'sonner';
import { LMeveUser, UserRole, CorporationConfig } from './types';
import { createUserWithRole, isSessionValid, refreshUserSession } from './roles';
import { getESIAuthService, initializeESIAuth } from './esi-auth';

interface AuthContextType {
  // Current user state
  user: LMeveUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Authentication methods
  loginWithCredentials: (username: string, password: string) => Promise<void>;
  loginWithESI: () => Promise<string>;
  handleESICallback: (code: string, state: string) => Promise<LMeveUser>;
  logout: () => void;
  
  // Token management
  refreshUserToken: () => Promise<void>;
  isTokenExpired: () => boolean;
  
  // User management
  createManualUser: (username: string, password: string, role: UserRole) => Promise<LMeveUser>;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  getAllUsers: () => LMeveUser[];
  
  // Configuration
  esiConfig: { clientId?: string; clientSecret?: string; isConfigured: boolean };
  updateESIConfig: (clientId: string, clientSecret?: string) => void;
  
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
  
  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [authTrigger, setAuthTrigger] = useState(0);

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

  // Initialize ESI service when configuration changes
  useEffect(() => {
    if (esiConfiguration.clientId) {
      try {
        initializeESIAuth(esiConfiguration.clientId, esiConfiguration.clientSecret);
        console.log('✅ ESI Auth initialized with configuration');
      } catch (error) {
        console.error('❌ Failed to initialize ESI Auth:', error);
      }
    }
  }, [esiConfiguration]);

  // Session validation
  useEffect(() => {
    if (currentUser && !isSessionValid(currentUser)) {
      console.log('⚠️ User session expired');
      setCurrentUser(null);
      toast.info('Session expired. Please sign in again.');
    }
  }, [currentUser, setCurrentUser]);

  // Trigger auth state changes
  const triggerAuthChange = useCallback(() => {
    setAuthTrigger(prev => prev + 1);
  }, []);

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
  const loginWithESI = useCallback(async () => {
    console.log('🚀 Starting ESI login');
    
    if (!esiConfiguration.clientId) {
      throw new Error('ESI is not configured');
    }
    
    try {
      const esiService = getESIAuthService();
      const url = await esiService.initiateLogin();
      return url;
    } catch (error) {
      console.error('❌ ESI login initiation failed:', error);
      throw error;
    }
  }, [esiConfiguration]);

  // Handle ESI callback
  const handleESICallback = useCallback(async (code: string, state: string): Promise<LMeveUser> => {
    console.log('🔄 Processing ESI callback');
    setIsLoading(true);
    
    try {
      const esiService = getESIAuthService();
      const esiUser = await esiService.handleCallback(code, state);
      
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
        
        // Update in users list
        setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
        setCurrentUser(updatedUser);
        
        console.log('✅ Manual login replaced with ESI login');
        triggerAuthChange();
        return updatedUser;
      } else {
        // New ESI login
        const existingUser = users.find(u => u.characterId === esiUser.characterId);
        
        if (existingUser) {
          // Update existing ESI user
          const updatedUser = refreshUserSession({
            ...existingUser,
            ...esiUser,
            id: existingUser.id,
            createdDate: existingUser.createdDate
          });
          
          setUsers(prev => prev.map(u => u.id === existingUser.id ? updatedUser : u));
          setCurrentUser(updatedUser);
          
          console.log('✅ Existing ESI user updated');
          triggerAuthChange();
          return updatedUser;
        } else {
          // Create new ESI user
          setUsers(prev => [...prev, esiUser]);
          setCurrentUser(esiUser);
          
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
  }, [currentUser, users, setUsers, setCurrentUser, triggerAuthChange]);

  // Logout
  const logout = useCallback(async () => {
    console.log('🚪 Logging out user');
    
    if (currentUser?.accessToken) {
      // Revoke ESI token if present
      try {
        const esiService = getESIAuthService();
        await esiService.revokeToken(currentUser.accessToken);
      } catch (error) {
        console.warn('Failed to revoke ESI token:', error);
      }
    }
    
    setCurrentUser(null);
    triggerAuthChange();
    
    console.log('✅ User logged out');
  }, [currentUser, setCurrentUser, triggerAuthChange]);

  // Refresh ESI token
  const refreshUserToken = useCallback(async () => {
    if (!currentUser || !currentUser.refreshToken || currentUser.authMethod !== 'esi') {
      return;
    }
    
    console.log('🔄 Refreshing user token');
    
    try {
      const esiService = getESIAuthService();
      const tokenResponse = await esiService.refreshToken(currentUser.refreshToken);
      
      const updatedUser = refreshUserSession({
        ...currentUser,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || currentUser.refreshToken,
        tokenExpiry: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      });
      
      setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
      setCurrentUser(updatedUser);
      
      console.log('✅ Token refreshed successfully');
      triggerAuthChange();
      
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      // If refresh fails, log out the user
      logout();
    }
  }, [currentUser, setUsers, setCurrentUser, logout, triggerAuthChange]);

  // Check if token is expired
  const isTokenExpired = useCallback(() => {
    if (!currentUser || currentUser.authMethod !== 'esi' || !currentUser.tokenExpiry) {
      return false;
    }
    
    const expiryTime = new Date(currentUser.tokenExpiry).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    return expiryTime - now < fiveMinutes;
  }, [currentUser]);

  // Create manual user
  const createManualUser = useCallback(async (username: string, password: string, role: UserRole): Promise<LMeveUser> => {
    console.log('👤 Creating manual user:', username);
    
    // Check if username already exists
    if (users.some(u => u.username === username)) {
      throw new Error('Username already exists');
    }
    
    if (userCredentials[username]) {
      throw new Error('Username already exists');
    }
    
    const user = createUserWithRole({
      username,
      characterName: username,
      authMethod: 'manual',
      createdBy: currentUser?.id
    }, role);
    
    setUsers(prev => [...prev, user]);
    setUserCredentials(prev => ({ ...prev, [username]: password }));
    
    console.log('✅ Manual user created:', username);
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

  // Update ESI configuration
  const updateESIConfig = useCallback((clientId: string, clientSecret?: string) => {
    console.log('🔧 Updating ESI configuration');
    
    const newConfig = { clientId, clientSecret };
    setESIConfiguration(newConfig);
    
    // Initialize ESI service with new config
    try {
      initializeESIAuth(clientId, clientSecret);
      console.log('✅ ESI configuration updated');
    } catch (error) {
      console.error('❌ Failed to update ESI configuration:', error);
      throw error;
    }
  }, [setESIConfiguration]);

  const contextValue: AuthContextType = {
    // Current user state
    user: currentUser,
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
    deleteUser,
    getAllUsers,
    
    // Configuration
    esiConfig: {
      clientId: esiConfiguration.clientId,
      clientSecret: esiConfiguration.clientSecret,
      isConfigured: !!esiConfiguration.clientId
    },
    updateESIConfig,
    
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