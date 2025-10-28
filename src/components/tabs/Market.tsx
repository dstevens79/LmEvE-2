import React, { useState, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginPrompt } from '@/components/LoginPrompt';
import { useAuth } from '@/lib/auth-provider';
import { useLMeveData } from '@/lib/LMeveDataContext';
import { TabComponentProps } from '@/lib/types';
import { 
  TrendUp,
  TrendDown,
  ChartLine,
  ShoppingCart,
  Package,
  Download,
  Funnel,
  Clock,
  CurrencyDollar,
  CheckCircle,
  XCircle,
  Minus,
  ArrowClockwise
} from '@phosphor-icons/react';
import { toast } from 'sonner';

interface MarketOrder {
  orderId: number;
  typeId: number;
  typeName: string;
  locationId: number;
  locationName: string;
  isBuyOrder: boolean;
  price: number;
  volumeTotal: number;
  volumeRemain: number;
  issued: string;
  duration: number;
  minVolume: number;
  range: string;
  state: 'active' | 'expired' | 'cancelled' | 'fulfilled';
}

interface CompletedSale {
  id: string;
  date: string;
  typeId: number;
  typeName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  profit: number;
  profitMargin: number;
  buyer?: string;
  locationId: number;
  locationName: string;
}

interface MarketStats {
  totalActiveOrders: number;
  totalValue: number;
  totalSales: number;
  totalProfit: number;
  averageProfit: number;
  topSellingItem: string;
  topProfitItem: string;
}

export function Market({ onLoginClick, isMobileView }: TabComponentProps) {
  const { user } = useAuth();
  const { marketOrders, loading, refreshMarketOrders, dataSource } = useLMeveData();
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [orderFilter, setOrderFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'expired' | 'cancelled' | 'fulfilled'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Load market orders on mount
  useEffect(() => {
    if (user && marketOrders.length === 0 && !loading.market) {
      refreshMarketOrders();
    }
  }, [user]);

  // Completed sales placeholder - will be added to unified service in future
  const completedSales: CompletedSale[] = [];

  // Use data from unified service (database-first)
  const orders = marketOrders;
  
  // Mock completed sales for demonstration - ESI endpoints to use:
  // GET /v1/corporations/{corporation_id}/orders/history/
  const mockCompletedSales: CompletedSale[] = [

    {
      id: 'sale1',
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      typeId: 12058,
      typeName: 'Hobgoblin I',
      quantity: 500,
      unitPrice: 185000,
      totalValue: 92500000,
      profit: 22500000,
      profitMargin: 0.243,
      locationId: 60011866,
      locationName: 'Dodixie IX - Moon 20'
    },
    {
      id: 'sale2',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      typeId: 587,
      typeName: 'Rifter',
      quantity: 18,
      unitPrice: 850000,
      totalValue: 15300000,
      profit: 4800000,
      profitMargin: 0.314,
      locationId: 60003760,
      locationName: 'Jita IV - Moon 4'
    },
    {
      id: 'sale3',
      date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      typeId: 34,
      typeName: 'Tritanium',
      quantity: 2500000,
      unitPrice: 5.50,
      totalValue: 13750000,
      profit: 1250000,
      profitMargin: 0.091,
      locationId: 60003760,
      locationName: 'Jita IV - Moon 4'
    },
    {
      id: 'sale4',
      date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      typeId: 11535,
      typeName: 'Compressed Arkonor',
      quantity: 1500,
      unitPrice: 2850000,
      totalValue: 4275000000,
      profit: 850000000,
      profitMargin: 0.199,
      locationId: 60003760,
      locationName: 'Jita IV - Moon 4'
    },
  ];

  const sales = (completedSales && completedSales.length > 0) ? completedSales : mockCompletedSales;

  // Filter orders
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    if (orderFilter !== 'all') {
      filtered = filtered.filter(o => 
        orderFilter === 'buy' ? o.isBuyOrder : !o.isBuyOrder
      );
    }

    if (stateFilter !== 'all') {
      filtered = filtered.filter(o => o.state === stateFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(o =>
        o.typeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.locationName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [orders, orderFilter, stateFilter, searchTerm]);

  // Filter sales by period
  const filteredSales = useMemo(() => {
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

    return sales.filter(sale => new Date(sale.date) >= cutoffDate);
  }, [sales, selectedPeriod]);

  // Calculate statistics
  const stats: MarketStats = useMemo(() => {
    const activeOrders = filteredOrders.filter(o => o.state === 'active');
    const totalValue = activeOrders.reduce((sum, o) => sum + (o.price * o.volumeRemain), 0);
    const totalSales = filteredSales.reduce((sum, s) => sum + s.totalValue, 0);
    const totalProfit = filteredSales.reduce((sum, s) => sum + s.profit, 0);
    const averageProfit = filteredSales.length > 0 ? totalProfit / filteredSales.length : 0;

    const itemSales = new Map<string, number>();
    const itemProfits = new Map<string, number>();

    filteredSales.forEach(sale => {
      itemSales.set(sale.typeName, (itemSales.get(sale.typeName) || 0) + sale.totalValue);
      itemProfits.set(sale.typeName, (itemProfits.get(sale.typeName) || 0) + sale.profit);
    });

    const topSellingItem = Array.from(itemSales.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const topProfitItem = Array.from(itemProfits.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      totalActiveOrders: activeOrders.length,
      totalValue,
      totalSales,
      totalProfit,
      averageProfit,
      topSellingItem,
      topProfitItem
    };
  }, [filteredOrders, filteredSales]);

  const formatISK = (amount: number): string => {
    if (amount === undefined || amount === null || isNaN(amount)) return '0 ISK';
    if (amount >= 1e12) return `${(amount / 1e12).toFixed(2)}T ISK`;
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B ISK`;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M ISK`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K ISK`;
    return `${amount.toFixed(2)} ISK`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStateColor = (state: string): string => {
    switch (state) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'fulfilled': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'expired': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'active': return <CheckCircle size={16} className="text-green-400" />;
      case 'fulfilled': return <CheckCircle size={16} className="text-blue-400" />;
      case 'expired': return <Clock size={16} className="text-yellow-400" />;
      case 'cancelled': return <XCircle size={16} className="text-red-400" />;
      default: return <Minus size={16} />;
    }
  };

  if (!user && onLoginClick) {
    return (
      <LoginPrompt 
        onLoginClick={onLoginClick}
        title="Market Analysis"
        description="Sign in to view corporation market orders and sales history"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendUp size={32} />
            Market Analysis
          </h2>
          <p className="text-muted-foreground">
            Track active corporation market orders and analyze sales history and profits
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dataSource.market && (
            <Badge variant="outline" className="text-xs">
              {dataSource.market === 'database' ? '💾 Database' : 
               dataSource.market === 'mock' ? '📝 Demo Data' : 
               dataSource.market}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMarketOrders()}
            disabled={loading.market}
          >
            <ArrowClockwise size={16} className={loading.market ? 'animate-spin' : ''} />
            <span className="ml-2 hidden sm:inline">
              {loading.market ? 'Loading...' : 'Refresh'}
            </span>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActiveOrders}</div>
            <p className="text-xs text-muted-foreground">
              Value: {formatISK(stats.totalValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <CurrencyDollar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{formatISK(stats.totalSales)}</div>
            <p className="text-xs text-muted-foreground">
              {selectedPeriod === '7d' ? 'Last 7 days' : selectedPeriod === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <TrendUp className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{formatISK(stats.totalProfit)}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatISK(stats.averageProfit)}/sale
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Item</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold truncate">{stats.topProfitItem}</div>
            <p className="text-xs text-muted-foreground">
              Most profitable
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Funnel size={20} />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Sales Period</label>
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
              <label className="text-sm font-medium">Order Type</label>
              <Select value={orderFilter} onValueChange={(v) => setOrderFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="sell">Sell Orders</SelectItem>
                  <SelectItem value="buy">Buy Orders</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Order State</label>
              <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="fulfilled">Fulfilled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search items, locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders">Active Orders</TabsTrigger>
          <TabsTrigger value="sales">Sales History</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Corporation Market Orders</CardTitle>
                <Badge variant="secondary">{filteredOrders.length} orders</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full data-table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Type</th>
                      <th className="text-left p-3">Item</th>
                      <th className="text-left p-3">Location</th>
                      <th className="text-right p-3">Price</th>
                      <th className="text-right p-3">Volume</th>
                      <th className="text-right p-3">Remaining</th>
                      <th className="text-right p-3">Total Value</th>
                      <th className="text-left p-3">Issued</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.orderId} className="hover:bg-muted/50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {getStateIcon(order.state)}
                            <Badge className={getStateColor(order.state)}>
                              {order.state}
                            </Badge>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant={order.isBuyOrder ? 'secondary' : 'default'}>
                            {order.isBuyOrder ? 'Buy' : 'Sell'}
                          </Badge>
                        </td>
                        <td className="p-3 font-medium">{order.typeName}</td>
                        <td className="p-3 text-sm text-muted-foreground">{order.locationName}</td>
                        <td className="p-3 text-right font-mono">{formatISK(order.price)}</td>
                        <td className="p-3 text-right font-mono">{order.volumeTotal.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono">{order.volumeRemain.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono font-bold text-accent">
                          {formatISK(order.price * order.volumeRemain)}
                        </td>
                        <td className="p-3 text-sm">{formatDate(order.issued)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredOrders.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No orders found matching your filters
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Completed Sales</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{filteredSales.length} sales</Badge>
                  <Button variant="outline" size="sm">
                    <Download size={16} className="mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full data-table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Item</th>
                      <th className="text-left p-3">Location</th>
                      <th className="text-right p-3">Quantity</th>
                      <th className="text-right p-3">Unit Price</th>
                      <th className="text-right p-3">Total Value</th>
                      <th className="text-right p-3">Profit</th>
                      <th className="text-right p-3">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-muted/50">
                        <td className="p-3 text-sm">{formatDate(sale.date)}</td>
                        <td className="p-3 font-medium">{sale.typeName}</td>
                        <td className="p-3 text-sm text-muted-foreground">{sale.locationName}</td>
                        <td className="p-3 text-right font-mono">{sale.quantity.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono">{formatISK(sale.unitPrice)}</td>
                        <td className="p-3 text-right font-mono font-bold text-green-400">
                          {formatISK(sale.totalValue)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-accent">
                          {formatISK(sale.profit)}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {(sale.profitMargin * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredSales.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No sales found in selected period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Selling Items by Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from(
                    filteredSales.reduce((map, sale) => {
                      const existing = map.get(sale.typeName) || { volume: 0, value: 0 };
                      existing.volume += sale.quantity;
                      existing.value += sale.totalValue;
                      map.set(sale.typeName, existing);
                      return map;
                    }, new Map<string, { volume: number; value: number }>())
                  )
                    .sort((a, b) => b[1].value - a[1].value)
                    .slice(0, 5)
                    .map(([item, data]) => (
                      <div key={item} className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{item}</h4>
                          <p className="text-sm text-muted-foreground">
                            {data.volume.toLocaleString()} units sold
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-400">{formatISK(data.value)}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Profit Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from(
                    filteredSales.reduce((map, sale) => {
                      const existing = map.get(sale.typeName) || { profit: 0, sales: 0 };
                      existing.profit += sale.profit;
                      existing.sales += 1;
                      map.set(sale.typeName, existing);
                      return map;
                    }, new Map<string, { profit: number; sales: number }>())
                  )
                    .sort((a, b) => b[1].profit - a[1].profit)
                    .slice(0, 5)
                    .map(([item, data]) => (
                      <div key={item} className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{item}</h4>
                          <p className="text-sm text-muted-foreground">
                            {data.sales} transactions
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-accent">{formatISK(data.profit)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatISK(data.profit / data.sales)} avg
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sales & Profit Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-center py-8">
                <ChartLine size={48} className="mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  Historical trend chart will be displayed here
                </p>
                <p className="text-sm text-muted-foreground">
                  Showing sales volume and profit trends over time
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
