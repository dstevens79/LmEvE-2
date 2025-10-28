import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Chart,
  Database,
  Warning,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Trash,
  ArrowClockwise,
  Info
} from '@phosphor-icons/react';
import { useSyncErrors, SyncError, ErrorStats } from '@/lib/sync-error-logger';
import { useCorporationTokens, CorporationToken } from '@/lib/corp-token-manager';
import { useSyncState } from '@/lib/sync-state-manager';
import { formatDistanceToNow } from 'date-fns';

interface SyncMonitoringProps {
  isMobileView?: boolean;
}

export function SyncMonitoring({ isMobileView = false }: SyncMonitoringProps) {
  const { errors, stats, clearErrors, clearOldErrors } = useSyncErrors();
  const { tokens, isLoading: tokensLoading, refreshToken, getTokenStatus } = useCorporationTokens();
  const { syncStatuses, syncHistory } = useSyncState();
  
  const [selectedError, setSelectedError] = useState<SyncError | null>(null);

  const getErrorTypeColor = (type: string) => {
    switch (type) {
      case 'esi_api': return 'bg-red-500/20 text-red-400';
      case 'database': return 'bg-orange-500/20 text-orange-400';
      case 'auth': return 'bg-yellow-500/20 text-yellow-400';
      case 'network': return 'bg-blue-500/20 text-blue-400';
      case 'validation': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getSyncHealthStatus = () => {
    if (!stats) return { status: 'unknown', color: 'text-gray-400', label: 'Unknown' };
    
    const recentErrorRate = stats.errorRate;
    
    if (recentErrorRate === 0) {
      return { status: 'healthy', color: 'text-green-400', label: 'Healthy' };
    } else if (recentErrorRate < 1) {
      return { status: 'warning', color: 'text-yellow-400', label: 'Warning' };
    } else {
      return { status: 'critical', color: 'text-red-400', label: 'Critical' };
    }
  };

  const healthStatus = getSyncHealthStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold mb-2">Sync Monitoring</h2>
        <p className="text-muted-foreground">
          Monitor sync health, errors, and token status
        </p>
      </div>

      {/* Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sync Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Activity size={32} className={healthStatus.color} />
              <div>
                <div className={`text-2xl font-bold ${healthStatus.color}`}>
                  {healthStatus.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {stats?.errorRate.toFixed(2) || 0} errors/min
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <XCircle size={32} className="text-red-400" />
              <div>
                <div className="text-2xl font-bold">{stats?.totalErrors || 0}</div>
                <div className="text-xs text-muted-foreground">All time</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Warning size={32} className="text-orange-400" />
              <div>
                <div className="text-2xl font-bold">{stats?.recentErrors.length || 0}</div>
                <div className="text-xs text-muted-foreground">Last hour</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <CheckCircle size={32} className="text-green-400" />
              <div>
                <div className="text-2xl font-bold">
                  {tokens.filter(t => t.isValid && t.expiresAt > Date.now()).length}
                </div>
                <div className="text-xs text-muted-foreground">
                  of {tokens.length} total
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Error Breakdown</CardTitle>
            <CardDescription>Errors by type and process</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* By Type */}
            <div>
              <h4 className="text-sm font-medium mb-3">By Error Type</h4>
              <div className="space-y-2">
                {Object.entries(stats.errorsByType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getErrorTypeColor(type)}>
                        {type.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress 
                        value={(count / stats.totalErrors) * 100} 
                        className="w-32"
                      />
                      <span className="text-sm font-medium w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* By Process */}
            <div>
              <h4 className="text-sm font-medium mb-3">By Process</h4>
              <div className="space-y-2">
                {Object.entries(stats.errorsByProcess)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([processId, count]) => (
                    <div key={processId} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{processId.replace('_', ' ')}</span>
                      <div className="flex items-center gap-3">
                        <Progress 
                          value={(count / stats.totalErrors) * 100} 
                          className="w-32"
                        />
                        <span className="text-sm font-medium w-12 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Repeated Failures */}
            {stats.repeatedFailures.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Warning className="text-orange-400" size={16} />
                    Repeated Failures (3+ errors)
                  </h4>
                  <div className="space-y-2">
                    {stats.repeatedFailures.slice(0, 5).map(failure => (
                      <Alert key={failure.processId} variant="destructive">
                        <AlertDescription className="flex items-center justify-between">
                          <span className="capitalize">
                            {failure.processId.replace('_', ' ')}
                          </span>
                          <Badge variant="outline" className="bg-red-500/20 text-red-400">
                            {failure.count} failures
                          </Badge>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Token Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Corporation Tokens</CardTitle>
              <CardDescription>ESI authentication tokens for sync operations</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={tokensLoading}
              onClick={() => {
                tokens.forEach(token => {
                  if (token.expiresAt - Date.now() < 600000) {
                    refreshToken(token.corporationId);
                  }
                });
              }}
            >
              <ArrowClockwise size={16} className="mr-2" />
              Refresh All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <Alert>
              <Info size={16} />
              <AlertDescription>
                No corporation tokens found. Users must authenticate with ESI to enable automatic sync.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {tokens.map(token => {
                const status = getTokenStatus(token.corporationId);
                const expiresIn = status.expiresIn ? formatDuration(status.expiresIn) : 'Expired';
                const isExpiring = status.expiresIn ? status.expiresIn < 600000 : false;
                
                return (
                  <div
                    key={token.corporationId}
                    className="flex items-center justify-between p-3 border border-border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://images.evetech.net/corporations/${token.corporationId}/logo?size=64`}
                        alt={token.corporationName}
                        className="w-10 h-10 rounded"
                      />
                      <div>
                        <div className="font-medium">{token.corporationName}</div>
                        <div className="text-sm text-muted-foreground">
                          {token.characterName}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          status.isExpired ? 'text-red-400' : 
                          isExpiring ? 'text-yellow-400' : 
                          'text-green-400'
                        }`}>
                          {status.isExpired ? 'Expired' : expiresIn}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {token.scopes.length} scopes
                        </div>
                      </div>
                      <Badge variant={
                        status.isExpired ? 'destructive' :
                        isExpiring ? 'outline' :
                        'default'
                      }>
                        {status.isExpired ? 'Expired' :
                         isExpiring ? 'Expiring' :
                         'Valid'}
                      </Badge>
                      {(status.isExpired || isExpiring) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refreshToken(token.corporationId)}
                        >
                          Refresh
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Errors */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Last 20 sync errors</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearOldErrors(7)}
              >
                Clear Old
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearErrors}
              >
                <Trash size={16} className="mr-2" />
                Clear All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <Alert>
              <CheckCircle size={16} />
              <AlertDescription>
                No errors recorded. All syncs are operating normally.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {errors.slice(-20).reverse().map(error => (
                <div
                  key={error.id}
                  className="p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedError(error)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getErrorTypeColor(error.errorType)}>
                          {error.errorType.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm font-medium capitalize">
                          {error.processName}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {error.errorMessage}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(error.timestamp), { addSuffix: true })}
                      </div>
                      {error.retryAttempt !== undefined && (
                        <div className="text-xs text-muted-foreground">
                          Retry #{error.retryAttempt}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Details Modal */}
      {selectedError && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedError(null)}
        >
          <Card 
            className="max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle>Error Details</CardTitle>
              <CardDescription>
                {new Date(selectedError.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Process</label>
                <div className="text-sm mt-1 capitalize">{selectedError.processName}</div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Error Type</label>
                <div className="mt-1">
                  <Badge className={getErrorTypeColor(selectedError.errorType)}>
                    {selectedError.errorType.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Message</label>
                <div className="text-sm mt-1">{selectedError.errorMessage}</div>
              </div>

              {selectedError.errorDetails && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Details</label>
                  <pre className="text-xs mt-1 p-3 bg-muted rounded overflow-x-auto">
                    {selectedError.errorDetails}
                  </pre>
                </div>
              )}

              {selectedError.requestUrl && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Request URL</label>
                  <div className="text-xs mt-1 font-mono break-all">{selectedError.requestUrl}</div>
                </div>
              )}

              {selectedError.responseStatus && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Response Status</label>
                  <div className="text-sm mt-1">{selectedError.responseStatus}</div>
                </div>
              )}

              {selectedError.stackTrace && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stack Trace</label>
                  <pre className="text-xs mt-1 p-3 bg-muted rounded overflow-x-auto max-h-48">
                    {selectedError.stackTrace}
                  </pre>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setSelectedError(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
