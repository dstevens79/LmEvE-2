import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Users,
  CheckCircle,
  Warning,
  X,
  Plus,
  Trash,
  PencilSimple,
  Key,
  UserCheck,
  Eye,
  EyeSlash,
  Copy,
  Shield,
  Info
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useManualUsers } from '@/lib/persistenceService';
import { UserManagement } from '@/components/UserManagement';
import { useAuth } from '@/lib/auth-provider';

interface UserSettingsProps {
  isMobileView?: boolean;
}

interface ManualUser {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'director' | 'manager' | 'member';
  characterId?: string;
  characterName?: string;
  corporationId?: string;
  corporationName?: string;
  esiScopes?: string[];
  lastLogin?: string;
  created: string;
  enabled: boolean;
}

interface ESICharacter {
  characterId: string;
  characterName: string;
  corporationId: string;
  corporationName: string;
  esiScopes: string[];
  lastLogin: string;
}

function mapUiRoleToServer(role: ManualUser['role'] | string): string {
  switch (role) {
    case 'admin':
      return 'super_admin';
    case 'director':
      return 'corp_director';
    case 'manager':
      return 'corp_manager';
    case 'member':
    default:
      return 'corp_member';
  }
}

async function persistOfflineAccount(username: string, password: string, role: string): Promise<void> {
  const resp = await fetch('/api/auth/bootstrap-users.php', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'upsert',
      username,
      password,
      role: mapUiRoleToServer(role),
    }),
  });
  const json = await resp.json().catch(() => null);
  if (!resp.ok || json?.ok === false) {
    throw new Error(json?.error || `Failed to save offline account (HTTP ${resp.status})`);
  }
}

export function UserSettings({ isMobileView = false }: UserSettingsProps) {
  const { user: currentUser, getRegisteredCorporations } = useAuth();
  
  const [manualUsers, setManualUsers] = useManualUsers();

  // Update helper function
  const updateManualUsers = (updates: any) => {
    setManualUsers(updates);
  };

  // User management state
  const [users, setUsers] = useState<ManualUser[]>([]);
  const [esiCharacters, setESICharacters] = useState<ESICharacter[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<ManualUser | null>(null);
  
  // New user form state
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'member' as ManualUser['role']
  });

  // Password visibility states
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Load settings and data on component mount
  useEffect(() => {
    loadUsers();
    loadESICharacters();
  }, []);

  const loadUsers = () => {
    const userList = manualUsers?.users || [];
    // Add default admin if not exists
    if (!userList.find(u => u.username === 'admin')) {
      userList.push({
        id: 'admin-default',
        username: 'admin',
        password: '12345',
        role: 'admin',
        created: new Date().toISOString(),
        enabled: true
      });
    }
    setUsers(userList);
  };

  const loadESICharacters = () => {
    // Load ESI-authenticated characters from corporation data
    const corps = getRegisteredCorporations();
    const characters: ESICharacter[] = [];
    
    corps.forEach(corp => {
      if (corp.members) {
        corp.members.forEach(member => {
          characters.push({
            characterId: member.characterId?.toString() || '',
            characterName: member.characterName || '',
            corporationId: corp.corporationId.toString(),
            corporationName: corp.corporationName,
            esiScopes: corp.esiScopes || [],
            lastLogin: member.lastLogin || ''
          });
        });
      }
    });
    
    setESICharacters(characters);
  };

  const handleAddUser = async () => {
    if (!newUser.username.trim()) {
      toast.error('Username is required');
      return;
    }

    if (!newUser.password.trim()) {
      toast.error('Password is required');
      return;
    }

    if (newUser.password !== newUser.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (users.find(u => u.username.toLowerCase() === newUser.username.toLowerCase())) {
      toast.error('Username already exists');
      return;
    }

    try {
      await persistOfflineAccount(newUser.username.trim(), newUser.password, newUser.role);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save offline account');
      return;
    }

    const user: ManualUser = {
      id: Date.now().toString(),
      username: newUser.username.trim(),
      password: newUser.password,
      role: newUser.role,
      created: new Date().toISOString(),
      enabled: true
    };

    const updatedUsers = [...users, user];
    setUsers(updatedUsers);
    updateManualUsers({ users: updatedUsers });
    
    setNewUser({
      username: '',
      password: '',
      confirmPassword: '',
      role: 'member'
    });
    setShowAddUser(false);
    
    toast.success('User added successfully');
  };

  const handleUpdateUser = async (id: string, updates: Partial<ManualUser>) => {
    const existing = users.find(u => u.id === id);
    if (!existing) return;

    const merged = { ...existing, ...updates };
    if (updates.password && updates.password.trim() !== '') {
      try {
        await persistOfflineAccount(merged.username, updates.password, merged.role);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to update offline password');
        return;
      }
    }

    const updatedUsers = users.map(u => u.id === id ? merged : u);
    setUsers(updatedUsers);
    updateManualUsers({ users: updatedUsers });
    
    if (editingUser && editingUser.id === id) {
      setEditingUser(null);
    }
    
    toast.success('User updated successfully');
  };

  const handleDeleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    // Prevent deleting the default admin user
    if (user.username === 'admin' && id === 'admin-default') {
      toast.error('Cannot delete the default admin user');
      return;
    }

    const updatedUsers = users.filter(u => u.id !== id);
    setUsers(updatedUsers);
    updateManualUsers({ users: updatedUsers });
    
    toast.success('User deleted successfully');
  };

  const handleLinkCharacter = (userId: string, character: ESICharacter) => {
    handleUpdateUser(userId, {
      characterId: character.characterId,
      characterName: character.characterName,
      corporationId: character.corporationId,
      corporationName: character.corporationName,
      esiScopes: character.esiScopes
    });
    
    toast.success(`Linked ${character.characterName} to user account`);
  };

  const handleUnlinkCharacter = (userId: string) => {
    handleUpdateUser(userId, {
      characterId: undefined,
      characterName: undefined,
      corporationId: undefined,
      corporationName: undefined,
      esiScopes: undefined
    });
    
    toast.success('Character unlinked from user account');
  };

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password);
    toast.success('Password copied to clipboard');
  };

  const handleSaveSettings = async () => {
    try {
      toast.success('User settings saved successfully');
    } catch (error) {
      toast.error('Failed to save user settings');
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'director': return 'default';
      case 'manager': return 'secondary';
      default: return 'outline';
    }
  };

  const formatLastLogin = (lastLogin?: string) => {
    if (!lastLogin) return 'Never';
    const date = new Date(lastLogin);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <div className="space-y-6">
      {/* Users Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users size={20} />
              User Management
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {users.filter(u => u.enabled).length} Active
              </Badge>
              <Badge variant="outline" className="text-xs">
                {esiCharacters.length} ESI Characters
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Manage manual user accounts and link them to EVE Online characters. Manual users can 
              login with username/password, while ESI characters authenticate via EVE Online SSO.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Manual Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Manual User Accounts</CardTitle>
            <Button onClick={() => setShowAddUser(true)}>
              <Plus size={16} className="mr-2" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {users.map((user) => (
              <Card key={user.id} className="border border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <UserCheck size={16} />
                          <span className="font-medium">{user.username}</span>
                          {user.username === 'admin' && user.id === 'admin-default' && (
                            <Badge variant="destructive" className="text-xs">Default</Badge>
                          )}
                        </div>
                        
                        <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                          {user.role.toUpperCase()}
                        </Badge>
                        
                        {!user.enabled && (
                          <Badge variant="outline" className="text-xs opacity-50">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                        <div>
                          <span className="text-muted-foreground">Password:</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono">
                              {showPasswords[user.id] ? user.password : '••••••••'}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="h-5 w-5 p-0"
                            >
                              {showPasswords[user.id] ? (
                                <EyeSlash size={12} />
                              ) : (
                                <Eye size={12} />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyPassword(user.password)}
                              className="h-5 w-5 p-0"
                            >
                              <Copy size={12} />
                            </Button>
                          </div>
                        </div>
                        
                        <div>
                          <span className="text-muted-foreground">Created:</span>
                          <div className="mt-1">
                            {new Date(user.created).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      {user.characterName && (
                        <div className="flex items-center gap-2 text-xs">
                          <img 
                            src={`https://images.evetech.net/characters/${user.characterId}/portrait?size=32`}
                            alt={user.characterName}
                            className="w-6 h-6 rounded-full"
                          />
                          <span className="text-foreground">{user.characterName}</span>
                          <span className="text-muted-foreground">
                            ({user.corporationName})
                          </span>
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground">
                        Last Login: {formatLastLogin(user.lastLogin)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Select
                        value={user.role}
                        onValueChange={(role: ManualUser['role']) => 
                          handleUpdateUser(user.id, { role })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="director">Director</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {user.characterName ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnlinkCharacter(user.id)}
                        >
                          Unlink
                        </Button>
                      ) : (
                        <Select
                          onValueChange={(characterId) => {
                            const character = esiCharacters.find(c => c.characterId === characterId);
                            if (character) {
                              handleLinkCharacter(user.id, character);
                            }
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Link Character" />
                          </SelectTrigger>
                          <SelectContent>
                            {esiCharacters.map((character) => (
                              <SelectItem key={character.characterId} value={character.characterId}>
                                {character.characterName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUpdateUser(user.id, { enabled: !user.enabled })}
                      >
                        {user.enabled ? (
                          <X size={14} className="text-red-400" />
                        ) : (
                          <CheckCircle size={14} className="text-green-400" />
                        )}
                      </Button>
                      
                      {user.username !== 'admin' || user.id !== 'admin-default' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash size={14} />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ESI Characters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ESI-Authenticated Characters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {esiCharacters.length === 0 ? (
            <div className="text-center py-8">
              <Shield size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No ESI Characters</h3>
              <p className="text-sm text-muted-foreground">
                ESI characters appear here when they authenticate via EVE Online SSO
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {esiCharacters.map((character) => (
                <Card key={character.characterId} className="border border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img 
                          src={`https://images.evetech.net/characters/${character.characterId}/portrait?size=32`}
                          alt={character.characterName}
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <div className="font-medium">{character.characterName}</div>
                          <div className="text-xs text-muted-foreground">
                            {character.corporationName}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Scopes:</span>
                          <div className="font-medium">
                            {character.esiScopes.length} configured
                          </div>
                        </div>
                        
                        <div>
                          <span className="text-muted-foreground">Last Login:</span>
                          <div className="font-medium">
                            {formatLastLogin(character.lastLogin)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new manual user account with username and password authentication.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newUsername">Username</Label>
              <Input
                id="newUsername"
                value={newUser.username}
                onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Enter username"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newPassword">Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Enter password"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={newUser.confirmPassword}
                onChange={(e) => setNewUser(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Confirm password"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newUserRole">Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(role: ManualUser['role']) => 
                  setNewUser(prev => ({ ...prev, role }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="director">Director</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddUser(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAddUser}>
                Add User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Settings */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings}>
              <CheckCircle size={16} className="mr-2" />
              Save User Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}