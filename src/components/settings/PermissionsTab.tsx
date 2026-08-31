import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield, Users, Crown, Star, Factory, HardHat, TrendUp, CurrencyDollar, Package, Eye, Warning, Info, CheckCircle, Plus, Trash, ArrowsLeftRight, Gear, Building, MagnifyingGlass, Crosshair, Receipt, UserPlus
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-provider';
import { RolePermissions, RoleDefinition, PermissionMapping } from '@/lib/types';
import { getRoleLabel, isLocalSiteAdmin, getRolePermissions } from '@/lib/roles';
import {
  fetchRoleDefinitions, saveRoleDefinition, deleteCorpRole, deleteGlobalRole,
  fetchPermissionMappings, savePermissionMapping, deleteCorpMapping, deleteGlobalMapping,
  fetchServerUsers, assignUserRole, setUserActive, ServerUserRow,
} from '@/lib/role-config';
import { toast } from 'sonner';

interface PermissionsTabProps {
  isMobileView?: boolean;
}

type PanelId = 'roles' | 'mappings' | 'users';
type Scope = 'global' | 'corp';

const PERMISSION_META: Record<string, { label: string; icon: React.ElementType }> = {
  canManageSystem: { label: 'System Management', icon: Shield },
  canManageMultipleCorps: { label: 'Multi-Corp Access', icon: Building },
  canConfigureESI: { label: 'ESI Configuration', icon: Gear },
  canManageDatabase: { label: 'Database Management', icon: Package },
  canManageCorp: { label: 'Corporation Management', icon: Building },
  canManageUsers: { label: 'User Management', icon: Users },
  canViewFinancials: { label: 'View Financials', icon: CurrencyDollar },
  canManageManufacturing: { label: 'Manage Manufacturing', icon: Factory },
  canManageMining: { label: 'Manage Mining', icon: HardHat },
  canManageAssets: { label: 'Manage Assets', icon: Package },
  canManageMarket: { label: 'Manage Market', icon: TrendUp },
  canViewKillmails: { label: 'View Killmails', icon: Crosshair },
  canManageIncome: { label: 'Manage Income', icon: Receipt },
  canViewAllMembers: { label: 'View All Members', icon: Users },
  canEditAllData: { label: 'Edit All Data', icon: Eye },
  canExportData: { label: 'Export Data', icon: Package },
  canDeleteData: { label: 'Delete Data', icon: Warning },
};

const ESI_ROLE_NAMES = [
  'ceo', 'director', 'factory_manager', 'station_manager', 'trader', 'accountant',
  'junior_accountant', 'config_equipment', 'security_officer', 'communications_officer',
  'personnel_manager', 'container_can_take',
  'hangar_can_take1', 'hangar_can_take2', 'hangar_can_take3', 'hangar_can_take4',
  'hangar_can_take5', 'hangar_can_take6', 'hangar_can_take7',
  'hangar_can_query1', 'hangar_can_query2', 'hangar_can_query3', 'hangar_can_query4',
  'hangar_can_query5', 'hangar_can_query6', 'hangar_can_query7',
  'account_can_query1', 'account_can_query2', 'account_can_query3', 'account_can_query4',
  'account_can_query5', 'account_can_query6', 'account_can_query7',
];

function roleKeyFromName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64);
}

export function PermissionsTab({ isMobileView }: PermissionsTabProps) {
  const { user: currentUser, hydrateSessionFromServer } = useAuth();
  const siteAdmin = !!(currentUser && (isLocalSiteAdmin(currentUser) || currentUser.role === 'super_admin'));
  const corpId: number | null = currentUser?.corporationId ?? null;

  const [panel, setPanel] = useState<PanelId>('roles');
  const [scope, setScope] = useState<Scope>(corpId ? 'corp' : 'global');

  // Role definitions state
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [permissionKeys, setPermissionKeys] = useState<string[]>(Object.keys(PERMISSION_META));
  const [roleDraft, setRoleDraft] = useState<{ key: string; name: string; permissions: Record<string, boolean>; isBuiltin: boolean } | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Mappings state
  const [rules, setRules] = useState<PermissionMapping[]>([]);
  const [siteRoleKeys, setSiteRoleKeys] = useState<string[]>([]);
  const [ruleKind, setRuleKind] = useState<'eve_role' | 'title'>('eve_role');
  const [ruleSource, setRuleSource] = useState('');
  const [ruleTarget, setRuleTarget] = useState('corp_member');
  const [rulePriority, setRulePriority] = useState(0);

  // Users state
  const [users, setUsers] = useState<ServerUserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const scopeCorpId = scope === 'corp' && corpId ? corpId : null;

  const refreshRoles = useCallback(async () => {
    try {
      const res = await fetchRoleDefinitions(scopeCorpId ?? undefined);
      setRoles(res.roles || []);
      if (Array.isArray(res.permissionKeys) && res.permissionKeys.length > 0) setPermissionKeys(res.permissionKeys);
      setLoadError(null);
    } catch (e: any) {
      console.error('Failed to load role definitions:', e);
      setLoadError(e?.message || 'Failed to load roles');
    }
  }, [scopeCorpId]);

  const refreshMappings = useCallback(async () => {
    try {
      const res = await fetchPermissionMappings(scopeCorpId ?? undefined);
      setRules(res.rules || []);
      if (Array.isArray(res.siteRoleKeys)) setSiteRoleKeys(res.siteRoleKeys);
    } catch (e: any) {
      console.error('Failed to load mappings:', e);
      toast.error(e?.message || 'Failed to load mapping rules');
    }
  }, [scopeCorpId]);

  const refreshUsers = useCallback(async () => {
    try {
      const res = await fetchServerUsers(scope === 'corp' && corpId ? corpId : (siteAdmin ? undefined : corpId ?? undefined));
      setUsers(res.users || []);
    } catch (e: any) {
      console.error('Failed to load users:', e);
      toast.error(e?.message || 'Failed to load users');
    }
  }, [scope, corpId, siteAdmin]);

  useEffect(() => {
    if (panel !== 'roles' && panel !== 'mappings') return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      await Promise.all([refreshRoles(), refreshMappings()]);
      if (!cancelled) setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [panel, scopeCorpId, refreshRoles, refreshMappings]);

  useEffect(() => {
    if (panel !== 'users') return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      await refreshUsers();
      if (!cancelled) setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [panel, scopeCorpId, refreshUsers]);

  const effectiveScope: Scope = scope === 'corp' && !corpId ? 'global' : scope;
  const canEditScope = effectiveScope === 'global' ? siteAdmin : true;

  // -------------------------------------------------------------------------
  // Roles panel actions
  // -------------------------------------------------------------------------
  const selectRole = (r: RoleDefinition) => {
    const perms: Record<string, boolean> = {};
    for (const k of permissionKeys.length > 0 ? permissionKeys : Object.keys(PERMISSION_META)) {
      perms[k] = !!(r.permissions as any)?.[k];
    }
    setRoleDraft({ key: r.key, name: r.name, permissions: perms, isBuiltin: r.isBuiltin });
  };

  const handleSaveRole = async () => {
    if (!roleDraft) return;
    try {
      setBusy(true);
      await saveRoleDefinition({
        corporationId: scopeCorpId,
        roleKey: roleDraft.key,
        name: roleDraft.name || roleDraft.key,
        permissions: roleDraft.permissions as Partial<RolePermissions>,
      });
      toast.success(`Saved role "${roleDraft.name}"`);
      await refreshRoles();
      if (currentUser?.role === roleDraft.key) void hydrateSessionFromServer?.();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save role');
    } finally {
      setBusy(false);
    }
  };

  const handleResetRole = async () => {
    if (!roleDraft) return;
    try {
      setBusy(true);
      await saveRoleDefinition({
        corporationId: scopeCorpId,
        roleKey: roleDraft.key,
        name: roleDraft.name,
        permissions: getRolePermissions(roleDraft.key),
      });
      toast.success(`Reset "${roleDraft.name}" to defaults`);
      await refreshRoles();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reset role');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!roleDraft) return;
    try {
      setBusy(true);
      if (effectiveScope === 'corp' && corpId) {
        await deleteCorpRole(corpId, roleDraft.key);
        toast.success(`Removed corp override for "${roleDraft.name}"`);
      } else if (!roleDraft.isBuiltin) {
        await deleteGlobalRole(roleDraft.key);
        toast.success(`Deleted role "${roleDraft.name}"`);
      } else {
        toast.error('Built-in roles cannot be deleted. Use Reset to Defaults.');
        return;
      }
      setRoleDraft(null);
      await refreshRoles();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete role');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRole = async () => {
    const key = roleKeyFromName(newRoleName);
    if (!key || key.length < 2) {
      toast.error('Enter a name with at least two characters');
      return;
    }
    try {
      setBusy(true);
      await saveRoleDefinition({
        corporationId: scopeCorpId,
        roleKey: key,
        name: newRoleName.trim(),
        permissions: Object.fromEntries((permissionKeys.length > 0 ? permissionKeys : []).map(k => [k, false])) as Partial<RolePermissions>,
      });
      toast.success(`Created custom role "${newRoleName.trim()}"`);
      setNewRoleName('');
      await refreshRoles();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create role');
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Mappings panel actions
  // -------------------------------------------------------------------------
  const handleSaveRule = async () => {
    if (!ruleSource.trim() || !ruleTarget) return;
    try {
      setBusy(true);
      await savePermissionMapping({
        corporationId: scopeCorpId,
        kind: ruleKind,
        sourceName: ruleSource.trim(),
        siteRoleKey: ruleTarget,
        priority: rulePriority,
      });
      toast.success(`Rule saved: ${ruleSource.trim()} -> ${getRoleLabel(ruleTarget)}`);
      setRuleSource('');
      await refreshMappings();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save rule');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRule = async (r: PermissionMapping) => {
    try {
      setBusy(true);
      if ((scopeCorpId ?? null) === r.corporationId && scopeCorpId !== null) {
        await deleteCorpMapping(scopeCorpId, r.kind, r.sourceName);
      } else if (effectiveScope === 'global' && siteAdmin) {
        await deleteGlobalMapping(r.kind, r.sourceName);
      } else {
        toast.error('This rule belongs to the other scope.');
        return;
      }
      toast.success(`Deleted rule for "${r.sourceName}"`);
      await refreshMappings();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete rule');
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Users panel actions
  // -------------------------------------------------------------------------
  const handleRoleAssign = async (u: ServerUserRow, role: string) => {
    try {
      setBusy(true);
      await assignUserRole(u.id, role);
      toast.success(`Role updated for ${u.characterName || u.username}`);
      if (currentUser?.id === String(u.id)) void hydrateSessionFromServer?.();
      await refreshUsers();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update role');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (u: ServerUserRow, active: boolean) => {
    try {
      setBusy(true);
      await setUserActive(u.id, active);
      toast.success(`${u.characterName || u.username} ${active ? 'enabled' : 'disabled'}`);
      if (currentUser?.id === String(u.id)) void hydrateSessionFromServer?.();
      await refreshUsers();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update account state');
    } finally {
      setBusy(false);
    }
  };

  const roleOptions = useMemo(() => roles, [roles]);
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const t = userSearch.toLowerCase();
    return users.filter(u =>
      (u.characterName || '').toLowerCase().includes(t) ||
      (u.username || '').toLowerCase().includes(t) ||
      u.role.toLowerCase().includes(t)
    );
  }, [users, userSearch]);

  const canCreateRole = canEditScope && (effectiveScope === 'corp' ? corpId !== null : siteAdmin);

  const panelButton = (id: PanelId, label: string, PanelIcon: React.ElementType) => (
    <button
      key={id}
      onClick={() => setPanel(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        panel === id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      <PanelIcon size={16} />
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Panel switcher + scope toggle */}
      <Card>
        <CardContent className="pt-4 pb-2 flex flex-wrap items-center justify-between gap-3">
          <div className={`flex gap-1 ${isMobileView ? 'w-full' : ''}`}>
            {panelButton('roles', 'Roles', Shield)}
            {panelButton('mappings', 'Mappings', ArrowsLeftRight)}
            {panelButton('users', 'Users', Users)}
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Scope:</Label>
            <button
              onClick={() => setScope(siteAdmin ? (scope === 'global' ? 'corp' : 'global') : 'corp')}
              disabled={!siteAdmin || !corpId}
              className={`px-3 py-1 rounded-md text-xs border ${effectiveScope === 'global' ? 'bg-accent text-accent-foreground border-transparent' : 'border-border text-muted-foreground'} disabled:opacity-40`}
            >
              Site-wide
            </button>
            <button
              onClick={() => setScope('corp')}
              disabled={!corpId}
              className={`px-3 py-1 rounded-md text-xs border ${effectiveScope === 'corp' ? 'bg-accent text-accent-foreground border-transparent' : 'border-border text-muted-foreground'} disabled:opacity-40`}
            >
              {corpId ? `Corp (${currentUser?.corporationName || corpId})` : 'Corporation (none linked)'}
            </button>
          </div>
        </CardContent>
      </Card>

      {!canEditScope && (
        <Alert>
          <Info size={16} />
          <AlertDescription>Site-wide edits require a site admin. You can browse the global set but not modify it.</AlertDescription>
        </Alert>
      )}

      {loadError && panel === 'roles' && (
        <Alert>
          <Warning size={16} />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ROLES PANEL                                                         */}
      {/* ------------------------------------------------------------------ */}
      {panel === 'roles' && (
        <Card>
          <CardContent className="pt-4">
            <div className={`grid ${isMobileView ? 'grid-cols-1 gap-4' : 'grid-cols-5 gap-6'}`}>
              {/* Role list */}
              <div className={isMobileView ? '' : 'col-span-2 space-y-3'}>
                {canCreateRole && (
                  <div className="space-y-2">
                    <Label>New {effectiveScope === 'corp' && corpId ? 'corporate custom role' : 'site-wide role'}</Label>
                    <div className="flex gap-2">
                      <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. Logistics Chief" />
                      <Button onClick={handleCreateRole} disabled={busy || !newRoleName.trim()}>
                        <Plus size={16} className="mr-1" /> Add
                      </Button>
                    </div>
                  </div>
                )}

                <ScrollArea className={`h-[420px] border border-border rounded-lg`}>
                  <div className="p-2 space-y-1">
                    {roles.length === 0 && !busy ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">No roles defined</div>
                    ) : (
                      roles.map(r => {
                        const selected = roleDraft?.key === r.key;
                        return (
                          <button key={`${r.corporationId ?? 'g'}:${r.key}`} onClick={() => selectRole(r)} className={`w-full text-left p-3 rounded-lg transition-colors ${selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">{r.name}</span>
                              <Badge variant={r.isBuiltin ? 'secondary' : 'outline'} className="text-xs shrink-0">
                                {effectiveScope === 'corp' && r.corporationId !== null && r.corporationId === corpId ? 'Corp' : r.isBuiltin ? 'Built-in' : 'Custom'}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">{r.key}</div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Role editor */}
              <div className={isMobileView ? '' : 'col-span-3 space-y-4'}>
                {!roleDraft ? (
                  <div className="flex items-center justify-center h-[420px] border border-dashed border-border rounded-lg">
                    <div className="text-center space-y-2">
                      <Shield size={48} className="mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Select a role to view and edit its permissions</p>
                    </div>
                  </div>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        {roleDraft.key === 'super_admin' ? <Crown size={18} /> : roleDraft.isBuiltin ? <Star size={18} /> : <UserPlus size={18} />}
                        {roleDraft.name}
                        {roleDraft.key === 'super_admin' && (
                          <Badge variant="outline" className="border-purple-500 text-purple-400">Locked - always full access</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {roleDraft.key !== 'super_admin' && (
                        <div className="space-y-1">
                          <Label>Display name</Label>
                          <Input value={roleDraft.name} onChange={(e) => setRoleDraft({ ...roleDraft, name: e.target.value })} disabled={!canEditScope || roleDraft.isBuiltin} />
                        </div>
                      )}

                      {roleDraft.key === 'super_admin' ? (
                        <Alert>
                          <Info size={16} />
                          <AlertDescription>The super_admin permission set is fixed server-side and cannot be reduced.</AlertDescription>
                        </Alert>
                      ) : (
                        <ScrollArea className="h-[340px] pr-4">
                          <div className="space-y-2 pb-2">
                            {(permissionKeys.length > 0 ? permissionKeys : Object.keys(PERMISSION_META)).map(k => {
                              const meta = PERMISSION_META[k] || { label: k, icon: Eye };
                              const Icon = meta.icon;
                              return (
                                <div key={k} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <Icon size={16} className="text-muted-foreground shrink-0" />
                                    <span className="text-sm truncate">{meta.label}</span>
                                  </div>
                                  <Switch
                                    checked={!!roleDraft.permissions[k]}
                                    disabled={!canEditScope}
                                    onCheckedChange={(v) => setRoleDraft({ ...roleDraft, permissions: { ...roleDraft.permissions, [k]: v } })}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}

                      <Separator className="my-2" />
                      <div className="flex flex-wrap justify-end gap-2">
                        {roleDraft.isBuiltin && roleDraft.key !== 'super_admin' && (
                          <Button variant="outline" onClick={handleResetRole} disabled={!canEditScope || busy}>Reset to Defaults</Button>
                        )}
                        {!roleDraft.isBuiltin && effectiveScope === 'global' && canEditScope && (
                          <Button variant="destructive" onClick={handleDeleteRole} disabled={busy}><Trash size={16} className="mr-1" /> Delete Role</Button>
                        )}
                        {roleDraft.isBuiltin && effectiveScope === 'corp' && corpId && canEditScope && (
                          <Button variant="outline" onClick={() => handleDeleteRole()} disabled={busy}><Trash size={16} className="mr-1" /> Restore Site Default</Button>
                        )}
                        {roleDraft.key !== 'super_admin' && (
                          <Button onClick={handleSaveRole} disabled={!canEditScope || busy} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                            <CheckCircle size={16} className="mr-2" /> Save
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MAPPINGS PANEL                                                      */}
      {/* ------------------------------------------------------------------ */}
      {panel === 'mappings' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowsLeftRight size={18} />
              EVE Roles &amp; Titles to Site Role Mapping
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              When a character logs in via SSO, their corporation roles and titles are matched against these rules. The highest-priority match wins; no match defaults to Member. Corporation-specific rules override site-wide fallbacks for the same source. Mappings can never grant Super Admin.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {canEditScope && (
              <div className={`grid ${isMobileView ? 'grid-cols-1 gap-3' : 'grid-cols-6 gap-2'} items-end p-3 rounded-lg border border-border`}>
                <div className="space-y-1">
                  <Label className="text-xs">Kind</Label>
                  <select value={ruleKind} onChange={(e) => setRuleKind(e.target.value as 'eve_role' | 'title')} className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm">
                    <option value="eve_role">EVE Corp Role</option>
                    <option value="title">Corp Title</option>
                  </select>
                </div>
                <div className={isMobileView ? '' : 'col-span-2'}>
                  <Label className="text-xs">{ruleKind === 'eve_role' ? 'EVE Role' : 'Title Name'}</Label>
                  {ruleKind === 'eve_role' ? (
                    <>
                      <input list="esi-role-names" value={ruleSource} onChange={(e) => setRuleSource(e.target.value)} placeholder="ceo, director..." className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm" />
                      <datalist id="esi-role-names">
                        {ESI_ROLE_NAMES.map(r => <option key={r} value={r} />)}
                      </datalist>
                    </>
                  ) : (
                    <Input value={ruleSource} onChange={(e) => setRuleSource(e.target.value)} placeholder="e.g. Veteran Pilot" />
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Site Role</Label>
                  <select value={ruleTarget} onChange={(e) => setRuleTarget(e.target.value)} className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm">
                    {(siteRoleKeys.length > 0 ? siteRoleKeys : roles.map(r => r.key)).map(k => (
                      <option key={k} value={k}>{getRoleLabel(k)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Priority</Label>
                  <Input type="number" value={rulePriority} onChange={(e) => setRulePriority(parseInt(e.target.value || '0', 10))} />
                </div>
                <Button onClick={handleSaveRule} disabled={!ruleSource.trim() || busy}>
                  <Plus size={16} className="mr-1" /> Add Rule
                </Button>
              </div>
            )}

            <ScrollArea className={`h-[380px] border border-border rounded-lg`}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b border-border">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="p-2 font-medium">Kind</th>
                    <th className="p-2 font-medium">Source</th>
                    <th className="p-2 font-medium">Site Role</th>
                    <th className="p-2 font-medium text-right">Priority</th>
                    <th className="p-2 font-medium">Scope</th>
                    {canEditScope && <th className="p-2" />}
                  </tr>
                </thead>
                <tbody>
                  {rules.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No mapping rules in this scope. SSO logins fall back to the built-in role table (CEO to Corp Admin, directors and so on).</td></tr>
                  ) : (
                    rules.map((r) => {
                      const isCorpRule = effectiveScope === 'corp' && r.corporationId !== null && r.corporationId === corpId;
                      return (
                        <tr key={`${r.corporationId ?? 'g'}:${r.kind}:${r.sourceName}`} className="border-b border-border last:border-0">
                          <td className="p-2"><Badge variant={r.kind === 'eve_role' ? 'secondary' : 'outline'} className="text-xs">{r.kind === 'eve_role' ? 'Role' : 'Title'}</Badge></td>
                          <td className="p-2 font-medium truncate max-w-[240px]">{r.sourceName}</td>
                          <td className="p-2"><Badge variant="outline" className="text-xs">{getRoleLabel(r.siteRoleKey)}</Badge></td>
                          <td className="p-2 text-right tabular-nums">{r.priority}</td>
                          <td className="p-2">
                            <span className="text-xs text-muted-foreground">{isCorpRule ? 'Corporation' : r.corporationId === null && effectiveScope === 'global' ? 'Site-wide' : `Corp ${r.corporationId}`}</span>
                          </td>
                          {canEditScope && (
                            <td className="p-2 text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteRule(r)} disabled={busy}>
                                <Trash size={14} />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* USERS PANEL                                                         */}
      {/* ------------------------------------------------------------------ */}
      {panel === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users size={18} />
              User Roles
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Assign site roles to accounts. SSO characters re-resolve from the mapping rules on each login; manual (service) accounts keep their assigned role.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative max-w-sm">
              <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-8" />
            </div>
            <ScrollArea className={`h-[420px] border border-border rounded-lg`}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b border-border">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="p-2 font-medium">User</th>
                    <th className="p-2 font-medium">Corporation</th>
                    <th className="p-2 font-medium">Auth</th>
                    <th className="p-2 font-medium">Role</th>
                    <th className="p-2 font-medium text-center">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">{busy ? 'Loading users...' : 'No users in this scope'}</td></tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelf = currentUser?.id === String(u.id);
                      return (
                        <tr key={String(u.id)} className="border-b border-border last:border-0">
                          <td className="p-2 font-medium">
                            <div className="flex items-center gap-2">
                              {u.characterName || u.username || `User ${u.id}`}
                              {isSelf && <Badge variant="outline" className="text-xs">you</Badge>}
                            </div>
                          </td>
                          <td className="p-2 text-muted-foreground truncate max-w-[180px]">{u.corporationName || '-'}</td>
                          <td className="p-2"><Badge variant={u.authMethod === 'esi' ? 'secondary' : 'outline'} className="text-xs">{u.authMethod === 'esi' ? 'ESI' : 'Local'}</Badge></td>
                          <td className="p-2">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleAssign(u, e.target.value)}
                              disabled={busy || (isSelf && !siteAdmin)}
                              className="w-full max-w-[180px] h-8 px-2 rounded-md border border-input bg-background text-sm disabled:opacity-50"
                            >
                              {!roleOptions.some(r => r.key === u.role) && <option value={u.role}>{getRoleLabel(u.role)}</option>}
                              {roleOptions.map(r => (
                                <option key={r.key} value={r.key} disabled={r.key === 'super_admin' && !siteAdmin}>{r.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 text-center">
                            <Switch checked={u.isActive} onCheckedChange={(v) => handleToggleActive(u, v)} disabled={busy || (isSelf && !siteAdmin)} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
