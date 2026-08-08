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
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { TabType } from '@/lib/types';

const Dashboard = lazy(() =>
  import('@/components/tabs/Dashboard').then((m) => ({ default: m.Dashboard }))
);
const Members = lazy(() =>
  import('@/components/tabs/Members').then((m) => ({ default: m.Members }))
);
const Assets = lazy(() =>
  import('@/components/tabs/Assets').then((m) => ({ default: m.Assets }))
);
const Manufacturing = lazy(() =>
  import('@/components/tabs/Manufacturing').then((m) => ({ default: m.Manufacturing }))
);
const Market = lazy(() =>
  import('@/components/tabs/Market').then((m) => ({ default: m.Market }))
);
const Wallet = lazy(() =>
  import('@/components/tabs/Wallet').then((m) => ({ default: m.Wallet }))
);
const Notifications = lazy(() =>
  import('@/components/tabs/Notifications').then((m) => ({ default: m.Notifications }))
);
const Corporations = lazy(() =>
  import('@/components/Corporations').then((m) => ({ default: m.Corporations }))
);
const Theme = lazy(() =>
  import('@/components/tabs/Theme').then((m) => ({ default: m.Theme }))
);
const PlanetaryInteraction = lazy(() =>
  import('@/components/tabs/PlanetaryInteraction').then((m) => ({ default: m.PlanetaryInteraction }))
);
const Buyback = lazy(() =>
  import('@/components/tabs/Buyback').then((m) => ({ default: m.Buyback }))
);

export type PrimaryTabId = Exclude<TabType, 'settings'> | string;

export interface AppNavTab {
  id: string;
  label: string;
  icon: Icon;
  component?: ComponentType<any> | LazyExoticComponent<ComponentType<any>>;
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
