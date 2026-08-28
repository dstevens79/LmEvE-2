import React, { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crosshair, ArrowClockwise, Info, TrendUp } from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-provider';
import { useLMeveData } from '@/lib/LMeveDataContext';
import { Button } from '@/components/ui/button';

function formatISK(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  const abs = Math.abs(amount);
  if (abs >= 1e12) return `${(amount / 1e12).toFixed(2)}T ISK`;
  if (abs >= 1e9) return `${(amount / 1e9).toFixed(2)}B ISK`;
  if (abs >= 1e6) return `${(amount / 1e6).toFixed(2)}M ISK`;
  if (abs >= 1e3) return `${(amount / 1e3).toFixed(1)}K ISK`;
  return amount.toFixed(0) + ' ISK';
}

export function Killmails() {
  const { user } = useAuth();
  const { killmails, loading, refreshKillmails } = useLMeveData();

  useEffect(() => {
    if (user && !loading.killmails) refreshKillmails();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    let totalValue = 0;
    for (const k of killmails) totalValue += Number(k.totalValue) || 0;
    return { count: killmails.length, totalValue };
  }, [killmails]);

  const recent = useMemo(() => {
    return [...killmails]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 150);
  }, [killmails]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Crosshair size={24} />
            Combat Activity
          </h2>
          <p className="text-muted-foreground">
            Corporation losses tracked from the killmail ledger (synced server-side).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refreshKillmails()} disabled={loading.killmails}>
          <ArrowClockwise size={16} className={loading.killmails ? 'animate-spin' : ''} />
        </Button>
      </div>

      {killmails.length === 0 && !loading.killmails && (
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <Info size={28} className="mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-medium">No killmail data yet</p>
            <p className="text-xs text-muted-foreground">
              The Killmails process is browser-run (needs a personal ESI token). Enable it in Settings → Data Sync and run it to record corporation losses.
            </p>
          </CardContent>
        </Card>
      )}

      {killmails.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Crosshair size={20} className="text-red-400" />
              <div>
                <p className="text-xs text-muted-foreground">Recorded losses</p>
                <p className="text-xl font-bold">{stats.count}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <TrendUp size={20} className="text-red-400" />
              <div>
                <p className="text-xs text-muted-foreground">Total lost value</p>
                <p className="text-xl font-bold">{formatISK(stats.totalValue)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Losses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full data-table text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Victim Character</th>
                    <th className="text-left p-2">Ship</th>
                    <th className="text-center p-2">Attackers</th>
                    <th className="text-right p-2">Damage Taken</th>
                    <th className="text-right p-2">Est. Value</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(k => (
                    <tr key={k.id} className="hover:bg-muted/50">
                      <td className="p-2 whitespace-nowrap">{new Date(k.timestamp).toLocaleString()}</td>
                      <td className="p-2 text-xs text-muted-foreground">{k.systemName}</td>
                      <td className="p-2 text-xs flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">loss</Badge>
                        {k.victim.shipTypeName}
                      </td>
                      <td className="p-2 text-center">{k.attackerCount}</td>
                      <td className="p-2 text-right font-mono">{(Number(k.victim.damageTaken) || 0).toLocaleString()}</td>
                      <td className="p-2 text-right font-mono text-red-400/80">{formatISK(Number(k.totalValue))}</td>
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
