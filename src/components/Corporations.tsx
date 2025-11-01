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
  import { hasPermission } from '@/lib/roles';
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

  const isAdmin = hasPermission(user, 'canManageSystem');
  const canEditCorpScopes = hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem');

  const handlePersonalAuth = async () => {
    try {
      // All scopes are required - build scope list from all personal scopes
      const allScopes = PERSONAL_ESI_SCOPES.map(s => s.scope);
      
      // Store scopes for later reference
      sessionStorage.setItem('personal-esi-scopes', JSON.stringify(allScopes));
      
      // Initiate ESI login with all required scopes
      const authUrl = await loginWithESI('enhanced');
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to start personal ESI auth:', error);
      toast.error('Failed to start authentication');
    }
  };

  return (
    <div className="space-y-4">
      {/* ESI Configuration Status */}
      {!esiConfig?.clientId && (
        <Alert>
          <Warning size={16} />
          <AlertDescription>
            ESI authentication is not configured. Contact your system administrator to configure ESI Client ID and Secret in Settings → Database.
          </AlertDescription>
        </Alert>
      )}

      {/* Side-by-Side Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Personal ESI Authentication */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCheck size={18} />
              Personal ESI
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Character-level authentication for personal data
            </p>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col">
            {/* Current User Status */}
            {user && user.authMethod === 'esi' && (
              <div className="p-2 bg-accent/5 border border-accent/20 rounded">
                <div className="flex items-center gap-2">
                  {user.characterId && (
                    <img 
                      src={`https://images.evetech.net/characters/${user.characterId}/portrait?size=64`}
                      alt={user.characterName || 'Character'}
                      className="w-8 h-8 rounded-full border border-accent/30"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-medium text-sm truncate">{user.characterName || 'Unknown'}</h4>
                      <Badge variant="default" className="text-xs h-5">
                        <CheckCircle size={10} className="mr-1" />
                        Active
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.corporationName || 'Unknown Corporation'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Scope Selection */}
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Required Scopes</h4>
                <Badge variant="outline" className="text-xs h-5">
                  {PERSONAL_ESI_SCOPES.length} total
                </Badge>
              </div>

              <div className="space-y-1">
                {PERSONAL_ESI_SCOPES.map(scope => (
                  <div 
                    key={scope.scope} 
                    className="flex items-center justify-between p-1.5 bg-muted/30 rounded border border-border/50"
                  >
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Checkbox 
                        checked={true} 
                        disabled={true}
                        className="opacity-50 h-3.5 w-3.5"
                      />
                      <Label className="text-xs cursor-default truncate">
                        {scope.label}
                      </Label>
                    </div>
                    <ScopeInfoButton scope={scope} />
                  </div>
                ))}
              </div>
            </div>

            {/* Authentication Action */}
            <div className="pt-2 mt-auto">
              {user?.authMethod === 'esi' ? (
                <Button
                  onClick={handlePersonalAuth}
                  disabled={!esiConfig?.clientId}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Key size={14} className="mr-2" />
                  Update Permissions
                </Button>
              ) : (
                <Button
                  onClick={handlePersonalAuth}
                  disabled={!esiConfig?.clientId}
                  size="sm"
                  className="w-full bg-accent hover:bg-accent/90"
                >
                  <Rocket size={14} className="mr-2" />
                  Authenticate with EVE
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Corporation ESI Management */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building size={18} />
              Corporation ESI
              {!canEditCorpScopes && (
                <Badge variant="outline" className="text-xs ml-auto">
                  <LockKey size={10} className="mr-1" />
                  Read Only
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Corporation-level authentication for Directors/CEOs
            </p>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col">
            {/* Corporation Scopes Display */}
            <div className="space-y-2 flex-1">
              {/* Required Corporation Scopes */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Required Scopes
                </h4>
                <div className="space-y-1">
                  {CORPORATION_ESI_SCOPES.filter(s => s.required).map(scope => (
                    <div 
                      key={scope.scope} 
                      className={`flex items-center justify-between p-1.5 rounded border ${
                        canEditCorpScopes 
                          ? 'bg-muted/30 border-border/50' 
                          : 'bg-muted/10 border-border/30 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Checkbox 
                          checked={true} 
                          disabled={true}
                          className="opacity-50 h-3.5 w-3.5"
                        />
                        <Label className="text-xs cursor-default truncate">
                          {scope.label}
                        </Label>
                      </div>
                      <ScopeInfoButton scope={scope} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional Corporation Scopes */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Optional Scopes
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                  {CORPORATION_ESI_SCOPES.filter(s => !s.required).map(scope => (
                    <div 
                      key={scope.scope} 
                      className={`flex items-center justify-between p-1.5 rounded border ${
                        canEditCorpScopes 
                          ? 'hover:bg-muted/30 border-transparent hover:border-border/50 transition-colors' 
                          : 'bg-muted/10 border-border/30 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Checkbox 
                          checked={true}
                          disabled={!canEditCorpScopes}
                          className={`h-3.5 w-3.5 ${!canEditCorpScopes ? 'opacity-50' : ''}`}
                        />
                        <Label 
                          className={`text-xs truncate ${canEditCorpScopes ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          {scope.label}
                        </Label>
                      </div>
                      <ScopeInfoButton scope={scope} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Registration Action */}
            <div className="pt-2 mt-auto">
              {user && user.authMethod === 'esi' && (hasPermission(user, 'canManageCorp') || hasPermission(user, 'canManageSystem')) ? (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    try {
                      const corpAuth = await loginWithESI('corporation');
                      window.location.href = corpAuth;
                    } catch (error) {
                      console.error('Failed to start corp ESI auth:', error);
                      toast.error('Failed to start corporation authentication');
                    }
                  }}
                  disabled={!esiConfig?.clientId}
                >
                  <Key size={14} className="mr-2" />
                  Register Corporation ESI
                </Button>
              ) : (
                <div className="p-2 bg-muted/30 rounded text-center">
                  <p className="text-xs text-muted-foreground">
                    Director/CEO role required
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Registered Corporations */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Registered Corporations</CardTitle>
            <Badge variant="outline" className="text-xs">
              {registeredCorps.filter(corp => corp.isActive).length} Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {registeredCorps.length > 0 ? (
            <div className="space-y-2">
              {registeredCorps.map((corp) => (
                <div key={corp.corporationId} className="p-3 border border-border rounded-lg space-y-2">
                  <div className="flex items-center gap-3">
                    {corp.corporationId && (
                      <img 
                        src={`https://images.evetech.net/corporations/${corp.corporationId}/logo?size=64`}
                        alt={corp.corporationName}
                        className="w-10 h-10 rounded border border-accent/30 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-sm truncate">{corp.corporationName}</h5>
                      <p className="text-xs text-muted-foreground">
                        ID: {corp.corporationId}
                      </p>
                    </div>
                    <Badge variant={corp.isActive ? "default" : "secondary"} className="text-xs h-6 flex-shrink-0">
                      {corp.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {canEditCorpScopes && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs flex-shrink-0"
                          onClick={() => updateCorporation(corp.corporationId, { isActive: !corp.isActive })}
                        >
                          {corp.isActive ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 w-8 p-0 flex-shrink-0"
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
                  
                  <div className="p-2 bg-muted/30 rounded text-xs space-y-1.5">
                    <div>
                      <p className="font-medium mb-1">Scopes ({corp.registeredScopes.length}):</p>
                      <div className="flex flex-wrap gap-1">
                        {corp.registeredScopes.slice(0, 4).map((scope, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs h-5">
                            {scope.split('.')[1]?.replace('read_', '').replace('_', ' ') || scope}
                          </Badge>
                        ))}
                        {corp.registeredScopes.length > 4 && (
                          <Badge variant="outline" className="text-xs h-5">
                            +{corp.registeredScopes.length - 4}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
                      <span className="text-muted-foreground">Members: {corp.memberCount || 0}</span>
                      <span className="text-muted-foreground">
                        Last Update: {corp.lastTokenRefresh ? new Date(corp.lastTokenRefresh).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 border border-dashed border-border rounded-lg text-center">
              <Building size={28} className="mx-auto mb-2 text-muted-foreground" />
              <h5 className="font-medium text-sm mb-1">No Corporations Registered</h5>
              <p className="text-xs text-muted-foreground mb-3">
                Directors and CEOs can register corporations using the button above
              </p>
              <div className="space-y-1.5 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded">
                <p><strong>Personal ESI:</strong> Character data and personal features</p>
                <p><strong>Corporation ESI:</strong> Full corporation data sync and management</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}