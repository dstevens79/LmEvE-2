import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Building,
  CheckCircle,
  Warning,
  X,
  Copy,
  Eye,
  EyeSlash,
  Key,
  UserCheck,
  Plus,
  Trash
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useESISettings } from '@/lib/persistenceService';
import { useAuth } from '@/lib/auth-provider';
import { CorpSettings } from '@/lib/types';

interface ESISettingsProps {
  isMobileView?: boolean;
}

interface RegisteredCorporation {
  id: string;
  name: string;
  ticker: string;
  memberCount: number;
  esiConfigured: boolean;
  lastSync: string | null;
  directors: string[];
  members: string[];
}

export function ESISettings({ isMobileView = false }: ESISettingsProps) {
  const { user, esiConfig, updateESIConfig, getRegisteredCorporations } = useAuth();
  
  const [esiSettings, setESISettings] = useESISettings();

  // Update helper function
  const updateESISettings = (updates: any) => {
    setESISettings(current => ({
      ...current,
      ...updates
    }));
  };

  // ESI Configuration state
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [clientId, setClientId] = useState(
    typeof esiConfig?.clientId === 'string' ? esiConfig.clientId : ''
  );
  const [clientSecret, setClientSecret] = useState(
    typeof esiConfig?.clientSecret === 'string' ? esiConfig.clientSecret : ''
  );
  
  // Corporation management state
  const [registeredCorps, setRegisteredCorps] = useState<RegisteredCorporation[]>([]);
  const [corpESICount, setCorpESICount] = useState(0);

  // Load settings on component mount
  useEffect(() => {
    loadCorporationData();
  }, []);

  // Update local state when auth config changes
  useEffect(() => {
    const id = typeof esiConfig?.clientId === 'string' ? esiConfig.clientId : '';
    const secret = typeof esiConfig?.clientSecret === 'string' ? esiConfig.clientSecret : '';
    setClientId(id);
    setClientSecret(secret);
  }, [esiConfig]);

  const loadCorporationData = () => {
    const corps = getRegisteredCorporations();
    setRegisteredCorps(corps.map(corp => ({
      id: corp.corporationId.toString(),
      name: corp.corporationName,
      ticker: corp.ticker || 'UNK',
      memberCount: corp.memberCount || 0,
      esiConfigured: corp.esiScopes && corp.esiScopes.length > 0,
      lastSync: corp.lastSync || null,
      directors: corp.directors || [],
      members: corp.members || []
    })));
    
    setCorpESICount(corps.filter(corp => corp.esiScopes && corp.esiScopes.length > 0).length);
  };

  const handleUpdateESIConfig = async () => {
    if (!clientId.trim()) {
      toast.error('Client ID is required');
      return;
    }

    if (!clientSecret.trim()) {
      toast.error('Client Secret is required');
      return;
    }

    try {
      // Auth provider expects (clientId: string, clientSecret?: string) — not an object.
      await updateESIConfig(clientId.trim(), clientSecret.trim());
      updateESISettings({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
      });

      toast.success('ESI configuration updated successfully');
    } catch (error) {
      console.error('Failed to update ESI config:', error);
      toast.error('Failed to update ESI configuration');
    }
  };

  const handleCopyClientId = () => {
    if (clientId) {
      navigator.clipboard.writeText(clientId);
      toast.success('Client ID copied to clipboard');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await handleUpdateESIConfig();
      toast.success('ESI settings saved successfully');
    } catch (error) {
      toast.error('Failed to save ESI settings');
    }
  };

  const getESIStatus = () => {
    if (!esiConfig?.clientId || !esiConfig?.clientSecret) {
      return { status: 'not-configured', message: 'ESI credentials not configured' };
    }
    
    if (corpESICount === 0) {
      return { status: 'configured-no-corps', message: 'ESI configured but no corporations registered' };
    }
    
    return { status: 'configured', message: `ESI configured with ${corpESICount} corporation(s)` };
  };

  const esiStatus = getESIStatus();

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Less than 1 hour ago';
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  return (
    <div className="space-y-6">
      {/* ESI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key size={20} />
            ESI Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Building className="h-4 w-4" />
            <AlertDescription>
              Configure your EVE Online ESI application credentials. These are required for 
              corporation SSO login and data synchronization.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <div className="flex gap-2">
                <Input
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Your ESI application client ID"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyClientId}
                  disabled={!clientId}
                >
                  <Copy size={16} />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <div className="flex gap-2">
                <Input
                  id="clientSecret"
                  type={showClientSecret ? "text" : "password"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Your ESI application client secret"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClientSecret(!showClientSecret)}
                >
                  {showClientSecret ? <EyeSlash size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">ESI Status:</span>
              <Badge variant={
                esiStatus.status === 'configured' ? 'default' :
                esiStatus.status === 'configured-no-corps' ? 'secondary' : 'destructive'
              }>
                {esiStatus.status === 'configured' ? 'Configured' :
                 esiStatus.status === 'configured-no-corps' ? 'Configured (No Corps)' : 'Not Configured'}
              </Badge>
            </div>
            
            <Button onClick={handleUpdateESIConfig}>
              <CheckCircle size={16} className="mr-2" />
              Update ESI Config
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {esiStatus.message}
          </p>
        </CardContent>
      </Card>

      {/* Corporation Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building size={20} />
              Registered Corporations
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {registeredCorps.length} Total
              </Badge>
              <Badge variant="default" className="text-xs">
                {corpESICount} ESI Configured
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {registeredCorps.length === 0 ? (
            <div className="text-center py-8">
              <Building size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Corporations Registered</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Corporations are registered when directors or CEOs authenticate via ESI
              </p>
              <Alert>
                <UserCheck className="h-4 w-4" />
                <AlertDescription>
                  To register a corporation, have a director or CEO login using the EVE SSO button 
                  and approve corporation-level ESI scopes.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-4">
              {registeredCorps.map((corp) => (
                <Card key={corp.id} className="border border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <img 
                            src={`https://images.evetech.net/corporations/${corp.id}/logo?size=32`}
                            alt={`${corp.name} logo`}
                            className="w-8 h-8 rounded border"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjMjIyIi8+CjxwYXRoIGQ9Ik0xNiA4TDI0IDE2TDE2IDI0TDggMTZMMTYgOFoiIGZpbGw9IiM2NjYiLz4KPC9zdmc+';
                            }}
                          />
                          <div>
                            <h3 className="font-medium">{corp.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              [{corp.ticker}] • {corp.memberCount.toLocaleString()} members
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">ESI:</span>
                            <Badge 
                              variant={corp.esiConfigured ? 'default' : 'secondary'}
                              className="text-xs h-5"
                            >
                              {corp.esiConfigured ? 'Configured' : 'Not Configured'}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Last Sync:</span>
                            <span className="text-foreground">
                              {formatLastSync(corp.lastSync)}
                            </span>
                          </div>
                        </div>
                        
                        {corp.directors.length > 0 && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Directors: </span>
                            <span className="text-foreground">
                              {corp.directors.slice(0, 3).join(', ')}
                              {corp.directors.length > 3 && ` +${corp.directors.length - 3} more`}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Corporation SSO Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Corporation Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <UserCheck className="h-4 w-4" />
            <AlertDescription>
              <strong>How Corporation Registration Works:</strong><br />
              <br />
              1. <strong>ESI Configuration:</strong> First, configure your ESI application credentials above<br />
              2. <strong>Director/CEO Login:</strong> Corporation directors or CEOs must login using the EVE SSO button<br />
              3. <strong>Scope Approval:</strong> During login, they approve corporation-level ESI scopes<br />
              4. <strong>Automatic Registration:</strong> The corporation is automatically registered with full access<br />
              <br />
              <strong>Member Access:</strong> Regular members can login after their corporation is registered by leadership.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border border-accent/20">
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <Building size={32} className="mx-auto text-accent" />
                  <h3 className="font-medium">Directors & CEOs</h3>
                  <p className="text-xs text-muted-foreground">
                    Can register new corporations and configure ESI scopes
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-muted">
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <UserCheck size={32} className="mx-auto text-muted-foreground" />
                  <h3 className="font-medium">Members</h3>
                  <p className="text-xs text-muted-foreground">
                    Can access data after their corporation is registered
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings}>
              <CheckCircle size={16} className="mr-2" />
              Save ESI Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}