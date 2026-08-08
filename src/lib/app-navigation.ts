import type { Icon } from '@phosphor-icons/react';
import {
  House,
  Users,
  Package,
  Factory,
  TrendUp,
  CurrencyDollar,
  Bell,
  Key,
  Palette,
  Planet,
  Receipt,
  Globe,
  Database,
  Clock,
  ChartLine,
  Shield,
  Gear,
} from '@phosphor-icons/react';
import type { ComponentType } from 'react';
import type { TabType } from '@/lib/types';
import { Dashboard } from '@/components/tabs/Dashboard';
import { Members } from '@/components/tabs/Members';
import { Assets } from '@/components/tabs/Assets';
import { Manufacturing } from '@/components/tabs/Manufacturing';
import { Market } from '@/components/tabs/Market';
import { Wallet } from '@/components/tabs/Wallet';
import { Notifications } from '@/components/tabs/Notifications';
import { Corporations } from '@/components/Corporations';
import { Theme } from '@/components/tabs/Theme';
import { PlanetaryInteraction } from '@/components/tabs/PlanetaryInteraction';
import { Buyback } from '@/components/tabs/Buyback';

export type PrimaryTabId = Exclude<TabType, 'settings'> | string;

export interface AppNavTab {
  id: string;
  label: string;
  icon: Icon;
  component?: ComponentType;
  badge?: string;
}

export interface AppSettingsTab {
  id: string;
  label: string;
  icon: Icon;
}

/** Primary app sections (excluding Settings, which is handled separately). */
export const PRIMARY_NAV_TABS: AppNavTab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: House, component: Dashboard },
  { id: 'members', label: 'Members', icon: Users, component: Members, badge: '42' },
  { id: 'assets', label: 'Assets', icon: Package, component: Assets },
  { id: 'manufacturing', label: 'Manufacturing', icon: Factory, component: Manufacturing, badge: '3' },
  { id: 'planetary', label: 'Planetary Interaction', icon: Planet, component: PlanetaryInteraction, badge: '5' },
  { id: 'market', label: 'Market', icon: TrendUp, component: Market },
  { id: 'wallet', label: 'Wallet', icon: CurrencyDollar, component: Wallet },
  { id: 'buyback', label: 'Buyback', icon: Receipt, component: Buyback },
  { id: 'notifications', label: 'Notifications', icon: Bell, component: Notifications },
  { id: 'corporations', label: 'ESI', icon: Key, component: Corporations },
  { id: 'theme', label: 'Theme', icon: Palette, component: Theme },
];

export const SETTINGS_NAV_TABS: AppSettingsTab[] = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'esi', label: 'ESI / SSO', icon: Key },
  { id: 'sync', label: 'Data Sync', icon: Clock },
  { id: 'sync-monitoring', label: 'Sync Monitoring', icon: ChartLine },
  { id: 'permissions', label: 'Permissions', icon: Shield },
];

export const SETTINGS_NAV_ICON = Gear;

export function findPrimaryTab(tabId: string | null | undefined): AppNavTab | undefined {
  if (!tabId) return undefined;
  return PRIMARY_NAV_TABS.find((t) => t.id === tabId);
}
