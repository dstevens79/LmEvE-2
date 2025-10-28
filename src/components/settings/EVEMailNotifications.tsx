import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Rocket, CheckCircle } from '@phosphor-icons/react';
import { useNotificationSettings } from '@/lib/persistenceService';
import { toast } from 'sonner';

interface EVEMailNotificationsProps {
  isMobileView?: boolean;
}

export function EVEMailNotifications({ isMobileView }: EVEMailNotificationsProps) {
  const [notificationSettings, setNotificationSettings] = useNotificationSettings();

  const saveNotificationSettings = async () => {
    try {
      const errors: string[] = [];
      
      if (notificationSettings.eveMail?.enabled && !notificationSettings.eveMail?.senderCharacterId) {
        errors.push('EVE mail sender character is required when EVE mail notifications are enabled');
      }
      
      if (errors.length > 0) {
        toast.error(`Validation failed: ${errors.join(', ')}`);
        return;
      }
      
      setNotificationSettings({ ...notificationSettings });
      toast.success('EVE mail notification settings saved successfully');
    } catch (error) {
      console.error('Failed to save EVE mail notification settings:', error);
      toast.error('Failed to save EVE mail notification settings');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-5 h-5 bg-orange-500 rounded flex items-center justify-center">
            <Rocket size={12} className="text-white" />
          </div>
          EVE Online In-Game Mail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable In-Game Mail Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Send notifications via EVE Online in-game mail system
            </p>
          </div>
          <Switch
            checked={notificationSettings.eveMail?.enabled || false}
            onCheckedChange={(checked) => setNotificationSettings(prev => ({
              ...prev,
              eveMail: { ...prev.eveMail, enabled: checked }
            }))}
          />
        </div>

        {notificationSettings.eveMail?.enabled && (
          <div className="space-y-6 pl-6 border-l-2 border-orange-500/20">
            <div className="space-y-4">
              <h5 className="font-medium text-sm">Sender Configuration</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="eveMailSenderCharacter">Sender Character ID</Label>
                  <Input
                    id="eveMailSenderCharacter"
                    type="number"
                    value={notificationSettings.eveMail?.senderCharacterId || ''}
                    onChange={(e) => setNotificationSettings(prev => ({
                      ...prev,
                      eveMail: { ...prev.eveMail, senderCharacterId: parseInt(e.target.value) || 0 }
                    }))}
                    placeholder="Character ID with mail sending permissions"
                  />
                  <p className="text-xs text-muted-foreground">
                    Character that will send notifications (requires ESI mail scope)
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="eveMailSubjectPrefix">Subject Prefix</Label>
                  <Input
                    id="eveMailSubjectPrefix"
                    value={notificationSettings.eveMail?.subjectPrefix || ''}
                    onChange={(e) => setNotificationSettings(prev => ({
                      ...prev,
                      eveMail: { ...prev.eveMail, subjectPrefix: e.target.value }
                    }))}
                    placeholder="[LMeve Alert]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Prefix for notification mail subjects
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="font-medium text-sm">Recipients</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="eveMailRecipients">Pilot Character IDs</Label>
                  <Textarea
                    id="eveMailRecipients"
                    rows={4}
                    value={notificationSettings.eveMail?.recipientIds?.join('\n') || ''}
                    onChange={(e) => setNotificationSettings(prev => ({
                      ...prev,
                      eveMail: {
                        ...prev.eveMail,
                        recipientIds: e.target.value.split('\n').map(id => parseInt(id.trim())).filter(id => id > 0)
                      }
                    }))}
                    placeholder="Enter character IDs, one per line&#10;91316135&#10;498125261&#10;12345678"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Individual pilots to receive notifications
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eveMailingLists">Mailing Lists</Label>
                  <Textarea
                    id="eveMailingLists"
                    rows={4}
                    value={notificationSettings.eveMail?.mailingLists?.map(ml => `${ml.name}:${ml.id}`).join('\n') || ''}
                    onChange={(e) => {
                      const lists = e.target.value.split('\n')
                        .map(line => line.trim())
                        .filter(line => line && line.includes(':'))
                        .map(line => {
                          const [name, id] = line.split(':');
                          return {
                            name: name.trim(),
                            id: parseInt(id.trim())
                          };
                        })
                        .filter(ml => ml.id > 0);
                      
                      setNotificationSettings(prev => ({
                        ...prev,
                        eveMail: {
                          ...prev.eveMail,
                          mailingLists: lists
                        }
                      }));
                    }}
                    placeholder="name:id format, one per line&#10;Corp Leadership:123456&#10;Industry Team:789012&#10;All Members:345678"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: ListName:MailingListID (one per line)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={notificationSettings.eveMail?.sendToCorporation || false}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({
                      ...prev,
                      eveMail: { ...prev.eveMail, sendToCorporation: checked }
                    }))}
                  />
                  <Label className="text-sm">Send to entire corporation</Label>
                  <p className="text-xs text-muted-foreground">
                    (Broadcasts to all corp members)
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={notificationSettings.eveMail?.sendToAlliance || false}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({
                      ...prev,
                      eveMail: { ...prev.eveMail, sendToAlliance: checked }
                    }))}
                  />
                  <Label className="text-sm">Send to alliance</Label>
                  <p className="text-xs text-muted-foreground">
                    (Requires alliance membership)
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="font-medium text-sm">Delivery Options</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={notificationSettings.eveMail?.onlyToOnlineCharacters || false}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({
                      ...prev,
                      eveMail: { ...prev.eveMail, onlyToOnlineCharacters: checked }
                    }))}
                  />
                  <Label className="text-sm">Only send to online characters</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={notificationSettings.eveMail?.cspaChargeCheck || true}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({
                      ...prev,
                      eveMail: { ...prev.eveMail, cspaChargeCheck: checked }
                    }))}
                  />
                  <Label className="text-sm">Skip high CSPA charge recipients</Label>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="eveMailThrottleMinutes">Throttle Minutes</Label>
                <Input
                  id="eveMailThrottleMinutes"
                  type="number"
                  min="1"
                  max="1440"
                  value={notificationSettings.eveMail?.throttleMinutes || 15}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    eveMail: { ...prev.eveMail, throttleMinutes: parseInt(e.target.value) || 15 }
                  }))}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum minutes between EVE mail notifications (EVE has strict rate limits)
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (notificationSettings.eveMail?.senderCharacterId && 
                    (notificationSettings.eveMail?.recipientIds?.length > 0 || 
                     notificationSettings.eveMail?.mailingLists?.length > 0 ||
                     notificationSettings.eveMail?.sendToCorporation ||
                     notificationSettings.eveMail?.sendToAlliance)) {
                  toast.info('Sending test EVE mail...');
                  
                  try {
                    const { notificationManager } = await import('@/lib/notification-manager');
                    
                    const result = await notificationManager.testNotifications({
                      ...notificationSettings,
                      events: { manufacturing: true, mining: true, killmails: true, markets: true }
                    });
                    
                    if (result.eveMail) {
                      toast.success('Test EVE mail sent successfully!');
                    } else {
                      toast.error('EVE mail test failed: ' + (result.errors.find(e => e.includes('EVE')) || 'Unknown error'));
                    }
                  } catch (error) {
                    console.error('EVE mail test error:', error);
                    toast.error('Failed to test EVE mail integration');
                  }
                } else {
                  toast.error('Please configure sender and at least one recipient first');
                }
              }}
              disabled={!notificationSettings.eveMail?.senderCharacterId || 
                (!notificationSettings.eveMail?.recipientIds?.length && 
                 !notificationSettings.eveMail?.mailingLists?.length &&
                 !notificationSettings.eveMail?.sendToCorporation &&
                 !notificationSettings.eveMail?.sendToAlliance)}
            >
              <Rocket size={16} className="mr-2" />
              Test EVE Mail Integration
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
            Save EVE Mail Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
