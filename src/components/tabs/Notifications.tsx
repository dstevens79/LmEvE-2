import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Factory,
  Hammer,
  Crosshair,
  TrendUp,
  Planet,
  Archive,
  Users,
  CurrencyDollar,
  Package,
  Warning,
  Info,
  CaretRight,
  CaretDown
} from '@phosphor-icons/react';
import { useKV } from '@github/spark/hooks';
import { useNotificationSettings } from '@/lib/persistenceService';
import { DiscordNotifications } from '@/components/settings/DiscordNotifications';
import { EVEMailNotifications } from '@/components/settings/EVEMailNotifications';

interface NotificationsProps {
  isMobileView?: boolean;
}

interface NotificationEvent {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  category: 'operations' | 'financial' | 'social' | 'alerts';
}

const notificationEvents: NotificationEvent[] = [
  {
    id: 'manufacturing',
    label: 'Manufacturing Jobs',
    description: 'Job completions, cancellations, and issues',
    icon: Factory,
    category: 'operations'
  },
  {
    id: 'mining',
    label: 'Mining Operations',
    description: 'Fleet activities and yield reports',
    icon: Hammer,
    category: 'operations'
  },
  {
    id: 'planetary',
    label: 'Planetary Interaction',
    description: 'PI extraction completions and factory alerts',
    icon: Planet,
    category: 'operations'
  },
  {
    id: 'killmails',
    label: 'Killmails',
    description: 'Corporation member kills and losses',
    icon: Crosshair,
    category: 'alerts'
  },
  {
    id: 'markets',
    label: 'Market Updates',
    description: 'Price alerts and market order notifications',
    icon: TrendUp,
    category: 'financial'
  },
  {
    id: 'wallet',
    label: 'Wallet Transactions',
    description: 'Large transactions and balance alerts',
    icon: CurrencyDollar,
    category: 'financial'
  },
  {
    id: 'assets',
    label: 'Asset Alerts',
    description: 'Low stock warnings and asset movements',
    icon: Package,
    category: 'financial'
  },
  {
    id: 'members',
    label: 'Member Activity',
    description: 'New members, departures, and role changes',
    icon: Users,
    category: 'social'
  },
  {
    id: 'buyback',
    label: 'Buyback Orders',
    description: 'New buyback submissions and completions',
    icon: CurrencyDollar,
    category: 'financial'
  },
  {
    id: 'system',
    label: 'System Alerts',
    description: 'ESI errors, sync issues, and system warnings',
    icon: Warning,
    category: 'alerts'
  }
];

export function Notifications({ isMobileView }: NotificationsProps) {
  const [activeSubTab, setActiveSubTab] = useKV<string>('notifications-sub-tab', '');
  const [notificationSettings, setNotificationSettings] = useNotificationSettings();

  const updateEventChannel = (eventId: string, channel: 'toast' | 'discord' | 'eveMail', enabled: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      eventChannels: {
        ...prev.eventChannels,
        [eventId]: {
          ...prev.eventChannels?.[eventId],
          [channel]: enabled
        }
      }
    }));
  };

  const getEventChannelStatus = (eventId: string, channel: 'toast' | 'discord' | 'eveMail'): boolean => {
    return notificationSettings.eventChannels?.[eventId]?.[channel] || false;
  };

  const eventsByCategory = notificationEvents.reduce((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = [];
    }
    acc[event.category].push(event);
    return acc;
  }, {} as Record<string, NotificationEvent[]>);

  const categoryLabels: Record<string, { label: string; icon: React.ComponentType<{ size?: number }> }> = {
    operations: { label: 'Operations & Industry', icon: Factory },
    financial: { label: 'Financial & Trading', icon: CurrencyDollar },
    social: { label: 'Social & Members', icon: Users },
    alerts: { label: 'Alerts & Warnings', icon: Warning }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bell size={24} />
          Notification Preferences
        </h2>
        <p className="text-muted-foreground">
          Configure which events trigger notifications and through which channels they are delivered
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell size={20} />
            Event Notification Channels
          </CardTitle>
          <CardDescription>
            Enable or disable notification channels for each event type. Toasts appear in-app, Discord sends to webhooks, and EVE Mail uses in-game messaging.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(eventsByCategory).map(([category, events]) => {
            const CategoryIcon = categoryLabels[category]?.icon || Info;
            
            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <CategoryIcon size={18} className="text-accent" />
                  <span className="font-semibold text-sm">
                    {categoryLabels[category]?.label || category}
                  </span>
                  <Badge variant="secondary" className="text-xs ml-2">
                    {events.length}
                  </Badge>
                </div>
                
                <div className="space-y-1">
                  {events.map((event) => {
                    const EventIcon = event.icon;
                    const toastEnabled = getEventChannelStatus(event.id, 'toast');
                    const discordEnabled = getEventChannelStatus(event.id, 'discord');
                    const eveMailEnabled = getEventChannelStatus(event.id, 'eveMail');
                    
                    return (
                      <div 
                        key={event.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/30 transition-colors"
                      >
                        <EventIcon size={16} className="text-muted-foreground flex-shrink-0" />
                        <span className="text-sm flex-1">{event.label}</span>
                        
                        <Button
                          variant={toastEnabled ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateEventChannel(event.id, 'toast', !toastEnabled)}
                          className={`h-7 px-3 ${
                            toastEnabled 
                              ? 'bg-accent hover:bg-accent/90 text-accent-foreground' 
                              : 'hover:bg-muted'
                          }`}
                          title={toastEnabled ? 'Disable toast notifications' : 'Enable toast notifications'}
                        >
                          <Bell size={14} className="mr-1.5" />
                          <span className="text-xs">Toast</span>
                        </Button>
                        
                        <Button
                          variant={discordEnabled ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateEventChannel(event.id, 'discord', !discordEnabled)}
                          className={`h-7 px-3 ${
                            discordEnabled 
                              ? 'bg-[#5865F2] hover:bg-[#5865F2]/90 text-white border-[#5865F2]' 
                              : 'hover:bg-muted'
                          }`}
                          title={discordEnabled ? 'Disable Discord notifications' : 'Enable Discord notifications'}
                        >
                          <div className="w-3 h-3 mr-1.5">
                            <svg viewBox="0 0 24 24" className="w-full h-full fill-current">
                              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                            </svg>
                          </div>
                          <span className="text-xs">Discord</span>
                        </Button>
                        
                        <Button
                          variant={eveMailEnabled ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateEventChannel(event.id, 'eveMail', !eveMailEnabled)}
                          className={`h-7 px-3 ${
                            eveMailEnabled 
                              ? 'bg-orange-500 hover:bg-orange-500/90 text-white border-orange-500' 
                              : 'hover:bg-muted'
                          }`}
                          title={eveMailEnabled ? 'Disable EVE Mail notifications' : 'Enable EVE Mail notifications'}
                        >
                          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current mr-1.5">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                          </svg>
                          <span className="text-xs">EVE Mail</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border border-border mt-6">
            <Info size={18} className="text-accent mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Channel Configuration Required</p>
              <p>
                Enabling Discord or EVE Mail notifications requires additional configuration in the respective tabs below.
                Toast notifications work immediately without setup.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Channel Configuration Subtabs */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Channel Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure delivery settings for Discord and EVE Mail notification channels
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant={activeSubTab === 'discord' ? "default" : "ghost"}
            onClick={() => setActiveSubTab(activeSubTab === 'discord' ? '' : 'discord')}
            className={`w-full justify-start gap-3 h-auto py-3 ${
              activeSubTab === 'discord' 
                ? 'bg-accent text-accent-foreground shadow-sm' 
                : 'hover:bg-muted'
            }`}
          >
            <div className="w-5 h-5 bg-[#5865F2] rounded flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium">Discord Integration</div>
              <div className="text-xs text-muted-foreground">Configure webhooks and message formatting</div>
            </div>
            {activeSubTab === 'discord' ? <CaretDown size={16} className="flex-shrink-0" /> : <CaretRight size={16} className="flex-shrink-0" />}
          </Button>

          {activeSubTab === 'discord' && (
            <div className="ml-6 border-l-2 border-accent pl-4">
              <DiscordNotifications isMobileView={isMobileView} />
            </div>
          )}

          <Button
            variant={activeSubTab === 'evemail' ? "default" : "ghost"}
            onClick={() => setActiveSubTab(activeSubTab === 'evemail' ? '' : 'evemail')}
            className={`w-full justify-start gap-3 h-auto py-3 ${
              activeSubTab === 'evemail' 
                ? 'bg-accent text-accent-foreground shadow-sm' 
                : 'hover:bg-muted'
            }`}
          >
            <div className="w-5 h-5 bg-orange-500 rounded flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium">EVE Mail Integration</div>
              <div className="text-xs text-muted-foreground">Configure in-game mail notifications</div>
            </div>
            {activeSubTab === 'evemail' ? <CaretDown size={16} className="flex-shrink-0" /> : <CaretRight size={16} className="flex-shrink-0" />}
          </Button>

          {activeSubTab === 'evemail' && (
            <div className="ml-6 border-l-2 border-orange-500 pl-4">
              <EVEMailNotifications isMobileView={isMobileView} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
