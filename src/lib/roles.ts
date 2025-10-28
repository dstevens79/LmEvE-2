import { UserRole, RolePermissions, LMeveUser } from './types';

/**
 * Role-based access control system for LMeve
 * Defines permissions for different user roles
 */

export const ROLE_DEFINITIONS: Record<UserRole, RolePermissions> = {
  super_admin: {
    // System permissions
    canManageSystem: true,
    canManageMultipleCorps: true,
    canConfigureESI: true,
    canManageDatabase: true,
    
    // Corporation permissions
    canManageCorp: true,
    canManageUsers: true,
    canViewFinancials: true,
    canManageManufacturing: true,
    canManageMining: true,
    canManageAssets: true,
    canManageMarket: true,
    canViewKillmails: true,
    canManageIncome: true,
    
    // Data permissions
    canViewAllMembers: true,
    canEditAllData: true,
    canExportData: true,
    canDeleteData: true,
  },
  
  corp_admin: {
    // System permissions
    canManageSystem: false,
    canManageMultipleCorps: false,
    canConfigureESI: true,
    canManageDatabase: false,
    
    // Corporation permissions
    canManageCorp: true,
    canManageUsers: true,
    canViewFinancials: true,
    canManageManufacturing: true,
    canManageMining: true,
    canManageAssets: true,
    canManageMarket: true,
    canViewKillmails: true,
    canManageIncome: true,
    
    // Data permissions
    canViewAllMembers: true,
    canEditAllData: true,
    canExportData: true,
    canDeleteData: false,
  },
  
  corp_director: {
    // System permissions
    canManageSystem: false,
    canManageMultipleCorps: false,
    canConfigureESI: false,
    canManageDatabase: false,
    
    // Corporation permissions
    canManageCorp: false,
    canManageUsers: false,
    canViewFinancials: true,
    canManageManufacturing: true,
    canManageMining: true,
    canManageAssets: true,
    canManageMarket: true,
    canViewKillmails: true,
    canManageIncome: true,
    
    // Data permissions
    canViewAllMembers: true,
    canEditAllData: true,
    canExportData: true,
    canDeleteData: false,
  },
  
  corp_manager: {
    // System permissions
    canManageSystem: false,
    canManageMultipleCorps: false,
    canConfigureESI: false,
    canManageDatabase: false,
    
    // Corporation permissions
    canManageCorp: false,
    canManageUsers: false,
    canViewFinancials: false,
    canManageManufacturing: true,
    canManageMining: true,
    canManageAssets: false,
    canManageMarket: true,
    canViewKillmails: true,
    canManageIncome: false,
    
    // Data permissions
    canViewAllMembers: true,
    canEditAllData: false,
    canExportData: false,
    canDeleteData: false,
  },
  
  corp_member: {
    // System permissions
    canManageSystem: false,
    canManageMultipleCorps: false,
    canConfigureESI: false,
    canManageDatabase: false,
    
    // Corporation permissions
    canManageCorp: false,
    canManageUsers: false,
    canViewFinancials: false,
    canManageManufacturing: false,
    canManageMining: false,
    canManageAssets: false,
    canManageMarket: false,
    canViewKillmails: true,
    canManageIncome: false,
    
    // Data permissions
    canViewAllMembers: false,
    canEditAllData: false,
    canExportData: false,
    canDeleteData: false,
  },
  
  guest: {
    // System permissions
    canManageSystem: false,
    canManageMultipleCorps: false,
    canConfigureESI: false,
    canManageDatabase: false,
    
    // Corporation permissions
    canManageCorp: false,
    canManageUsers: false,
    canViewFinancials: false,
    canManageManufacturing: false,
    canManageMining: false,
    canManageAssets: false,
    canManageMarket: false,
    canViewKillmails: false,
    canManageIncome: false,
    
    // Data permissions
    canViewAllMembers: false,
    canEditAllData: false,
    canExportData: false,
    canDeleteData: false,
  },
};

/**
 * Get permissions for a specific role
 */
export function getRolePermissions(role: UserRole): RolePermissions {
  return ROLE_DEFINITIONS[role];
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: LMeveUser | null, permission: keyof RolePermissions): boolean {
  if (!user || !user.isActive) return false;
  return user.permissions[permission] || false;
}

/**
 * Check if a user can access a specific tab
 */
export function canAccessTab(user: LMeveUser | null, tab: string): boolean {
  if (!user || !user.isActive) {
    // Only dashboard is accessible without authentication
    return tab === 'dashboard';
  }
  
  switch (tab) {
    case 'dashboard':
      return true; // Always accessible when authenticated
      
    case 'members':
      return hasPermission(user, 'canViewAllMembers');
      
    case 'assets':
      return hasPermission(user, 'canManageAssets');
      
    case 'manufacturing':
      return hasPermission(user, 'canManageManufacturing');
      
    case 'planetary':
      return hasPermission(user, 'canManageManufacturing') || hasPermission(user, 'canManageMining'); // PI can be managed by manufacturing or mining managers
      
    case 'market':
      return hasPermission(user, 'canManageMarket');
      
    case 'buyback':
      return hasPermission(user, 'canManageMarket') || hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem');
      
    case 'wallet':
      return hasPermission(user, 'canManageIncome') || hasPermission(user, 'canViewFinancials');
      
    case 'notifications':
      return hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem');
      
    case 'corporations':
      return hasPermission(user, 'canManageSystem') || hasPermission(user, 'canConfigureESI');
      
    case 'theme':
      return true; // Theme customization available to all authenticated users
      
    case 'settings':
      return hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem');
      
    default:
      return false;
  }
}

/**
 * Check if a user can access a specific settings tab
 */
export function canAccessSettingsTab(user: LMeveUser | null, settingsTab: string): boolean {
  if (!user || !user.isActive) return false;
  
  switch (settingsTab) {
    case 'general':
      return hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem');
      
    case 'database':
      return hasPermission(user, 'canManageDatabase');
      
    case 'sync':
      return hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem');
      
    case 'sync-monitoring':
      return hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem');
      
    case 'permissions':
      return hasPermission(user, 'canManageUsers') || hasPermission(user, 'canManageSystem');
      
    default:
      return false;
  }
}

/**
 * Get the highest role from EVE corporation roles
 */
export function getEVERoleMapping(eveRoles: string[]): UserRole {
  // Normalize roles for comparison
  const normalizedRoles = eveRoles.map(role => role.toLowerCase());
  
  // Check for CEO role first (highest priority)
  if (normalizedRoles.includes('ceo') || 
      normalizedRoles.includes('chief_executive_officer')) {
    return 'corp_admin';
  }
  
  // Check for director roles (second highest)
  if (normalizedRoles.some(role => 
    role.includes('director') || 
    role === 'personnel_manager' ||
    role === 'security_officer' ||
    role === 'communications_officer'
  )) {
    return 'corp_director';
  }
  
  // Check for specific manager roles that indicate corp management permissions
  if (normalizedRoles.some(role => 
    role === 'factory_manager' ||
    role === 'station_manager' ||
    role === 'accountant' ||
    role === 'junior_accountant' ||
    role === 'trader' ||
    role === 'config_equipment' ||
    role === 'config_starbase_equipment' ||
    role === 'container_can_take' ||
    role === 'hangar_can_take1' ||
    role === 'hangar_can_take2' ||
    role === 'hangar_can_take3' ||
    role === 'hangar_can_take4' ||
    role === 'hangar_can_take5' ||
    role === 'hangar_can_take6' ||
    role === 'hangar_can_take7'
  )) {
    return 'corp_manager';
  }
  
  // Check for limited access roles
  if (normalizedRoles.some(role => 
    role === 'hangar_can_query1' ||
    role === 'hangar_can_query2' ||
    role === 'hangar_can_query3' ||
    role === 'hangar_can_query4' ||
    role === 'hangar_can_query5' ||
    role === 'hangar_can_query6' ||
    role === 'hangar_can_query7' ||
    role === 'account_can_query1' ||
    role === 'account_can_query2' ||
    role === 'account_can_query3' ||
    role === 'account_can_query4' ||
    role === 'account_can_query5' ||
    role === 'account_can_query6' ||
    role === 'account_can_query7'
  )) {
    return 'corp_member';
  }
  
  // Default to member role for any authenticated corp member
  return 'corp_member';
}

/**
 * Create a user with appropriate permissions
 */
export function createUserWithRole(
  userData: Partial<LMeveUser>,
  role: UserRole
): LMeveUser {
  const now = new Date().toISOString();
  
  return {
    id: userData.id || `user_${Date.now()}`,
    username: userData.username,
    characterId: userData.characterId,
    characterName: userData.characterName,
    corporationId: userData.corporationId,
    corporationName: userData.corporationName,
    allianceId: userData.allianceId,
    allianceName: userData.allianceName,
    authMethod: userData.authMethod || 'manual',
    role,
    permissions: getRolePermissions(role),
    accessToken: userData.accessToken,
    refreshToken: userData.refreshToken,
    tokenExpiry: userData.tokenExpiry,
    scopes: userData.scopes || [],
    lastLogin: now,
    sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    isActive: true,
    createdDate: userData.createdDate || now,
    createdBy: userData.createdBy,
    updatedDate: now,
    updatedBy: userData.updatedBy,
  };
}

/**
 * Check if a user's session is valid
 */
export function isSessionValid(user: LMeveUser): boolean {
  if (!user.isActive) return false;
  
  const now = Date.now();
  const sessionExpiry = new Date(user.sessionExpiry).getTime();
  
  return now < sessionExpiry;
}

/**
 * Refresh user session
 */
export function refreshUserSession(user: LMeveUser): LMeveUser {
  const now = new Date().toISOString();
  
  return {
    ...user,
    lastLogin: now,
    sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    updatedDate: now,
  };
}