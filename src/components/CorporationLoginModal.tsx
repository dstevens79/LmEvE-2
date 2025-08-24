import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Rocket, Key, Globe, AlertTriangle, Info } from '@phosphor-icons/react';
import { useCorporationAuth } from '@/lib/corp-auth';

interface CorporationLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CorporationLoginModal({ open, onOpenChange }: CorporationLoginModalProps) {
  const { 
    loginWithCredentials, 
    loginWithESI, 
    isLoading, 
    esiConfig,
    registeredCorps 
  } = useCorporationAuth();
  
  const [activeTab, setActiveTab] = useState<'local' | 'esi'>('local');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isESIProcessing, setIsESIProcessing] = useState(false);

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    try {
      await loginWithCredentials(username.trim(), password.trim());
      onOpenChange(false);
      setUsername('');
      setPassword('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Authentication failed');
    }
  };

  const handleESILogin = async () => {
    setError(null);
    setIsESIProcessing(true);

    try {
      if (!esiConfig.clientId) {
        setError('ESI is not configured. Please contact your administrator to set up ESI authentication.');
        return;
      }

      const authUrl = loginWithESI();
      window.location.href = authUrl;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to initiate ESI login');
      setIsESIProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLocalSubmit(e);
    }
  };

  const hasESIConfig = Boolean(esiConfig.clientId);
  const registeredCorpCount = registeredCorps.filter(corp => corp.isActive).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket size={24} className="text-accent" />
            Sign In to LMeve
          </DialogTitle>
          <DialogDescription>
            Choose your authentication method to access the corporation management system
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'local' | 'esi')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="local" className="flex items-center gap-2">
              <Key size={16} />
              Local Account
            </TabsTrigger>
            <TabsTrigger value="esi" className="flex items-center gap-2">
              <Globe size={16} />
              EVE Online SSO
            </TabsTrigger>
          </TabsList>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle size={16} />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="local" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Alert>
                <Info size={16} />
                <AlertDescription>
                  Local accounts are for administrators and testing purposes.
                </AlertDescription>
              </Alert>

              <form onSubmit={handleLocalSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>

                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Demo credentials: <strong>admin</strong> / <strong>12345</strong>
                  </p>
                </div>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="esi" className="space-y-4 mt-4">
            <div className="space-y-3">
              {!hasESIConfig ? (
                <Alert variant="destructive">
                  <AlertTriangle size={16} />
                  <AlertDescription>
                    ESI authentication is not configured. Please contact your administrator.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <Info size={16} />
                  <AlertDescription>
                    You can login if your corporation is registered or if you're a CEO/Director who can register it.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">{registeredCorpCount}</div>
                  <div className="text-xs text-muted-foreground">Registered Corps</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">{hasESIConfig ? '✓' : '✗'}</div>
                  <div className="text-xs text-muted-foreground">ESI Configured</div>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleESILogin}
                  disabled={!hasESIConfig || isESIProcessing}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  size="lg"
                >
                  {isESIProcessing ? (
                    'Redirecting to EVE Online...'
                  ) : (
                    <>
                      <Globe size={18} className="mr-2" />
                      Login with EVE Online
                    </>
                  )}
                </Button>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Who can login:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Members of corporations with registered ESI access</li>
                    <li>CEOs and Directors of any corporation (can register their corp)</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>LMeve Corporation Management</span>
          <span>Powered by EVE Online ESI</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}