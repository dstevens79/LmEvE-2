import { useCallback } from 'react';
import { toast } from 'sonner';
import type { LMeveUser, TabType } from '@/lib/types';
import { canAccessTab, canAccessSettingsTab } from '@/lib/roles';

type SetTab = (value: TabType | ((current: TabType) => TabType)) => void;
type SetString = (value: string | ((current: string) => string)) => void;
type SetBool = (value: boolean | ((current: boolean) => boolean)) => void;

/**
 * Single authorization path for primary tabs and Settings sub-tabs.
 */
export function useTabNavigation(options: {
  currentUser: LMeveUser | null;
  settingsExpanded: boolean;
  setActiveTab: SetTab;
  setActiveSettingsTab: SetString;
  setSettingsExpanded: SetBool;
  onRequireLogin: () => void;
}) {
  const {
    currentUser,
    settingsExpanded,
    setActiveTab,
    setActiveSettingsTab,
    setSettingsExpanded,
    onRequireLogin,
  } = options;

  const handleTabChange = useCallback(
    (value: string) => {
      if (!currentUser && value !== 'dashboard') {
        onRequireLogin();
        return;
      }

      if (currentUser && !canAccessTab(currentUser, value)) {
        toast.error('You do not have permission to access this section');
        return;
      }

      if (value === 'settings') {
        if (!currentUser) {
          onRequireLogin();
          return;
        }
        setSettingsExpanded(!settingsExpanded);
        if (!settingsExpanded) {
          setActiveTab('settings' as TabType);
        } else {
          setActiveTab('dashboard');
        }
        return;
      }

      setActiveTab(value as TabType);
      setSettingsExpanded(false);
    },
    [
      currentUser,
      onRequireLogin,
      setActiveTab,
      setSettingsExpanded,
      settingsExpanded,
    ]
  );

  const handleSettingsTabChange = useCallback(
    (value: string) => {
      if (currentUser && !canAccessSettingsTab(currentUser, value)) {
        toast.error('You do not have permission to access this section');
        return;
      }
      setActiveSettingsTab(value);
    },
    [currentUser, setActiveSettingsTab]
  );

  return { handleTabChange, handleSettingsTabChange };
}
