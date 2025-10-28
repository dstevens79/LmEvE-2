import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginPrompt } from '@/components/LoginPrompt';
import { useAuth } from '@/lib/auth-provider';
import { TabComponentProps } from '@/lib/types';
import { 
  TrendUp,
  TrendDown,
  Wallet as WalletIcon,
  Bank,
  ChartLine,
  Download,
  ArrowUp,
  ArrowDown,
  CurrencyDollar,
  CalendarBlank,
  Funnel
} from '@phosphor-icons/react';
import { useKV } from '@github/spark/hooks';
import { toast } from 'sonner';

interface WalletDivision {
  divisionId: number;
  divisionName: string;
  balance: number;
}

interface WalletTransaction {
  id: string;
  date: string;
  divisionId: number;
  amount: number;
  balance: number;
  description: string;
  refType: string;
  secondPartyId?: number;
  secondPartyName?: string;
}

interface MonthlyData {
  month: string;
  divisions: {
    [divisionId: number]: {
      income: number;
      expenses: number;
      profit: number;
    };
  };
  totalIncome: number;
  totalExpenses: number;
  totalProfit: number;
}

export function Wallet({ onLoginClick, isMobileView }: TabComponentProps) {
  const { user } = useAuth();
  const [walletDivisions] = useKV<WalletDivision[]>('wallet-divisions', []);
  const [walletTransactions] = useKV<WalletTransaction[]>('wallet-transactions', []);
  const [selectedDivision, setSelectedDivision] = useState<number>(0);
  const [selectedPeriod, setSelectedPeriod] = useState('12m');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<'divisions' | 'chart' | 'transactions'>('divisions');

  // Mock data for demonstration
  const mockDivisions: WalletDivision[] = [
    { divisionId: 1, divisionName: 'Master Wallet', balance: 15750000000 },
    { divisionId: 2, divisionName: 'Manufacturing', balance: 8250000000 },
    { divisionId: 3, divisionName: 'Mining Operations', balance: 3500000000 },
    { divisionId: 4, divisionName: 'Market Trading', balance: 12100000000 },
    { divisionId: 5, divisionName: 'Planetary Interaction', balance: 2800000000 },
    { divisionId: 6, divisionName: 'Research & Development', balance: 1900000000 },
    { divisionId: 7, divisionName: 'Reserve Fund', balance: 25000000000 },
  ];

  const mockTransactions: WalletTransaction[] = [
    {
      id: '1',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      divisionId: 1,
      amount: 5000000000,
      balance: 15750000000,
      description: 'Market sale - Capital components',
      refType: 'market_transaction',
      secondPartyName: 'Market'
    },
    {
      id: '2',
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      divisionId: 2,
      amount: -2500000000,
      balance: 8250000000,
      description: 'Manufacturing materials purchase',
      refType: 'market_transaction',
      secondPartyName: 'Jita Market Hub'
    },
    {
      id: '3',
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      divisionId: 3,
      amount: 1800000000,
      balance: 3500000000,
      description: 'Ore sales - Compressed Arkonor',
      refType: 'market_transaction',
      secondPartyName: 'Market'
    },
    {
      id: '4',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      divisionId: 4,
      amount: 3200000000,
      balance: 12100000000,
      description: 'Market arbitrage profit',
      refType: 'market_transaction',
      secondPartyName: 'Market'
    },
  ];

  // Generate mock monthly data
  const generateMonthlyData = (): MonthlyData[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    const data: MonthlyData[] = [];

    for (let i = 11; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const month = months[monthIndex];
      
      const monthData: MonthlyData = {
        month,
        divisions: {},
        totalIncome: 0,
        totalExpenses: 0,
        totalProfit: 0
      };

      mockDivisions.forEach(div => {
        const income = Math.random() * 10000000000;
        const expenses = Math.random() * 7000000000;
        const profit = income - expenses;

        monthData.divisions[div.divisionId] = { income, expenses, profit };
        monthData.totalIncome += income;
        monthData.totalExpenses += expenses;
        monthData.totalProfit += profit;
      });

      data.push(monthData);
    }

    return data;
  };

  const monthlyData = useMemo(() => generateMonthlyData(), []);

  const divisions = (walletDivisions && walletDivisions.length > 0) ? walletDivisions : mockDivisions;
  const transactions = (walletTransactions && walletTransactions.length > 0) ? walletTransactions : mockTransactions;

  // Calculate total balance
  const totalBalance = divisions.reduce((sum, div) => sum + div.balance, 0);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    if (selectedDivision !== 0) {
      filtered = filtered.filter(t => t.divisionId === selectedDivision);
    }

    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.secondPartyName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selectedDivision, searchTerm]);

  // Calculate period stats
  const periodStats = useMemo(() => {
    const period = selectedPeriod === '12m' ? 12 : selectedPeriod === '6m' ? 6 : 3;
    const periodData = monthlyData.slice(-period);
    
    return {
      totalIncome: periodData.reduce((sum, m) => sum + m.totalIncome, 0),
      totalExpenses: periodData.reduce((sum, m) => sum + m.totalExpenses, 0),
      totalProfit: periodData.reduce((sum, m) => sum + m.totalProfit, 0),
      avgMonthlyProfit: periodData.reduce((sum, m) => sum + m.totalProfit, 0) / period,
      growth: period > 1 ? 
        ((periodData[period - 1].totalProfit - periodData[0].totalProfit) / periodData[0].totalProfit) * 100 
        : 0
    };
  }, [monthlyData, selectedPeriod]);

  const formatISK = (amount: number): string => {
    const absAmount = Math.abs(amount);
    if (absAmount >= 1e12) return `${(amount / 1e12).toFixed(2)}T ISK`;
    if (absAmount >= 1e9) return `${(amount / 1e9).toFixed(2)}B ISK`;
    if (absAmount >= 1e6) return `${(amount / 1e6).toFixed(2)}M ISK`;
    if (absAmount >= 1e3) return `${(amount / 1e3).toFixed(2)}K ISK`;
    return `${amount.toFixed(0)} ISK`;
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

  if (!user && onLoginClick) {
    return (
      <LoginPrompt 
        onLoginClick={onLoginClick}
        title="Corporation Wallet"
        description="Sign in to view and manage corporation wallet divisions and transactions"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <WalletIcon size={32} />
          Corporation Wallet
        </h2>
        <p className="text-muted-foreground">
          Track corporate wallet divisions, transactions, and monthly profit/loss analysis
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Filters and Controls */}
        <div className="space-y-4">
          {/* Total Balance Card */}
          <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bank size={18} />
                Total Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{formatISK(totalBalance)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {divisions.length} divisions
              </p>
            </CardContent>
          </Card>

          {/* Filters & Period Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Funnel size={18} />
                Filters & Period
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Period</label>
                <div className="flex gap-2 mt-1">
                  <Button
                    size="sm"
                    variant={selectedPeriod === '3m' ? 'default' : 'outline'}
                    onClick={() => setSelectedPeriod('3m')}
                    className="flex-1 h-8 text-xs"
                  >
                    3M
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedPeriod === '6m' ? 'default' : 'outline'}
                    onClick={() => setSelectedPeriod('6m')}
                    className="flex-1 h-8 text-xs"
                  >
                    6M
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedPeriod === '12m' ? 'default' : 'outline'}
                    onClick={() => setSelectedPeriod('12m')}
                    className="flex-1 h-8 text-xs"
                  >
                    12M
                  </Button>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground">Division</label>
                <Select value={selectedDivision.toString()} onValueChange={(v) => setSelectedDivision(parseInt(v))}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Divisions</SelectItem>
                    {divisions.map((div) => (
                      <SelectItem key={div.divisionId} value={div.divisionId.toString()}>
                        {div.divisionName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Search</label>
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid - Compact */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium flex items-center gap-1">
                  <ArrowUp className="h-3 w-3 text-green-400" />
                  Income
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-lg font-bold text-green-400">{formatISK(periodStats.totalIncome)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium flex items-center gap-1">
                  <ArrowDown className="h-3 w-3 text-red-400" />
                  Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-lg font-bold text-red-400">{formatISK(periodStats.totalExpenses)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium flex items-center gap-1">
                  <TrendUp className="h-3 w-3 text-accent" />
                  Profit
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-lg font-bold text-accent">{formatISK(periodStats.totalProfit)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium flex items-center gap-1">
                  <ChartLine className="h-3 w-3 text-muted-foreground" />
                  Growth
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className={`text-lg font-bold ${periodStats.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {periodStats.growth >= 0 ? '+' : ''}{periodStats.growth.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* View Type Toggle */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Display</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant={activeView === 'divisions' ? 'default' : 'outline'}
                  onClick={() => setActiveView('divisions')}
                  className="h-8 text-xs"
                >
                  Divisions
                </Button>
                <Button
                  size="sm"
                  variant={activeView === 'chart' ? 'default' : 'outline'}
                  onClick={() => setActiveView('chart')}
                  className="h-8 text-xs"
                >
                  Chart
                </Button>
                <Button
                  size="sm"
                  variant={activeView === 'transactions' ? 'default' : 'outline'}
                  onClick={() => setActiveView('transactions')}
                  className="h-8 text-xs"
                >
                  Transactions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Charts and Data Display */}
        <div className="space-y-4">
          {activeView === 'divisions' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Division Balances</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {divisions.map((division) => {
                    const percentage = (division.balance / totalBalance) * 100;
                    return (
                      <div key={division.divisionId} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-accent/20 text-accent font-bold text-xs">
                              {division.divisionId}
                            </div>
                            <div>
                              <h4 className="font-medium text-sm">{division.divisionName}</h4>
                              <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold">{formatISK(division.balance)}</p>
                          </div>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                          <div 
                            className="bg-accent h-1.5 rounded-full transition-all" 
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {activeView === 'chart' && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Monthly P/L Analysis</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {selectedPeriod === '12m' ? '12M' : selectedPeriod === '6m' ? '6M' : '3M'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {monthlyData.slice(-(selectedPeriod === '12m' ? 12 : selectedPeriod === '6m' ? 6 : 3)).map((month, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CalendarBlank size={14} className="text-muted-foreground" />
                            <span className="font-medium text-sm">{month.month}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-green-400">{formatISK(month.totalIncome)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-red-400">{formatISK(month.totalExpenses)}</p>
                            </div>
                            <div className="text-right min-w-[80px]">
                              <p className={`font-bold text-xs ${month.totalProfit >= 0 ? 'text-accent' : 'text-red-400'}`}>
                                {formatISK(month.totalProfit)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-0.5 h-6">
                          <div 
                            className="bg-green-500/30 rounded flex items-center justify-center text-xs font-medium"
                            style={{ width: `${(month.totalIncome / (month.totalIncome + month.totalExpenses)) * 100}%` }}
                          />
                          <div 
                            className="bg-red-500/30 rounded flex items-center justify-center text-xs font-medium"
                            style={{ width: `${(month.totalExpenses / (month.totalIncome + month.totalExpenses)) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Division Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {divisions.map((division) => {
                      const divisionMonthlyProfit = monthlyData
                        .slice(-(selectedPeriod === '12m' ? 12 : selectedPeriod === '6m' ? 6 : 3))
                        .reduce((sum, m) => sum + (m.divisions[division.divisionId]?.profit || 0), 0);
                      
                      return (
                        <div key={division.divisionId} className="p-2 border rounded">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{division.divisionName}</span>
                            <span className={`font-bold text-sm ${divisionMonthlyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatISK(divisionMonthlyProfit)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeView === 'transactions' && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Recent Transactions</CardTitle>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Download size={14} className="mr-1" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full data-table text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Division</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-right p-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((transaction) => {
                        const division = divisions.find(d => d.divisionId === transaction.divisionId);
                        return (
                          <tr key={transaction.id} className="hover:bg-muted/50">
                            <td className="p-2 text-xs">{formatDate(transaction.date)}</td>
                            <td className="p-2">
                              <Badge variant="secondary" className="text-xs h-5">{division?.divisionName || `Div ${transaction.divisionId}`}</Badge>
                            </td>
                            <td className="p-2 text-xs">{transaction.description}</td>
                            <td className={`p-2 text-right font-mono font-medium ${transaction.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {transaction.amount >= 0 ? '+' : ''}{formatISK(transaction.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredTransactions.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No transactions found
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
