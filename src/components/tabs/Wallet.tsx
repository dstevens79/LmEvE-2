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

      {/* Total Balance Card */}
      <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bank size={20} />
            Total Corporation Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-accent">{formatISK(totalBalance)}</div>
          <p className="text-sm text-muted-foreground mt-2">
            Across {divisions.length} wallet divisions
          </p>
        </CardContent>
      </Card>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Funnel size={20} />
            Filters & Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Analysis Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3m">Last 3 Months</SelectItem>
                  <SelectItem value="6m">Last 6 Months</SelectItem>
                  <SelectItem value="12m">Last 12 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Division Filter</label>
              <Select value={selectedDivision.toString()} onValueChange={(v) => setSelectedDivision(parseInt(v))}>
                <SelectTrigger>
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
              <label className="text-sm font-medium">Search Transactions</label>
              <Input
                placeholder="Search description, party..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <ArrowUp className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{formatISK(periodStats.totalIncome)}</div>
            <p className="text-xs text-muted-foreground">
              {selectedPeriod === '12m' ? 'Last 12 months' : selectedPeriod === '6m' ? 'Last 6 months' : 'Last 3 months'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <ArrowDown className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{formatISK(periodStats.totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">
              {selectedPeriod === '12m' ? 'Last 12 months' : selectedPeriod === '6m' ? 'Last 6 months' : 'Last 3 months'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendUp className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{formatISK(periodStats.totalProfit)}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatISK(periodStats.avgMonthlyProfit)}/month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
            <ChartLine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${periodStats.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {periodStats.growth >= 0 ? '+' : ''}{periodStats.growth.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Period-over-period
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="divisions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="divisions">Wallet Divisions</TabsTrigger>
          <TabsTrigger value="chart">Profit/Loss Chart</TabsTrigger>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="divisions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Division Balances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {divisions.map((division) => {
                  const percentage = (division.balance / totalBalance) * 100;
                  return (
                    <div key={division.divisionId} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/20 text-accent font-bold">
                            {division.divisionId}
                          </div>
                          <div>
                            <h4 className="font-medium">{division.divisionName}</h4>
                            <p className="text-sm text-muted-foreground">{percentage.toFixed(1)}% of total</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">{formatISK(division.balance)}</p>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 mt-2">
                        <div 
                          className="bg-accent h-2 rounded-full transition-all" 
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Monthly Profit/Loss Analysis</CardTitle>
                <Badge variant="secondary">{selectedPeriod === '12m' ? '12 Months' : selectedPeriod === '6m' ? '6 Months' : '3 Months'}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {monthlyData.slice(-(selectedPeriod === '12m' ? 12 : selectedPeriod === '6m' ? 6 : 3)).map((month, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CalendarBlank size={16} className="text-muted-foreground" />
                        <span className="font-medium">{month.month}</span>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Income</p>
                          <p className="font-medium text-green-400">{formatISK(month.totalIncome)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Expenses</p>
                          <p className="font-medium text-red-400">{formatISK(month.totalExpenses)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Profit</p>
                          <p className={`font-bold ${month.totalProfit >= 0 ? 'text-accent' : 'text-red-400'}`}>
                            {formatISK(month.totalProfit)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 h-8">
                      <div 
                        className="bg-green-500/30 rounded flex items-center justify-center text-xs font-medium"
                        style={{ width: `${(month.totalIncome / (month.totalIncome + month.totalExpenses)) * 100}%` }}
                      >
                        {month.totalIncome > 1e9 && formatISK(month.totalIncome)}
                      </div>
                      <div 
                        className="bg-red-500/30 rounded flex items-center justify-center text-xs font-medium"
                        style={{ width: `${(month.totalExpenses / (month.totalIncome + month.totalExpenses)) * 100}%` }}
                      >
                        {month.totalExpenses > 1e9 && formatISK(month.totalExpenses)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Division breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Division Performance Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {divisions.map((division) => {
                  const divisionMonthlyProfit = monthlyData
                    .slice(-(selectedPeriod === '12m' ? 12 : selectedPeriod === '6m' ? 6 : 3))
                    .reduce((sum, m) => sum + (m.divisions[division.divisionId]?.profit || 0), 0);
                  
                  return (
                    <div key={division.divisionId} className="p-3 border rounded">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{division.divisionName}</span>
                        <span className={`font-bold ${divisionMonthlyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatISK(divisionMonthlyProfit)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Transactions</CardTitle>
                <Button variant="outline" size="sm">
                  <Download size={16} className="mr-2" />
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
                      <th className="text-left p-3">Division</th>
                      <th className="text-left p-3">Description</th>
                      <th className="text-left p-3">Party</th>
                      <th className="text-right p-3">Amount</th>
                      <th className="text-right p-3">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction) => {
                      const division = divisions.find(d => d.divisionId === transaction.divisionId);
                      return (
                        <tr key={transaction.id} className="hover:bg-muted/50">
                          <td className="p-3 text-sm">{formatDate(transaction.date)}</td>
                          <td className="p-3">
                            <Badge variant="secondary">{division?.divisionName || `Division ${transaction.divisionId}`}</Badge>
                          </td>
                          <td className="p-3 text-sm">{transaction.description}</td>
                          <td className="p-3 text-sm text-muted-foreground">{transaction.secondPartyName || 'N/A'}</td>
                          <td className={`p-3 text-right font-mono font-medium ${transaction.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {transaction.amount >= 0 ? '+' : ''}{formatISK(transaction.amount)}
                          </td>
                          <td className="p-3 text-right font-mono">{formatISK(transaction.balance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredTransactions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found matching your filters
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
