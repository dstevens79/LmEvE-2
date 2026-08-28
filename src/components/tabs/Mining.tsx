import React, { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HardHat, TrendUp, ArrowClockwise, Info } from '@phosphor-icons/react';
import { TabComponentProps } from '@/lib/types';
import { useAuth } from '@/lib/auth-provider';
import { useLMeveData } from '@/lib/LMeveDataContext';
import { Button } from '@/components/ui/button';

function formatISK(amount: number): string {
  if (!Number.isFinite(amount)) return '0 ISK';
  const abs = Math.abs(amount);
  if (abs >= 1e12) return `${(amount / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(amount / 1e3).toFixed(1)}K`;
  return amount.toFixed(0);
}

export function Mining(_props: TabComponentProps) {
  const { user } = useAuth();
  const { miningOperations, loading, refreshMining } = useLMeveData();

  useEffect(() => {
    if (user && !loading.mining) refreshMining();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Group ledger rows by ore type for the summary cards.
  const summary = useMemo(() => {
    const byOre = new Map<number, { name: string; quantity: number }>();
    let totalQuantity = 0;
    let minerCount = 0;
    const miners = new Set<number>();

    for (const op of miningOperations) {
      totalQuantity += op.quantity || 0;
      if (op.minerId > 0) miners.add(op.minerId);
      const e = byOre.get(op.oreTypeId) || { name: op.ore, quantity: 0 };
      e.quantity += op.quantity || 0;
      byOre.set(op.oreTypeId, e);
    }

    const topOres = Array.from(byOre.entries())
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 5)
      .map(([, v]) => v);

    return { totalQuantity, minerCount: miners.size, topOres };
  }, [miningOperations]);

  const recent = useMemo(() => {
    return [...miningOperations]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 100);
  }, [miningOperations]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <HardHat size={24} />
            Mining Operations
          </h2>
          <p className="text-muted-foreground">
            Corporation mining ledger — ore extracted per pilot, synced from ESI.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">Database</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMining()}
            disabled={loading.mining}
          >
            <ArrowClockwise size={16} className={loading.mining ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {miningOperations.length === 0 && !loading.mining && (
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <Info size={28} className="mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-medium">No mining ledger data yet</p>
            <p className="text-xs text-muted-foreground">
              Enable the Mining Ledger process in Settings → Data Sync and run it (or wait for the next server sync) to populate this page.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendUp size={20} className="text-accent" />
            <div>
              <p className="text-xs text-muted-foreground">Total ore mined</p>
              <p className="text-xl font-bold">{summary.topOres.length > 0 ? summary.totalQuantity.toLocaleString() : '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <HardHat size={20} className="text-accent" />
            <div>
              <p className="text-xs text-muted-foreground">Active miners</p>
              <p className="text-xl font-bold">{summary.minerCount || '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendUp size={20} className="text-accent" />
            <div>
              <p className="text-xs text-muted-foreground">Ore types</p>
              <p className="text-xl font-bold">{summary.topOres.length || '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Ledger Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full data-table text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Miner</th>
                    <th className="text-left p-2">Ore</th>
                    <th className="text-right p-2">Quantity</th>
                    <th className="text-left p-2">System</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(op => (
                    <tr key={op.id} className="hover:bg-muted/50">
                      <td className="p-2 whitespace-nowrap">{new Date(op.date).toLocaleDateString()}</td>
                      <td className="p-2 text-xs">{op.minerName}</td>
                      <td className="p-2 text-xs flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">ore</Badge>
                        {op.ore}
                      </td>
                      <td className="p-2 text-right font-mono">{(op.quantity || 0).toLocaleString()}</td>
                      <td className="p-2 text-xs text-muted-foreground">{op.system}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
