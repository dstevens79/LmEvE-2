import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowClockwise, Play, Stop, X } from '@phosphor-icons/react';

export interface ConnectionLogsPanelProps {
  logs: string[];
  testing: boolean;
  connected: boolean;
  onClear: () => void;
  onTest: () => void; // kept for compatibility (actions moved)
  onConnect: () => void; // kept
  onDisconnect: () => void; // kept
  onSave: () => void; // kept
  onReset: () => void; // kept
  extraActions?: React.ReactNode;
}

export const ConnectionLogsPanel: React.FC<ConnectionLogsPanelProps> = ({
  logs,
  testing,
  connected,
  onClear,
  onTest,
  onConnect,
  onDisconnect,
  onSave,
  onReset,
  extraActions,
}) => {
  const endRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="lg:col-span-1 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Connection Logs</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={logs.length === 0}
          className="h-8 px-3 text-xs"
        >
          <X size={12} className="mr-1" />
          Clear
        </Button>
      </div>
      <div className="bg-muted/30 border border-border rounded p-4 h-64 overflow-y-auto font-mono text-xs">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No logs available
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`leading-relaxed ${
                  log.includes('❌') || log.includes('💥') ? 'text-red-300' :
                  log.includes('⚠️') ? 'text-yellow-300' :
                  log.includes('✅') || log.includes('🎉') ? 'text-green-300' :
                  log.includes('🔍') || log.includes('🌐') || log.includes('🔌') || 
                  log.includes('🧪') ? 'text-blue-300' : 'text-foreground'
                }`}
              >
                {log}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {extraActions && (
        <div className="pt-1">
          {extraActions}
        </div>
      )}
    </div>
  );
};

export default ConnectionLogsPanel;
