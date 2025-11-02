import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import type { DatabaseSettings } from '@/lib/persistenceService';

export interface DatabaseConfigPanelProps {
  databaseSettings: DatabaseSettings;
  dbConnected: boolean;
  onUpdate: (key: keyof DatabaseSettings, value: any) => void;
}

export const DatabaseConfigPanel: React.FC<DatabaseConfigPanelProps> = ({
  databaseSettings,
  dbConnected,
  onUpdate,
}) => {
  const [showSudoPassword, setShowSudoPassword] = React.useState(false);
  const [showDbPassword, setShowDbPassword] = React.useState(false);

  return (
    <>
      {/* Database Connection - Compact */}
      <div className="lg:col-span-1 space-y-4">
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <h4 className="text-sm font-medium">Database</h4>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="dbHost" className="text-xs">Host</Label>
              <Input
                id="dbHost"
                value={databaseSettings.host || ''}
                onChange={(e) => {
                  onUpdate('host', e.target.value);
                  onUpdate('sudoHost', e.target.value);
                }}
                placeholder="localhost"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dbPort" className="text-xs">Port</Label>
              <Input
                id="dbPort"
                type="number"
                value={databaseSettings.port || ''}
                onChange={(e) => {
                  const port = parseInt(e.target.value) || 3306;
                  onUpdate('port', port);
                  onUpdate('sudoPort', port);
                }}
                placeholder="3306"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dbName" className="text-xs">Database</Label>
              <Input
                id="dbName"
                value={databaseSettings.database || ''}
                onChange={(e) => onUpdate('database', e.target.value)}
                placeholder="lmeve"
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Database Users - Compact */}
      <div className="lg:col-span-1 space-y-4">
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${databaseSettings.sudoUsername && databaseSettings.sudoPassword ? 'bg-green-500' : 'bg-red-500'}`} />
            <h4 className="text-sm font-medium">DB Users</h4>
          </div>
          <div className="space-y-3">
            {/* Admin User */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Sudo User</Label>
              <Input
                value={databaseSettings.sudoUsername || ''}
                onChange={(e) => onUpdate('sudoUsername', e.target.value)}
                placeholder="root"
                className="h-8 text-sm"
              />
              <div className="relative">
                <Input
                  type={showSudoPassword ? 'text' : 'password'}
                  value={databaseSettings.sudoPassword || ''}
                  onChange={(e) => onUpdate('sudoPassword', e.target.value)}
                  placeholder="Admin password"
                  className="h-8 text-sm pr-8"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-8 w-8 p-0"
                  onClick={() => setShowSudoPassword((v) => !v)}
                >
                  {showSudoPassword ? <EyeSlash size={12} /> : <Eye size={12} />}
                </Button>
              </div>
            </div>

            {/* App User */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">LMeve User</Label>
              <Input
                value={databaseSettings.username || ''}
                onChange={(e) => onUpdate('username', e.target.value)}
                placeholder="lmeve_user"
                className="h-8 text-sm"
              />
              <div className="relative">
                <Input
                  type={showDbPassword ? 'text' : 'password'}
                  value={databaseSettings.password || ''}
                  onChange={(e) => onUpdate('password', e.target.value)}
                  placeholder="App password"
                  className="h-8 text-sm pr-8"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-8 w-8 p-0"
                  onClick={() => setShowDbPassword((v) => !v)}
                >
                  {showDbPassword ? <EyeSlash size={12} /> : <Eye size={12} />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DatabaseConfigPanel;
