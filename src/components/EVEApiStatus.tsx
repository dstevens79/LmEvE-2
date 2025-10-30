import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Globe, 
  CheckCircle, 
  Warning, 
  Clock, 
  Database,
  ArrowClockwise,
  TrendUp,
  Factory,
  Package
} from '@phosphor-icons/react';
import { useKV } from '@/lib/kv';
import { useEVEData } from '@/hooks/useEVEData';
import { eveApi } from '@/lib/eveApi';

interface APIStatus {
  connected: boolean;
  lastPing: number;
  latency: number;
  errors: number;
}

export function EVEApiStatus() {
  const [settings] = useKV<{ eveOnlineSync: { 
    enabled: boolean;
    corporationId: number;
    characterId: number;
    autoSync: boolean;
    syncInterval: number;
  } }>('corp-settings', { 
    eveOnlineSync: { 
      enabled: false,
      corporationId: 498125261,
      characterId: 91316135,
      autoSync: false,
      syncInterval: 30
    }
  });
  const [apiStatus, setApiStatus] = useState<APIStatus>({
    connected: false,
    lastPing: 0,
    latency: 0,
    errors: 0
  });

  // Ensure safe access to settings
  const eveOnlineSync = settings?.eveOnlineSync || {
    enabled: false,
    corporationId: 498125261,
    characterId: 91316135,
    autoSync: false,
    syncInterval: 30
  };

  const { data: eveData, refreshData } = useEVEData(
    eveOnlineSync.corporationId
  );

  // Check API connectivity periodically
  useEffect(() => {
    if (!eveOnlineSync.enabled) return;

    const checkAPI = async () => {
      const startTime = Date.now();
      
      try {
        // Test with a simple character lookup (Test Alliance Please Ignore's Dreddit)
        await eveApi.getCharacter(91316135);
        
        const latency = Date.now() - startTime;
        setApiStatus(prev => ({
          connected: true,
          lastPing: Date.now(),
          latency,
          errors: Math.max(0, prev.errors - 1)
        }));
      } catch (error) {
        setApiStatus(prev => ({
          connected: false,
          lastPing: Date.now(),
          latency: 0,
          errors: prev.errors + 1
        }));
      }
    };

    // Check immediately
    checkAPI();

    // Check every 30 seconds
    const interval = setInterval(checkAPI, 30000);
    return () => clearInterval(interval);
  }, [eveOnlineSync.enabled]);

  if (!eveOnlineSync.enabled) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Globe size={20} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">EVE Online Integration</p>
              <p className="text-xs text-muted-foreground">Disabled</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = () => {
    if (!apiStatus.connected) return 'text-red-400 border-red-500/50';
    if (apiStatus.latency > 2000) return 'text-yellow-400 border-yellow-500/50';
    return 'text-green-400 border-green-500/50';
  };

  const getStatusText = () => {
    if (!apiStatus.connected) return 'Disconnected';
    if (apiStatus.latency > 2000) return 'Slow';
    return 'Connected';
  };

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe size={16} />
            EVE Online API Status
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {apiStatus.connected ? (
                <CheckCircle size={16} className="text-green-400" />
              ) : (
                <Warning size={16} className="text-red-400" />
              )}
              <span className="text-sm font-medium">{getStatusText()}</span>
            </div>
            <Badge variant="outline" className={`text-xs ${getStatusColor()}`}>
              {apiStatus.connected && `${apiStatus.latency}ms`}
            </Badge>
          </div>

          {apiStatus.lastPing > 0 && (
            <p className="text-xs text-muted-foreground">
              Last checked: {new Date(apiStatus.lastPing).toLocaleTimeString()}
            </p>
          )}

          {apiStatus.errors > 0 && (
            <p className="text-xs text-red-400">
              {apiStatus.errors} recent error{apiStatus.errors > 1 ? 's' : ''}
            </p>
          )}

          <Button 
            size="sm" 
            variant="outline" 
            onClick={refreshData}
            disabled={eveData.isLoading}
            className="w-full"
          >
            {eveData.isLoading ? (
              <ArrowClockwise size={14} className="mr-2 animate-spin" />
            ) : (
              <Database size={14} className="mr-2" />
            )}
            Refresh Data
          </Button>
        </CardContent>
      </Card>

      {/* Data Overview */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database size={16} />
            Synchronized Data
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Factory size={14} className="text-blue-400" />
                <span>Jobs</span>
              </div>
              <span className="font-medium">{eveData.industryJobs.length}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={14} className="text-purple-400" />
                <span>Blueprints</span>
              </div>
              <span className="font-medium">{eveData.blueprints.length}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendUp size={14} className="text-green-400" />
                <span>Assets</span>
              </div>
              <span className="font-medium">{eveData.assets.length}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-orange-400" />
                <span>Prices</span>
              </div>
              <span className="font-medium">{eveData.marketPrices.length}</span>
            </div>
          </div>

          {eveData.lastUpdate && (
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                Last update: {new Date(eveData.lastUpdate).toLocaleString()}
              </p>
            </div>
          )}

          {eveData.isLoading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Syncing data...</span>
                <span>⚡</span>
              </div>
              <Progress value={75} className="h-1" />
            </div>
          )}

          {eveData.error && (
            <div className="border-t border-border pt-3">
              <p className="text-xs text-red-400">{eveData.error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}