import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Warning, CheckCircle, ArrowClockwise } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import type { DataFreshnessInfo } from '@/lib/data-retrieval-service';

interface DataFreshnessIndicatorProps {
  freshness: DataFreshnessInfo;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showRefreshButton?: boolean;
  compact?: boolean;
}

export function DataFreshnessIndicator({
  freshness,
  onRefresh,
  isRefreshing = false,
  showRefreshButton = true,
  compact = false
}: DataFreshnessIndicatorProps) {
  const { lastUpdated, isStale, staleDuration } = freshness;

  if (!lastUpdated) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        <Badge variant="secondary" className="bg-muted text-muted-foreground">
          <Warning size={compact ? 12 : 14} className="mr-1" />
          No data
        </Badge>
        {showRefreshButton && onRefresh && (
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            onClick={onRefresh}
            disabled={isRefreshing}
            className={compact ? 'h-6 px-2' : ''}
          >
            <ArrowClockwise 
              size={compact ? 12 : 16} 
              className={`${isRefreshing ? 'animate-spin' : ''} ${compact ? '' : 'mr-2'}`}
            />
            {!compact && (isRefreshing ? 'Syncing...' : 'Sync Now')}
          </Button>
        )}
      </div>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(lastUpdated), { addSuffix: true });

  return (
    <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <Badge 
        variant={isStale ? "secondary" : "default"}
        className={
          isStale 
            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' 
            : 'bg-green-500/20 text-green-400 border-green-500/30'
        }
      >
        {isStale ? (
          <Warning size={compact ? 12 : 14} className="mr-1" />
        ) : (
          <CheckCircle size={compact ? 12 : 14} className="mr-1" />
        )}
        {compact ? (
          isStale ? 'Stale' : 'Fresh'
        ) : (
          `Updated ${timeAgo}`
        )}
      </Badge>
      
      {!compact && staleDuration && (
        <span className="text-xs text-muted-foreground">
          <Clock size={12} className="inline mr-1" />
          {staleDuration} min ago
        </span>
      )}
      
      {showRefreshButton && onRefresh && (
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          onClick={onRefresh}
          disabled={isRefreshing}
          className={compact ? 'h-6 px-2' : ''}
        >
          <ArrowClockwise 
            size={compact ? 12 : 16} 
            className={`${isRefreshing ? 'animate-spin' : ''} ${compact ? '' : 'mr-2'}`}
          />
          {!compact && (isRefreshing ? 'Syncing...' : 'Sync Now')}
        </Button>
      )}
    </div>
  );
}

interface DataFreshnessAlertProps {
  freshness: DataFreshnessInfo;
  dataType: string;
  onSync?: () => void;
}

export function DataFreshnessAlert({ freshness, dataType, onSync }: DataFreshnessAlertProps) {
  const { lastUpdated, isStale, staleDuration, freshnessCutoff } = freshness;

  if (!lastUpdated) {
    return (
      <div className="mb-4 p-4 bg-muted/50 border border-border rounded-lg">
        <div className="flex items-start gap-3">
          <Warning size={20} className="text-yellow-400 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-sm mb-1">No {dataType} data available</h4>
            <p className="text-xs text-muted-foreground">
              This data hasn't been synced yet. Click "Sync Now" to fetch data from EVE ESI.
            </p>
          </div>
          {onSync && (
            <Button variant="outline" size="sm" onClick={onSync}>
              <ArrowClockwise size={14} className="mr-2" />
              Sync Now
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isStale) {
    return (
      <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Clock size={20} className="text-yellow-400 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-sm mb-1">Data may be outdated</h4>
            <p className="text-xs text-muted-foreground">
              This {dataType} data was last updated {staleDuration} minutes ago 
              (recommended refresh: every {freshnessCutoff} minutes).
              Consider syncing to get the latest information.
            </p>
          </div>
          {onSync && (
            <Button variant="outline" size="sm" onClick={onSync}>
              <ArrowClockwise size={14} className="mr-2" />
              Sync Now
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
