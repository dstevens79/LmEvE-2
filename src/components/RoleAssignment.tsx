/**
 * Role Assignment Component
 * Provides detailed role and permission management interface
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  ShieldCheck, 
  User, 
  Users,
  Info,
  Eye,
  Gear,
  Database,
  Globe,
  Package,
  Factory,
  HardHat,
  Crosshair,
  TrendUp,
  CurrencyDollar,
  Truck
} from '@phosphor-icons/react';
import { UserRole, RolePermissions, LMeveUser } from '@/lib/types';
import { ROLE_DEFINITIONS, getRolePermissions } from '@/lib/roles';

interface RoleAssignmentProps {
  user?: LMeveUser;
  onRoleChange?: (userId: string, newRole: UserRole) => void;
  className?: string;
}

export function RoleAssignment({ user, onRoleChange, className }: RoleAssignmentProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);

  // Get role display info with icons and colors
  type RoleDisplayInfo = { label: string; variant: 'destructive' | 'default' | 'secondary' | 'outline'; icon: React.ElementType; description: string; color: string };
  const getRoleDisplay = (role: UserRole | string): RoleDisplayInfo => {
    const roleMap: Record<string, RoleDisplayInfo> = {
      super_admin: { 
        label: 'Super Administrator', 
        variant: 'destructive', 
        icon: ShieldCheck,
        description: 'Full system access across all corporations and settings',
        color: 'text-red-400'
      },
      corp_admin: { 
        label: 'Corporation Administrator', 
        variant: 'default', 
        icon: Shield,
        description: 'Full corporation management and user administration',
        color: 'text-blue-400'
      },
      corp_director: { 
        label: 'Corporation Director', 
        variant: 'secondary', 
        icon: Users,
        description: 'Operations management and financial oversight',
        color: 'text-purple-400'
      },
      corp_manager: { 
        label: 'Corporation Manager', 
        variant: 'outline', 
        icon: User,
        description: 'Departmental management and operational tasks',
        color: 'text-green-400'
      },
      corp_member: { 
        label: 'Corporation Member', 
        variant: 'outline', 
        icon: User,
        description: 'Basic member access with limited permissions',
        color: 'text-yellow-400'
      },
      guest: { 
        label: 'Guest User', 
        variant: 'outline', 
        icon: User,
        description: 'Minimal access for external users',
        color: 'text-gray-400'
      },
    };
    return roleMap[role] || roleMap.corp_member;
  };

  // Get permission category icons
  const getPermissionIcon = (permission: keyof RolePermissions) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      canManageSystem: Gear,
      canManageDatabase: Database,
      canConfigureESI: Globe,
      canManageCorp: Shield,
      canManageUsers: Users,
      canViewFinancials: CurrencyDollar,
      canManageAssets: Package,
      canManageManufacturing: Factory,
      canManageMining: HardHat,
      canManageMarket: TrendUp,
      canViewKillmails: Crosshair,
      canManageIncome: CurrencyDollar,
      canViewAllMembers: Eye,
      canEditAllData: Gear,
      canExportData: Package,
      canDeleteData: Gear,
    };
    return iconMap[permission] || Info;
  };

  // Get permission display name
  const getPermissionLabel = (permission: keyof RolePermissions) => {
    const labelMap: Record<string, string> = {
      canManageSystem: 'System Management',
      canManageMultipleCorps: 'Multi-Corporation Access',
      canConfigureESI: 'ESI Configuration',
      canManageDatabase: 'Database Management',
      canManageCorp: 'Corporation Management',
      canManageUsers: 'User Management',
      canViewFinancials: 'Financial Access',
      canManageManufacturing: 'Manufacturing Management',
      canManageMining: 'Mining Operations',
      canManageAssets: 'Asset Management',
      canManageMarket: 'Market Operations',
      canViewKillmails: 'Killmail Access',
      canManageIncome: 'Income Management',
      canViewAllMembers: 'Member Directory',
      canEditAllData: 'Data Modification',
      canExportData: 'Data Export',
      canDeleteData: 'Data Deletion',
    };
    return labelMap[permission] || permission;
  };

  // Group permissions by category
  const groupPermissions = (permissions: RolePermissions) => {
    const groups = {
      system: ['canManageSystem', 'canManageMultipleCorps', 'canConfigureESI', 'canManageDatabase'],
      corporation: ['canManageCorp', 'canManageUsers', 'canViewFinancials'],
      operations: ['canManageManufacturing', 'canManageMining', 'canManageAssets', 'canManageMarket', 'canViewKillmails', 'canManageIncome'],
      data: ['canViewAllMembers', 'canEditAllData', 'canExportData', 'canDeleteData'],
    };

    return Object.entries(groups).map(([category, permissionKeys]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      permissions: permissionKeys.filter(key => 
        permissions[key as keyof RolePermissions] === true
      )
    })).filter(group => group.permissions.length > 0);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Role Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={20} />
            Role & Permission Management
          </CardTitle>
          <CardDescription>
            Understand and manage user roles and their associated permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="roles">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="roles">Available Roles</TabsTrigger>
              <TabsTrigger value="permissions">Permission Matrix</TabsTrigger>
            </TabsList>

            {/* Roles Tab */}
            <TabsContent value="roles" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(ROLE_DEFINITIONS).map(([role, permissions]) => {
                  const roleDisplay = getRoleDisplay(role as UserRole);
                  const RoleIcon = roleDisplay.icon;
                  const isCurrentRole = user?.role === role;
                  
                  return (
                    <Card key={role} className={`${isCurrentRole ? 'ring-2 ring-accent' : ''}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <RoleIcon size={18} className={roleDisplay.color} />
                            <CardTitle className="text-base">{roleDisplay.label}</CardTitle>
                          </div>
                          {isCurrentRole && (
                            <Badge variant="default" className="text-xs">Current</Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs">
                          {roleDisplay.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Permissions</span>
                            <Badge variant="outline" className="text-xs">
                              {Object.values(permissions).filter(Boolean).length} granted
                            </Badge>
                          </div>
                          
                          <div className="space-y-2">
                            {groupPermissions(permissions).map((group) => (
                              <div key={group.category} className="text-xs">
                                <span className="font-medium text-muted-foreground">
                                  {group.category}:
                                </span>
                                <span className="ml-1">
                                  {group.permissions.length} permissions
                                </span>
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Dialog open={showPermissionsDialog && selectedRole === role} 
                                   onOpenChange={(open) => {
                                     setShowPermissionsDialog(open);
                                     if (open) setSelectedRole(role as UserRole);
                                   }}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="flex-1 text-xs">
                                  <Eye size={14} className="mr-1" />
                                  View Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <RoleIcon size={20} className={roleDisplay.color} />
                                    {roleDisplay.label}
                                  </DialogTitle>
                                  <DialogDescription>
                                    Detailed permissions breakdown for this role
                                  </DialogDescription>
                                </DialogHeader>
                                
                                <div className="space-y-4">
                                  {groupPermissions(permissions).map((group) => (
                                    <div key={group.category}>
                                      <h4 className="font-medium mb-3 flex items-center gap-2">
                                        <Badge variant="outline">{group.category}</Badge>
                                      </h4>
                                      <div className="grid gap-2">
                                        {group.permissions.map((permission) => {
                                          const PermissionIcon = getPermissionIcon(permission as keyof RolePermissions);
                                          return (
                                            <div key={permission} 
                                                 className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                              <PermissionIcon size={16} className="text-accent" />
                                              <span className="text-sm">
                                                {getPermissionLabel(permission as keyof RolePermissions)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </DialogContent>
                            </Dialog>
                            
                            {user && !isCurrentRole && onRoleChange && (
                              <Button 
                                variant="default" 
                                size="sm" 
                                className="flex-1 text-xs"
                                onClick={() => onRoleChange(user.id, role as UserRole)}
                              >
                                Assign Role
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              
              {user && (
                <Alert>
                  <Info size={16} />
                  <AlertDescription>
                    Current user <strong>{user.characterName || user.username}</strong> has the{' '}
                    <strong>{getRoleDisplay(user.role).label}</strong> role with{' '}
                    {Object.values(user.permissions).filter(Boolean).length} permissions granted.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* Permissions Matrix Tab */}
            <TabsContent value="permissions" className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Permission</TableHead>
                      {Object.keys(ROLE_DEFINITIONS).map((role) => (
                        <TableHead key={role} className="text-center min-w-[120px]">
                          <div className="flex flex-col items-center gap-1">
                            {(() => {
                              const display = getRoleDisplay(role as UserRole);
                              const Icon = display.icon;
                              return <Icon size={16} className={display.color} />;
                            })()}
                            <span className="text-xs">{role.replace('_', ' ').replace('corp', 'Corp')}</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.keys(getRolePermissions('super_admin')).map((permission) => {
                      const PermissionIcon = getPermissionIcon(permission as keyof RolePermissions);
                      return (
                        <TableRow key={permission}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <PermissionIcon size={16} className="text-muted-foreground" />
                              <span>{getPermissionLabel(permission as keyof RolePermissions)}</span>
                            </div>
                          </TableCell>
                          {Object.entries(ROLE_DEFINITIONS).map(([role, permissions]) => (
                            <TableCell key={role} className="text-center">
                              {permissions[permission as keyof RolePermissions] ? (
                                <Badge variant="default" className="w-6 h-6 p-0 rounded-full">
                                  ✓
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="w-6 h-6 p-0 rounded-full">
                                  ×
                                </Badge>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}