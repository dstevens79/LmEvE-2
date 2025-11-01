import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  UserPlus, 
  Trash, 
  PencilSimple, 
  Shield, 
  Users, 
  Key,
  Warning,
  CheckCircle,
  Clock,
  LinkSimple,
  Rocket,
  ArrowClockwise,
  X,
  Info
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-provider';
import { LMeveUser, UserRole } from '@/lib/types';
import { hasPermission } from '@/lib/roles';

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  corp_admin: 'Corporation Admin',
  corp_director: 'Corporation Director', 
  corp_manager: 'Corporation Manager',
  corp_member: 'Corporation Member',
  guest: 'Guest'
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin: 'Full system access, can manage all corporations',
  corp_admin: 'Corporation administrator, can manage corp settings and users',
  corp_director: 'Corporation director, can view/manage corp operations',
  corp_manager: 'Corporation manager, can manage specific areas',
  corp_member: 'Basic corporation member, read-only access',
  guest: 'Limited guest access'
};

export function UserManagement({ isMobileView }: { isMobileView?: boolean }) {
  const { 
    user: currentUser, 
    getAllUsers, 
    createManualUser, 
    updateUserRole, 
    deleteUser,
    linkUserToCharacter,
    unlinkUserCharacter
  } = useAuth();
  const [users, setUsers] = useState<LMeveUser[]>(getAllUsers());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<LMeveUser | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Create user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('corp_member');
  const [isCreating, setIsCreating] = useState(false);
  
  // Edit user form
  const [editRole, setEditRole] = useState<UserRole>('corp_member');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Delete confirmation
  const [isDeleting, setIsDeleting] = useState(false);

  // Character linking functionality
  const [showCharacterLookup, setShowCharacterLookup] = useState(false);
  const [characterSearchTerm, setCharacterSearchTerm] = useState('');
  const [characterSearchResults, setCharacterSearchResults] = useState<any[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<any>(null);
  const [isSearchingCharacters, setIsSearchingCharacters] = useState(false);
  // If set, we are linking a character to an existing user instead of creating a new one
  const [linkTargetUser, setLinkTargetUser] = useState<LMeveUser | null>(null);
  // Optional: role selection when creating a new user from character
  const [selectedRoleForCreation, setSelectedRoleForCreation] = useState<UserRole>('corp_member');

  // Check permissions
  const canManageUsers = hasPermission(currentUser, 'canManageUsers');
  const canManageSystem = hasPermission(currentUser, 'canManageSystem');

  if (!canManageUsers) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center space-y-2">
            <Shield size={48} className="mx-auto text-muted-foreground" />
            <h3 className="text-lg font-medium">Access Denied</h3>
            <p className="text-sm text-muted-foreground">
              You don't have permission to manage users.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Refresh users list
  const refreshUsers = () => {
    setUsers(getAllUsers());
  };

  // Character lookup functionality
  const searchCharacters = async (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 3) {
      setCharacterSearchResults([]);
      return;
    }

    setIsSearchingCharacters(true);
    try {
      console.log('🔍 Searching for characters:', searchTerm);
      
      // Use EVE API to search for characters
      const response = await fetch(`https://esi.evetech.net/v1/search/?categories=character&search=${encodeURIComponent(searchTerm)}&strict=false`, {
        headers: {
          'User-Agent': 'LMeve/2.0 (Character Search)'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Character search results:', data);
        
        if (data.character && data.character.length > 0) {
          // Get character details
          const characterDetails = await Promise.all(
            data.character.slice(0, 10).map(async (id: number) => {
              try {
                console.log('📋 Fetching details for character ID:', id);
                
                const charResponse = await fetch(`https://esi.evetech.net/v5/characters/${id}/`, {
                  headers: {
                    'User-Agent': 'LMeve/2.0 (Character Details)'
                  }
                });
                
                if (charResponse.ok) {
                  const charData = await charResponse.json();
                  
                  // Get corporation details
                  let corporationData = null;
                  if (charData.corporation_id) {
                    try {
                      const corpResponse = await fetch(`https://esi.evetech.net/v5/corporations/${charData.corporation_id}/`, {
                        headers: {
                          'User-Agent': 'LMeve/2.0 (Corporation Details)'
                        }
                      });
                      if (corpResponse.ok) {
                        corporationData = await corpResponse.json();
                      }
                    } catch (error) {
                      console.warn('⚠️ Failed to fetch corporation data:', error);
                    }
                  }

                  return {
                    characterId: id,
                    characterName: charData.name,
                    corporationId: charData.corporation_id,
                    corporationName: corporationData?.name || 'Unknown Corporation',
                    allianceId: charData.alliance_id,
                    allianceName: corporationData?.alliance_name,
                    securityStatus: charData.security_status
                  };
                }
              } catch (error) {
                console.warn('⚠️ Failed to fetch character data for ID:', id, error);
                return null;
              }
            })
          );

          setCharacterSearchResults(characterDetails.filter(Boolean));
        } else {
          setCharacterSearchResults([]);
          toast.info('No characters found with that name');
        }
      } else {
        throw new Error(`Search failed: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Character search error:', error);
      toast.error('Failed to search characters. Please try again.');
      setCharacterSearchResults([]);
    } finally {
      setIsSearchingCharacters(false);
    }
  };

  // Handle character selection and user creation
  const handleCreateUserFromCharacter = async (character: any, role: UserRole = 'corp_member') => {
    try {
      const username = character.characterName.toLowerCase().replace(/\s+/g, '_');
      const password = Math.random().toString(36).slice(-8); // Generate random password
      
      await createManualUser(username, password, role, {
        characterId: character.characterId,
        characterName: character.characterName,
        corporationId: character.corporationId,
        corporationName: character.corporationName,
        allianceId: character.allianceId,
        allianceName: character.allianceName
      });

      setShowCharacterLookup(false);
      setSelectedCharacter(null);
      setCharacterSearchTerm('');
      setCharacterSearchResults([]);
      refreshUsers();
      
      toast.success(`User created for ${character.characterName} with username: ${username}`);
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    }
  };

  // Link selected character to an existing user
  const handleLinkCharacterToUser = async (user: LMeveUser, character: any) => {
    try {
      await linkUserToCharacter(user.id, {
        characterId: character.characterId,
        characterName: character.characterName,
        corporationId: character.corporationId,
        corporationName: character.corporationName,
        allianceId: character.allianceId,
        allianceName: character.allianceName
      });
      setShowCharacterLookup(false);
      setSelectedCharacter(null);
      setCharacterSearchTerm('');
      setCharacterSearchResults([]);
      setLinkTargetUser(null);
      refreshUsers();
      toast.success(`Linked ${character.characterName} to ${user.username || user.characterName}`);
    } catch (error) {
      console.error('Error linking character:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to link character');
    }
  };

  // Handle create user
  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsCreating(true);
    try {
      await createManualUser(newUsername.trim(), newPassword, newRole);
      toast.success('User created successfully');
      setNewUsername('');
      setNewPassword('');
      setNewRole('corp_member');
      setIsCreateDialogOpen(false);
      refreshUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle edit user
  const handleEditUser = async () => {
    if (!selectedUser) return;

    setIsUpdating(true);
    try {
      await updateUserRole(selectedUser.id, editRole);
      toast.success('User role updated successfully');
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      refreshUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsDeleting(true);
    try {
      await deleteUser(selectedUser.id);
      toast.success('User deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      refreshUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open edit dialog
  const openEditDialog = (user: LMeveUser) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setIsEditDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (user: LMeveUser) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  // Get role badge variant
  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'destructive';
      case 'corp_admin':
        return 'default';
      case 'corp_director':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Format last login
  const formatLastLogin = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return `${Math.floor(diffInHours / 24)}d ago`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${isMobileView ? 'space-y-4' : 'flex items-center justify-between'}`}>
        <div>
          <h2 className={`${isMobileView ? 'text-xl' : 'text-2xl'} font-bold tracking-tight`}>User Management</h2>
          <p className="text-muted-foreground text-sm">
            Manage user accounts and permissions for your corporation
          </p>
        </div>
        
        <div className={`flex items-center gap-2 ${isMobileView ? 'w-full' : ''}`}>
          <Button 
            onClick={() => {
              setLinkTargetUser(null); // explicit create mode
              setShowCharacterLookup(true);
            }}
            variant="outline"
            className={isMobileView ? "mobile-touch-target flex-1" : ""}
          >
            <LinkSimple size={16} className="mr-2" />
            Link/Create from Character
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className={isMobileView ? "mobile-touch-target flex-1" : ""}>
                <UserPlus size={16} className="mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter username"
                    disabled={isCreating}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter password"
                    disabled={isCreating}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select 
                    value={newRole} 
                    onValueChange={(value) => setNewRole(value as UserRole)}
                    disabled={isCreating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([role, label]) => {
                        // Only super admin can create other super admins
                        if (role === 'super_admin' && !canManageSystem) return null;
                        
                        return (
                          <SelectItem key={role} value={role}>
                            <div className="flex flex-col">
                              <span>{label}</span>
                              <span className="text-xs text-muted-foreground">
                                {ROLE_DESCRIPTIONS[role as UserRole]}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={isCreating}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateUser}
                    disabled={isCreating}
                    className="flex-1"
                  >
                    {isCreating ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Character Linking Information */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info size={16} className="text-accent mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-foreground">Character Linking System</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>• <strong>ESI Users:</strong> Automatically linked to EVE characters via SSO authentication</li>
                <li>• <strong>Manual Users:</strong> Can be tied to characters using the "Link Character" feature</li>
                <li>• <strong>Character Search:</strong> Uses EVE's search API to find and verify characters</li>
                <li>• <strong>Corporation Validation:</strong> Characters are validated against registered corporations</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={20} />
            System Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isMobileView ? (
            /* Mobile card layout */
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="mobile-card">
                  <div className="mobile-card-header">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={user.characterId
                            ? `https://images.evetech.net/characters/${user.characterId}/portrait?size=64`
                            : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxMCIgeT0iMTAiPgo8cGF0aCBkPSJNMTAgMTJDOC4zNCAxMiA3IDEwLjY2IDcgOUM3IDcuMzQgOC4zNCA2IDEwIDZDMTEuNjYgNiAxMyA3LjM0IDEzIDlDMTMgMTAuNjYgMTEuNjYgMTIgMTAgMTJaIiBmaWxsPSIjOTk5Ii8+CjxwYXRoIGQ9Ik0xMCAxNUM3LjI0IDE1IDUgMTIuMjQgNSAxMEM1IDcuNzYgNy4yNCA1IDEwIDVDMTIuMjQgNSAxNSA3Ljc2IDE1IDEwQzE1IDEyLjI0IDEyLjI0IDE1IDEwIDE1WiIgZmlsbD0iIzk5OSIvPgo8L3N2Zz4KPC9zdmc+'}
                          alt={user.characterName || user.username || 'Unknown'}
                          className="w-10 h-10 rounded-full border border-accent/30"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxMCIgeT0iMTAiPgo8cGF0aCBkPSJNMTAgMTJDOC4zNCAxMiA3IDEwLjY2IDcgOUM3IDcuMzQgOC4zNCA2IDEwIDZDMTEuNjYgNiAxMyA3LjM0IDEzIDlDMTMgMTAuNjYgMTEuNjYgMTIgMTAgMTJaIiBmaWxsPSIjOTk5Ii8+CjxwYXRoIGQ9Ik0xMCAxNUM3LjI0IDE1IDUgMTIuMjQgNSAxMEM1IDcuNzYgNy4yNCA1IDEwIDVDMTIuMjQgNSAxNSA3Ljc2IDE1IDEwQzE1IDEyLjI0IDEyLjI0IDE1IDEwIDE1WiIgZmlsbD0iIzk5OSIvPgo8L3N2Zz4KPC9zdmc+';
                          }}
                        />
                        {user.characterId && (
                          <span
                            title="Linked character"
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent border border-white"
                          />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">
                          {user.characterName || user.username || 'Unknown'}
                        </div>
                        {user.username && user.characterName && (
                          <div className="text-xs text-muted-foreground">@{user.username}</div>
                        )}
                      </div>
                    </div>
                    <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </div>
                  
                  <div className="mobile-card-content">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Authentication:</span>
                      {user.authMethod === 'esi' ? (
                        <Badge variant="secondary" className="text-xs">
                          <Key size={12} className="mr-1" />
                          ESI
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <Shield size={12} className="mr-1" />
                          Manual
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Corporation:</span>
                      <span className="text-sm">{user.corporationName || 'No Corporation'}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Last Login:</span>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={14} className="text-muted-foreground" />
                        {formatLastLogin(user.lastLogin)}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Status:</span>
                      {user.isActive ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle size={14} />
                          <span className="text-xs">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-600">
                          <Warning size={14} />
                          <span className="text-xs">Inactive</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-2 flex justify-end gap-1">
                      {/* Link/Unlink actions for manual users */}
                      {user.authMethod === 'manual' && (
                        <>
                          {!user.characterId ? (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setLinkTargetUser(user);
                                setShowCharacterLookup(true);
                              }}
                              className="mobile-touch-target"
                            >
                              <LinkSimple size={14} />
                            </Button>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={async () => {
                                await unlinkUserCharacter(user.id);
                                refreshUsers();
                                toast.success('Unlinked character');
                              }}
                              className="mobile-touch-target"
                            >
                              <X size={14} />
                            </Button>
                          )}
                        </>
                      )}
                      {user.id !== currentUser?.id && (user.role !== 'super_admin' || canManageSystem) && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEditDialog(user)}
                          className="mobile-touch-target"
                        >
                          <PencilSimple size={14} />
                        </Button>
                      )}
                      
                      {user.id !== currentUser?.id && (user.role !== 'super_admin' || canManageSystem) && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openDeleteDialog(user)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 mobile-touch-target"
                        >
                          <Trash size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop table layout */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Authentication</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Corporation</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={user.characterId
                              ? `https://images.evetech.net/characters/${user.characterId}/portrait?size=64`
                              : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxMCIgeT0iMTAiPgo8cGF0aCBkPSJNMTAgMTJDOC4zNCAxMiA3IDEwLjY2IDcgOUM3IDcuMzQgOC4zNCA2IDEwIDZDMTEuNjYgNiAxMyA3LjM0IDEzIDlDMTMgMTAuNjYgMTEuNjYgMTIgMTAgMTJaIiBmaWxsPSIjOTk5Ii8+CjxwYXRoIGQ9Ik0xMCAxNUw3LjI0IDE1IDUgMTIuMjQgNSAxMEM1IDcuNzYgNy4yNCA1IDEwIDVDMTIuMjQgNSAxNSA3Ljc2IDE1IDEwQzE1IDEyLjI0IDEyLjI0IDE1IDEwIDE1WiIgZmlsbD0iIzk5OSIvPgo8L3N2Zz4KPC9zdmc+'}
                            alt={user.characterName || user.username || 'Unknown'}
                            className="w-10 h-10 rounded-full border border-accent/30"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxMCIgeT0iMTAiPgo8cGF0aCBkPSJNMTAgMTJDOC4zNCAxMiA3IDEwLjY2IDcgOUM3IDcuMzQgOC4zNCA2IDEwIDZDMTEuNjYgNiAxMyA3LjM0IDEzIDlDMTMgMTAuNjYgMTEuNjYgMTIgMTAgMTJaIiBmaWxsPSIjOTk5Ii8+CjxwYXRoIGQ9Ik0xMCAxNUw3LjI0IDE1IDUgMTIuMjQgNSAxMEM1IDcuNzYgNy4yNCA1IDEwIDVDMTIuMjQgNSAxNSA3Ljc2IDE1IDEwQzE1IDEyLjI0IDEyLjI0IDE1IDEwIDE1WiIgZmlsbD0iIzk5OSIvPgo8L3N2Zz4KPC9zdmc+';
                            }}
                          />
                          {user.characterId && (
                            <span
                              title="Linked character"
                              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent border border-white"
                            />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {user.characterName || user.username || 'Unknown'}
                          </span>
                          {user.username && user.characterName && (
                            <span className="text-xs text-muted-foreground">
                              @{user.username}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.authMethod === 'esi' ? (
                          <Badge variant="secondary" className="text-xs">
                            <Key size={12} className="mr-1" />
                            ESI
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Shield size={12} className="mr-1" />
                            Manual
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <span className="text-sm">
                        {user.corporationName || 'No Corporation'}
                      </span>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={14} className="text-muted-foreground" />
                        {formatLastLogin(user.lastLogin)}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {user.isActive ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle size={14} />
                          <span className="text-xs">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-600">
                          <Warning size={14} />
                          <span className="text-xs">Inactive</span>
                        </div>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Link/Unlink for manual users */}
                        {user.authMethod === 'manual' && (
                          !user.characterId ? (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setLinkTargetUser(user);
                                setShowCharacterLookup(true);
                              }}
                            >
                              <LinkSimple size={14} />
                            </Button>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={async () => {
                                await unlinkUserCharacter(user.id);
                                refreshUsers();
                                toast.success('Unlinked character');
                              }}
                            >
                              <X size={14} />
                            </Button>
                          )
                        )}
                        {/* Can't edit current user or super admin (unless current user is super admin) */}
                        {user.id !== currentUser?.id && (user.role !== 'super_admin' || canManageSystem) && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <PencilSimple size={14} />
                          </Button>
                        )}
                        
                        {/* Can't delete current user or super admin (unless current user is super admin) */}
                        {user.id !== currentUser?.id && (user.role !== 'super_admin' || canManageSystem) && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openDeleteDialog(user)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash size={14} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>No users found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 pt-4">
              <Alert>
                <Shield size={16} />
                <AlertDescription>
                  Editing role for: <strong>{selectedUser.characterName || selectedUser.username}</strong>
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select 
                  value={editRole} 
                  onValueChange={(value) => setEditRole(value as UserRole)}
                  disabled={isUpdating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([role, label]) => {
                      // Only super admin can assign super admin role
                      if (role === 'super_admin' && !canManageSystem) return null;
                      
                      return (
                        <SelectItem key={role} value={role}>
                          <div className="flex flex-col">
                            <span>{label}</span>
                            <span className="text-xs text-muted-foreground">
                              {ROLE_DESCRIPTIONS[role as UserRole]}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={isUpdating}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleEditUser}
                  disabled={isUpdating}
                  className="flex-1"
                >
                  {isUpdating ? 'Updating...' : 'Update Role'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 pt-4">
              <Alert variant="destructive">
                <Warning size={16} />
                <AlertDescription>
                  This action cannot be undone. This will permanently delete the user account for:{' '}
                  <strong>{selectedUser.characterName || selectedUser.username}</strong>
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleDeleteUser}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  {isDeleting ? 'Deleting...' : 'Delete User'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Character Lookup Dialog */}
      <Dialog open={showCharacterLookup} onOpenChange={(open) => {
        setShowCharacterLookup(open);
        if (!open) {
          setLinkTargetUser(null);
          setSelectedCharacter(null);
          setCharacterSearchResults([]);
          setCharacterSearchTerm('');
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{linkTargetUser ? 'Link EVE Character to User' : 'Create User from EVE Character'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {/* Character Search */}
            <div className="space-y-2">
              <Label htmlFor="characterSearch">Search EVE Characters</Label>
              <div className="flex gap-2">
                <Input
                  id="characterSearch"
                  value={characterSearchTerm}
                  onChange={(e) => setCharacterSearchTerm(e.target.value)}
                  placeholder="Enter character name (minimum 3 characters)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && characterSearchTerm.length >= 3) {
                      searchCharacters(characterSearchTerm);
                    }
                  }}
                />
                <Button
                  onClick={() => searchCharacters(characterSearchTerm)}
                  disabled={isSearchingCharacters || characterSearchTerm.length < 3}
                  size="sm"
                >
                  {isSearchingCharacters ? (
                    <ArrowClockwise size={16} className="animate-spin mr-2" />
                  ) : (
                    <Rocket size={16} className="mr-2" />
                  )}
                  Search
                </Button>
              </div>
            </div>

            {/* Search Results */}
            {characterSearchResults.length > 0 && (
              <div className="space-y-2">
                <Label>Search Results</Label>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {characterSearchResults.map((character) => (
                    <div
                      key={character.characterId}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedCharacter?.characterId === character.characterId
                          ? 'border-accent bg-accent/10'
                          : 'border-border hover:border-accent/50'
                      }`}
                      onClick={() => setSelectedCharacter(character)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://images.evetech.net/characters/${character.characterId}/portrait?size=64`}
                          alt={character.characterName}
                          className="w-10 h-10 rounded-full border border-accent/30"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxMCIgeT0iMTAiPgo8cGF0aCBkPSJNMTAgMTJDOC4zNCAxMiA3IDEwLjY2IDcgOUM3IDcuMzQgOC4zNCA2IDEwIDZDMTEuNjYgNiAxMyA3LjM0IDEzIDlDMTMgMTAuNjYgMTEuNjYgMTIgMTAgMTJaIiBmaWxsPSIjOTk5Ii8+CjxwYXRoIGQ9Ik0xMCAxNUM3LjI0IDE1IDUgMTIuMjQgNSAxMEM1IDcuNzYgNy4yNCA1IDEwIDVDMTIuMjQgNSAxNSA3Ljc2IDE1IDEwQzE1IDEyLjI0IDEyLjI0IDE1IDEwIDE1WiIgZmlsbD0iIzk5OSIvPgo8L3N2Zz4KPC9zdmc+';
                          }}
                        />
                        <div className="flex-1">
                          <h4 className="font-medium">{character.characterName}</h4>
                          <p className="text-sm text-muted-foreground">
                            {character.corporationName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Security Status: {character.securityStatus?.toFixed(2) || 'N/A'}
                          </p>
                        </div>
                        {selectedCharacter?.characterId === character.characterId && (
                          <CheckCircle size={20} className="text-accent" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Role Selection - only when creating a new user */}
            {selectedCharacter && !linkTargetUser && (
              <div className="space-y-2">
                <Label>Assign Role</Label>
                <Select value={selectedRoleForCreation} onValueChange={(v) => setSelectedRoleForCreation(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([role, label]) => {
                      // Only super admin can create other super admins
                      if (role === 'super_admin' && !canManageSystem) return null;
                      
                      return (
                        <SelectItem key={role} value={role}>
                          <div className="flex flex-col">
                            <span>{label}</span>
                            <span className="text-xs text-muted-foreground">
                              {ROLE_DESCRIPTIONS[role as UserRole]}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-6">
            <Button
              onClick={() => {
                setShowCharacterLookup(false);
                setCharacterSearchTerm('');
                setCharacterSearchResults([]);
                setSelectedCharacter(null);
                setLinkTargetUser(null);
              }}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedCharacter) {
                  if (linkTargetUser) {
                    handleLinkCharacterToUser(linkTargetUser, selectedCharacter);
                  } else {
                    handleCreateUserFromCharacter(selectedCharacter, selectedRoleForCreation);
                  }
                }
              }}
              disabled={!selectedCharacter}
              className="flex-1 bg-accent hover:bg-accent/90"
            >
              {linkTargetUser ? 'Link Character' : 'Create User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}