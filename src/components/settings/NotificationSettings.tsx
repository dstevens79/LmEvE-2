import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bell,
  CheckCircle,
  Warning,
  X,
  Copy,
  Eye,
  EyeSlash,
  Plus,
  Trash,
  Envelope,
  ChatCircle,
  Info,
  TestTube
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useNotificationSettings } from '@/lib/persistenceService';

interface NotificationSettingsProps {
  isMobileView?: boolean;
}

interface DiscordWebhook {
  id: string;
  name: string;
  webhookUrl: string;
  channels: string[];
  roles: string[];
  enabled: boolean;
}

interface EVEMailConfig {
  id: string;
  name: string;
  enabled: boolean;
  recipients: 'pilot' | 'mailingList' | 'both';
  mailingListName?: string;
}

interface NotificationEvent {
  id: string;
  name: string;
  description: string;
  discordEnabled: boolean;
  eveMailEnabled: boolean;
  customMessage?: string;
  useDefaultMessage: boolean;
}

export function NotificationSettings({ isMobileView = false }: NotificationSettingsProps) {
  const [notificationSettings, setNotificationSettings] = useNotificationSettings();

  // Update helper function
  const updateNotificationSettings = (updates: any) => {
    setNotificationSettings(current => ({
      ...current,
      ...updates
    }));
  };

  // Discord webhook management
  const [discordWebhooks, setDiscordWebhooks] = useState<DiscordWebhook[]>([]);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    webhookUrl: '',
    channels: '',
    roles: ''
  });

  // EVE mail configuration
  const [eveMailConfigs, setEVEMailConfigs] = useState<EVEMailConfig[]>([]);
  const [newEVEMail, setNewEVEMail] = useState({
    name: '',
    recipients: 'pilot' as 'pilot' | 'mailingList' | 'both',
    mailingListName: ''
  });

  // Notification events
  const [notificationEvents, setNotificationEvents] = useState<NotificationEvent[]>([
    {
      id: 'industry_complete',
      name: 'Industry Job Complete',
      description: 'When an industry job is completed',
      discordEnabled: true,
      eveMailEnabled: false,
      useDefaultMessage: true,
      customMessage: 'Hey @pilot - your LMeve industry task of <item> <count> is complete at <time>!'
    },
    {
      id: 'queue_low',
      name: 'Queue Running Low',
      description: 'When job queues need attention',
      discordEnabled: true,
      eveMailEnabled: false,
      useDefaultMessage: true,
      customMessage: 'Hey <@lmeve_admin_Role> queues are running low - you need to setup additional industry tasking!'
    },
    {
      id: 'contract_expired',
      name: 'Contract Expired',
      description: 'When a contract expires',
      discordEnabled: false,
      eveMailEnabled: true,
      useDefaultMessage: true
    },
    {
      id: 'pos_fuel_low',
      name: 'Structure Fuel Low',
      description: 'When structure fuel is running low',
      discordEnabled: true,
      eveMailEnabled: true,
      useDefaultMessage: true
    },
    {
      id: 'market_order_filled',
      name: 'Market Order Filled',
      description: 'When a market order is completed',
      discordEnabled: false,
      eveMailEnabled: false,
      useDefaultMessage: true
    },
    {
      id: 'member_joined',
      name: 'Member Joined',
      description: 'When a new member joins the corporation',
      discordEnabled: true,
      eveMailEnabled: false,
      useDefaultMessage: true
    },
    {
      id: 'member_left',
      name: 'Member Left',
      description: 'When a member leaves the corporation',
      discordEnabled: true,
      eveMailEnabled: false,
      useDefaultMessage: true
    }
  ]);

  // Load settings on component mount
  useEffect(() => {
    loadWebhooks();
    loadEVEMailConfigs();
  }, []);

  const loadWebhooks = () => {
    const webhooks = notificationSettings?.discordWebhooks || [];
    setDiscordWebhooks(webhooks);
  };

  const loadEVEMailConfigs = () => {
    const configs = notificationSettings?.eveMailConfigs || [];
    setEVEMailConfigs(configs);
  };

  const addDiscordWebhook = () => {
    if (!newWebhook.name.trim() || !newWebhook.webhookUrl.trim()) {
      toast.error('Please fill in webhook name and URL');
      return;
    }

    const webhook: DiscordWebhook = {
      id: Date.now().toString(),
      name: newWebhook.name.trim(),
      webhookUrl: newWebhook.webhookUrl.trim(),
      channels: newWebhook.channels.split(',').map(c => c.trim()).filter(c => c),
      roles: newWebhook.roles.split(',').map(r => r.trim()).filter(r => r),
      enabled: true
    };

    setDiscordWebhooks(prev => [...prev, webhook]);
    setNewWebhook({ name: '', webhookUrl: '', channels: '', roles: '' });
    toast.success('Discord webhook added');
  };

  const removeDiscordWebhook = (id: string) => {
    setDiscordWebhooks(prev => prev.filter(w => w.id !== id));
    toast.success('Discord webhook removed');
  };

  const updateDiscordWebhook = (id: string, updates: Partial<DiscordWebhook>) => {
    setDiscordWebhooks(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const addEVEMailConfig = () => {
    if (!newEVEMail.name.trim()) {
      toast.error('Please enter a configuration name');
      return;
    }

    if (newEVEMail.recipients === 'mailingList' && !newEVEMail.mailingListName.trim()) {
      toast.error('Please enter a mailing list name');
      return;
    }

    const config: EVEMailConfig = {
      id: Date.now().toString(),
      name: newEVEMail.name.trim(),
      recipients: newEVEMail.recipients,
      mailingListName: newEVEMail.mailingListName.trim() || undefined,
      enabled: true
    };

    setEVEMailConfigs(prev => [...prev, config]);
    setNewEVEMail({ name: '', recipients: 'pilot', mailingListName: '' });
    toast.success('EVE mail configuration added');
  };

  const removeEVEMailConfig = (id: string) => {
    setEVEMailConfigs(prev => prev.filter(c => c.id !== id));
    toast.success('EVE mail configuration removed');
  };

  const updateEVEMailConfig = (id: string, updates: Partial<EVEMailConfig>) => {
    setEVEMailConfigs(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const updateNotificationEvent = (id: string, updates: Partial<NotificationEvent>) => {
    setNotificationEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const testDiscordWebhook = async (webhook: DiscordWebhook) => {
    try {
      // Simulate Discord webhook test
      toast.info('Sending test message to Discord...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success(`Test message sent to ${webhook.name}`);
    } catch (error) {
      toast.error(`Failed to send test message to ${webhook.name}`);
    }
  };

  const testEVEMail = async (config: EVEMailConfig) => {
    try {
      // Simulate EVE mail test
      toast.info('Sending test EVE mail...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success(`Test EVE mail sent via ${config.name}`);
    } catch (error) {
      toast.error(`Failed to send test EVE mail via ${config.name}`);
    }
  };

  const handleSaveSettings = async () => {
    try {
      updateNotificationSettings({
        discordWebhooks,
        eveMailConfigs,
        notificationEvents
      });
      toast.success('Notification settings saved successfully');
    } catch (error) {
      toast.error('Failed to save notification settings');
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell size={20} />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Configure Discord webhooks and EVE Online in-game mail notifications for various 
              corporation events. Each event type can be individually configured.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Discord Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ChatCircle size={20} />
            Discord Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <ChatCircle className="h-4 w-4" />
            <AlertDescription>
              Configure Discord webhooks to send notifications to specific channels and mention 
              roles when events occur. Each webhook can target different channels and roles.
            </AlertDescription>
          </Alert>

          {/* Add New Webhook */}
          <Card className="border border-accent/20">
            <CardHeader>
              <CardTitle className="text-base">Add Discord Webhook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="webhookName">Webhook Name</Label>
                  <Input
                    id="webhookName"
                    placeholder="Main Server Webhook"
                    value={newWebhook.name}
                    onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={newWebhook.webhookUrl}
                    onChange={(e) => setNewWebhook(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="webhookChannels">Target Channels (comma separated)</Label>
                  <Input
                    id="webhookChannels"
                    placeholder="#general, #industry, #alerts"
                    value={newWebhook.channels}
                    onChange={(e) => setNewWebhook(prev => ({ ...prev, channels: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="webhookRoles">Roles to Mention (comma separated)</Label>
                  <Input
                    id="webhookRoles"
                    placeholder="@lmeve_admin, @industry_team"
                    value={newWebhook.roles}
                    onChange={(e) => setNewWebhook(prev => ({ ...prev, roles: e.target.value }))}
                  />
                </div>
              </div>
              
              <Button onClick={addDiscordWebhook} className="w-full">
                <Plus size={16} className="mr-2" />
                Add Discord Webhook
              </Button>
            </CardContent>
          </Card>

          {/* Existing Webhooks */}
          {discordWebhooks.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Configured Webhooks</h3>
              {discordWebhooks.map((webhook) => (
                <Card key={webhook.id} className="border border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium">{webhook.name}</h4>
                          <Switch
                            checked={webhook.enabled}
                            onCheckedChange={(enabled) => updateDiscordWebhook(webhook.id, { enabled })}
                          />
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          <div>URL: {webhook.webhookUrl.substring(0, 50)}...</div>
                          {webhook.channels.length > 0 && (
                            <div>Channels: {webhook.channels.join(', ')}</div>
                          )}
                          {webhook.roles.length > 0 && (
                            <div>Roles: {webhook.roles.join(', ')}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testDiscordWebhook(webhook)}
                          disabled={!webhook.enabled}
                        >
                          <TestTube size={14} className="mr-1" />
                          Test
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDiscordWebhook(webhook.id)}
                        >
                          <Trash size={14} />
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

      {/* EVE Mail Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Envelope size={20} />
            EVE Online Mail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Envelope className="h-4 w-4" />
            <AlertDescription>
              Configure in-game EVE Online mail notifications. These require ESI scopes to send 
              mail on behalf of your corporation.
            </AlertDescription>
          </Alert>

          {/* Add New EVE Mail Config */}
          <Card className="border border-accent/20">
            <CardHeader>
              <CardTitle className="text-base">Add EVE Mail Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="eveMailName">Configuration Name</Label>
                  <Input
                    id="eveMailName"
                    placeholder="General Notifications"
                    value={newEVEMail.name}
                    onChange={(e) => setNewEVEMail(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="eveMailRecipients">Recipients</Label>
                  <Select
                    value={newEVEMail.recipients}
                    onValueChange={(value: 'pilot' | 'mailingList' | 'both') => 
                      setNewEVEMail(prev => ({ ...prev, recipients: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pilot">Individual Pilots</SelectItem>
                      <SelectItem value="mailingList">Mailing List</SelectItem>
                      <SelectItem value="both">Both Pilots & Mailing List</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {(newEVEMail.recipients === 'mailingList' || newEVEMail.recipients === 'both') && (
                <div className="space-y-2">
                  <Label htmlFor="mailingListName">Mailing List Name</Label>
                  <Input
                    id="mailingListName"
                    placeholder="Corp Leadership"
                    value={newEVEMail.mailingListName}
                    onChange={(e) => setNewEVEMail(prev => ({ ...prev, mailingListName: e.target.value }))}
                  />
                </div>
              )}
              
              <Button onClick={addEVEMailConfig} className="w-full">
                <Plus size={16} className="mr-2" />
                Add EVE Mail Configuration
              </Button>
            </CardContent>
          </Card>

          {/* Existing EVE Mail Configs */}
          {eveMailConfigs.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">EVE Mail Configurations</h3>
              {eveMailConfigs.map((config) => (
                <Card key={config.id} className="border border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium">{config.name}</h4>
                          <Switch
                            checked={config.enabled}
                            onCheckedChange={(enabled) => updateEVEMailConfig(config.id, { enabled })}
                          />
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          <div>Recipients: {config.recipients.replace(/([A-Z])/g, ' $1').trim()}</div>
                          {config.mailingListName && (
                            <div>Mailing List: {config.mailingListName}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testEVEMail(config)}
                          disabled={!config.enabled}
                        >
                          <TestTube size={14} className="mr-1" />
                          Test
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEVEMailConfig(config.id)}
                        >
                          <Trash size={14} />
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

      {/* Notification Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notification Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure which events trigger notifications and customize messages for each event type.
          </p>
          
          <div className="space-y-4">
            {notificationEvents.map((event) => (
              <Card key={event.id} className="border border-border">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{event.name}</h4>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Discord</Label>
                          <Switch
                            checked={event.discordEnabled}
                            onCheckedChange={(enabled) => 
                              updateNotificationEvent(event.id, { discordEnabled: enabled })
                            }
                          />
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">EVE Mail</Label>
                          <Switch
                            checked={event.eveMailEnabled}
                            onCheckedChange={(enabled) => 
                              updateNotificationEvent(event.id, { eveMailEnabled: enabled })
                            }
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={event.useDefaultMessage}
                          onCheckedChange={(useDefault) => 
                            updateNotificationEvent(event.id, { useDefaultMessage: useDefault })
                          }
                        />
                        <Label className="text-sm">Use default message</Label>
                      </div>
                      
                      {!event.useDefaultMessage && (
                        <Textarea
                          placeholder="Enter custom notification message..."
                          value={event.customMessage || ''}
                          onChange={(e) => 
                            updateNotificationEvent(event.id, { customMessage: e.target.value })
                          }
                          className="text-sm"
                        />
                      )}
                      
                      {event.customMessage && (
                        <div className="text-xs text-muted-foreground">
                          Available variables: &lt;item&gt;, &lt;count&gt;, &lt;time&gt;, &lt;pilot&gt;, @pilot, &lt;@role&gt;
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Settings */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings}>
              <CheckCircle size={16} className="mr-2" />
              Save Notification Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}