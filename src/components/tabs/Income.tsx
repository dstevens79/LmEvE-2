import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginPrompt } from '@/components/LoginPrompt';
import { useAuth } from '@/lib/auth-provider';
import { TabComponentProps, IncomeRecord, IncomeAnalytics } from '@/lib/types';
import { 
  TrendUp,
  TrendDown,
  Factory,
  Package,
  Funnel,
  Download,
  Eye,
  ArrowUp,
  ArrowDown,
  Clock,
  Gear,
  FloppyDisk
} from '@phosphor-icons/react';
import { useKV } from '@/lib/kv';
import { toast } from 'sonner';
import { useIncomeSettings } from '@/lib/persistenceService';

export function Income({ onLoginClick }: TabComponentProps) {
  const { user } = useAuth();
  const [incomeRecords] = useKV<IncomeRecord[]>('income-records', []);
  const [incomeSettings, setIncomeSettings] = useIncomeSettings();
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedPilot, setSelectedPilot] = useState('all');
  const [selectedJobType, setSelectedJobType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data - in a real app this would come from ESI API and industry calculations
  const mockIncomeRecords: IncomeRecord[] = [
    {
      id: '1',
      pilotId: 91316135,
      pilotName: 'John Industrialist',
      jobId: 12345,
      jobType: 'manufacturing',
      productTypeId: 587,
      productTypeName: 'Rifter',
      completedDate: '2024-01-15T14:30:00Z',
      runs: 10,
      productQuantity: 10,
      materialCost: 25000000,
      laborCost: 1500000,
      facilityCost: 500000,
      totalCost: 27000000,
      marketValue: 35000000,
      profit: 8000000,
      profitMargin: 0.229,
      efficiency: {
        material: 10,
        time: 20
      },
      location: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
      locationId: 60003760
    },
    {
      id: '2',
      pilotId: 91316136,
      pilotName: 'Jane Manufacturer',
      jobId: 12346,
      jobType: 'manufacturing',
      productTypeId: 12058,
      productTypeName: 'Hobgoblin I',
      completedDate: '2024-01-14T16:45:00Z',
      runs: 50,
      productQuantity: 50,
      materialCost: 8000000,
      laborCost: 800000,
      facilityCost: 200000,
      totalCost: 9000000,
      marketValue: 12500000,
      profit: 3500000,
      profitMargin: 0.28,
      efficiency: {
        material: 10,
        time: 18
      },
      location: 'Dodixie IX - Moon 20 - Federation Navy Assembly Plant',
      locationId: 60011866
    },
    {
      id: '3',
      pilotId: 91316135,
      pilotName: 'John Industrialist',
      jobId: 12347,
      jobType: 'research',
      productTypeId: 0,
      productTypeName: 'Blueprint Research',
      completedDate: '2024-01-13T09:15:00Z',
      runs: 1,
      productQuantity: 1,
      materialCost: 0,
      laborCost: 2000000,
      facilityCost: 300000,
      totalCost: 2300000,
      marketValue: 5000000,
      profit: 2700000,
      profitMargin: 0.54,
      efficiency: {
        material: 0,
        time: 15
      },
      location: 'Amarr VIII (Oris) - Emperor Family Academy',
      locationId: 60008494
    }
  ];

  // Use mock data if no real data is available
  const records = (incomeRecords && incomeRecords.length > 0) ? incomeRecords : mockIncomeRecords;

  // Filter records based on selected criteria
  const filteredRecords = useMemo(() => {
    let filtered = records || [];

    // Filter by period
    const now = new Date();
    let cutoffDate: Date;
    
    switch (selectedPeriod) {
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffDate = new Date(0);
    }

    filtered = filtered.filter(record => new Date(record.completedDate || record.date) >= cutoffDate);

    // Filter by pilot
    if (selectedPilot !== 'all') {
      filtered = filtered.filter(record => record.pilotId?.toString() === selectedPilot);
    }

    // Filter by job type
    if (selectedJobType !== 'all') {
      filtered = filtered.filter(record => record.jobType === selectedJobType);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(record =>
        (record.productTypeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.pilotName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [records, selectedPeriod, selectedPilot, selectedJobType, searchTerm]);

  // Calculate analytics
  const analytics: IncomeAnalytics = useMemo(() => {
    const totalProfit = filteredRecords.reduce((sum, record) => sum + (record.profit || 0), 0);
    const totalRevenue = filteredRecords.reduce((sum, record) => sum + (record.marketValue || 0), 0);
    const totalCost = filteredRecords.reduce((sum, record) => sum + (record.totalCost || 0), 0);
    const averageProfitMargin = totalCost > 0 ? totalProfit / totalCost : 0;
    
    const totalEarned = filteredRecords.reduce((sum, record) => sum + record.totalEarned, 0);
    const totalHours = filteredRecords.reduce((sum, record) => sum + record.hoursWorked, 0);
    const averageRate = totalHours > 0 ? totalEarned / totalHours : 0;

    // Calculate top pilots
    const pilotStats = new Map<number, { pilotName: string; jobs: number; profit: number }>();
    
    filteredRecords.forEach(record => {
      const existing = pilotStats.get(record.pilotId) || { pilotName: record.pilotName, jobs: 0, profit: 0 };
      existing.jobs += 1;
      existing.profit += (record.profit || 0);
      pilotStats.set(record.pilotId, existing);
    });

    const topPilots = Array.from(pilotStats.entries())
      .map(([pilotId, stats]) => ({
        pilotId,
        pilotName: stats.pilotName,
        jobsCompleted: stats.jobs,
        totalProfit: stats.profit,
        averageProfit: stats.jobs > 0 ? stats.profit / stats.jobs : 0
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 5);

    // Calculate top products
    const productStats = new Map<number, { typeName: string; units: number; profit: number }>();
    
    filteredRecords.forEach(record => {
      const typeId = record.productTypeId || 0;
      const existing = productStats.get(typeId) || { typeName: record.productTypeName || 'Unknown', units: 0, profit: 0 };
      existing.units += (record.productQuantity || 0);
      existing.profit += (record.profit || 0);
      productStats.set(typeId, existing);
    });

    const topProducts = Array.from(productStats.entries())
      .map(([typeId, stats]) => ({
        typeId,
        typeName: stats.typeName,
        unitsProduced: stats.units,
        totalProfit: stats.profit,
        averageProfit: stats.units > 0 ? stats.profit / stats.units : 0
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 5);

    // Calculate monthly trends (mock data for now)
    const monthlyTrends = [
      { month: 'Jan', revenue: totalRevenue * 0.8, profit: totalProfit * 0.7, jobs: Math.floor(filteredRecords.length * 0.8) },
      { month: 'Feb', revenue: totalRevenue * 0.9, profit: totalProfit * 0.85, jobs: Math.floor(filteredRecords.length * 0.9) },
      { month: 'Mar', revenue: totalRevenue, profit: totalProfit, jobs: filteredRecords.length }
    ];

    return {
      totalEarned,
      totalHours,
      averageRate,
      topEarners: topPilots.map(pilot => ({
        pilotName: pilot.pilotName,
        totalEarned: pilot.totalProfit,
        hoursWorked: 0 // Not calculated yet
      })),
      activityBreakdown: [],
      monthlyTrend: monthlyTrends.map(trend => ({
        month: trend.month,
        totalEarned: trend.revenue,
        totalHours: 0
      })),
      totalProfit,
      totalRevenue,
      averageProfitMargin,
      jobsCompleted: filteredRecords.length,
      topPilots,
      topProducts,
      monthlyTrends
    };
  }, [filteredRecords]);

  // Helper functions
  const formatISK = (amount: number): string => {
    if (amount >= 1e12) return `${(amount / 1e12).toFixed(1)}T ISK`;
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(1)}B ISK`;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(1)}M ISK`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(1)}K ISK`;
    return `${amount.toFixed(0)} ISK`;
  };

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getJobTypeColor = (type: string): string => {
    switch (type) {
      case 'manufacturing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'research': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'invention': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // Get unique pilots for filter
  const uniquePilots = useMemo(() => {
    const pilots = new Map<number, string>();
    (records || []).forEach(record => {
      pilots.set(record.pilotId, record.pilotName);
    });
    return Array.from(pilots.entries()).map(([id, name]) => ({ id, name }));
  }, [records]);

  // Show login prompt if not authenticated
  // Show login prompt if not authenticated - TEMPORARILY DISABLED FOR DEBUG
  if (!user && onLoginClick && false) { // Added && false to disable this check
    return (
      <LoginPrompt 
        onLoginClick={onLoginClick || (() => {})}
        title="Income Analytics"
        description="Sign in to view and manage pilot compensation and income tracking"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Income Analytics
        </h2>
        <p className="text-muted-foreground">
          Track corporation income from manufacturing, research, and trading activities.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Funnel className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Time Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Pilot</label>
              <Select value={selectedPilot} onValueChange={setSelectedPilot}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pilots</SelectItem>
                  {uniquePilots.map((pilot) => (
                    <SelectItem key={pilot.id} value={pilot.id?.toString() || '0'}>
                      {pilot.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Job Type</label>
              <Select value={selectedJobType} onValueChange={setSelectedJobType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="invention">Invention</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search products, pilots..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <TrendUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatISK(analytics.totalProfit)}</div>
            <p className="text-xs text-muted-foreground">
              Across {analytics.jobsCompleted} completed jobs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatISK(analytics.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Market value of all production
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.jobsCompleted}</div>
            <p className="text-xs text-muted-foreground">
              Completed in selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(analytics.averageProfitMargin)}</div>
            <p className="text-xs text-muted-foreground">
              Average across all activities
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pilots">Top Pilots</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
          <TabsTrigger value="details">Job Details</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Pilots by Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topPilots.map((pilot) => (
                    <div key={pilot.pilotId} className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{pilot.pilotName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {pilot.jobsCompleted} jobs completed
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatISK(pilot.totalProfit)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatISK(pilot.averageProfit)} avg/job
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Products by Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topProducts.map((product) => (
                    <div key={product.typeId} className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{product.typeName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {product.unitsProduced.toLocaleString()} units produced
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatISK(product.totalProfit)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatISK(product.averageProfit)} avg/unit
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pilots" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pilot Performance Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {analytics.topPilots.map((pilot) => (
                  <div key={pilot.pilotId} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{pilot.pilotName}</h4>
                      <Badge variant="secondary">
                        {formatISK(pilot.totalProfit)} profit
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Jobs Completed</p>
                        <p className="font-medium">{pilot.jobsCompleted}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg. Profit per Job</p>
                        <p className="font-medium">{formatISK(pilot.averageProfit)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Performance Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.topProducts.map((product) => (
                  <div key={product.typeId} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{product.typeName}</h4>
                      <Badge variant="secondary">
                        {formatISK(product.totalProfit)} profit
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Units Produced</p>
                        <p className="font-medium">{product.unitsProduced.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg. Profit per Unit</p>
                        <p className="font-medium">{formatISK(product.averageProfit)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Job Details</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full data-table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Pilot</th>
                      <th className="text-left p-3">Product</th>
                      <th className="text-left p-3">Type</th>
                      <th className="text-right p-3">Quantity</th>
                      <th className="text-right p-3">Cost</th>
                      <th className="text-right p-3">Revenue</th>
                      <th className="text-right p-3">Profit</th>
                      <th className="text-right p-3">Margin</th>
                      <th className="text-center p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => (
                      <tr key={record.id}>
                        <td className="p-3">
                          {new Date(record.completedDate).toLocaleDateString()}
                        </td>
                        <td className="p-3">{record.pilotName}</td>
                        <td className="p-3">{record.productTypeName}</td>
                        <td className="p-3">
                          <Badge className={getJobTypeColor(record.jobType)}>
                            {record.jobType}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-mono">
                          {record.productQuantity.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-mono text-red-400">
                          {formatISK(record.totalCost)}
                        </td>
                        <td className="p-3 text-right font-mono text-green-400">
                          {formatISK(record.marketValue)}
                        </td>
                        <td className="p-3 text-right font-mono text-accent">
                          {formatISK(record.profit)}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {formatPercentage(record.profitMargin)}
                        </td>
                        <td className="p-3 text-center">
                          <Button variant="ghost" size="sm">
                            <Eye size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gear size={20} />
                Income & Payment Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Hourly Rates */}
              <div className="space-y-4">
                <h4 className="font-medium">Hourly Rates (ISK per hour)</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(incomeSettings.hourlyRates).map(([category, rate]) => (
                    <div key={category} className="space-y-2">
                      <label className="text-sm font-medium capitalize">
                        {category.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <Input
                        type="number"
                        value={rate?.toString() || '0'}
                        onChange={(e) => {
                          const newRate = parseInt(e.target.value) || 0;
                          setIncomeSettings(prev => ({
                            ...prev,
                            hourlyRates: { ...prev.hourlyRates, [category]: newRate }
                          }));
                        }}
                        placeholder="50000000"
                        className="text-right"
                      />
                      <p className="text-xs text-muted-foreground">
                        {(rate / 1e6).toFixed(1)}M ISK/hour
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bonus Rates */}
              <div className="space-y-4">
                <h4 className="font-medium">Bonus Multipliers</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Weekend Multiplier</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={incomeSettings.bonusRates?.weekendMultiplier?.toString() || '1.0'}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 1.0;
                        setIncomeSettings(prev => ({
                          ...prev,
                          bonusRates: { ...prev.bonusRates, weekendMultiplier: value }
                        }));
                      }}
                      placeholder="1.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Night Shift Multiplier</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={incomeSettings.bonusRates?.nightShiftMultiplier?.toString() || '1.0'}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 1.0;
                        setIncomeSettings(prev => ({
                          ...prev,
                          bonusRates: { ...prev.bonusRates, nightShiftMultiplier: value }
                        }));
                      }}
                      placeholder="1.2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Holiday Multiplier</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={incomeSettings.bonusRates?.holidayMultiplier?.toString() || '1.0'}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 1.0;
                        setIncomeSettings(prev => ({
                          ...prev,
                          bonusRates: { ...prev.bonusRates, holidayMultiplier: value }
                        }));
                      }}
                      placeholder="2.0"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">Payment Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Schedule</label>
                    <select
                      value={incomeSettings.paymentSettings.paymentSchedule}
                      onChange={(e) => {
                        setIncomeSettings(prev => ({
                          ...prev,
                          paymentSettings: { 
                            ...prev.paymentSettings, 
                            paymentSchedule: e.target.value as 'daily' | 'weekly' | 'monthly'
                          }
                        }));
                      }}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Currency</label>
                    <select
                      value={incomeSettings.paymentSettings.currency}
                      onChange={(e) => {
                        setIncomeSettings(prev => ({
                          ...prev,
                          paymentSettings: { 
                            ...prev.paymentSettings, 
                            currency: e.target.value as 'ISK' | 'USD' | 'EUR'
                          }
                        }));
                      }}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="ISK">ISK</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Minimum Payout (ISK)</label>
                    <Input
                      type="number"
                      value={incomeSettings.paymentSettings?.minimumPayout?.toString() || '0'}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        setIncomeSettings(prev => ({
                          ...prev,
                          paymentSettings: { ...prev.paymentSettings, minimumPayout: value }
                        }));
                      }}
                      placeholder="100000000"
                      className="text-right"
                    />
                    <p className="text-xs text-muted-foreground">
                      {(incomeSettings.paymentSettings.minimumPayout / 1e6).toFixed(1)}M ISK minimum
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tax Rate (%)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={((incomeSettings.paymentSettings?.taxRate || 0) * 100).toString()}
                      onChange={(e) => {
                        const value = (parseFloat(e.target.value) || 0) / 100;
                        setIncomeSettings(prev => ({
                          ...prev,
                          paymentSettings: { ...prev.paymentSettings, taxRate: Math.min(1, Math.max(0, value)) }
                        }));
                      }}
                      placeholder="10"
                    />
                  </div>
                </div>
              </div>

              {/* Save Settings */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Reset to default values
                    window.location.reload();
                  }}
                >
                  Reset Changes
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      setIncomeSettings({ ...incomeSettings });
                      toast.success('Income settings saved successfully');
                    } catch (error) {
                      console.error('Failed to save income settings:', error);
                      toast.error('Failed to save income settings');
                    }
                  }}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <FloppyDisk size={16} className="mr-2" />
                  Save Income Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}