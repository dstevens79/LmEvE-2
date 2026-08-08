import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import type { LMeveUser } from '@/lib/types';
import { canAccessTab, canAccessSettingsTab } from '@/lib/roles';
import {
  PRIMARY_NAV_TABS,
  SETTINGS_NAV_ICON,
  SETTINGS_NAV_TABS,
  type AppNavTab,
} from '@/lib/app-navigation';

export interface AppPrimaryNavProps {
  variant: 'desktop' | 'mobile';
  currentUser: LMeveUser | null;
  activeTab: string;
  activeSettingsTab: string;
  settingsExpanded: boolean;
  onTabChange: (tabId: string) => void;
  onSettingsTabChange: (tabId: string) => void;
  /** Mobile: close menu after selection */
  onNavigateComplete?: () => void;
  /** Optional status strip rendered above desktop nav items */
  desktopStatusSlot?: React.ReactNode;
  tabs?: AppNavTab[];
}

export function AppPrimaryNav({
  variant,
  currentUser,
  activeTab,
  activeSettingsTab,
  settingsExpanded,
  onTabChange,
  onSettingsTabChange,
  onNavigateComplete,
  desktopStatusSlot,
  tabs = PRIMARY_NAV_TABS,
}: AppPrimaryNavProps) {
  const Gear = SETTINGS_NAV_ICON;
  const afterNav = () => {
    onNavigateComplete?.();
  };

  const renderPrimaryButtons = () =>
    tabs.map((tab) => {
      const IconComponent = tab.icon;
      const isActive = activeTab === tab.id;
      const isAccessible = canAccessTab(currentUser, tab.id);
      const isDisabled = !isAccessible;
      return (
        <Button
          key={tab.id}
          variant={isActive ? 'default' : 'ghost'}
          disabled={isDisabled}
          className={`w-full justify-start gap-3 ${
            isActive
              ? 'bg-accent text-accent-foreground shadow-sm'
              : isDisabled
                ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => {
            onTabChange(tab.id);
            afterNav();
          }}
        >
          <IconComponent size={18} />
          <span className="text-sm font-medium">{tab.label}</span>
          {'badge' in tab && tab.badge && (
            <Badge
              variant="secondary"
              className={`ml-auto text-xs h-5 px-1.5 ${
                isActive
                  ? 'bg-accent-foreground/20 text-accent-foreground'
                  : 'bg-accent/20 text-accent'
              }`}
            >
              {tab.badge}
            </Badge>
          )}
        </Button>
      );
    });

  const renderSettingsSubs = () =>
    SETTINGS_NAV_TABS.map((settingsTab) => {
      const IconComponent = settingsTab.icon;
      const isActiveSettings = activeSettingsTab === settingsTab.id;
      const isAccessible = canAccessSettingsTab(currentUser, settingsTab.id);
      if (!isAccessible) return null;
      return (
        <Button
          key={settingsTab.id}
          variant={isActiveSettings ? 'secondary' : 'ghost'}
          size="sm"
          className={`w-full justify-start gap-2 text-xs ${
            isActiveSettings
              ? 'bg-secondary text-secondary-foreground'
              : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => {
            onSettingsTabChange(settingsTab.id);
            afterNav();
          }}
        >
          <IconComponent size={14} />
          <span>{settingsTab.label}</span>
        </Button>
      );
    });

  if (variant === 'desktop') {
    return (
      <div className="space-y-2">
        {desktopStatusSlot}
        {renderPrimaryButtons()}
        <div className="pt-2 border-t border-border">
          <Button
            variant={activeTab === 'settings' ? 'default' : 'ghost'}
            disabled={!currentUser || !canAccessTab(currentUser, 'settings')}
            className={`w-full justify-start gap-3 ${
              activeTab === 'settings'
                ? 'bg-accent text-accent-foreground shadow-sm'
                : !currentUser || !canAccessTab(currentUser, 'settings')
                  ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => onTabChange('settings')}
          >
            <Gear size={18} />
            <span className="text-sm font-medium">Settings</span>
            {settingsExpanded ? (
              <CaretDown size={16} className="ml-auto" />
            ) : (
              <CaretRight size={16} className="ml-auto" />
            )}
          </Button>
          {settingsExpanded && currentUser && (
            <div className="mt-2 ml-6 space-y-1">{renderSettingsSubs()}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
      <div className="space-y-1">{renderPrimaryButtons()}</div>
      {currentUser && (
        <div className="pt-2 border-t border-border space-y-1">
          <Button
            variant={activeTab === 'settings' ? 'default' : 'ghost'}
            className={`w-full justify-start gap-3 ${
              activeTab === 'settings'
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => {
              onTabChange('settings');
              afterNav();
            }}
          >
            <Gear size={18} />
            <span className="text-sm font-medium">Settings</span>
          </Button>
          {activeTab === 'settings' && (
            <div className="ml-6 space-y-1">{renderSettingsSubs()}</div>
          )}
        </div>
      )}
    </div>
  );
}
