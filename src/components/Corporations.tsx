import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Building, 
  Users, 
  Globe, 
  Shield, 
  UserCheck, 
  X, 
  Key, 
  Rocket, 
  Warning,
  Info,
  LockKey,
  CheckCircle
} from '@phosphor-icons/react';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from '@/lib/auth-provider';
import { toast } from 'sonner';

interface CorporationsProps {
  isMobileView?: boolean;
}

interface ESIScope {
  scope: string;
  label: string;
  description: string;
  required: boolean;
  category: 'character' | 'corporation';
}

const PERSONAL_ESI_SCOPES: ESIScope[] = [
  {
    scope: 'esi-characters.read_character_info.v1',
    label: 'Character Information',
    description: 'Read your basic character information including name and corporation',
    required: true,
    category: 'character'
  },
  {
    scope: 'esi-characters.read_corporation_roles.v1',
    label: 'Corporation Roles',
    description: 'Read your corporation roles to determine permissions',
    required: true,
    category: 'character'
  },
  {
    scope: 'esi-planets.manage_planets.v1',
    label: 'Planetary Interaction',
    description: 'Manage planetary colonies and view production',
    required: true,
    category: 'character'
  },
  {
    scope: 'esi-skills.read_skills.v1',
    label: 'Skills',
    description: 'View your skill levels for job assignment optimization',
    required: true,
    category: 'character'
  }
];

const CORPORATION_ESI_SCOPES: ESIScope[] = [
  {
    scope: 'esi-corporations.read_corporation_membership.v1',
    label: 'Corporation Members',
    description: 'View corporation member list and tracking',
    required: true,
    category: 'corporation'
  },
  {
    scope: 'esi-corporations.read_titles.v1',
    label: 'Corporation Titles',
    description: 'Read corporation titles for role assignment',
    required: true,
    category: 'corporation'
  },
  {
    scope: 'esi-assets.read_corporation_assets.v1',
    label: 'Corporation Assets',
    description: 'Access corporation hangars and asset tracking',
    required: true,
    category: 'corporation'
  },
  {
    scope: 'esi-industry.read_corporation_jobs.v1',
    label: 'Corporation Industry Jobs',
    description: 'View all corporation manufacturing jobs',
    required: true,
    category: 'corporation'
  },
  {
    scope: 'esi-wallet.read_corporation_wallets.v1',
    label: 'Corporation Wallets',
    description: 'Access corporation wallet divisions and transactions',
    required: true,
    category: 'corporation'
  },
  {
    scope: 'esi-corporations.read_blueprints.v1',
    label: 'Corporation Blueprints',
    description: 'View corporation blueprint library',
    required: true,
    category: 'corporation'
  },
  {
    scope: 'esi-corporations.read_divisions.v1',
    label: 'Corporation Divisions',
    description: 'Read hangar and wallet division names',
    required: true,
    category: 'corporation'
  },
  {
    scope: 'esi-universe.read_structures.v1',
    label: 'Structure Information',
    description: 'Access structure details for stations and citadels',
    required: false,
    category: 'corporation'
  },
  {
    scope: 'esi-markets.read_corporation_orders.v1',
    label: 'Market Orders',
    description: 'View corporation market orders',
    required: false,
    category: 'corporation'
  },
  {
    scope: 'esi-contracts.read_corporation_contracts.v1',
    label: 'Contracts',
    description: 'Read corporation contracts',
    required: false,
    category: 'corporation'
  },
  {
    scope: 'esi-industry.read_corporation_mining.v1',
    label: 'Mining Ledger',
    description: 'Access corporation mining statistics',
    required: false,
    category: 'corporation'
  },
  {
    scope: 'esi-corporations.read_facilities.v1',
    label: 'Corporation Facilities',
    description: 'View corporation-owned facilities',
    required: false,
    category: 'corporation'
  },
  {
    scope: 'esi-corporations.track_members.v1',
    label: 'Member Tracking',
    description: 'Enhanced member activity tracking',
    required: false,
    category: 'corporation'
  }
];

function ScopeInfoButton({ scope }: { scope: ESIScope }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <Info size={14} className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">{scope.label}</h4>
          <p className="text-xs text-muted-foreground">{scope.description}</p>
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Scope:</strong> <code className="text-xs bg-muted px-1 py-0.5 rounded">{scope.scope}</code>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              <strong>Type:</strong> {scope.category === 'character' ? 'Personal' : 'Corporation'} • {scope.required ? 'Required' : 'Optional'}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Corporations({ isMobileView = false }: CorporationsProps) {
  const { 
    user, 
    esiConfig, 
    getRegisteredCorporations, 
    updateCorporation, 
    deleteCorporation,
    loginWithESI 
  } = useAuth();
  
  const registeredCorps = getRegisteredCorporations();

  const isAdmin = user?.role && ['super_admin', 'admin', 'ceo'].includes(user.role);
  const canEditCorpScopes = user?.role && ['super_admin', 'admin', 'ceo'].includes(user.role);

  const handlePersonalAuth = () => {
    try {
      // All scopes are required - build scope list from all personal scopes
      const allScopes = PERSONAL_ESI_SCOPES.map(s => s.scope);
      
      // Store scopes for later reference
      sessionStorage.setItem('personal-esi-scopes', JSON.stringify(allScopes));
      
      // Initiate ESI login with all required scopes
      const authUrl = loginWithESI('enhanced');
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to start personal ESI auth:', error);
      toast.error('Failed to start authentication');
    }
  };

  return (
    <div className="space-y-6">
      {/* Personal ESI Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck size={20} />
            Personal ESI Authentication
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Authenticate your character with EVE Online to access personal data and site features
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current User Status */}
          {user && user.authMethod === 'esi' && (
            <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg">
              <div className="flex items-center gap-3">
                {user.characterId && (
                  <img 
                    src={`https://images.evetech.net/characters/${user.characterId}/portrait?size=64`}
                    alt={user.characterName || 'Character'}
                    className="w-10 h-10 rounded-full border-2 border-accent/30"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{user.characterName || 'Unknown Character'}</h4>
                    <Badge variant="default" className="text-xs">
                      <CheckCircle size={12} className="mr-1" />
                      ESI Authenticated
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {user.corporationName || 'Unknown Corporation'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Scope Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">ESI Access Scopes</h4>
              <Badge variant="outline" className="text-xs">
                All {PERSONAL_ESI_SCOPES.length} scopes required
              </Badge>
            </div>

            {/* All Scopes (Required) */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                The following scopes are required for LMeve to function properly with personal data
              </p>
              <div className="space-y-1">
                {PERSONAL_ESI_SCOPES.map(scope => (
                  <div 
                    key={scope.scope} 
                    className="flex items-center justify-between p-2 bg-muted/30 rounded border border-border/50"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox 
                        checked={true} 
                        disabled={true}
                        className="opacity-50"
                      />
                      <Label className="text-sm cursor-default">
                        {scope.label}
                      </Label>
                    </div>
                    <ScopeInfoButton scope={scope} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Authentication Action */}
          <div className="pt-2">
            {user?.authMethod === 'esi' ? (
              <Button
                onClick={handlePersonalAuth}
                disabled={!esiConfig?.clientId}
                variant="outline"
                className="w-full"
              >
                <Key size={16} className="mr-2" />
                Update ESI Permissions
              </Button>
            ) : (
              <Button
                onClick={handlePersonalAuth}
                disabled={!esiConfig?.clientId}
                className="w-full bg-accent hover:bg-accent/90"
              >
                <Rocket size={16} className="mr-2" />
                Authenticate with EVE Online
              </Button>
            )}
            {!esiConfig?.clientId && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                ESI not configured. Contact your administrator.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Corporation ESI Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building size={20} />
            Corporation ESI Management
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Corporation-level ESI authentication for Directors and CEOs
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Director/CEO Registration Section */}
          {user && user.authMethod === 'esi' && ['director', 'ceo', 'super_admin', 'admin'].includes(user.role || '') && (
            <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={16} className="text-accent" />
                <span className="text-sm font-medium">Corporation Registration Available</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                As a {user.role?.replace('_', ' ').toUpperCase()}, you can register your corporation for LMeve data access
              </p>
              <Button
                size="sm"
                className="w-full"
                onClick={async () => {
                  try {
                    const corpAuth = loginWithESI('corporation');
                    window.location.href = corpAuth;
                  } catch (error) {
                    console.error('Failed to start corp ESI auth:', error);
                    toast.error('Failed to start corporation authentication');
                  }
                }}
                disabled={!esiConfig?.clientId}
              >
                <Key size={16} className="mr-2" />
                Register Corporation ESI Access
              </Button>
            </div>
          )}

          {/* Corporation Scopes Display (Read-only for non-admins) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Corporation ESI Scopes</h4>
              {!canEditCorpScopes && (
                <Badge variant="outline" className="text-xs">
                  <LockKey size={12} className="mr-1" />
                  Read Only
                </Badge>
              )}
            </div>

            {/* Required Corporation Scopes */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Required Corporation Scopes
              </p>
              <div className="space-y-1">
                {CORPORATION_ESI_SCOPES.filter(s => s.required).map(scope => (
                  <div 
                    key={scope.scope} 
                    className={`flex items-center justify-between p-2 rounded border ${
                      canEditCorpScopes 
                        ? 'bg-muted/30 border-border/50' 
                        : 'bg-muted/10 border-border/30 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox 
                        checked={true} 
                        disabled={true}
                        className="opacity-50"
                      />
                      <Label className="text-sm cursor-default">
                        {scope.label}
                      </Label>
                    </div>
                    <ScopeInfoButton scope={scope} />
                  </div>
                ))}
              </div>
            </div>

            {/* Optional Corporation Scopes */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Optional Corporation Scopes
              </p>
              <div className="space-y-1">
                {CORPORATION_ESI_SCOPES.filter(s => !s.required).map(scope => (
                  <div 
                    key={scope.scope} 
                    className={`flex items-center justify-between p-2 rounded border ${
                      canEditCorpScopes 
                        ? 'hover:bg-muted/30 border-transparent hover:border-border/50 transition-colors' 
                        : 'bg-muted/10 border-border/30 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox 
                        checked={true}
                        disabled={!canEditCorpScopes}
                        className={!canEditCorpScopes ? 'opacity-50' : ''}
                      />
                      <Label 
                        className={`text-sm ${canEditCorpScopes ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        {scope.label}
                      </Label>
                    </div>
                    <ScopeInfoButton scope={scope} />
                  </div>
                ))}
              </div>
            </div>

            {!canEditCorpScopes && (
              <Alert>
                <Info size={16} />
                <AlertDescription className="text-xs">
                  Only Directors, CEOs, and Administrators can modify corporation ESI scopes. 
                  These scopes are managed at the corporation level.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Registered Corporations */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <h4 className="font-medium">Registered Corporations</h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {registeredCorps.filter(corp => corp.isActive).length} Active
                </Badge>
              </div>
            </div>
            
            {registeredCorps.length > 0 ? (
              <div className="space-y-3">
                {registeredCorps.map((corp) => (
                  <div key={corp.corporationId} className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {corp.corporationId && (
                          <img 
                            src={`https://images.evetech.net/corporations/${corp.corporationId}/logo?size=64`}
                            alt={corp.corporationName}
                            className="w-10 h-10 rounded border border-accent/30"
                          />
                        )}
                        <div>
                          <h5 className="font-medium">{corp.corporationName}</h5>
                          <p className="text-sm text-muted-foreground">
                            Corp ID: {corp.corporationId} • Registered: {new Date(corp.registrationDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={corp.isActive ? "default" : "secondary"}>
                          {corp.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {canEditCorpScopes && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateCorporation(corp.corporationId, { isActive: !corp.isActive })}
                            >
                              {corp.isActive ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(`Are you sure you want to remove ${corp.corporationName}?`)) {
                                  deleteCorporation(corp.corporationId);
                                  toast.success('Corporation removed');
                                }
                              }}
                            >
                              <X size={14} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-3 p-3 bg-muted/30 rounded text-xs space-y-2">
                      <div>
                        <p className="font-medium mb-1">Registered Scopes ({corp.registeredScopes.length}):</p>
                        <div className="flex flex-wrap gap-1">
                          {corp.registeredScopes.slice(0, 3).map((scope, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {scope.split('.')[1]?.replace('read_', '').replace('_', ' ') || scope}
                            </Badge>
                          ))}
                          {corp.registeredScopes.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{corp.registeredScopes.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                        <div>
                          <p className="text-muted-foreground">Members: {corp.memberCount || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Last Update: {corp.lastTokenRefresh ? new Date(corp.lastTokenRefresh).toLocaleDateString() : 'Never'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 border border-dashed border-border rounded-lg text-center">
                <Building size={32} className="mx-auto mb-3 text-muted-foreground" />
                <h5 className="font-medium mb-2">No Corporations Registered</h5>
                <p className="text-sm text-muted-foreground mb-4">
                  Corporation Directors and CEOs can register their corporations for LMeve data access
                </p>
                <div className="space-y-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded">
                  <p><strong>Personal Access:</strong> Authenticate to access your character data and personal features</p>
                  <p><strong>Corporation Access:</strong> Directors/CEOs register corporations for full data sync and management</p>
                </div>
              </div>
            )}
          </div>

          {/* ESI Configuration Status */}
          {!esiConfig?.clientId && (
            <Alert>
              <Warning size={16} />
              <AlertDescription>
                ESI authentication is not configured. Contact your system administrator to configure ESI Client ID and Secret in Settings → Database.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}