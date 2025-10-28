import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Globe, Database as DatabaseIcon, Archive, Clock, CheckCircle, XCircle, Warning } from '@phosphor-icons/react';

interface DataSourceIndicatorProps {
  source: {
    esi: boolean;
    database: boolean;
    cache: boolean;
  };
  timestamp?: string | null;
  error?: string | null;
  className?: string;
  showDetails?: boolean;
}

export function DataSourceIndicator({ 
  source, 
  timestamp, 
  error, 
  className = '',
  showDetails = true 
}: DataSourceIndicatorProps) {
  const getSourceIcon = () => {
    if (error) return <XCircle size={14} className="text-destructive" />;
    if (source.esi) return <Globe size={14} className="text-accent" />;
    if (source.database) return <DatabaseIcon size={14} className="text-primary" />;
    if (source.cache) return <Archive size={14} className="text-muted-foreground" />;
    return <Warning size={14} className="text-yellow-500" />;
  };

  const getSourceLabel = () => {
    if (error) return 'Error';
    if (source.esi) return 'ESI';
    if (source.database) return 'Database';
    if (source.cache) return 'Cached';
    return 'No Data';
  };

  const getSourceColor = () => {
    if (error) return 'destructive';
    if (source.esi) return 'default';
    if (source.database) return 'secondary';
    if (source.cache) return 'outline';
    return 'outline';
  };

  const getTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return 'Unknown';
    
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getDetailedStatus = () => {
    const sources = [];
    if (source.esi) sources.push('ESI API');
    if (source.database) sources.push('Database');
    if (source.cache) sources.push('Cache');
    
    if (error) return `Error: ${error}`;
    if (sources.length === 0) return 'No data source available';
    return `Data from: ${sources.join(', ')}`;
  };

  if (!showDetails) {
    return (
      <Badge variant={getSourceColor() as any} className={`flex items-center gap-1 ${className}`}>
        {getSourceIcon()}
        <span className="text-xs">{getSourceLabel()}</span>
      </Badge>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-2 ${className}`}>
            <Badge variant={getSourceColor() as any} className="flex items-center gap-1">
              {getSourceIcon()}
              <span className="text-xs">{getSourceLabel()}</span>
            </Badge>
            {timestamp && !error && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={12} />
                <span>{getTimeAgo(timestamp)}</span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{getDetailedStatus()}</p>
            {timestamp && !error && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(timestamp).toLocaleString()}
              </p>
            )}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ConnectionStatusProps {
  esiConnected: boolean;
  databaseConnected: boolean;
  className?: string;
}

export function ConnectionStatus({ esiConnected, databaseConnected, className = '' }: ConnectionStatusProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              {esiConnected ? (
                <CheckCircle size={16} className="text-green-500" />
              ) : (
                <XCircle size={16} className="text-red-500" />
              )}
              <Globe size={16} className={esiConnected ? 'text-accent' : 'text-muted-foreground'} />
              <span className="text-xs font-medium">ESI</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{esiConnected ? 'Connected to EVE ESI' : 'ESI not available'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="h-4 w-px bg-border" />

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              {databaseConnected ? (
                <CheckCircle size={16} className="text-green-500" />
              ) : (
                <XCircle size={16} className="text-red-500" />
              )}
              <DatabaseIcon size={16} className={databaseConnected ? 'text-primary' : 'text-muted-foreground'} />
              <span className="text-xs font-medium">Database</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{databaseConnected ? 'Connected to database' : 'Database not connected'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
