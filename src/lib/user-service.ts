/**
 * User Management Service
 * Handles user authentication, registration, and management
 * Integrates with both manual login and ESI authentication
 */

import { LMeveUser, UserRole, ESICharacterData, ESIConfig } from './types';
import { localKv } from '@/lib/kv';
import { createUserWithRole, getRolePermissions, getEVERoleMapping, isSessionValid, refreshUserSession } from './roles';

// Password hash utility (simple implementation for demo)
function hashPassword(password: string): string {
  // In production, use bcrypt or similar
  // This is a simple base64 encoding for demo purposes
  return btoa(password + 'salt');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Default users for testing/development
const getDefaultUsers = (): (LMeveUser & { password?: string })[] => [
  {
    id: 'admin',
    username: 'admin',
    characterId: undefined,
    characterName: undefined,
    corporationId: undefined,
    corporationName: undefined,
    authMethod: 'manual',
    role: 'super_admin',
    permissions: getRolePermissions('super_admin'),
    lastLogin: new Date().toISOString(),
    sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
    password: hashPassword('12345'), // Default password
  },
];

// User service interface
export interface UserService {
  // Authentication methods
  loginWithCredentials(username: string, password: string): Promise<LMeveUser>;
  loginWithESI(characterData: ESICharacterData, tokenData: any): Promise<LMeveUser>;
  logout(): Promise<void>;
  refreshToken(): Promise<void>;
  
  // User management
  getUsers(): Promise<LMeveUser[]>;
  getUserById(id: string): Promise<LMeveUser | undefined>;
  getUserByCharacterId(characterId: number): Promise<LMeveUser | undefined>;
  createUser(userData: Partial<LMeveUser> & { password?: string }, role: UserRole): Promise<LMeveUser>;
  updateUser(id: string, updates: Partial<LMeveUser>): Promise<LMeveUser>;
  deleteUser(id: string): Promise<void>;
  setUserRole(id: string, role: UserRole): Promise<LMeveUser>;
  activateUser(id: string): Promise<void>;
  deactivateUser(id: string): Promise<void>;
  
  // Session management
  getCurrentUser(): Promise<LMeveUser | null>;
  isUserAuthenticated(): Promise<boolean>;
  validateSession(): Promise<boolean>;
}

// Create user service with KV storage
export function createUserService(): UserService {
  // Initialize default users if none exist
  const initializeDefaultUsers = async () => {
    const users = await localKv.get<LMeveUser[]>('users') || [];
    if (users.length === 0) {
      const defaultUsers = getDefaultUsers();
      await localKv.set('users', defaultUsers);
      console.log('🔧 Default users initialized');
    }
  };

  // Initialize on first load
  initializeDefaultUsers();

  return {
    // Authentication methods
    async loginWithCredentials(username: string, password: string): Promise<LMeveUser> {
      console.log('👤 User service: Attempting login for:', username);
      
      const users = await localKv.get<LMeveUser[]>('users') || [];
      const user = users.find(u => u.username === username && u.isActive);
      
      if (!user) {
        console.log('❌ User service: User not found or inactive:', username);
        throw new Error('Invalid credentials');
      }

      // Verify password (stored users should have password field)
      const userWithPassword = user as LMeveUser & { password?: string };
      if (!userWithPassword.password || !verifyPassword(password, userWithPassword.password)) {
        console.log('❌ User service: Password verification failed for:', username);
        throw new Error('Invalid credentials');
      }

      // Update last login and refresh session
      const updatedUser = refreshUserSession(user);
      
      // Update user in storage
      const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);
      await localKv.set('users', updatedUsers);
      
      // Store current user session
      await localKv.set('current-user', updatedUser);
      
      console.log('✅ User service: Login successful for:', username);
      return updatedUser;
    },

    async loginWithESI(characterData: ESICharacterData, tokenData: any): Promise<LMeveUser> {
      console.log('👤 User service: Attempting ESI login for character:', characterData.character_name);
      
      const users = await localKv.get<LMeveUser[]>('users') || [];
      let user = users.find(u => u.characterId === characterData.character_id);
      
      if (user) {
        // Update existing user with new token data
        const updatedUser = {
          ...refreshUserSession(user),
          characterName: characterData.character_name,
          corporationId: characterData.corporation_id,
          allianceId: characterData.alliance_id,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          scopes: characterData.scopes,
          authMethod: 'esi' as const,
          updatedDate: new Date().toISOString(),
        };
        
        // Update user in storage
        const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);
        await localKv.set('users', updatedUsers);
        await localKv.set('current-user', updatedUser);
        
        console.log('✅ User service: ESI login successful for existing user:', characterData.character_name);
        return updatedUser;
        
      } else {
        // Create new user from ESI data
        // Determine role based on ESI character roles (if available)
        const role = getEVERoleMapping(characterData.scopes || []);
        
        const newUser = createUserWithRole({
          id: `esi_${characterData.character_id}`,
          characterId: characterData.character_id,
          characterName: characterData.character_name,
          corporationId: characterData.corporation_id,
          allianceId: characterData.alliance_id,
          authMethod: 'esi',
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          scopes: characterData.scopes,
        }, role);
        
        // Add new user to storage
        const updatedUsers = [...users, newUser];
        await localKv.set('users', updatedUsers);
        await localKv.set('current-user', newUser);
        
        console.log('✅ User service: ESI login successful for new user:', characterData.character_name);
        return newUser;
      }
    },

    async logout(): Promise<void> {
      console.log('👤 User service: Logging out user');
      await localKv.delete('current-user');
    },

    async refreshToken(): Promise<void> {
      const currentUser = await localKv.get<LMeveUser>('current-user');
      if (!currentUser) return;

      // Refresh session expiry
      const refreshedUser = refreshUserSession(currentUser);
      
      const users = await localKv.get<LMeveUser[]>('users') || [];
      const updatedUsers = users.map(u => u.id === currentUser.id ? refreshedUser : u);
      
      await localKv.set('users', updatedUsers);
      await localKv.set('current-user', refreshedUser);
    },

    // User management
    async getUsers(): Promise<LMeveUser[]> {
      return await localKv.get<LMeveUser[]>('users') || [];
    },

    async getUserById(id: string): Promise<LMeveUser | undefined> {
      const users = await localKv.get<LMeveUser[]>('users') || [];
      return users.find(u => u.id === id);
    },

    async getUserByCharacterId(characterId: number): Promise<LMeveUser | undefined> {
      const users = await localKv.get<LMeveUser[]>('users') || [];
      return users.find(u => u.characterId === characterId);
    },

    async createUser(userData: Partial<LMeveUser> & { password?: string }, role: UserRole): Promise<LMeveUser> {
      const users = await localKv.get<LMeveUser[]>('users') || [];
      
      // Check for duplicates
      if (userData.username && users.some(u => u.username === userData.username)) {
        throw new Error('Username already exists');
      }
      if (userData.characterId && users.some(u => u.characterId === userData.characterId)) {
        throw new Error('Character already registered');
      }
      
      const newUser = createUserWithRole(userData, role);
      
      // Hash password if provided
      if (userData.username && userData.password) {
        (newUser as any).password = hashPassword(userData.password);
      }
      
      const updatedUsers = [...users, newUser];
      await localKv.set('users', updatedUsers);
      
      return newUser;
    },

    async updateUser(id: string, updates: Partial<LMeveUser>): Promise<LMeveUser> {
      const users = await localKv.get<LMeveUser[]>('users') || [];
      const userIndex = users.findIndex(u => u.id === id);
      
      if (userIndex === -1) {
        throw new Error('User not found');
      }
      
      const updatedUser = {
        ...users[userIndex],
        ...updates,
        updatedDate: new Date().toISOString(),
      };
      
      // Update permissions if role changed
      if (updates.role) {
        updatedUser.permissions = getRolePermissions(updates.role);
      }
      
      users[userIndex] = updatedUser;
      await localKv.set('users', users);
      
      // Update current user session if this is the current user
      const currentUser = await localKv.get<LMeveUser>('current-user');
      if (currentUser && currentUser.id === id) {
        await localKv.set('current-user', updatedUser);
      }
      
      return updatedUser;
    },

    async deleteUser(id: string): Promise<void> {
      const users = await localKv.get<LMeveUser[]>('users') || [];
      const updatedUsers = users.filter(u => u.id !== id);
      await localKv.set('users', updatedUsers);
      
      // Log out user if they're currently logged in
      const currentUser = await localKv.get<LMeveUser>('current-user');
      if (currentUser && currentUser.id === id) {
        await localKv.delete('current-user');
      }
    },

    async setUserRole(id: string, role: UserRole): Promise<LMeveUser> {
      return this.updateUser(id, { 
        role, 
        permissions: getRolePermissions(role) 
      });
    },

    async activateUser(id: string): Promise<void> {
      await this.updateUser(id, { isActive: true });
    },

    async deactivateUser(id: string): Promise<void> {
      await this.updateUser(id, { isActive: false });
    },

    // Session management
    async getCurrentUser(): Promise<LMeveUser | null> {
      const user = await localKv.get<LMeveUser>('current-user');
      if (!user) return null;
      
      // Check if session is still valid
      if (!isSessionValid(user)) {
        await localKv.delete('current-user');
        return null;
      }
      
      return user;
    },

    async isUserAuthenticated(): Promise<boolean> {
      const user = await this.getCurrentUser();
      return !!user;
    },

    async validateSession(): Promise<boolean> {
      const user = await localKv.get<LMeveUser>('current-user');
      return user ? isSessionValid(user) : false;
    },
  };
}

// Global user service instance
export const userService = createUserService();