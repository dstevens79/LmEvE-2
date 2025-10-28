import React, { useState, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginPrompt } from '@/components/LoginPrompt';
import { useAuth } from '@/lib/auth-provider';
import { TabComponentProps } from '@/lib/types';
import { useIntegratedData } from '@/hooks/useIntegratedData';
import { DataSourceIndicator } from '@/components/DataSourceIndicator';
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
  Funnel,
  ChartPie,
  ArrowClockwise
} from '@phosphor-icons/react';
import { useKV } from '@github/spark/hooks';
import { toast } from 'sonner';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

const DIVISION_COLORS = [
  'oklch(0.65 0.2 35)',
  'oklch(0.45 0.15 240)',
  'oklch(0.5 0.2 140)',
  'oklch(0.55 0.25 300)',
  'oklch(0.6 0.25 15)',
  'oklch(0.7 0.15 180)',
  'oklch(0.5 0.2 60)',
];

export function Wallet({ onLoginClick, isMobileView }: TabComponentProps) {
  const { user } = useAuth();
  const { 
    walletDivisions, 
    walletTransactions, 
    fetchWalletDivisions, 
    fetchWalletTransactions 
  } = useIntegratedData();
  
  const [selectedDivision, setSelectedDivision] = useState<number>(0);
  const [selectedPeriod, setSelectedPeriod] = useState('12m');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<'balance' | 'profit' | 'transactions'>('balance');

  useEffect(() => {
    if (user) {
      fetchWalletDivisions();
      fetchWalletTransactions();
    }
  }, [user, fetchWalletDivisions, fetchWalletTransactions]);

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

  const divisions = (walletDivisions.data && walletDivisions.data.length > 0) ? walletDivisions.data : mockDivisions;
  const transactions = (walletTransactions.data && walletTransactions.data.length > 0) ? walletTransactions.data : mockTransactions;

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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <WalletIcon size={32} />
            Corporation Wallet
          </h2>
          <p className="text-muted-foreground">
            Track corporate wallet divisions, transactions, and monthly profit/loss analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DataSourceIndicator 
            source={walletDivisions.source}
            timestamp={walletDivisions.timestamp}
            error={walletDivisions.error}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchWalletDivisions({ useCache: false });
              fetchWalletTransactions(undefined, { useCache: false });
              toast.success('Refreshing wallet data...');
            }}
            disabled={walletDivisions.loading || walletTransactions.loading}
          >
            <ArrowClockwise 
              size={16} 
              className={walletDivisions.loading || walletTransactions.loading ? 'animate-spin' : ''}
            />
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Division Cards List */}
        <div className="space-y-3">
          <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bank size={18} />
                Total Corporation Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{formatISK(totalBalance)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {divisions.length} divisions
              </p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {divisions.map((division) => {
              const percentage = (division.balance / totalBalance) * 100;
              const isSelected = selectedDivision === division.divisionId;
              const divisionMonthlyProfit = monthlyData
                .slice(-(selectedPeriod === '12m' ? 12 : selectedPeriod === '6m' ? 6 : 3))
                .reduce((sum, m) => sum + (m.divisions[division.divisionId]?.profit || 0), 0);
              
              return (
                <Card 
                  key={division.divisionId} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'border-accent bg-accent/5' : ''
                  }`}
                  onClick={() => setSelectedDivision(division.divisionId)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div 
                          className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold"
                          style={{ 
                            backgroundColor: `${DIVISION_COLORS[(division.divisionId - 1) % DIVISION_COLORS.length]}20`,
                            color: DIVISION_COLORS[(division.divisionId - 1) % DIVISION_COLORS.length]
                          }}
                        >
                          {division.divisionId}
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm leading-tight">{division.divisionName}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">{percentage.toFixed(1)}% of total</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold">{formatISK(division.balance)}</p>
                        <p className={`text-xs font-medium mt-0.5 ${divisionMonthlyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {divisionMonthlyProfit >= 0 ? '+' : ''}{formatISK(divisionMonthlyProfit)}
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div 
                        className="h-1.5 rounded-full transition-all" 
                        style={{ 
                          width: `${Math.min(percentage, 100)}%`,
                          backgroundColor: DIVISION_COLORS[(division.divisionId - 1) % DIVISION_COLORS.length]
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right Column - Charts and Analytics */}
        <div className="space-y-4">
          {/* Compact Controls Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Display Type */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={activeView === 'balance' ? 'default' : 'outline'}
                onClick={() => setActiveView('balance')}
                className="h-7 text-xs px-2"
              >
                Balance
              </Button>
              <Button
                size="sm"
                variant={activeView === 'profit' ? 'default' : 'outline'}
                onClick={() => setActiveView('profit')}
                className="h-7 text-xs px-2"
              >
                Profit
              </Button>
              <Button
                size="sm"
                variant={activeView === 'transactions' ? 'default' : 'outline'}
                onClick={() => setActiveView('transactions')}
                className="h-7 text-xs px-3"
              >
                Transactions
              </Button>
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Period */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={selectedPeriod === '3m' ? 'default' : 'outline'}
                onClick={() => setSelectedPeriod('3m')}
                className="h-7 text-xs px-2"
              >
                3M
              </Button>
              <Button
                size="sm"
                variant={selectedPeriod === '6m' ? 'default' : 'outline'}
                onClick={() => setSelectedPeriod('6m')}
                className="h-7 text-xs px-2"
              >
                6M
              </Button>
              <Button
                size="sm"
                variant={selectedPeriod === '12m' ? 'default' : 'outline'}
                onClick={() => setSelectedPeriod('12m')}
                className="h-7 text-xs px-2"
              >
                12M
              </Button>
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Division Selector */}
            <Select value={selectedDivision.toString()} onValueChange={(v) => setSelectedDivision(parseInt(v))}>
              <SelectTrigger className="h-7 text-xs w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All Divisions</SelectItem>
                {divisions.map((div) => (
                  <SelectItem key={div.divisionId} value={div.divisionId.toString()}>
                    Div {div.divisionId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chart Display */}
          {activeView === 'balance' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ChartLine size={16} />
                  {selectedDivision === 0 ? 'Division Balance Distribution' : `${divisions.find(d => d.divisionId === selectedDivision)?.divisionName} - Balance Trend`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDivision === 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={divisions.map(div => ({
                          name: div.divisionName,
                          value: div.balance,
                          divisionId: div.divisionId
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {divisions.map((division, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={DIVISION_COLORS[(division.divisionId - 1) % DIVISION_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatISK(value)}
                        contentStyle={{ 
                          backgroundColor: 'oklch(0.12 0.02 220)', 
                          border: '1px solid oklch(0.2 0.02 220)',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart 
                      data={monthlyData
                        .slice(-(selectedPeriod === '12m' ? 12 : selectedPeriod === '6m' ? 6 : 3))
                        .map(m => ({
                          month: m.month,
                          balance: m.divisions[selectedDivision]?.profit || 0
                        }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.02 220)" />
                      <XAxis 
                        dataKey="month" 
                        stroke="oklch(0.7 0.02 220)"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke="oklch(0.7 0.02 220)"
                        style={{ fontSize: '12px' }}
                        tickFormatter={(value) => formatISK(value)}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatISK(value)}
                        contentStyle={{ 
                          backgroundColor: 'oklch(0.12 0.02 220)', 
                          border: '1px solid oklch(0.2 0.02 220)',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="balance" 
                        stroke={DIVISION_COLORS[(selectedDivision - 1) % DIVISION_COLORS.length]}
                        strokeWidth={2}
                        dot={{ fill: DIVISION_COLORS[(selectedDivision - 1) % DIVISION_COLORS.length], r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}

          {activeView === 'profit' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendUp size={16} />
                  {selectedDivision === 0 ? 'Total Profit/Loss Trend' : `${divisions.find(d => d.divisionId === selectedDivision)?.divisionName} - P/L Trend`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart 
                    data={monthlyData
                      .slice(-(selectedPeriod === '12m' ? 12 : selectedPeriod === '6m' ? 6 : 3))
                      .map(m => {
                        if (selectedDivision === 0) {
                          return {
                            month: m.month,
                            income: m.totalIncome,
                            expenses: m.totalExpenses,
                            profit: m.totalProfit
                          };
                        } else {
                          const divData = m.divisions[selectedDivision];
                          return {
                            month: m.month,
                            income: divData?.income || 0,
                            expenses: divData?.expenses || 0,
                            profit: divData?.profit || 0
                          };
                        }
                      })}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.02 220)" />
                    <XAxis 
                      dataKey="month" 
                      stroke="oklch(0.7 0.02 220)"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="oklch(0.7 0.02 220)"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => formatISK(value)}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatISK(value)}
                      contentStyle={{ 
                        backgroundColor: 'oklch(0.12 0.02 220)', 
                        border: '1px solid oklch(0.2 0.02 220)',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="income" 
                      stroke="oklch(0.6 0.25 140)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Income"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="expenses" 
                      stroke="oklch(0.6 0.25 15)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Expenses"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="profit" 
                      stroke="oklch(0.65 0.2 35)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      name="Profit"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {activeView === 'transactions' && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Recent Transactions</CardTitle>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Download size={14} className="mr-1" />
                    Export
                  </Button>
                </div>
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 text-xs mt-2"
                />
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full data-table text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Div</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-right p-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((transaction) => {
                        const division = divisions.find(d => d.divisionId === transaction.divisionId);
                        return (
                          <tr key={transaction.id} className="hover:bg-muted/50">
                            <td className="p-2 text-xs whitespace-nowrap">{formatDate(transaction.date)}</td>
                            <td className="p-2">
                              <Badge variant="secondary" className="text-xs h-5">{transaction.divisionId}</Badge>
                            </td>
                            <td className="p-2 text-xs">{transaction.description}</td>
                            <td className={`p-2 text-right font-mono font-medium whitespace-nowrap ${transaction.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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

          {/* Stats Summary Card */}
          <div className="grid grid-cols-2 gap-2">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-4 w-4 text-green-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Income</p>
                    <p className="text-sm font-bold text-green-400">{formatISK(periodStats.totalIncome)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 text-red-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Expenses</p>
                    <p className="text-sm font-bold text-red-400">{formatISK(periodStats.totalExpenses)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <TrendUp className="h-4 w-4 text-accent" />
                  <div>
                    <p className="text-xs text-muted-foreground">Profit</p>
                    <p className="text-sm font-bold text-accent">{formatISK(periodStats.totalProfit)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <ChartLine className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Growth</p>
                    <p className={`text-sm font-bold ${periodStats.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {periodStats.growth >= 0 ? '+' : ''}{periodStats.growth.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
