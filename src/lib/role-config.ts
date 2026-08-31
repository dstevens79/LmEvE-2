// Client service for the data-driven role config endpoints.
//   /api/lmeve/role-definitions.php    roles as data (per-corp + global built-ins)
//   /api/lmeve/permission-mappings.php EVE role / corp title -> site role rules
//   /api/lmeve/resolve-role.php        resolve a character's effective site role
//   /api/lmeve/users.php               user list + role assignment (server-persisted)

import { RolePermissions, RoleDefinition, PermissionMapping } from './types';

const API_BASE = '/api/lmeve';

export interface RoleConfigError extends Error {}

async function request<T>(path: string, opts?: { method?: string; body?: unknown }): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: opts?.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const json = await resp.json().catch(() => null);
  if (!resp.ok || !json || json.ok !== true) {
    const message = (json && (json.error || json.message)) || `${path} failed (HTTP ${resp.status})`;
    throw new Error(message);
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

export interface FetchRolesResponse {
  corporationId: number | null;
  permissionKeys: string[];
  roles: RoleDefinition[];
}

export function fetchRoleDefinitions(corporationId?: number): Promise<FetchRolesResponse> {
  const q = corporationId && corporationId > 0 ? `?corporationId=${encodeURIComponent(String(corporationId))}` : '';
  return request<FetchRolesResponse>(`/role-definitions.php${q}`);
}

export interface SaveRoleInput {
  /** Omit or pass null for the global (site-wide) set; a corporation id creates/updates a corp override. */
  corporationId?: number | null;
  roleKey: string;
  name: string;
  permissions?: Partial<RolePermissions>;
}

export function saveRoleDefinition(input: SaveRoleInput): Promise<{ ok: boolean }> {
  return request('/role-definitions.php', { method: 'POST', body: input });
}

/** Delete a corp-specific definition row (restores the global default for that key). */
export function deleteCorpRole(corporationId: number, roleKey: string): Promise<{ ok: boolean }> {
  return request('/role-definitions.php', { method: 'POST', body: { action: 'delete', corporationId, roleKey } });
}

/** Delete a global custom role (site admin only; built-ins are undeletable). */
export function deleteGlobalRole(roleKey: string): Promise<{ ok: boolean }> {
  return request('/role-definitions.php', { method: 'POST', body: { action: 'delete', corporationId: null, roleKey } });
}

// ---------------------------------------------------------------------------
// Permission mappings (EVE roles + corp titles -> site role)
// ---------------------------------------------------------------------------

export interface FetchMappingsResponse {
  corporationId: number | null;
  siteRoleKeys: string[];
  rules: PermissionMapping[];
}

export function fetchPermissionMappings(corporationId?: number): Promise<FetchMappingsResponse> {
  const q = corporationId && corporationId > 0 ? `?corporationId=${encodeURIComponent(String(corporationId))}` : '';
  return request<FetchMappingsResponse>(`/permission-mappings.php${q}`);
}

export interface SaveMappingInput {
  corporationId?: number | null;
  kind: 'eve_role' | 'title';
  sourceName: string;
  siteRoleKey: string;
  priority?: number;
}

export function savePermissionMapping(input: SaveMappingInput): Promise<{ ok: boolean }> {
  return request('/permission-mappings.php', { method: 'POST', body: input });
}

/** Delete a corp-specific rule (falls back to the global rule for that source, if any). */
export function deleteCorpMapping(corporationId: number, kind: 'eve_role' | 'title', sourceName: string): Promise<{ ok: boolean }> {
  return request('/permission-mappings.php', { method: 'POST', body: { action: 'delete', corporationId, kind, sourceName } });
}

export function deleteGlobalMapping(kind: 'eve_role' | 'title', sourceName: string): Promise<{ ok: boolean }> {
  return request('/permission-mappings.php', { method: 'POST', body: { action: 'delete', corporationId: null, kind, sourceName } });
}

// ---------------------------------------------------------------------------
// Role resolution (preview for a character's EVE roles + titles)
// ---------------------------------------------------------------------------

export interface ResolveRoleResponse {
  corporationId: number;
  roleKey: string;
  reason: string;
  matched: Array<Partial<PermissionMapping>>;
}

export function resolveSiteRole(corporationId: number, eveRoles: string[], titles: string[]): Promise<ResolveRoleResponse> {
  return request('/resolve-role.php', { method: 'POST', body: { corporationId, eveRoles, titles } });
}

// ---------------------------------------------------------------------------
// Users (server-persisted list + role assignment)
// ---------------------------------------------------------------------------

export interface ServerUserRow {
  id: number | string;
  username?: string | null;
  characterName?: string | null;
  authMethod: 'manual' | 'esi';
  role: string;
  corporationId?: number | null;
  corporationName?: string | null;
  isActive: boolean;
}

export function fetchServerUsers(corporationId?: number): Promise<{ ok: boolean; users: ServerUserRow[] }> {
  const q = corporationId && corporationId > 0 ? `?corporationId=${encodeURIComponent(String(corporationId))}` : '';
  return request(`/users.php${q}`);
}

export function assignUserRole(userId: number | string, role: string): Promise<{ ok: boolean }> {
  return request('/users.php', { method: 'POST', body: { action: 'set-role', userId, role } });
}

export function setUserActive(userId: number | string, isActive: boolean): Promise<{ ok: boolean }> {
  return request('/users.php', { method: 'POST', body: { action: 'set-active', userId, isActive } });
}
