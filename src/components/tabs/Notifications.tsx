import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  EnvelopeSimple
} from '@phosphor-icons/react';
import { useKV } from '@github/spark/hooks';
import { DiscordNotifications } from '@/components/settings/DiscordNotifications';
import { EVEMailNotifications } from '@/components/settings/EVEMailNotifications';

interface NotificationsProps {
  isMobileView?: boolean;
}

export function Notifications({ isMobileView }: NotificationsProps) {
  const [activeSubTab, setActiveSubTab] = useKV<string>('notifications-sub-tab', 'discord');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bell size={24} />
          Notification Preferences
        </h2>
        <p className="text-muted-foreground">
          Configure notification delivery methods and message templates for LMeve events
        </p>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="discord" className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#5865F2] rounded flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </div>
            Discord
          </TabsTrigger>
          <TabsTrigger value="evemail" className="flex items-center gap-2">
            <EnvelopeSimple size={16} />
            EVE Mail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discord" className="mt-6">
          <DiscordNotifications isMobileView={isMobileView} />
        </TabsContent>

        <TabsContent value="evemail" className="mt-6">
          <EVEMailNotifications isMobileView={isMobileView} />
        </TabsContent>
      </Tabs>
    </div>
  );
}