import React, { useState, useMemo } from 'react';
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
  Shield, 
  MagnifyingGlass,
  Users,
  CheckCircle,
  Warning,
  Info,
  Package,
  Factory,
  HardHat,
  TrendUp,
  CurrencyDollar,
  Bell,
  ChartLine,
  Building,
  Gear,
  Eye,
  EyeSlash,
  Crown,
  Star
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-provider';
import { LMeveUser, UserRole, RolePermissions } from '@/lib/types';
import { getRolePermissions } from '@/lib/roles';
import { toast } from 'sonner';

interface PermissionConfig {
  id: keyof RolePermissions;
  label: string;
  description: string;
  icon: React.ElementType;
  category: 'system' | 'corporation' | 'data' | 'tabs';
}

const PERMISSION_CONFIGS: PermissionConfig[] = [
  {
    id: 'canManageSystem',
    label: 'System Management',
    description: 'Full system administration and multi-corp management',
    icon: Shield,
    category: 'system'
  },
  {
    id: 'canManageDatabase',
    label: 'Database Management',
    description: 'Configure database settings and run maintenance',
    icon: Gear,
    category: 'system'
  },
  {
    id: 'canConfigureESI',
    label: 'ESI Configuration',
    description: 'Configure EVE Online ESI credentials and settings',
    icon: Building,
    category: 'system'
  },
  {
    id: 'canManageCorp',
    label: 'Corporation Management',
    description: 'Manage corporation settings and structure',
    icon: Building,
    category: 'corporation'
  },
  {
    id: 'canManageUsers',
    label: 'User Management',
    description: 'Create, edit, and remove users and permissions',
    icon: Users,
    category: 'corporation'
  },
  {
    id: 'canViewFinancials',
    label: 'View Financials',
    description: 'Access wallet and financial data',
    icon: CurrencyDollar,
    category: 'tabs'
  },
  {
    id: 'canManageAssets',
    label: 'Manage Assets',
    description: 'View and manage corp assets and hangars',
    icon: Package,
    category: 'tabs'
  },
  {
    id: 'canManageManufacturing',
    label: 'Manage Manufacturing',
    description: 'Access manufacturing jobs and blueprints',
    icon: Factory,
    category: 'tabs'
  },
  {
    id: 'canManageMining',
    label: 'Manage Mining',
    description: 'Access mining operations and data',
    icon: HardHat,
    category: 'tabs'
  },
  {
    id: 'canManageMarket',
    label: 'Manage Market',
    description: 'Access market data and trading',
    icon: TrendUp,
    category: 'tabs'
  },
  {
    id: 'canViewAllMembers',
    label: 'View All Members',
    description: 'Access complete member roster and details',
    icon: Users,
    category: 'data'
  },
  {
    id: 'canEditAllData',
    label: 'Edit All Data',
    description: 'Modify corporation data and records',
    icon: Eye,
    category: 'data'
  },
  {
    id: 'canExportData',
    label: 'Export Data',
    description: 'Export data and generate reports',
    icon: Package,
    category: 'data'
  },
  {
    id: 'canDeleteData',
    label: 'Delete Data',
    description: 'Permanently delete records and data',
    icon: Warning,
    category: 'data'
  }
];

const ROLE_LABELS: Record<UserRole, { label: string; color: string; icon: React.ElementType }> = {
  super_admin: { label: 'Super Admin', color: 'bg-purple-500', icon: Crown },
  corp_admin: { label: 'Corp Admin', color: 'bg-red-500', icon: Star },
  corp_director: { label: 'Director', color: 'bg-orange-500', icon: Shield },
  corp_manager: { label: 'Manager', color: 'bg-blue-500', icon: Users },
  corp_member: { label: 'Member', color: 'bg-green-500', icon: Users },
  guest: { label: 'Guest', color: 'bg-gray-500', icon: Eye }
};

interface PermissionsTabProps {
  isMobileView?: boolean;
}

export function PermissionsTab({ isMobileView }: PermissionsTabProps) {
  const { user: currentUser, getAllUsers, updateUserRole, updateUserPermissions } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<LMeveUser | null>(null);
  const [customPermissions, setCustomPermissions] = useState<Partial<RolePermissions>>({});
  const [hasOverrides, setHasOverrides] = useState(false);

  const allUsers = useMemo(() => {
    const users = getAllUsers() || [];
    return users
      .filter(u => u.isActive)
      .sort((a, b) => {
        const roleOrder: UserRole[] = ['super_admin', 'corp_admin', 'corp_director', 'corp_manager', 'corp_member', 'guest'];
        const aIndex = roleOrder.indexOf(a.role);
        const bIndex = roleOrder.indexOf(b.role);
        if (aIndex !== bIndex) return aIndex - bIndex;
        return (a.characterName || '').localeCompare(b.characterName || '');
      });
  }, [getAllUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return allUsers;
    const term = searchTerm.toLowerCase();
    return allUsers.filter(u => 
      u.characterName?.toLowerCase().includes(term) ||
      u.corporationName?.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  }, [allUsers, searchTerm]);

  React.useEffect(() => {
    if (selectedUser) {
      setCustomPermissions(selectedUser.permissions || {});
      const defaultPerms = getRolePermissions(selectedUser.role);
      const hasCustom = Object.keys(selectedUser.permissions || {}).some(
        key => selectedUser.permissions[key as keyof RolePermissions] !== defaultPerms[key as keyof RolePermissions]
      );
      setHasOverrides(hasCustom);
    }
  }, [selectedUser]);

  const handleUserSelect = (user: LMeveUser) => {
    setSelectedUser(user);
  };

  const handlePermissionToggle = (permissionId: keyof RolePermissions) => {
    if (!selectedUser) return;
    
    const newValue = !customPermissions[permissionId];
    setCustomPermissions(prev => ({
      ...prev,
      [permissionId]: newValue
    }));
    
    const defaultPerms = getRolePermissions(selectedUser.role);
    const willHaveOverrides = Object.keys({ ...customPermissions, [permissionId]: newValue }).some(
      key => ({ ...customPermissions, [permissionId]: newValue })[key as keyof RolePermissions] !== defaultPerms[key as keyof RolePermissions]
    );
    setHasOverrides(willHaveOverrides);
  };

  const handleResetToDefault = () => {
    if (!selectedUser) return;
    
    const defaultPerms = getRolePermissions(selectedUser.role);
    setCustomPermissions(defaultPerms);
    setHasOverrides(false);
    toast.info('Permissions reset to role defaults');
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    
    try {
      await updateUserPermissions(selectedUser.id, customPermissions);
      toast.success('Permissions updated successfully');
      
      const updatedUsers = getAllUsers();
      const updated = updatedUsers.find(u => u.id === selectedUser.id);
      if (updated) {
        setSelectedUser(updated);
      }
    } catch (error) {
      console.error('Failed to update permissions:', error);
      toast.error('Failed to update permissions');
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await updateUserRole(userId, newRole);
      toast.success('User role updated successfully');
      
      const updatedUsers = getAllUsers();
      const updated = updatedUsers.find(u => u.id === userId);
      if (updated) {
        setSelectedUser(updated);
      }
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role');
    }
  };

  const canEditPermissions = currentUser && (
    currentUser.role === 'super_admin' || 
    currentUser.role === 'corp_admin'
  );

  const canEditUser = (targetUser: LMeveUser) => {
    if (!currentUser || !canEditPermissions) return false;
    if (currentUser.id === targetUser.id) return false;
    if (currentUser.role === 'super_admin') return true;
    if (currentUser.role === 'corp_admin') {
      return targetUser.role !== 'super_admin';
    }
    return false;
  };

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionConfig[]> = {
      system: [],
      corporation: [],
      tabs: [],
      data: []
    };
    
    PERMISSION_CONFIGS.forEach(config => {
      groups[config.category].push(config);
    });
    
    return groups;
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={20} />
            User Permissions Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!canEditPermissions && (
            <Alert className="mb-4">
              <Warning size={16} />
              <AlertDescription>
                You do not have permission to manage user permissions. Only Super Admins and Corp Admins can modify permissions.
              </AlertDescription>
            </Alert>
          )}

          <div className={`grid ${isMobileView ? 'grid-cols-1 gap-4' : 'grid-cols-3 gap-6'}`}>
            <div className={`${isMobileView ? '' : 'col-span-1'} space-y-4`}>
              <div className="space-y-2">
                <Label>Search Users</Label>
                <div className="relative">
                  <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, corp, or role..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <ScrollArea className={`${isMobileView ? 'h-64' : 'h-[600px]'} border border-border rounded-lg`}>
                <div className="p-2 space-y-1">
                  {filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No users found
                    </div>
                  ) : (
                    filteredUsers.map(user => {
                      const roleInfo = ROLE_LABELS[user.role];
                      const IconComponent = roleInfo.icon;
                      const isSelected = selectedUser?.id === user.id;
                      
                      return (
                        <button
                          key={user.id}
                          onClick={() => handleUserSelect(user)}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            isSelected 
                              ? 'bg-accent text-accent-foreground' 
                              : 'hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {user.authMethod === 'esi' && user.characterId && (
                              <img 
                                src={`https://images.evetech.net/characters/${user.characterId}/portrait?size=64`}
                                alt={user.characterName || 'Character'}
                                className="w-10 h-10 rounded-full border border-border"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{user.characterName || user.username}</div>
                              <div className="text-xs text-muted-foreground truncate">{user.corporationName || 'Unknown Corp'}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${roleInfo.color} text-white border-none`}
                                >
                                  <IconComponent size={12} className="mr-1" />
                                  {roleInfo.label}
                                </Badge>
                                {user.authMethod === 'esi' && (
                                  <Badge variant="outline" className="text-xs">
                                    ESI
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className={`${isMobileView ? '' : 'col-span-2'} space-y-4`}>
              {!selectedUser ? (
                <div className="flex items-center justify-center h-full min-h-[400px] border border-dashed border-border rounded-lg">
                  <div className="text-center space-y-2">
                    <Users size={48} className="mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Select a user to view and manage permissions</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {selectedUser.authMethod === 'esi' && selectedUser.characterId && (
                            <img 
                              src={`https://images.evetech.net/characters/${selectedUser.characterId}/portrait?size=128`}
                              alt={selectedUser.characterName || 'Character'}
                              className="w-16 h-16 rounded-lg border-2 border-accent"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div>
                            <h3 className="text-lg font-semibold">{selectedUser.characterName || selectedUser.username}</h3>
                            <p className="text-sm text-muted-foreground">{selectedUser.corporationName || 'Unknown Corporation'}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge 
                                variant="secondary" 
                                className={`${ROLE_LABELS[selectedUser.role].color} text-white border-none`}
                              >
                                {ROLE_LABELS[selectedUser.role].label}
                              </Badge>
                              {selectedUser.authMethod === 'esi' && (
                                <Badge variant="outline">ESI Authenticated</Badge>
                              )}
                              {hasOverrides && (
                                <Badge variant="outline" className="border-orange-500 text-orange-500">
                                  <Warning size={12} className="mr-1" />
                                  Custom Permissions
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>User Role</Label>
                        <select
                          value={selectedUser.role}
                          onChange={(e) => handleRoleChange(selectedUser.id, e.target.value as UserRole)}
                          disabled={!canEditUser(selectedUser)}
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="super_admin">Super Admin</option>
                          <option value="corp_admin">Corp Admin</option>
                          <option value="corp_director">Director</option>
                          <option value="corp_manager">Manager</option>
                          <option value="corp_member">Member</option>
                          <option value="guest">Guest</option>
                        </select>
                        <p className="text-xs text-muted-foreground">
                          Changing the role will apply default permissions. You can override individual permissions below.
                        </p>
                      </div>

                      {hasOverrides && (
                        <Alert>
                          <Info size={16} />
                          <AlertDescription className="flex items-center justify-between">
                            <span>This user has custom permission overrides</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleResetToDefault}
                              disabled={!canEditUser(selectedUser)}
                            >
                              Reset to Default
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Individual Permissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className={`${isMobileView ? 'h-96' : 'h-[400px]'} pr-4`}>
                        <div className="space-y-6">
                          {Object.entries(groupedPermissions).map(([category, permissions]) => (
                            <div key={category} className="space-y-3">
                              <h4 className="font-medium text-sm capitalize flex items-center gap-2">
                                {category === 'system' && <Shield size={16} />}
                                {category === 'corporation' && <Building size={16} />}
                                {category === 'tabs' && <Package size={16} />}
                                {category === 'data' && <Eye size={16} />}
                                {category} Permissions
                              </h4>
                              <div className="space-y-2">
                                {permissions.map(permission => {
                                  const IconComponent = permission.icon;
                                  const isEnabled = customPermissions[permission.id] || false;
                                  const defaultValue = getRolePermissions(selectedUser.role)[permission.id];
                                  const isOverridden = isEnabled !== defaultValue;
                                  
                                  return (
                                    <div 
                                      key={permission.id}
                                      className={`flex items-start justify-between p-3 rounded-lg border ${
                                        isOverridden ? 'border-orange-500 bg-orange-500/5' : 'border-border'
                                      }`}
                                    >
                                      <div className="flex items-start gap-3 flex-1">
                                        <IconComponent size={18} className="mt-0.5 text-muted-foreground" />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <Label className="text-sm font-medium">{permission.label}</Label>
                                            {isOverridden && (
                                              <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">
                                                Override
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                            {permission.description}
                                          </p>
                                        </div>
                                      </div>
                                      <Switch
                                        checked={isEnabled}
                                        onCheckedChange={() => handlePermissionToggle(permission.id)}
                                        disabled={!canEditUser(selectedUser)}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>

                      <Separator className="my-4" />

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={handleResetToDefault}
                          disabled={!canEditUser(selectedUser) || !hasOverrides}
                        >
                          Reset to Default
                        </Button>
                        <Button
                          onClick={handleSavePermissions}
                          disabled={!canEditUser(selectedUser)}
                          className="bg-accent hover:bg-accent/90 text-accent-foreground"
                        >
                          <CheckCircle size={16} className="mr-2" />
                          Save Permissions
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
