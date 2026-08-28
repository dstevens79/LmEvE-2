import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Clock,
  CheckCircle,
  Warning,
  X,
  Play,
  ArrowClockwise,
  Pulse,
  Info,
  Users,
  Package,
  Factory,
  HardHat,
  TrendUp,
  Crosshair,
  CurrencyDollar,
  Building,
  FileText,
  Receipt,
  Planet,
  User,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { esiRouteManager, useESIRoutes } from '@/lib/esi-routes';
import { SyncExecutor, type SyncProcessType } from '@/lib/sync-executor';
import { ESIDataFetchService } from '@/lib/esi-data-service';
import { getDatabaseService } from '@/lib/database';
import { useAuth } from '@/lib/auth-provider';
import { runCorpSyncSegment } from '@/lib/corp-sync-service';

interface DataSyncSettingsProps {
  isMobileView?: boolean;
}

// ---------------------------------------------------------------------------
// Server-persisted per-process sync config + status
// (public/api/lmeve/esi/sync-settings.php, backed by sync_process_config /
// corp_sync_log tables. The system cron poller runs due processes server-side.)
// ---------------------------------------------------------------------------

interface ServerSyncProcess {
  processType: string;
  enabled: boolean;
  intervalMinutes: number;
  serverSegment: string | null; // null => no server implementation (browser-only)
  lastRunAt: string | null;     // MySQL datetime 'YYYY-MM-DD HH:MM:SS'
  lastStatus: 'success' | 'error' | null;
  lastItems: number | null;
  lastError: string | null;
  tookMs: number | null;
}

interface ProcessMeta {
  name: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  // Browser-executor process type (only used for browser-only fallback runs)
  browserProcessType?: SyncProcessType;
  // esi-routes key when a versioned ESI route exists for this process.
  routeKey?: string;
}

const PROCESS_META: Record<string, ProcessMeta> = {
  corporation_members:   { name: 'Corporation Members',    description: 'Member list, roles and titles. Fastest to change — keep the interval low.', icon: Users, routeKey: 'members' },
  industry_jobs:         { name: 'Industry Jobs',          description: 'Active + completed manufacturing/mining/other jobs.',                          icon: Factory, routeKey: 'manufacturing' },
  market_orders:         { name: 'Market Orders',          description: 'Corp buy/sell orders across its markets (capped at 40 stations).',           icon: TrendUp, routeKey: 'market' },
  corporation_assets:    { name: 'Corporation Assets',     description: 'Hangar/facility item locations and quantities.',                             icon: Package, routeKey: 'assets' },
  killmails:             { name: 'Killmails',              description: 'Corp kills and losses (browser-run with a personal token).',                 icon: Crosshair, browserProcessType: 'killmails', routeKey: 'killmails' },
  corporation_wallets:   { name: 'Corporation Wallets',    description: 'Wallet transactions by division (browser-run with a personal token).',       icon: CurrencyDollar, browserProcessType: 'wallet', routeKey: 'income' },
  mining_ledger:         { name: 'Mining Ledger',          description: 'Corp mining output per pilot/day (browser-run with a personal token).',      icon: HardHat, browserProcessType: 'mining', routeKey: 'mining' },
  corporation_contracts: { name: 'Corporation Contracts',  description: 'Contracts and contract items (browser-run with a personal token).',          icon: FileText, browserProcessType: 'contracts', routeKey: 'contracts' },
  item_pricing:          { name: 'Market Item Costs',      description: 'Item prices from the configured station (browser-run; no versioned ESI route).', icon: Receipt, browserProcessType: 'item_pricing' },
  structures:            { name: 'Structures & Containers',description: 'Structure and container logs (browser-run with a personal token).',          icon: Building, browserProcessType: 'container_logs', routeKey: 'containerLogs' },
  planetary_interaction: { name: 'Planetary Interaction',  description: 'Colonies and extraction data (browser-run with a personal token).',          icon: Planet, browserProcessType: 'planetary' },
  personal_esi:          { name: 'Personal ESI Data',      description: 'Per-pilot character data (personal token only; never run by the server cron).', icon: User, browserProcessType: 'personal_esi' },
};

const PROCESS_ORDER = [
  'corporation_members', 'industry_jobs', 'market_orders', 'corporation_assets',
  'killmails', 'corporation_wallets', 'mining_ledger', 'corporation_contracts',
  'item_pricing', 'structures', 'planetary_interaction', 'personal_esi',
];

const MIN_INTERVAL = 5;        // system cron ticks every 5 minutes
const MAX_INTERVAL = 43200;    // 30 days

function toLocalDate(mysqlDatetime: string | null): Date | null {
  if (!mysqlDatetime) return null;
  const d = new Date(mysqlDatetime.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

export function DataSyncSettings({ isMobileView = false }: DataSyncSettingsProps) {
  const { user, getRegisteredCorporations } = useAuth();
  const corps = getRegisteredCorporations();

  // Active corporation for this page (config + runs are per-corp server-side).
  const [activeCorpId, setActiveCorpId] = useState<number | null>(null);
  useEffect(() => {
    if (user?.corporationId && corps.some(c => c.corporationId === user.corporationId)) {
      setActiveCorpId(user.corporationId);
    } else if (corps.length > 0) {
      setActiveCorpId(corps[0].corporationId);
    }
  }, [user?.corporationId, corps]);

  const activeCorp = corps.find(c => c.corporationId === activeCorpId) || null;

  // Server-persisted per-process config + last-run status.
  const [serverProcesses, setServerProcesses] = useState<Record<string, ServerSyncProcess>>({});
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  // Route validation states (ESI route versioning stays on this page).
  const esiRoutes = useESIRoutes();
  const [validatingRoutes, setValidatingRoutes] = useState(false);
  const [esiRouteValidation, setESIRouteValidation] = useState<Record<string, string>>({});

  const fetchConfig = useCallback(async () => {
    if (!activeCorpId) return;
    setLoadingConfig(true);
    try {
      const resp = await fetch(`/api/lmeve/esi/sync-settings.php?corporationId=${encodeURIComponent(activeCorpId)}`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const json = await resp.json().catch(() => null);
      if (resp.ok && json?.ok === true && Array.isArray(json.processes)) {
        const map: Record<string, ServerSyncProcess> = {};
        for (const p of json.processes as ServerSyncProcess[]) {
          map[p.processType] = p;
        }
        setServerProcesses(map);
      } else if (!resp.ok) {
        console.warn('Failed to load sync settings:', resp.status, json?.error ?? '');
      }
    } catch (e) {
      console.warn('Failed to reach sync-settings endpoint', e);
    } finally {
      setLoadingConfig(false);
    }
  }, [activeCorpId]);

  useEffect(() => {
    setServerProcesses({});
    void fetchConfig();
  }, [fetchConfig]);

  const saveProcessUpdate = useCallback(async (processType: string, updates: { enabled?: boolean; intervalMinutes?: number }) => {
    if (!activeCorpId) return;
    // Optimistic update.
    setServerProcesses(prev => ({
      ...prev,
      [processType]: { ...(prev[processType] as ServerSyncProcess), ...updates } as ServerSyncProcess,
    }));
    try {
      const resp = await fetch('/api/lmeve/esi/sync-settings.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ corporationId: activeCorpId, updates: [{ processType, ...updates }] }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || json?.ok !== true) {
        toast.error(json?.error || `Failed to save ${processType} settings (HTTP ${resp.status})`);
        void fetchConfig(); // roll back view from server truth
      }
    } catch (e) {
      console.warn('Failed saving sync config', e);
      toast.error('Failed to save sync settings — check the connection');
    }
  }, [activeCorpId, fetchConfig]);

  const startRunning = (id: string) => setRunningIds(prev => new Set(prev).add(id));
  const stopRunning = (id: string) => setRunningIds(prev => {
    const next = new Set(prev);
    next.delete(id);
    return next;
  });

  // Manual run. Server-backed segments go to the server endpoint (vaulted corp
  // token — no browser token needed). Browser-only processes fall back to the
  // in-browser executor when a personal ESI token is present.
  const runSyncProcess = useCallback(async (processId: string) => {
    if (!activeCorpId) return;
    const meta = PROCESS_META[processId];
    if (!meta) return;

    const sp = serverProcesses[processId];
    if (sp?.serverSegment && !runningIds.has(processId)) {
      startRunning(processId);
      try {
        const result = await runCorpSyncSegment(sp.serverSegment, activeCorpId);
        if (result.ok) {
          toast.success(`${meta.name} sync completed — ${((result.inserted ?? 0) + (result.updated ?? 0))} items (${(result.tookMs ?? 0)}ms)`);
          void fetchConfig();
        } else {
          const msg = result.error || 'sync failed';
          toast.error(`${meta.name} sync failed: ${msg}`);
          // A 409 means the vault has no token yet — actionable.
          if (result.status === 409) {
            void fetchConfig();
          }
        }
      } catch (e: any) {
        toast.error(`${meta.name} sync failed: ${e?.message || 'network error'}`);
      } finally {
        stopRunning(processId);
      }
      return;
    }

    // Browser-only process (no server segment yet): needs a personal token.
    if (!user?.accessToken) {
      toast.error(`${meta.name} requires a personal ESI token. Log in with EVE SSO, then re-run.`);
      return;
    }
    if (!meta.browserProcessType) {
      toast.warning('This process is not implemented yet.');
      return;
    }
    if (runningIds.has(processId)) return;

    startRunning(processId);
    try {
      const storageService = getDatabaseService();
      const fetchService = new ESIDataFetchService();
      const executor = new SyncExecutor();
      const result = await executor.executeSyncProcess(meta.browserProcessType, {
        processId,
        corporationId: user.corporationId ?? activeCorpId,
        accessToken: user.accessToken,
        storageService,
        fetchService,
      });
      if (result.success) {
        toast.success(`${meta.name} sync completed — ${result.itemsProcessed} items processed`);
        void fetchConfig();
      } else {
        toast.error(`${meta.name} sync failed: ${result.errorMessage || 'unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${meta.name} sync failed: ${errorMessage}`);
    } finally {
      stopRunning(processId);
    }
  }, [activeCorpId, serverProcesses, runningIds, user?.accessToken, user?.corporationId, fetchConfig]);

  // Run every enabled server-backed process in order.
  const runAllServerSegments = useCallback(async () => {
    if (!activeCorpId) return;
    const queue = PROCESS_ORDER.filter(id => {
      const sp = serverProcesses[id];
      return !!sp?.serverSegment && sp.enabled;
    });
    if (queue.length === 0) {
      toast.warning('No enabled server-backed sync processes for this corporation.');
      return;
    }
    let okCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    for (const id of queue) {
      startRunning(id);
      try {
        const sp = serverProcesses[id]!;
        const result = await runCorpSyncSegment(sp.serverSegment!, activeCorpId);
        if (result.ok) okCount++;
        else { failCount++; errors.push(`${PROCESS_META[id].name}: ${result.error || 'failed'}`); }
      } catch (e: any) {
        failCount++;
        errors.push(`${PROCESS_META[id].name}: ${e?.message || 'network error'}`);
      } finally {
        stopRunning(id);
      }
    }
    void fetchConfig();
    if (failCount === 0) {
      toast.success(`Sync All complete — ${okCount}/${queue.length} segments updated`);
    } else {
      toast.error(`Sync All finished with errors: ${errors.slice(0, 3).join(' | ')}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ''}`);
    }
  }, [activeCorpId, serverProcesses]);

  const validateESIRoutes = async () => {
    setValidatingRoutes(true);
    setESIRouteValidation({});
    try {
      const results = await esiRouteManager.validateAllRoutes(); // Record<routeKey, boolean>
      const validationResults: Record<string, string> = {};
      for (const [processId, meta] of Object.entries(PROCESS_META)) {
        if (!meta.routeKey) continue;
        const isValid = results[meta.routeKey];
        validationResults[processId] = typeof isValid === 'boolean'
          ? (isValid ? '✓ Valid' : '✗ Failed')
          : '';
      }
      setESIRouteValidation(validationResults);
      toast.success('Route validation complete');
    } catch (error) {
      toast.error('Bulk route validation failed');
    } finally {
      setValidatingRoutes(false);
    }
  };

  const updateESIRouteVersion = (processId: string, version: string) => {
    const meta = PROCESS_META[processId];
    if (!meta?.routeKey) return;
    const success = esiRoutes.updateVersion(meta.routeKey, version);
    if (success) {
      toast.success(`Updated ${meta.name} to ESI route ${version}`);
      setESIRouteValidation(prev => ({ ...prev, [processId]: '' }));
    } else {
      toast.error('Failed to update ESI route version');
    }
  };

  const formatLastRun = (sp?: ServerSyncProcess): string => {
    if (!sp?.lastRunAt) return 'Never';
    const date = toLocalDate(sp.lastRunAt);
    if (!date) return sp.lastRunAt;
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const hours = Math.floor(diffMin / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // No registered corporation at all — nothing to configure.
  if (!activeCorp) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <Info size={32} className="mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No registered corporations found. Log in with EVE SSO and complete Corp ESI consent from the Corporations page to enable data sync.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasVaultedToken = !!activeCorp?.hasVaultedToken;
  const enabledCount = PROCESS_ORDER.filter(id => serverProcesses[id]?.enabled).length;
  const runningServer = PROCESS_ORDER.some(id => runningIds.has(id) && serverProcesses[id]?.serverSegment);

  return (
    <div className="space-y-6">
      {/* Overview + corp selector */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock size={20} />
              Data Sync
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {corps.length > 1 && (
                <Select value={activeCorpId ? String(activeCorpId) : undefined} onValueChange={(v) => setActiveCorpId(Number(v))}>
                  <SelectTrigger className="w-56 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {corps.map(c => (
                      <SelectItem key={c.corporationId} value={String(c.corporationId)}>
                        {c.corporationName || `Corp ${c.corporationId}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Badge variant="secondary" className="text-xs">{enabledCount} enabled</Badge>
              <Button
                onClick={runAllServerSegments}
                disabled={!hasVaultedToken || runningIds.size > 0 || loadingConfig}
                size="sm"
                className="h-8"
              >
                {runningServer ? (
                  <>
                    <Pulse size={16} className="mr-2 animate-spin" />
                    Syncing…
                  </>
                ) : (
                  <>
                    <Play size={16} className="mr-2" />
                    Sync All
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasVaultedToken && (
            <Alert variant="destructive">
              <Warning className="h-4 w-4" />
              <AlertDescription>
                <strong>No corp token in the server vault.</strong> A Director/CEO must complete Corp ESI consent from the Corporations page. Until then, scheduled and manual sync will not run for this corporation.
              </AlertDescription>
            </Alert>
          )}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Scheduled sync runs on the server: a system cron job (every 5 minutes) executes each enabled process when its
              interval below has elapsed — no open browser required. Use the per-process Run button for manual refreshes; intervals are applied immediately and stored per corporation.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Per-process config + status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {loadingConfig && <Pulse size={16} className="animate-spin" />}
              Sync Processes
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => void fetchConfig()} disabled={loadingConfig}>
              <ArrowClockwise size={14} /> Refresh status
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {PROCESS_ORDER.map((processId) => {
              const meta = PROCESS_META[processId];
              const sp: ServerSyncProcess | undefined = serverProcesses[processId];
              if (!sp && !loadingConfig) return null; // config not loaded yet
              const enabled = sp?.enabled ?? true;
              const intervalMinutes = sp?.intervalMinutes ?? 60;
              const isRunning = runningIds.has(processId);
              const status: 'idle' | 'running' | 'success' | 'error' =
                isRunning ? 'running' : (sp?.lastStatus === 'error' ? 'error' : sp?.lastRunAt ? (sp.lastStatus ?? 'success') : 'idle');

              return (
                <div key={processId} className="border border-border rounded-lg p-3 space-y-2 hover:bg-muted/20 transition-colors">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {/* Status dot */}
                    <div className={`w-3 h-3 rounded-full shrink-0 ${
                      isRunning ? 'bg-blue-400 animate-pulse'
                        : status === 'error' ? 'bg-red-400'
                        : sp?.lastRunAt && sp.lastStatus === 'success' ? 'bg-green-400'
                        : enabled ? 'bg-muted-foreground/30'
                        : 'bg-muted-foreground/20 border border-muted-foreground/40'
                    }`} />

                    <meta.icon size={18} className="text-muted-foreground shrink-0" />

                    <div className="flex-1 min-w-[160px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{meta.name}</span>
                        {sp?.serverSegment ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">server</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-dashed">browser-only</Badge>
                        )}
                        {!enabled && <Badge variant="secondary" className="text-xs">Disabled</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                    </div>

                    {/* Interval */}
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap" htmlFor={`${processId}-interval`}>Every</Label>
                      <input
                        id={`${processId}-interval`}
                        type="number"
                        min={MIN_INTERVAL}
                        max={MAX_INTERVAL}
                        value={loadingConfig ? undefined : intervalMinutes}
                        disabled={!enabled || loadingConfig}
                        onChange={(e) => {
                          if (!sp) return;
                          const raw = parseInt(e.target.value, 10);
                          if (isNaN(raw)) return;
                          const clamped = Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, raw));
                          setServerProcesses(prev => ({ ...prev, [processId]: { ...sp, intervalMinutes: clamped } }));
                        }}
                        onBlur={(e) => {
                          if (!sp) return;
                          const raw = parseInt(e.target.value, 10);
                          if (isNaN(raw)) return;
                          const clamped = Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, raw));
                          if (clamped !== intervalMinutes) saveProcessUpdate(processId, { intervalMinutes: clamped });
                        }}
                        className="w-20 h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                      />
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">min</Label>
                    </div>

                    {/* Enable */}
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => saveProcessUpdate(processId, { enabled: v })}
                    />

                    {/* Run now */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => void runSyncProcess(processId)}
                      disabled={isRunning || loadingConfig}
                    >
                      {isRunning ? (
                        <Pulse size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                    </Button>
                  </div>

                  {/* Last run status line */}
                  <div className="flex items-center gap-2 text-xs pl-[52px]">
                    {sp?.lastError && (status === 'error' || isRunning) ? (
                      <span className="text-red-400 flex items-center gap-1 min-w-0">
                        <X size={12} className="shrink-0" />
                        <span className="truncate">{sp.lastError}</span>
                      </span>
                    ) : status === 'success' ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <CheckCircle size={12} />
                        {sp?.lastItems ?? 0} items{typeof sp?.tookMs === 'number' && ` · ${(sp.tookMs / 1000).toFixed(1)}s`}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground ml-auto shrink-0">
                      Last run: {formatLastRun(sp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ESI Route Management (versioning) — kept on this page */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendUp size={18} />
              ESI Route Versions
            </CardTitle>
            <Button onClick={validateESIRoutes} disabled={validatingRoutes} variant="outline" size="sm">
              <ArrowClockwise size={16} className={validatingRoutes ? 'mr-2 animate-spin' : 'mr-2'} />
              {validatingRoutes ? 'Validating...' : 'Validate Routes'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Manage ESI API versions per process. Changing a version does not run a sync — use the Run button above afterwards.
          </p>

          <div className={`grid gap-3 ${isMobileView ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {PROCESS_ORDER.map((processId) => {
              const meta = PROCESS_META[processId];
              if (!meta.routeKey) return null; // e.g. item_pricing has no versioned ESI route
              const route = esiRoutes.getRoute(meta.routeKey);
              const versions = route?.versions || ['v1'];
              const current = route?.currentVersion || versions[0];
              return (
                <div key={processId} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{meta.name}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{current}</Badge>
                  </div>

                  <Select value={current} onValueChange={(value) => updateESIRouteVersion(processId, value)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((version: string) => (
                        <SelectItem key={version} value={version}>{version}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {esiRouteValidation[processId] && (
                    <div className={`text-xs ${esiRouteValidation[processId].startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                      {esiRouteValidation[processId]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
