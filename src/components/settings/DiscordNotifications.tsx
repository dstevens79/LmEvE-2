import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Bell, CheckCircle } from '@phosphor-icons/react';
import { useNotificationSettings } from '@/lib/persistenceService';
import { toast } from 'sonner';

interface DiscordNotificationsProps {
  isMobileView?: boolean;
}

export function DiscordNotifications({ isMobileView }: DiscordNotificationsProps) {
  const [notificationSettings, setNotificationSettings] = useNotificationSettings();

  const saveNotificationSettings = async () => {
    try {
      const errors: string[] = [];
      
      if (notificationSettings.discord?.enabled && !notificationSettings.discord?.webhookUrl) {
        errors.push('Discord webhook URL is required when Discord notifications are enabled');
      }
      
      if (errors.length > 0) {
        toast.error(`Validation failed: ${errors.join(', ')}`);
        return;
      }
      
      setNotificationSettings({ ...notificationSettings });
      toast.success('Discord notification settings saved successfully');
    } catch (error) {
      console.error('Failed to save Discord notification settings:', error);
      toast.error('Failed to save Discord notification settings');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#5865F2] rounded flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </div>
          Discord Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable Discord Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Forward notifications to Discord channels via webhooks
            </p>
          </div>
          <Switch
            checked={notificationSettings.discord?.enabled || false}
            onCheckedChange={(checked) => setNotificationSettings(prev => ({
              ...prev,
              discord: { ...prev.discord, enabled: checked }
            }))}
          />
        </div>

        {notificationSettings.discord?.enabled && (
          <div className="space-y-6 pl-6 border-l-2 border-[#5865F2]/20">
            <div className="space-y-4">
              <h5 className="font-medium text-sm">Webhook Configuration</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discordWebhookUrl">Webhook URL</Label>
                  <Input
                    id="discordWebhookUrl"
                    type="url"
                    value={notificationSettings.discord?.webhookUrl || ''}
                    onChange={(e) => setNotificationSettings(prev => ({
                      ...prev,
                      discord: { ...prev.discord, webhookUrl: e.target.value }
                    }))}
                    placeholder="https://discord.com/api/webhooks/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Create a webhook in your Discord server settings
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="discordBotName">Bot Display Name</Label>
                  <Input
                    id="discordBotName"
                    value={notificationSettings.discord?.botName || ''}
                    onChange={(e) => setNotificationSettings(prev => ({
                      ...prev,
                      discord: { ...prev.discord, botName: e.target.value }
                    }))}
                    placeholder="LMeve Notifications"
                  />
                  <p className="text-xs text-muted-foreground">
                    Name shown for the notification bot
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discordAvatarUrl">Bot Avatar URL (Optional)</Label>
                <Input
                  id="discordAvatarUrl"
                  type="url"
                  value={notificationSettings.discord?.avatarUrl || ''}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    discord: { ...prev.discord, avatarUrl: e.target.value }
                  }))}
                  placeholder="https://images.evetech.net/corporations/..."
                />
                <p className="text-xs text-muted-foreground">
                  Custom avatar for the notification bot (corp logo recommended)
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="font-medium text-sm">Target Configuration</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discordChannels">Channel Mentions</Label>
                  <Textarea
                    id="discordChannels"
                    rows={3}
                    value={notificationSettings.discord?.channels?.join('\n') || ''}
                    onChange={(e) => setNotificationSettings(prev => ({
                      ...prev,
                      discord: {
                        ...prev.discord,
                        channels: e.target.value.split('\n').map(c => c.trim()).filter(c => c)
                      }
                    }))}
                    placeholder="#general&#10;#industry&#10;#alerts"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Channels to mention in notifications (one per line)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discordRoles">Role Mentions</Label>
                  <Textarea
                    id="discordRoles"
                    rows={3}
                    value={notificationSettings.discord?.roles?.join('\n') || ''}
                    onChange={(e) => setNotificationSettings(prev => ({
                      ...prev,
                      discord: {
                        ...prev.discord,
                        roles: e.target.value.split('\n').map(r => r.trim()).filter(r => r)
                      }
                    }))}
                    placeholder="@lmeve_admin&#10;@industry_team&#10;@pilots"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Roles to ping in notifications (one per line, with @)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discordUserMentions">User Mentions (Character IDs)</Label>
                <Textarea
                  id="discordUserMentions"
                  rows={2}
                  value={notificationSettings.discord?.userMentions?.join('\n') || ''}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    discord: {
                      ...prev.discord,
                      userMentions: e.target.value.split('\n').map(u => u.trim()).filter(u => u)
                    }
                  }))}
                  placeholder="91316135&#10;498125261"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  EVE character IDs to mention in notifications (one per line)
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="font-medium text-sm">Advanced Settings</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={notificationSettings.discord?.embedFormat || false}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({
                      ...prev,
                      discord: { ...prev.discord, embedFormat: checked }
                    }))}
                  />
                  <Label className="text-sm">Use rich embeds</Label>
                  <p className="text-xs text-muted-foreground">(Prettier formatting)</p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={notificationSettings.discord?.includeThumbnails || false}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({
                      ...prev,
                      discord: { ...prev.discord, includeThumbnails: checked }
                    }))}
                  />
                  <Label className="text-sm">Include EVE thumbnails</Label>
                  <p className="text-xs text-muted-foreground">(Ship/item images)</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="discordThrottleMinutes">Throttle Minutes</Label>
                <Input
                  id="discordThrottleMinutes"
                  type="number"
                  min="0"
                  max="1440"
                  value={notificationSettings.discord?.throttleMinutes || 5}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    discord: { ...prev.discord, throttleMinutes: parseInt(e.target.value) || 5 }
                  }))}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum minutes between similar notifications (prevents spam)
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (notificationSettings.discord?.webhookUrl) {
                  toast.info('Sending test message to Discord...');
                  
                  try {
                    const { notificationManager } = await import('@/lib/notification-manager');
                    
                    const result = await notificationManager.testNotifications({
                      ...notificationSettings,
                      events: { manufacturing: true, mining: true, killmails: true, markets: true }
                    });
                    
                    if (result.discord) {
                      toast.success('Test message sent to Discord successfully!');
                    } else {
                      toast.error('Discord test failed: ' + (result.errors.find(e => e.includes('Discord')) || 'Unknown error'));
                    }
                  } catch (error) {
                    console.error('Discord test error:', error);
                    toast.error('Failed to test Discord integration');
                  }
                } else {
                  toast.error('Please enter a webhook URL first');
                }
              }}
              disabled={!notificationSettings.discord?.webhookUrl}
            >
              <Bell size={16} className="mr-2" />
              Test Discord Integration
            </Button>
          </div>
        )}
        
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reset Changes
          </Button>
          <Button
            onClick={saveNotificationSettings}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <CheckCircle size={16} className="mr-2" />
            Save Discord Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
