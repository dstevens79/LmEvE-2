import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Network, Database, Globe, CheckCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useGeneralSettings, useDatabaseSettings, useESISettings, useLocalKV } from '@/lib/persistenceService';
import { useAuth } from '@/lib/auth-provider';
import { startEsiLogin } from '@/lib/start-esi-login';
import { initializeESIAuth, getESIAuthService } from '@/lib/esi-auth';
import DatabaseTabContainer from '@/components/settings/DatabaseTab/DatabaseTabContainer';
import { ESICredentialsPanel } from '@/components/settings/ESITab/ESICredentialsPanel';

export const ConnectivityTab: React.FC = () => {
  const { user, esiConfig, updateESIConfig, getRegisteredCorporations, loginWithESI } = useAuth();
  const [generalSettings, setGeneralSettings] = useGeneralSettings();
  const [esiSettings, setESISettings] = useESISettings();
  const [persistedDbConnected] = useLocalKV<boolean>('lmeve-database-connected', false);
  const dbConnected = !!persistedDbConnected;
  const esiConfigured = !!esiConfig.clientId;
  const proto = generalSettings.deploymentProtocol || (typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http');
  const authFlow = generalSettings.authFlow || 'server';
  const callbackOrigin = (() => { try { return esiSettings.callbackUrl ? new URL(esiSettings.callbackUrl).origin : '' } catch { return '' } })();

  const updateGeneralSetting = <K extends keyof typeof generalSettings>(k: K, v: typeof generalSettings[K]) => setGeneralSettings(prev => ({ ...prev, [k]: v }));
  const updateESISetting = <K extends keyof typeof esiSettings>(k: K, v: typeof esiSettings[K]) => setESISettings(prev => ({ ...prev, [k]: v }));

  const handleSaveSiteCompact = () => toast.success('Connectivity site settings saved');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network size={18} />
            Connectivity
            <span className="ml-auto flex items-center gap-3 text-xs font-normal">
              <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-green-500' : 'bg-red-500'}`} />DB {dbConnected ? 'Online' : 'Offline'}</span>
              <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${esiConfigured ? 'bg-green-500' : 'bg-red-500'}`} />ESI {esiConfigured ? 'Configured' : 'Missing'}</span>
              <span className="hidden sm:inline text-muted-foreground">{proto} / {authFlow}</span>
            </span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">Database is optional and can be remote. ESI callback must be the public URL you registered with CCP.</p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-base"><Database size={18} />Database</CardTitle>
          <p className="text-xs text-muted-foreground">Host/port/credentials for any reachable MySQL/MariaDB. Nothing is installed on this app host.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <DatabaseTabContainer />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-base"><Globe size={18} />EVE ESI</CardTitle>
        </CardHeader>
        <CardContent>
          <ESICredentialsPanel
            userName={user?.characterName}
            userCorp={user?.corporationName}
            esiSettings={esiSettings}
            esiConfig={{ clientId: esiConfig.clientId, clientSecret: esiConfig.clientSecret }}
            generalSettings={generalSettings}
            onUpdateESISetting={(k, v) => updateESISetting(k as any, v)}
            onSaveESIConfig={(clientId, clientSecret) => {
              if (!clientId) { toast.error('Client ID is required'); return; }
              updateESIConfig(clientId, clientSecret || '');
              setESISettings(prev => ({ ...prev, clientId: '', clientSecret: '' }));
              toast.success('ESI configuration updated');
            }}
            onClearESIForm={() => { setESISettings(prev => ({ ...prev, clientId: '', clientSecret: '' })); toast.info('Form cleared'); }}
            onTestESIConfig={async () => {
              try {
                const clientId = (esiSettings.clientId || esiConfig.clientId || '').trim();
                const clientSecret = (esiSettings.clientSecret || esiConfig.clientSecret || '').trim() || undefined;
                if (!clientId) { toast.error('Client ID is required to test ESI configuration'); return; }
                if ((generalSettings.authFlow || 'server') !== 'spa') {
                  await startEsiLogin(loginWithESI, { scopeType: 'basic', clientId, role: user?.role, announce: true });
                  return;
                }
                const callbackUrl = (esiSettings.callbackUrl && esiSettings.callbackUrl.trim()) ? esiSettings.callbackUrl.trim() : `${window.location.origin}/`;
                const corps = getRegisteredCorporations();
                initializeESIAuth(clientId, clientSecret, corps, callbackUrl);
                const svc = getESIAuthService();
                const url = await svc.initiateLogin('basic');
                toast.info('Redirecting to EVE SSO for basic test...');
                window.location.href = url;
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to initialize ESI login';
                toast.error(message);
              }
            }}
          />
          {callbackOrigin && <p className="text-xs text-muted-foreground pt-2">Callback origin: <span className="font-mono">{callbackOrigin}</span> — must match CCP app exactly.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Site — Connectivity Options</CardTitle>
          <p className="text-xs text-muted-foreground">Deployment and session behavior. Saved automatically.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Deployment Protocol</Label>
              <Select value={generalSettings.deploymentProtocol || (typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http')} onValueChange={(v) => updateGeneralSetting('deploymentProtocol', v as 'http' | 'https')}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select protocol" /></SelectTrigger>
                <SelectContent><SelectItem value="http">HTTP</SelectItem><SelectItem value="https">HTTPS</SelectItem></SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">HTTPS needs cert/proxy.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Authentication Flow</Label>
              <Select value={generalSettings.authFlow || 'server'} onValueChange={(v) => updateGeneralSetting('authFlow', v as 'spa' | 'server')}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select auth flow" /></SelectTrigger>
                <SelectContent><SelectItem value="server">PHP (Server Callback)</SelectItem><SelectItem value="spa">SPA (Client Callback)</SelectItem></SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Server recommended for HTTP / LAN.</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs">Session Timeout</Label>
              <p className="text-[11px] text-muted-foreground">Auto-logout after inactivity</p>
            </div>
            <Switch checked={!!generalSettings.sessionTimeout} onCheckedChange={(c) => updateGeneralSetting('sessionTimeout', c)} />
          </div>
          {generalSettings.sessionTimeout && (
            <div className="space-y-1.5">
              <Label htmlFor="sessionTimeoutMinutes" className="text-xs">Timeout (minutes)</Label>
              <Input id="sessionTimeoutMinutes" type="number" value={generalSettings.sessionTimeoutMinutes?.toString() || '30'} onChange={(e) => updateGeneralSetting('sessionTimeoutMinutes', parseInt(e.target.value) || 30)} min={5} max={480} placeholder="30" className="h-8 text-sm" />
              <p className="text-[11px] text-muted-foreground">5–480 minutes.</p>
            </div>
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs">Enable Local Cache</Label>
              <p className="text-[11px] text-muted-foreground">Machine-local cache, not browser storage.</p>
            </div>
            <Switch checked={!!generalSettings.cacheEnabled} onCheckedChange={(c) => updateGeneralSetting('cacheEnabled', c)} />
          </div>
          {generalSettings.cacheEnabled && (
            <div className="space-y-1.5">
              <Label htmlFor="cacheMaxSize" className="text-xs">Cache Size (MB)</Label>
              <Input id="cacheMaxSize" type="number" value={(generalSettings.cacheMaxSizeMB ?? 256).toString()} onChange={(e) => updateGeneralSetting('cacheMaxSizeMB', Math.max(16, parseInt(e.target.value) || 256))} min={16} max={32768} placeholder="256" className="h-8 text-sm" />
              <p className="text-[11px] text-muted-foreground">16 MB – 32768 MB.</p>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleSaveSiteCompact} className="h-8 bg-accent hover:bg-accent/90 text-accent-foreground"><CheckCircle size={14} className="mr-1.5" />Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
export default ConnectivityTab;