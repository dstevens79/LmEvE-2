import { useKV } from '@/lib/kv';

export interface ThemeSettings {
  name: string;
  accentColor: string;
  neutralColor: string;
  backgroundMode: 'light' | 'dark';
  borderRadius: number;
  sizeScale: number;
  radiusFactor: number;
  fontFamily: 'inter' | 'jetbrains' | 'system';
  customColors: {
    primary: string;
    secondary: string;
    accent: string;
    destructive: string;
    muted: string;
    border: string;
  };
}

export const defaultThemes: Record<string, ThemeSettings> = {
  'eve-dark': {
    name: 'EVE Dark',
    accentColor: 'amber',
    neutralColor: 'slate',
    backgroundMode: 'dark',
    borderRadius: 0.75,
    sizeScale: 1,
    radiusFactor: 1,
    fontFamily: 'inter',
    customColors: {
      primary: 'oklch(0.45 0.15 240)',
      secondary: 'oklch(0.16 0.02 220)',
      accent: 'oklch(0.65 0.2 35)',
      destructive: 'oklch(0.6 0.25 15)',
      muted: 'oklch(0.16 0.02 220)',
      border: 'oklch(0.2 0.02 220)',
    }
  },
  'eve-blue': {
    name: 'EVE Blue',
    accentColor: 'blue',
    neutralColor: 'slate',
    backgroundMode: 'dark',
    borderRadius: 0.75,
    sizeScale: 1,
    radiusFactor: 1,
    fontFamily: 'inter',
    customColors: {
      primary: 'oklch(0.45 0.2 240)',
      secondary: 'oklch(0.16 0.02 220)',
      accent: 'oklch(0.6 0.25 240)',
      destructive: 'oklch(0.6 0.25 15)',
      muted: 'oklch(0.16 0.02 220)',
      border: 'oklch(0.2 0.02 220)',
    }
  },
  'eve-amber': {
    name: 'EVE Amber',
    accentColor: 'amber',
    neutralColor: 'slate',
    backgroundMode: 'dark',
    borderRadius: 0.75,
    sizeScale: 1,
    radiusFactor: 1,
    fontFamily: 'inter',
    customColors: {
      primary: 'oklch(0.45 0.15 45)',
      secondary: 'oklch(0.16 0.02 220)',
      accent: 'oklch(0.7 0.2 45)',
      destructive: 'oklch(0.6 0.25 15)',
      muted: 'oklch(0.16 0.02 220)',
      border: 'oklch(0.2 0.02 220)',
    }
  },
  'corp-green': {
    name: 'Corporation Green',
    accentColor: 'green',
    neutralColor: 'slate',
    backgroundMode: 'dark',
    borderRadius: 0.75,
    sizeScale: 1,
    radiusFactor: 1,
    fontFamily: 'inter',
    customColors: {
      primary: 'oklch(0.4 0.2 140)',
      secondary: 'oklch(0.16 0.02 220)',
      accent: 'oklch(0.6 0.25 140)',
      destructive: 'oklch(0.6 0.25 15)',
      muted: 'oklch(0.16 0.02 220)',
      border: 'oklch(0.2 0.02 220)',
    }
  },
  'light-mode': {
    name: 'Light Mode',
    accentColor: 'blue',
    neutralColor: 'gray',
    backgroundMode: 'light',
    borderRadius: 0.75,
    sizeScale: 1,
    radiusFactor: 1,
    fontFamily: 'inter',
    customColors: {
      primary: 'oklch(0.4 0.15 240)',
      secondary: 'oklch(0.96 0.01 220)',
      accent: 'oklch(0.5 0.2 240)',
      destructive: 'oklch(0.55 0.25 15)',
      muted: 'oklch(0.96 0.01 220)',
      border: 'oklch(0.88 0.01 220)',
    }
  }
};

export const accentColorOptions = [
  'blue', 'violet', 'green', 'amber', 'red', 'pink', 'cyan', 'orange',
  'purple', 'teal', 'indigo', 'lime', 'sky', 'rose', 'emerald', 'yellow'
];

export const neutralColorOptions = [
  'slate', 'gray', 'stone', 'neutral', 'zinc'
];

export const fontOptions = [
  { value: 'inter', label: 'Inter (Default)', family: 'Inter, system-ui, sans-serif' },
  { value: 'jetbrains', label: 'JetBrains Mono', family: '"JetBrains Mono", monospace' },
  { value: 'system', label: 'System Font', family: 'system-ui, sans-serif' }
];

export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: ThemeSettings;

  constructor() {
    this.currentTheme = defaultThemes['eve-dark'];
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  setTheme(theme: ThemeSettings): void {
    this.currentTheme = theme;
    this.applyTheme(theme);
  }

  getCurrentTheme(): ThemeSettings {
    return this.currentTheme;
  }

  applyTheme(theme: ThemeSettings): void {
    const root = document.documentElement;
    
    // Apply basic theme variables
    root.style.setProperty('--size-scale', theme.sizeScale.toString());
    root.style.setProperty('--radius-factor', theme.radiusFactor.toString());
    root.style.setProperty('--radius', `${theme.borderRadius}rem`);
    root.style.setProperty('--font-family', fontOptions.find(f => f.value === theme.fontFamily)?.family || 'Inter, system-ui, sans-serif');

    // Apply custom colors to existing CSS variables
    root.style.setProperty('--primary', theme.customColors.primary);
    root.style.setProperty('--secondary', theme.customColors.secondary);
    root.style.setProperty('--accent', theme.customColors.accent);
    root.style.setProperty('--destructive', theme.customColors.destructive);
    root.style.setProperty('--muted', theme.customColors.muted);
    root.style.setProperty('--border', theme.customColors.border);
    root.style.setProperty('--input', theme.customColors.muted);

    // Apply background/foreground based on mode
    if (theme.backgroundMode === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
      
      // Apply enhanced dark theme colors
      root.style.setProperty('--background', 'oklch(0.08 0.02 220)');
      root.style.setProperty('--foreground', 'oklch(0.98 0.01 220)');
      root.style.setProperty('--card', 'oklch(0.12 0.02 220)');
      root.style.setProperty('--card-foreground', 'oklch(0.98 0.01 220)');
      root.style.setProperty('--popover', 'oklch(0.12 0.02 220)');
      root.style.setProperty('--popover-foreground', 'oklch(0.98 0.01 220)');
      root.style.setProperty('--muted-foreground', 'oklch(0.7 0.02 220)');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      
      // Apply light mode colors
      root.style.setProperty('--background', 'oklch(0.98 0.01 220)');
      root.style.setProperty('--foreground', 'oklch(0.05 0.01 220)');
      root.style.setProperty('--card', 'oklch(1 0 0)');
      root.style.setProperty('--card-foreground', 'oklch(0.05 0.01 220)');
      root.style.setProperty('--popover', 'oklch(1 0 0)');
      root.style.setProperty('--popover-foreground', 'oklch(0.05 0.01 220)');
      root.style.setProperty('--muted-foreground', 'oklch(0.45 0.01 220)');
    }

    // Apply accent color derived values
    const accentForegroundColor = theme.backgroundMode === 'dark' ? 'oklch(0.05 0.01 220)' : 'oklch(0.98 0.01 220)';
    root.style.setProperty('--accent-foreground', accentForegroundColor);
    root.style.setProperty('--primary-foreground', 'oklch(0.98 0.01 220)');
    root.style.setProperty('--secondary-foreground', theme.backgroundMode === 'dark' ? 'oklch(0.8 0.02 220)' : 'oklch(0.45 0.01 220)');
    root.style.setProperty('--destructive-foreground', 'oklch(0.98 0.01 220)');

    // Update ring color to match accent
    root.style.setProperty('--ring', theme.customColors.accent);

    // Apply font family to body
    const fontConfig = fontOptions.find(f => f.value === theme.fontFamily);
    if (fontConfig) {
      document.body.style.fontFamily = fontConfig.family;
    }
    
    console.log('✨ Theme applied:', theme.name, {
      colors: theme.customColors,
      mode: theme.backgroundMode,
      font: theme.fontFamily,
      radius: theme.borderRadius
    });
  }

  createCustomTheme(name: string, baseTheme: ThemeSettings, overrides: Partial<ThemeSettings>): ThemeSettings {
    return {
      ...baseTheme,
      ...overrides,
      name,
      customColors: {
        ...baseTheme.customColors,
        ...overrides.customColors
      }
    };
  }

  exportTheme(theme: ThemeSettings): string {
    return JSON.stringify(theme, null, 2);
  }

  importTheme(themeJson: string): ThemeSettings {
    try {
      const theme = JSON.parse(themeJson);
      if (!this.validateTheme(theme)) {
        throw new Error('Invalid theme format');
      }
      return theme;
    } catch (error) {
      throw new Error(`Failed to import theme: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateTheme(theme: any): theme is ThemeSettings {
    return (
      typeof theme === 'object' &&
      typeof theme.name === 'string' &&
      typeof theme.accentColor === 'string' &&
      typeof theme.neutralColor === 'string' &&
      ['light', 'dark'].includes(theme.backgroundMode) &&
      typeof theme.borderRadius === 'number' &&
      typeof theme.sizeScale === 'number' &&
      typeof theme.radiusFactor === 'number' &&
      typeof theme.fontFamily === 'string' &&
      theme.customColors &&
      typeof theme.customColors.primary === 'string' &&
      typeof theme.customColors.secondary === 'string' &&
      typeof theme.customColors.accent === 'string' &&
      typeof theme.customColors.destructive === 'string' &&
      typeof theme.customColors.muted === 'string' &&
      typeof theme.customColors.border === 'string'
    );
  }

  resetToDefault(): void {
    this.setTheme(defaultThemes['eve-dark']);
  }
}

import React from 'react';

export function useThemeManager() {
  const [currentThemeName, setCurrentThemeName] = useKV<string>('current-theme', 'eve-dark');
  const [customThemes, setCustomThemes] = useKV<Record<string, ThemeSettings>>('custom-themes', {});
  
  const allThemes = { ...defaultThemes, ...customThemes };
  const currentTheme = allThemes[currentThemeName] || defaultThemes['eve-dark'];
  
  const themeManager = ThemeManager.getInstance();

  // Apply theme on mount and when theme changes
  React.useEffect(() => {
    themeManager.setTheme(currentTheme);
  }, [currentTheme, themeManager]);

  const setTheme = (themeName: string) => {
    if (allThemes[themeName]) {
      setCurrentThemeName(themeName);
      themeManager.setTheme(allThemes[themeName]);
    }
  };

  const saveCustomTheme = (theme: ThemeSettings) => {
    setCustomThemes(prev => ({
      ...prev,
      [theme.name]: theme
    }));
  };

  const deleteCustomTheme = (themeName: string) => {
    if (customThemes[themeName]) {
      setCustomThemes(prev => {
        const updated = { ...prev };
        delete updated[themeName];
        return updated;
      });
      
      // If deleting current theme, revert to default
      if (currentThemeName === themeName) {
        setTheme('eve-dark');
      }
    }
  };

  return {
    currentTheme,
    currentThemeName,
    allThemes,
    customThemes,
    defaultThemes,
    setTheme,
    saveCustomTheme,
    deleteCustomTheme,
    themeManager
  };
}