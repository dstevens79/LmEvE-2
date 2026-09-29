import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeSlash, Globe, Copy } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { ESISettings, GeneralSettings } from '@/lib/persistenceService';

export interface ESICredentialsPanelProps {
  userName?: string;
  userCorp?: string;
  esiSettings: ESISettings & { clientSecretSet?: boolean };
  esiConfig: { clientId?: string; clientSecret?: string };
  generalSettings: GeneralSettings;
  onUpdateESISetting: (key: keyof ESISettings, value: any) => void;
  onSaveESIConfig: (clientId: string, clientSecret: string) => void;
  onClearESIForm: () => void;
  onTestESIConfig: () => Promise<void> | void;
}

function secretIsSaved(value: string | undefined, flag?: boolean): boolean {
  return flag === true || value === '***';
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
  const [secretDraft, setSecretDraft] = React.useState<string | null>(null);

  const proto = generalSettings.deploymentProtocol || (window.location.protocol === 'https:' ? 'https' : 'http');
  const host = window.location.host;
  // Fixed for this site. Not a setting. Must match the EVE application exactly.
  const canonicalCallback = `${proto}://${host}/api/auth/esi/callback.php`;

  const secretSaved = secretIsSaved(esiSettings.clientSecret, esiSettings.clientSecretSet)
    || secretIsSaved(esiConfig.clientSecret);
  const secretDisplay = secretDraft !== null
    ? secretDraft
    : (secretSaved ? '' : (esiSettings.clientSecret || esiConfig.clientSecret || ''));

  const hasUnsaved =
    (esiSettings.clientId && esiSettings.clientId !== esiConfig.clientId && esiSettings.clientId !== '***') ||
    (secretDraft !== null && secretDraft !== '' && secretDraft !== '***');

  const copyCallback = async () => {
    try {
      await navigator.clipboard.writeText(canonicalCallback);
      toast.success('Callback URL copied');
    } catch {
      toast.error('Could not copy callback URL');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${esiConfig.clientId || esiSettings.clientId ? 'bg-green-500' : 'bg-red-500'}`} />
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

      {(userName || userCorp) && (
        <p className="text-xs text-muted-foreground">
          Signed in as {userName || 'unknown'}{userCorp ? ` · ${userCorp}` : ''}
        </p>
      )}

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
          <Label htmlFor="clientSecret" className="flex items-center gap-2">
            EVE Online Client Secret
            {secretSaved && secretDraft === null && (
              <span className="text-[11px] font-normal text-green-500">Saved</span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="clientSecret"
              type={showSecrets ? 'text' : 'password'}
              value={secretDisplay}
              onChange={(e) => {
                const next = e.target.value;
                setSecretDraft(next);
                if (next === '' && secretSaved) onUpdateESISetting('clientSecret', '***');
                else onUpdateESISetting('clientSecret', next);
              }}
              placeholder={secretSaved ? 'Saved on server — leave blank to keep' : 'Your EVE Online application Client Secret'}
              className={secretDraft && secretDraft !== '***' ? 'border-accent' : ''}
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
          {secretDraft && secretDraft !== '***' && (
            <p className="text-xs text-accent">• Unsaved changes</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            const clientId = (esiSettings.clientId || esiConfig.clientId || '').trim();
            const typed = (secretDraft ?? esiSettings.clientSecret ?? '').trim();
            const clientSecret = typed && typed !== '***'
              ? typed
              : ((esiConfig.clientSecret && esiConfig.clientSecret !== '***')
                ? esiConfig.clientSecret
                : (secretSaved ? '***' : ''));
            if (!clientId) return;
            onSaveESIConfig(clientId, clientSecret);
            setSecretDraft(null);
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
          onClick={() => {
            setSecretDraft('');
            onClearESIForm();
          }}
          disabled={!esiSettings.clientId && !esiSettings.clientSecret && !secretSaved}
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

      <div className="space-y-2">
        <Label>ESI callback URL</Label>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <code className="flex-1 break-all font-mono text-xs">{canonicalCallback}</code>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={copyCallback}>
            <Copy size={14} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Register this exact URL at developers.eveonline.com. It is fixed for this site and is not editable.
          Server callback supports HTTP and HTTPS.
        </p>
      </div>
    </div>
  );
};

export default ESICredentialsPanel;
