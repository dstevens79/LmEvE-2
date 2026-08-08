import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Palette, 
  Download, 
  Upload, 
  Copy, 
  Trash, 
  Plus, 
  ArrowsClockwise, 
  Eye, 
  Sliders,
  Square,
  Circle,
  Sun,
  Moon,
  Check,
  X
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { 
  useThemeManager, 
  ThemeSettings, 
  defaultThemes, 
  accentColorOptions, 
  neutralColorOptions, 
  fontOptions 
} from '@/lib/themeManager';

interface ThemeProps {
  isMobileView?: boolean;
}

const ColorPreview: React.FC<{ 
  color: string; 
  label: string;
  onClick?: () => void;
  className?: string;
}> = ({ color, label, onClick, className = "" }) => (
  <div 
    className={`flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-2 ${className}`}
    onClick={onClick}
  >
    <div 
      className="w-6 h-6 rounded border border-border shadow-sm"
      style={{ backgroundColor: color }}
    />
    <span className="text-sm font-medium">{label}</span>
  </div>
);

const ThemePreview: React.FC<{ 
  theme: ThemeSettings; 
  isActive: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}> = ({ theme, isActive, onSelect, onEdit, onDelete, showActions = false }) => (
  <Card className={`cursor-pointer transition-all hover:shadow-md ${
    isActive ? 'ring-2 ring-accent border-accent' : ''
  }`}>
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-medium">{theme.name}</CardTitle>
        {isActive && (
          <Badge variant="default" className="text-xs bg-accent text-accent-foreground">
            Active
          </Badge>
        )}
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="space-y-2">
        <div className="flex gap-1">
          <div 
            className="w-4 h-4 rounded-sm border border-border"
            style={{ backgroundColor: theme.customColors.primary }}
          />
          <div 
            className="w-4 h-4 rounded-sm border border-border"
            style={{ backgroundColor: theme.customColors.accent }}
          />
          <div 
            className="w-4 h-4 rounded-sm border border-border"
            style={{ backgroundColor: theme.customColors.secondary }}
          />
          <div 
            className="w-4 h-4 rounded-sm border border-border"
            style={{ backgroundColor: theme.customColors.muted }}
          />
        </div>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {theme.backgroundMode === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
          <span>{theme.backgroundMode}</span>
          <span>â€¢</span>
          <span>{theme.accentColor}</span>
          <span>â€¢</span>
          <span>{theme.fontFamily}</span>
        </div>
        
        <div className="flex gap-1 pt-2">
          <Button size="sm" variant="outline" onClick={onSelect} className="flex-1">
            {isActive ? <Check size={12} className="mr-1" /> : <Eye size={12} className="mr-1" />}
            {isActive ? 'Applied' : 'Apply'}
          </Button>
          {showActions && (
            <>
              {onEdit && (
                <Button size="sm" variant="outline" onClick={onEdit}>
                  <Sliders size={12} />
                </Button>
              )}
              {onDelete && (
                <Button size="sm" variant="outline" onClick={onDelete} className="text-destructive hover:text-destructive">
                  <Trash size={12} />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

const ColorPicker: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets?: string[];
}> = ({ label, value, onChange, presets = [] }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium">{label}</Label>
    <div className="flex gap-2">
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1"
        placeholder="oklch(0.5 0.2 180)"
      />
      <div 
        className="w-10 h-10 rounded border border-border cursor-pointer"
        style={{ backgroundColor: value }}
        onClick={() => {
          // In a real implementation, this would open a color picker
          // For now, we'll cycle through some preset colors
          const presetColors = presets.length ? presets : [
            'oklch(0.4 0.15 240)', // Blue
            'oklch(0.4 0.2 140)',  // Green
            'oklch(0.45 0.15 45)', // Amber
            'oklch(0.4 0.2 15)',   // Red
            'oklch(0.4 0.2 300)',  // Purple
          ];
          const currentIndex = presetColors.indexOf(value);
          const nextIndex = (currentIndex + 1) % presetColors.length;
          onChange(presetColors[nextIndex]);
        }}
      />
    </div>
    {presets.length > 0 && (
      <div className="flex gap-1 flex-wrap">
        {presets.map((preset, index) => (
          <div
            key={index}
            className="w-6 h-6 rounded border border-border cursor-pointer hover:scale-110 transition-transform"
            style={{ backgroundColor: preset }}
            onClick={() => onChange(preset)}
          />
        ))}
      </div>
    )}
  </div>
);

export const Theme: React.FC<ThemeProps> = ({ isMobileView = false }) => {
  const {
    currentTheme,
    currentThemeName,
    allThemes,
    customThemes,
    defaultThemes,
    setTheme,
    saveCustomTheme,
    deleteCustomTheme,
    themeManager
  } = useThemeManager();

  const [editingTheme, setEditingTheme] = useState<ThemeSettings | null>(null);
  const [newThemeName, setNewThemeName] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [previewTheme, setPreviewTheme] = useState<ThemeSettings | null>(null);

  // Live preview functionality
  useEffect(() => {
    if (previewTheme) {
      themeManager.applyTheme(previewTheme);
      const timeout = setTimeout(() => {
        setPreviewTheme(null);
        themeManager.applyTheme(currentTheme);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [previewTheme, themeManager, currentTheme]);

  const handleCreateTheme = () => {
    if (!newThemeName.trim()) {
      toast.error('Please enter a theme name');
      return;
    }

    if (allThemes[newThemeName]) {
      toast.error('A theme with this name already exists');
      return;
    }

    const newTheme: ThemeSettings = {
      ...defaultThemes['eve-dark'],
      name: newThemeName.trim()
    };

    setEditingTheme(newTheme);
    setNewThemeName('');
    setShowCreateDialog(false);
  };

  const handleSaveTheme = (theme: ThemeSettings) => {
    saveCustomTheme(theme);
    setEditingTheme(null);
    toast.success(`Theme "${theme.name}" saved successfully`);
  };

  const handleExportTheme = (theme: ThemeSettings) => {
    const exported = themeManager.exportTheme(theme);
    navigator.clipboard.writeText(exported);
    toast.success('Theme copied to clipboard');
  };

  const handleImportTheme = () => {
    try {
      const imported = themeManager.importTheme(importJson);
      saveCustomTheme(imported);
      setImportJson('');
      setShowImportDialog(false);
      toast.success(`Theme "${imported.name}" imported successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import theme');
    }
  };

  const handleDeleteTheme = (themeName: string) => {
    deleteCustomTheme(themeName);
    toast.success(`Theme "${themeName}" deleted`);
  };

  const handlePreviewTheme = (theme: ThemeSettings) => {
    setPreviewTheme(theme);
    toast.info('Previewing theme for 3 seconds...', {
      duration: 3000,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Theme Customization</h1>
          <p className="text-muted-foreground">
            Customize the appearance and styling of your LMeve interface
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload size={16} className="mr-2" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Theme</DialogTitle>
                <DialogDescription>
                  Paste the theme JSON configuration below
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder="Paste theme JSON here..."
                  className="min-h-32"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleImportTheme} disabled={!importJson.trim()}>
                    Import Theme
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={16} className="mr-2" />
                Create Theme
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Theme</DialogTitle>
                <DialogDescription>
                  Create a custom theme based on the current settings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Theme Name</Label>
                  <Input
                    value={newThemeName}
                    onChange={(e) => setNewThemeName(e.target.value)}
                    placeholder="My Custom Theme"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTheme} disabled={!newThemeName.trim()}>
                    Create Theme
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {editingTheme && (
        <Card className="border-accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sliders size={20} />
              Editing: {editingTheme.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="colors" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="colors">Colors</TabsTrigger>
                <TabsTrigger value="layout">Layout</TabsTrigger>
                <TabsTrigger value="typography">Typography</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="colors" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ColorPicker
                    label="Primary Color"
                    value={editingTheme.customColors.primary}
                    onChange={(value) => setEditingTheme({
                      ...editingTheme,
                      customColors: { ...editingTheme.customColors, primary: value }
                    })}
                  />
                  <ColorPicker
                    label="Accent Color"
                    value={editingTheme.customColors.accent}
                    onChange={(value) => setEditingTheme({
                      ...editingTheme,
                      customColors: { ...editingTheme.customColors, accent: value }
                    })}
                  />
                  <ColorPicker
                    label="Secondary Color"
                    value={editingTheme.customColors.secondary}
                    onChange={(value) => setEditingTheme({
                      ...editingTheme,
                      customColors: { ...editingTheme.customColors, secondary: value }
                    })}
                  />
                  <ColorPicker
                    label="Muted Color"
                    value={editingTheme.customColors.muted}
                    onChange={(value) => setEditingTheme({
                      ...editingTheme,
                      customColors: { ...editingTheme.customColors, muted: value }
                    })}
                  />
                  <ColorPicker
                    label="Border Color"
                    value={editingTheme.customColors.border}
                    onChange={(value) => setEditingTheme({
                      ...editingTheme,
                      customColors: { ...editingTheme.customColors, border: value }
                    })}
                  />
                  <ColorPicker
                    label="Destructive Color"
                    value={editingTheme.customColors.destructive}
                    onChange={(value) => setEditingTheme({
                      ...editingTheme,
                      customColors: { ...editingTheme.customColors, destructive: value }
                    })}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Accent Palette</Label>
                    <Select
                      value={editingTheme.accentColor}
                      onValueChange={(value) => setEditingTheme({
                        ...editingTheme,
                        accentColor: value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accentColorOptions.map(color => (
                          <SelectItem key={color} value={color}>
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded bg-${color}-500`} />
                              {color}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Neutral Palette</Label>
                    <Select
                      value={editingTheme.neutralColor}
                      onValueChange={(value) => setEditingTheme({
                        ...editingTheme,
                        neutralColor: value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {neutralColorOptions.map(color => (
                          <SelectItem key={color} value={color}>
                            {color}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="dark-mode"
                    checked={editingTheme.backgroundMode === 'dark'}
                    onCheckedChange={(checked) => setEditingTheme({
                      ...editingTheme,
                      backgroundMode: checked ? 'dark' : 'light'
                    })}
                  />
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                </div>
              </TabsContent>

              <TabsContent value="layout" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label>Border Radius: {editingTheme.borderRadius}rem</Label>
                    <Slider
                      value={[editingTheme.borderRadius]}
                      onValueChange={([value]) => setEditingTheme({
                        ...editingTheme,
                        borderRadius: value
                      })}
                      max={2}
                      min={0}
                      step={0.125}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <Label>Size Scale: {editingTheme.sizeScale}x</Label>
                    <Slider
                      value={[editingTheme.sizeScale]}
                      onValueChange={([value]) => setEditingTheme({
                        ...editingTheme,
                        sizeScale: value
                      })}
                      max={1.5}
                      min={0.75}
                      step={0.05}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <Label>Radius Factor: {editingTheme.radiusFactor}x</Label>
                    <Slider
                      value={[editingTheme.radiusFactor]}
                      onValueChange={([value]) => setEditingTheme({
                        ...editingTheme,
                        radiusFactor: value
                      })}
                      max={2}
                      min={0.5}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="typography" className="space-y-4">
                <div>
                  <Label>Font Family</Label>
                  <Select
                    value={editingTheme.fontFamily}
                    onValueChange={(value) => setEditingTheme({
                      ...editingTheme,
                      fontFamily: value as any
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions.map(font => (
                        <SelectItem key={font.value} value={font.value}>
                          <span style={{ fontFamily: font.family }}>
                            {font.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Typography Preview</Label>
                  <div className="space-y-2 p-4 bg-card border rounded">
                    <h1 className="text-2xl font-bold">Heading 1</h1>
                    <h2 className="text-xl font-semibold">Heading 2</h2>
                    <h3 className="text-lg font-medium">Heading 3</h3>
                    <p className="text-base">Body text with normal weight</p>
                    <p className="text-sm text-muted-foreground">Small muted text</p>
                    <code className="text-sm bg-muted px-2 py-1 rounded">Code text</code>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="space-y-4">
                <div className="space-y-2">
                  <Label>Theme Preview</Label>
                  <div className="p-4 bg-card border rounded space-y-4">
                    <div className="flex items-center gap-2">
                      <Button size="sm">Primary Button</Button>
                      <Button size="sm" variant="outline">Outline Button</Button>
                      <Button size="sm" variant="secondary">Secondary</Button>
                      <Button size="sm" variant="destructive">Destructive</Button>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Input field" className="flex-1" />
                      <Button size="sm">
                        <Copy size={16} />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Sample Card</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          This is how cards will look with your theme.
                        </CardContent>
                      </Card>
                      <Alert>
                        <AlertDescription>
                          Alert component preview
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => handlePreviewTheme(editingTheme)}
              >
                <Eye size={16} className="mr-2" />
                Preview
              </Button>
              <Button variant="outline" onClick={() => setEditingTheme(null)}>
                Cancel
              </Button>
              <Button onClick={() => handleSaveTheme(editingTheme)}>
                Save Theme
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="default" className="w-full">
        <TabsList>
          <TabsTrigger value="default">Default Themes</TabsTrigger>
          <TabsTrigger value="custom">
            Custom Themes
            {Object.keys(customThemes).length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {Object.keys(customThemes).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="default" className="space-y-4">
          <div className={`grid ${isMobileView ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-4`}>
            {Object.entries(defaultThemes).map(([key, theme]) => (
              <ThemePreview
                key={key}
                theme={theme}
                isActive={currentThemeName === key}
                onSelect={() => setTheme(key)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          {Object.keys(customThemes).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Palette size={48} className="text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Custom Themes</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first custom theme to get started
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus size={16} className="mr-2" />
                  Create Theme
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className={`grid ${isMobileView ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-4`}>
              {Object.entries(customThemes).map(([key, theme]) => (
                <ThemePreview
                  key={key}
                  theme={theme}
                  isActive={currentThemeName === key}
                  onSelect={() => setTheme(key)}
                  onEdit={() => setEditingTheme(theme)}
                  onDelete={() => handleDeleteTheme(key)}
                  showActions
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowsClockwise size={20} />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportTheme(currentTheme)}
            >
              <Download size={16} className="mr-2" />
              Export Current Theme
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => themeManager.resetToDefault()}
            >
              <ArrowsClockwise size={16} className="mr-2" />
              Reset to Default
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};