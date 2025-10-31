import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  Warning,
  X,
  ArrowClockwise,
  Copy,
  Info,
  Activity,
  Clock
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useGeneralSettings } from '@/lib/persistenceService';
import { useAuth } from '@/lib/auth-provider';
import { useKV } from '@/lib/kv';

interface GeneralSettingsProps {
  isMobileView?: boolean;
}

export function GeneralSettings({ isMobileView = false }: GeneralSettingsProps) {
  const { user } = useAuth();
  const [generalSettings, setGeneralSettings] = useGeneralSettings();

  // Overall system status state
  const [systemStatus, setSystemStatus] = useState<{
    eveOnline: 'online' | 'offline' | 'unknown';
    database: 'online' | 'offline' | 'unknown';
    remoteAccess: 'online' | 'offline' | 'unknown';
    esiStatus: 'online' | 'offline' | 'unknown';
    corporationESI: 'configured' | 'not-configured' | 'unknown';
    uptime: string;
    overall: 'online' | 'offline' | 'partial';
  }>({
    eveOnline: 'unknown',
    database: 'unknown',
    remoteAccess: 'unknown', 
    esiStatus: 'unknown',
    corporationESI: 'unknown',
    uptime: 'Unknown',
    overall: 'offline'
  });

  const handleSaveSettings = async () => {
    try {
      toast.success('General settings saved successfully');
    } catch (error) {
      toast.error('Failed to save general settings');
    }
  };

  const updateGeneralSettings = (updates: Partial<GeneralSettings>) => {
    setGeneralSettings(current => ({
      ...current,
      ...updates
    }));
  };

  const handleRefreshStatus = async () => {
    toast.info('Refreshing system status...');
    
    try {
      // Simulate status checks
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSystemStatus({
        eveOnline: Math.random() > 0.1 ? 'online' : 'offline',
        database: Math.random() > 0.2 ? 'online' : 'offline', 
        remoteAccess: Math.random() > 0.3 ? 'online' : 'offline',
        esiStatus: Math.random() > 0.2 ? 'online' : 'offline',
        corporationESI: Math.random() > 0.4 ? 'configured' : 'not-configured',
        uptime: `${Math.floor(Math.random() * 72)}h ${Math.floor(Math.random() * 60)}m`,
        overall: 'online'
      });
      
      toast.success('System status refreshed');
    } catch (error) {
      toast.error('Failed to refresh status');
    }
  };

  const StatusIndicator: React.FC<{
    label: string;
    status: 'online' | 'offline' | 'unknown' | 'configured' | 'not-configured';
  }> = ({ label, status }) => (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <div 
          className={`w-2 h-2 rounded-full ${
            status === 'online' || status === 'configured' 
              ? 'bg-green-500' 
              : status === 'offline' || status === 'not-configured'
              ? 'bg-red-500'
              : 'bg-yellow-500'
          }`} 
        />
        <span className={`text-xs ${
          status === 'online' || status === 'configured'
            ? 'text-green-400' 
            : status === 'offline' || status === 'not-configured'
            ? 'text-red-400'
            : 'text-yellow-400'
        }`}>
          {status === 'configured' ? 'OK' : status === 'not-configured' ? 'NO' : status.toUpperCase()}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* System Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">System Status</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshStatus}
            >
              <ArrowClockwise size={16} className="mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <StatusIndicator label="EVE Online Server" status={systemStatus.eveOnline} />
              <StatusIndicator label="Database Connection" status={systemStatus.database} />
              <StatusIndicator label="Remote Access" status={systemStatus.remoteAccess} />
            </div>
            <div className="space-y-2">
              <StatusIndicator label="ESI Status" status={systemStatus.esiStatus} />
              <StatusIndicator label="Corporation ESI" status={systemStatus.corporationESI} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Uptime</span>
                <span className="text-xs text-foreground">{systemStatus.uptime}</span>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Status</span>
            <Badge variant={systemStatus.overall === 'online' ? 'default' : 'destructive'}>
              <Activity size={12} className="mr-1" />
              {systemStatus.overall.toUpperCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Application Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Application Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appName">Application Name</Label>
              <Input
                id="appName"
                value={generalSettings?.applicationName || 'LMeve'}
                onChange={(e) => updateGeneralSettings({ applicationName: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select 
                value={generalSettings?.timezone || 'UTC'} 
                onValueChange={(value) => updateGeneralSettings({ timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="US/Eastern">US/Eastern</SelectItem>
                  <SelectItem value="US/Pacific">US/Pacific</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                  <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
            <Input
              id="sessionTimeout"
              type="number"
              min="5"
              max="1440"
              value={generalSettings?.sessionTimeout || 120}
              onChange={(e) => updateGeneralSettings({ sessionTimeout: parseInt(e.target.value) || 120 })}
            />
            <p className="text-xs text-muted-foreground">
              How long users stay logged in without activity (5-1440 minutes)
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="enableLogging">Enable System Logging</Label>
                <p className="text-xs text-muted-foreground">
                  Log system activities for troubleshooting
                </p>
              </div>
              <Switch
                id="enableLogging"
                checked={generalSettings?.enableLogging || false}
                onCheckedChange={(checked) => updateGeneralSettings({ enableLogging: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="enableAutoBackup">Enable Auto Backup</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically backup settings daily
                </p>
              </div>
              <Switch
                id="enableAutoBackup"
                checked={generalSettings?.enableAutoBackup || false}
                onCheckedChange={(checked) => updateGeneralSettings({ enableAutoBackup: checked })}
              />
            </div>
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings}>
              <CheckCircle size={16} className="mr-2" />
              Save General Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Corporation Info */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Corporation Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Corporation Name</Label>
                <div className="p-2 bg-muted rounded text-sm">
                  {user.corporationName || 'Unknown Corporation'}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Current User</Label>
                <div className="p-2 bg-muted rounded text-sm">
                  {user.characterName || 'Unknown Character'}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Access Level</Label>
              <Badge variant="secondary">
                {(user as any)?.role?.replace('_', ' ').toUpperCase() || 'MEMBER'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}