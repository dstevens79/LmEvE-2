import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useLMeveData } from '@/lib/LMeveDataContext';
import { useAuth } from '@/lib/auth-provider';
import { useDatabase } from '@/lib/DatabaseContext';
import { ConnectionStatus } from '@/components/DataSourceIndicator';
import { 
  Users, 
  Package, 
  Factory, 
  HardHat, 
  TrendUp, 
  ArrowUp, 
  ArrowDown,
  Clock,
  MapPin,
  ArrowClockwise,
  Download,
  Database,
  Globe,
  CheckCircle,
  XCircle
} from '@phosphor-icons/react';

interface DashboardProps {
  onLoginClick?: () => void;
  isMobileView?: boolean;
}

export function Dashboard({ onLoginClick, isMobileView }: DashboardProps) {
  const { user } = useAuth();
  const { 
    dashboardStats, 
    refreshDashboard,
    loading 
  } = useLMeveData();
  const { isConnected } = useDatabase();
  
  // System status state
  const [systemStatus, setSystemStatus] = useState({
    eveOnline: false,
    database: false,
    uptime: Date.now(),
    overallStatus: 'offline' as 'online' | 'offline'
  });

  // Check EVE Online status
  const checkEVEStatus = async () => {
    try {
      const response = await fetch('https://esi.evetech.net/status');
      setSystemStatus(prev => ({ 
        ...prev, 
        eveOnline: response.ok 
      }));
    } catch (error) {
      setSystemStatus(prev => ({ 
        ...prev, 
        eveOnline: false 
      }));
    }
  };

  // Update overall status based on components
  useEffect(() => {
    const overall = systemStatus.eveOnline && systemStatus.database ? 'online' : 'offline';
    setSystemStatus(prev => ({ ...prev, overallStatus: overall }));
  }, [systemStatus.eveOnline, systemStatus.database]);

  // Update database status from context
  useEffect(() => {
    setSystemStatus(prev => ({ 
      ...prev, 
      database: isConnected 
    }));
  }, [isConnected]);

  // Check EVE status on mount
  useEffect(() => {
    checkEVEStatus();
    const interval = setInterval(checkEVEStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Load dashboard data on component mount
  useEffect(() => {
    if (!dashboardStats) {
      refreshDashboard();
    }
  }, [dashboardStats, refreshDashboard]);

  // Use real data from context - show zeros if no data available yet
  const stats = dashboardStats || {
    totalMembers: 0,
    activeMembers: 0,
    totalAssets: 0,
    totalAssetsValue: 0,
    activeJobs: 0,
    completedJobsThisMonth: 0,
    miningOperationsThisMonth: 0,
    miningValueThisMonth: 0,
    corpWalletBalance: 0,
    recentActivity: []
  };

  const hasNoData = stats.totalMembers === 0 && stats.totalAssets === 0;

  const formatISK = (amount: number): string => {
    if (amount === undefined || amount === null || isNaN(amount)) return '0 ISK';
    if (amount >= 1e12) return `${(amount / 1e12).toFixed(1)}T ISK`;
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(1)}B ISK`;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(1)}M ISK`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(1)}K ISK`;
    return `${amount} ISK`;
  };

  const formatUptime = (startTime: number): string => {
    const uptimeMs = Date.now() - startTime;
    const days = Math.floor(uptimeMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((uptimeMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((uptimeMs % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'manufacturing': return <Factory size={16} className="text-blue-400" />;
      case 'mining': return <HardHat size={16} className="text-yellow-400" />;
      case 'asset': return <Package size={16} className="text-green-400" />;
      case 'login': return <Users size={16} className="text-purple-400" />;
      default: return <Clock size={16} className="text-gray-400" />;
    }
  };

  // Login prompt removed - authentication handled via modal in main app

  return (
    <div className="space-y-6">
      {/* Corporation Overview */}
      <div className={`${isMobileView ? 'space-y-4' : 'flex items-center justify-between'}`}>
        <div>
          <h2 className={`${isMobileView ? 'text-xl' : 'text-2xl'} font-bold`}>Corporation Dashboard</h2>
          <p className="text-muted-foreground text-sm">
            Overview of {user?.corporationName || 'your corporation'} activities and metrics
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <ConnectionStatus 
            esiConnected={systemStatus.eveOnline && !!user?.accessToken}
            databaseConnected={systemStatus.database}
          />
          <Button
            onClick={refreshDashboard}
            variant="outline"
            size={isMobileView ? "sm" : "default"}
            disabled={loading.members || loading.assets}
            className={isMobileView ? "w-full sm:w-auto" : ""}
          >
            <ArrowClockwise size={16} className={`${isMobileView ? '' : 'mr-2'} ${loading.members || loading.assets ? 'animate-spin' : ''}`} />
            <span className={isMobileView ? 'ml-2' : ''}>Refresh Data</span>
          </Button>
        </div>
      </div>

      {/* No Data Notice */}
      {hasNoData && (
        <div className="bg-muted/30 border border-border rounded-lg p-4 flex items-start gap-3">
          <Database size={20} className="text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium mb-1">No Data Available</h3>
            <p className="text-sm text-muted-foreground">
              Click "Refresh Data" to load corporation statistics from ESI, or configure data sync in Settings.
            </p>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className={`grid ${isMobileView ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'} gap-4`}>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">
              <span className="inline-flex items-center text-green-400">
                <ArrowUp size={12} className="mr-1" />
                {stats.activeMembers} active
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssets.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {formatISK(stats.totalAssetsValue)} ISK value
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manufacturing</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeJobs}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedJobsThisMonth} completed this month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Corp Wallet</CardTitle>
            <TrendUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatISK(stats.corpWalletBalance)}</div>
            <p className="text-xs text-muted-foreground">
              ISK balance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mining Operations Summary */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardHat size={20} />
            Mining Operations This Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-accent">{stats.miningOperationsThisMonth}</div>
              <p className="text-sm text-muted-foreground">Operations</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent">{formatISK(stats.miningValueThisMonth)}</div>
              <p className="text-sm text-muted-foreground">ISK Value</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent">
                {stats.miningOperationsThisMonth > 0 
                  ? `${Math.round(stats.miningValueThisMonth / stats.miningOperationsThisMonth / 1e6)}M`
                  : '0M'}
              </div>
              <p className="text-sm text-muted-foreground">Avg per Operation</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentActivity && stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        {getActivityIcon(activity.type)}
                        <div>
                          <p className="text-sm font-medium">{activity.memberName}</p>
                          <p className="text-xs text-muted-foreground">{activity.description}</p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs">Activity will appear here as members interact with the system</p>
                  </div>
                )}
              </div>
              {stats.recentActivity && stats.recentActivity.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Button variant="outline" className="w-full">
                    View All Activity
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <div>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe size={20} />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Overall Status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="font-medium">Overall Status</span>
                <div className="flex items-center gap-2">
                  {systemStatus.overallStatus === 'online' ? (
                    <CheckCircle size={16} className="text-green-400" />
                  ) : (
                    <XCircle size={16} className="text-red-400" />
                  )}
                  <Badge 
                    variant={systemStatus.overallStatus === 'online' ? 'default' : 'destructive'}
                    className={systemStatus.overallStatus === 'online' ? 'bg-green-500' : ''}
                  >
                    {systemStatus.overallStatus.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* EVE Online Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm">EVE Online</span>
                <div className="flex items-center gap-2">
                  {systemStatus.eveOnline ? (
                    <CheckCircle size={14} className="text-green-400" />
                  ) : (
                    <XCircle size={14} className="text-red-400" />
                  )}
                  <span className={`text-xs font-medium ${
                    systemStatus.eveOnline ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {systemStatus.eveOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
              </div>

              {/* Database Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm">Database</span>
                <div className="flex items-center gap-2">
                  {systemStatus.database ? (
                    <CheckCircle size={14} className="text-green-400" />
                  ) : (
                    <XCircle size={14} className="text-red-400" />
                  )}
                  <span className={`text-xs font-medium ${
                    systemStatus.database ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {systemStatus.database ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>
              </div>

              {/* Uptime */}
              <div className="flex items-center justify-between">
                <span className="text-sm">Uptime</span>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatUptime(systemStatus.uptime)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  );
}