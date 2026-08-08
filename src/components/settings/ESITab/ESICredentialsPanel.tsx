import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeSlash, Globe, CheckCircle } from '@phosphor-icons/react';
import type { ESISettings, GeneralSettings } from '@/lib/persistenceService';

export interface ESICredentialsPanelProps {
  userName?: string;
  userCorp?: string;
  esiSettings: ESISettings;
  esiConfig: { clientId?: string; clientSecret?: string };
  generalSettings: GeneralSettings;
  onUpdateESISetting: (key: keyof ESISettings, value: any) => void;
  onSaveESIConfig: (clientId: string, clientSecret: string) => void;
  onClearESIForm: () => void;
  onTestESIConfig: () => Promise<void> | void;
}

export const ESICredentialsPanel: React.FC<ESICredentialsPanelProps> = ({
  userName,
  userCorp,
  esiSettings,
  esiConfig,
  generalSettings,
  onUpdateESISetting,
  onSaveESIConfig,
  onClearESIForm,
  onTestESIConfig,
}) => {
  const [showSecrets, setShowSecrets] = React.useState(false);

  const proto = generalSettings.deploymentProtocol || (window.location.protocol === 'https:' ? 'https' : 'http');
  const host = window.location.host;
  const isServer = (generalSettings.authFlow || 'server') === 'server';
  // Prefer the saved public callback URL (what EVE SSO has registered).
  // Never tell the admin to register a LAN IP just because they're browsing via one.
  const suggestedLocal = isServer
    ? `${proto}://${host}/api/auth/esi/callback.php`
    : `${proto}://${host}/`;
    const effectiveCallback = (esiSettings.callbackUrl && esiSettings.callbackUrl.trim())
    ? esiSettings.callbackUrl.trim()
    : suggestedLocal;
  const browsingDiffers = (() => {
    try {
        return new URL(effectiveCallback).origin !== window.location.origin;
    } catch {
      return false;
    }
  })();

  const hasUnsaved =
    (esiSettings.clientId && esiSettings.clientId !== esiConfig.clientId) ||
    (esiSettings.clientSecret && esiSettings.clientSecret !== esiConfig.clientSecret);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${esiConfig.clientId ? 'bg-green-500' : 'bg-red-500'}`} />
          <h4 className="font-medium">ESI Application Credentials</h4>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('https://developers.eveonline.com/applications', '_blank')}
        >
          <Globe size={16} className="mr-2" />
          Manage Apps
        </Button>
      </div>

      {/* Credentials form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="clientId">EVE Online Client ID</Label>
          <Input
            id="clientId"
            value={esiSettings.clientId || esiConfig.clientId || ''}
            onChange={(e) => onUpdateESISetting('clientId', e.target.value)}
            placeholder="Your EVE Online application Client ID"
            className={esiSettings.clientId && esiSettings.clientId !== esiConfig.clientId ? 'border-accent' : ''}
          />
          {esiSettings.clientId && esiSettings.clientId !== esiConfig.clientId && (
            <p className="text-xs text-accent">• Unsaved changes</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientSecret">EVE Online Client Secret</Label>
          <div className="relative">
            <Input
              id="clientSecret"
              type={showSecrets ? 'text' : 'password'}
              value={esiSettings.clientSecret || esiConfig.clientSecret || ''}
              onChange={(e) => onUpdateESISetting('clientSecret', e.target.value)}
              placeholder="Your EVE Online application Client Secret"
              className={esiSettings.clientSecret && esiSettings.clientSecret !== esiConfig.clientSecret ? 'border-accent' : ''}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowSecrets((v) => !v)}
            >
              {showSecrets ? <EyeSlash size={16} /> : <Eye size={16} />}
            </Button>
          </div>
          {esiSettings.clientSecret && esiSettings.clientSecret !== esiConfig.clientSecret && (
            <p className="text-xs text-accent">• Unsaved changes</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            const clientId = (esiSettings.clientId || esiConfig.clientId || '').trim();
            const clientSecret = (esiSettings.clientSecret || esiConfig.clientSecret || '').trim();
            if (!clientId) return;
            onSaveESIConfig(clientId, clientSecret);
          }}
          size="sm"
          disabled={!esiSettings.clientId && !esiConfig.clientId}
          className={hasUnsaved ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : ''}
        >
          {hasUnsaved ? 'Save Changes' : 'Save ESI Config'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onClearESIForm}
          disabled={!esiSettings.clientId && !esiSettings.clientSecret}
        >
          Clear
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onTestESIConfig()}
        >
          Test ESI Config
        </Button>
      </div>

      {/* Public callback URL — one field, one line of help */}
            <div className="space-y-2">
              <Label htmlFor="callbackUrl">Public ESI callback URL</Label>
              <Input
                id="callbackUrl"
                value={esiSettings.callbackUrl || ''}
                onChange={(e) => onUpdateESISetting('callbackUrl', e.target.value)}
                placeholder={suggestedLocal}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Register this exact URL at developers.eveonline.com. OAuth uses this saved public
                callback, not your browser address
                {browsingDiffers ? ` (you are on ${window.location.origin})` : ''}.
                {!esiSettings.callbackUrl?.trim()
                  ? ' Save your public URL before character login.'
                  : isServer
                    ? ' Server callback supports HTTP and HTTPS.'
                    : ' SPA callback requires HTTPS + PKCE.'}
              </p>
              {!esiSettings.callbackUrl?.trim() && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdateESISetting('callbackUrl', suggestedLocal)}
                >
                  Use current browser address
                </Button>
              )}
            </div>
    </div>
  );
};

export default ESICredentialsPanel;
