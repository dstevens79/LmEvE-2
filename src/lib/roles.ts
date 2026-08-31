import { UserRole, RoleKey, RolePermissions, LMeveUser } from './types';

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
    canManageSystem: true, // CEOs can manage site settings
    canManageMultipleCorps: false, // but only within their own corp
    canConfigureESI: true,
    canManageDatabase: true, // allow DB settings management
    
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
 * Normalize legacy / alias role strings to a known UserRole.
 */
export function normalizeUserRole(role: unknown): UserRole {
  const raw = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!raw) return 'guest';

  if (
    raw === 'super_admin' ||
    raw === 'superadmin' ||
    raw === 'admin' ||
    raw === 'administrator' ||
    raw === 'root' ||
    raw === 'system_admin' ||
    raw === 'site_admin'
  ) {
    return 'super_admin';
  }
  if (raw === 'corp_admin' || raw === 'corporation_admin' || raw === 'corpadmin') {
    return 'corp_admin';
  }
  if (raw === 'corp_director' || raw === 'director') return 'corp_director';
  if (raw === 'corp_manager' || raw === 'manager') return 'corp_manager';
  if (raw === 'corp_member' || raw === 'member' || raw === 'user') return 'corp_member';
  if (raw === 'guest' || raw === 'public') return 'guest';

  if ((ROLE_DEFINITIONS as Record<string, RolePermissions>)[raw]) {
    return raw as UserRole;
  }
  return 'corp_member';
}

/**
 * Offline bootstrap / local maintenance admin (e.g. admin/12345).
 * These accounts must always have a full free pass — including before DB/ESI exist.
 */
export function isLocalSiteAdmin(user: LMeveUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isActive === false) return false;

  if (user.role === 'super_admin') return true;
  if (user.isAdmin === true) return true;

  const id = String(user.id || '').toLowerCase();
  // Built-in offline admin only — other bootstrap-* accounts keep assigned roles.
  if (id === 'bootstrap-admin') {
    return true;
  }

  if (user.authMethod === 'manual') {
    const uname = String(user.username || user.characterName || '').trim().toLowerCase();
    if (uname === 'admin' || uname === 'administrator' || uname === 'root') {
      return true;
    }
  }

  return false;
}

/**
 * Get permissions for a specific role (never undefined).
 */
export function getRolePermissions(role: UserRole | string): RolePermissions {
  const normalized = normalizeUserRole(role);
  return ROLE_DEFINITIONS[normalized] || ROLE_DEFINITIONS.guest;
}

// Server-resolved role data (custom roles, or edited built-in permission sets) — see role_definitions.
export interface ResolvedRoleData {
  /** Exact role key as stored in the DB (may be a custom key). */
  key?: string;
  /** Display label for the key. */
  name?: string;
  permissions: RolePermissions | null | undefined;
}

const BUILTIN_ROLE_KEYS = new Set<string>(Object.keys(ROLE_DEFINITIONS));

function isServerPermissionSet(perms: unknown): perms is Partial<RolePermissions> {
  if (!perms || typeof perms !== 'object') return false;
  const keys = role_permission_keys();
  for (const k of keys) {
    if (!(k in (perms as Record<string, unknown>))) return false;
  }
  return true;
}

/** The 17 permission flags — mirrors RolePermissions and the server's canonical list. */
export function role_permission_keys(): (keyof RolePermissions)[] {
  return [
    'canManageSystem', 'canManageMultipleCorps', 'canConfigureESI', 'canManageDatabase',
    'canManageCorp', 'canManageUsers', 'canViewFinancials',
    'canManageManufacturing', 'canManageMining', 'canManageAssets',
    'canManageMarket', 'canViewKillmails', 'canManageIncome',
    'canViewAllMembers', 'canEditAllData', 'canExportData', 'canDeleteData',
  ];
}

// In-memory registry of server-resolved role data for the current session, keyed by exact key.
// Populated by fetchRoleDefinitions (role-config.ts) so that permission resolution — which runs in
// pure functions without a DB handle — can honor custom roles and site-edited built-in sets.
const resolvedRoleRegistry = new Map<string, { name: string; permissions: RolePermissions }>();

/** Register server-fetched role definitions for the current corporation scope (or global when corp is null). */
export function registerResolvedRoles(roles: Array<{ key: string; name: string; permissions: RolePermissions }>, _corporationId?: number | null): void {
  if (!Array.isArray(roles)) return;
  for (const r of roles) {
    if (!r || typeof r.key !== 'string' || r.key === '' ) continue;
    resolvedRoleRegistry.set(r.key, { name: String(r.name ?? r.key), permissions: normalizeServerPerms(r.permissions) });
  }
}

/** Forget cached role data (e.g. on logout or scope change). */
export function clearResolvedRoles(): void {
  resolvedRoleRegistry.clear();
}

function normalizeServerPerms(perms: RolePermissions | null | undefined): RolePermissions {
  const out = {} as Record<keyof RolePermissions, boolean>;
  for (const k of role_permission_keys()) out[k] = !!(perms && (perms as unknown as Record<string, unknown>)?.[k]);
  return out as RolePermissions;
}

/** Display label for a role key: server name when known, else built-in label. */
export function getRoleLabel(role: string): string {
  const entry = resolvedRoleRegistry.get(String(role));
  if (entry) return entry.name;
  switch (role) {
    case 'super_admin': return 'Super Admin';
    case 'corp_admin': return 'Corp Admin';
    case 'corp_director': return 'Director';
    case 'corp_manager': return 'Manager';
    case 'corp_member': return 'Member';
    case 'guest': return 'Guest';
    default: return String(role);
  }
}

/**
 * Effective permissions for a role key, preferring server-resolved data.
 * - super_admin is always full (escape hatch).
 * - A registry entry (custom roles + site-edited built-ins) wins over the static table.
 * - Otherwise falls back to ROLE_DEFINITIONS by normalized key (built-ins + offline bootstrap,
 *   where no DB data exists yet).
 */
export function resolveRolePermissions(role: UserRole | string): RolePermissions {
  const rawKey = String(role ?? '').trim();
  if (rawKey === 'super_admin') {
    return normalizeServerPerms({ canManageSystem:true,canManageMultipleCorps:true,canConfigureESI:true,canManageDatabase:true,canManageCorp:true,canManageUsers:true,canViewFinancials:true,canManageManufacturing:true,canManageMining:true,canManageAssets:true,canManageMarket:true,canViewKillmails:true,canManageIncome:true,canViewAllMembers:true,canEditAllData:true,canExportData:true,canDeleteData:true });
  }

  const registered = resolvedRoleRegistry.get(rawKey);
  if (registered) return registered.permissions;

  // Custom key not yet known to the registry: no capabilities rather than guessing.
  if (!BUILTIN_ROLE_KEYS.has(rawKey)) {
    return normalizeServerPerms(null);
  }

  const normalized = normalizeUserRole(role);
  return ROLE_DEFINITIONS[normalized] || ROLE_DEFINITIONS.guest;
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: LMeveUser | null, permission: keyof RolePermissions): boolean {
  if (!user || user.isActive === false) return false;
  if (isLocalSiteAdmin(user)) return true;
  const perms = user.permissions && Object.keys(user.permissions).length > 0 ? user.permissions : resolveRolePermissions(user.role);
  return !!perms[permission];
}

/**
 * Check if a user can access a specific tab
 */
export function canAccessTab(user: LMeveUser | null, tab: string): boolean {
  if (!user || user.isActive === false) {
    // Only dashboard is accessible without authentication
    return tab === 'dashboard';
  }

  // Local/bootstrap site admin: free pass everywhere
  if (isLocalSiteAdmin(user)) {
    return true;
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
      
    case 'killmails':
      return hasPermission(user, 'canViewKillmails');
      
    case 'buyback':
      return hasPermission(user, 'canManageMarket') || hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem');
      
    case 'wallet':
      return hasPermission(user, 'canManageIncome') || hasPermission(user, 'canViewFinancials');
      
    case 'income':
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
  if (!user || user.isActive === false) return false;

  // Local/bootstrap site admin: free pass to every settings panel
  if (isLocalSiteAdmin(user)) {
    return true;
  }
  
  switch (settingsTab) {
    case 'general':
      return hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem');
      
    case 'database':
      return hasPermission(user, 'canManageDatabase');

    // Legacy 'esi' settings tab removed — credentials are under General.
    case 'esi':
    case 'eve':
      return hasPermission(user, 'canConfigureESI')
        || hasPermission(user, 'canManageCorp')
        || hasPermission(user, 'canManageSystem');

    case 'sync':
      return hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem');
      
    case 'sync-monitoring':
      return hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem');
      
    case 'permissions':
      return hasPermission(user, 'canManageUsers') || hasPermission(user, 'canManageSystem');

    case 'notifications':
      return hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem');
      
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
  role: UserRole | string
): LMeveUser {
  const now = new Date().toISOString();
  // Preserve custom (data-defined) role keys verbatim; normalizeUserRole only maps built-ins/aliases.
  let resolvedRole: RoleKey = BUILTIN_ROLE_KEYS.has(String(role)) ? normalizeUserRole(role) : String(role).trim() || 'corp_member';

  // Offline bootstrap / classic local admin always becomes super_admin with full perms
  const provisional: Partial<LMeveUser> = {
    ...userData,
    role: resolvedRole,
    authMethod: userData.authMethod || 'manual',
  };
  if (isLocalSiteAdmin(provisional as LMeveUser) || resolvedRole === 'super_admin') {
    resolvedRole = 'super_admin';
  }

  const permissions = resolveRolePermissions(resolvedRole);
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
    role: resolvedRole,
    permissions,
    accessToken: userData.accessToken,
    refreshToken: userData.refreshToken,
    tokenExpiry: userData.tokenExpiry,
    scopes: userData.scopes || [],
    characterScopes: userData.characterScopes || [],
    corporationScopes: userData.corporationScopes || [],
    // EVE roles and station context
    eveRoles: userData.eveRoles || [],
    eveRolesAtHQ: userData.eveRolesAtHQ || [],
    eveRolesAtBase: userData.eveRolesAtBase || [],
    eveRolesAtOther: userData.eveRolesAtOther || [],
    corpHomeStationId: userData.corpHomeStationId,
    userBaseStationId: userData.userBaseStationId,
    lastLogin: userData.lastLogin || now,
    sessionExpiry:
      userData.sessionExpiry ||
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    isActive: userData.isActive !== false,
    isAdmin:
      resolvedRole === 'super_admin' ||
      userData.isAdmin === true ||
      isLocalSiteAdmin({
        ...(userData as LMeveUser),
        role: resolvedRole,
        authMethod: userData.authMethod || 'manual',
        isActive: true,
      } as LMeveUser),
    canManageESI:
      permissions.canConfigureESI ||
      userData.canManageESI === true,
    roleLabel: (userData as Partial<LMeveUser> & { roleLabel?: string }).roleLabel ?? getRoleLabel(resolvedRole),
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
  if (!user.sessionExpiry) return true; // server cookie is source of truth; missing client expiry is not a logout

  const now = Date.now();
  const sessionExpiry = new Date(user.sessionExpiry).getTime();
  if (Number.isNaN(sessionExpiry)) return true;

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