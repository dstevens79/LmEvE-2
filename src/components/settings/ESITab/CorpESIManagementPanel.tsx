import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface RegisteredCorp {
  corporationId: number;
  corporationName: string;
  registrationDate?: string;
  isActive: boolean;
  lastTokenRefresh?: string;
}

export interface CorpESIManagementPanelProps {
  corps: RegisteredCorp[];
  onToggleActive: (corporationId: number) => void;
  onDelete: (corporationId: number) => void;
  esiConfigured?: boolean;
}

export const CorpESIManagementPanel: React.FC<CorpESIManagementPanelProps> = ({ corps, onToggleActive, onDelete, esiConfigured = true }) => {
  if (!corps?.length) {
    return (
      <div className="border border-border rounded p-3">
        <div className="text-sm font-medium mb-1">Registered Corporations</div>
        <div className="text-xs text-muted-foreground">No corporations registered.</div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Registered Corporations</div>
        {!esiConfigured && (
          <Badge variant="destructive" className="h-5">ESI not configured</Badge>
        )}
      </div>
      <div className="space-y-2">
        {corps.map(corp => (
          <div key={corp.corporationId} className="flex items-center justify-between gap-3 border border-border rounded p-2">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={`https://images.evetech.net/corporations/${corp.corporationId}/logo?size=64`}
                alt="corp logo"
                className="h-8 w-8 rounded"
                loading="lazy"
              />
              <div className="min-w-0">
                <div className="text-sm truncate">{corp.corporationName}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  ID {corp.corporationId}
                  {corp.registrationDate ? ` · Registered ${new Date(corp.registrationDate).toLocaleString()}` : ''}
                  {corp.lastTokenRefresh ? ` · Token ${new Date(corp.lastTokenRefresh).toLocaleString()}` : ''}
                </div>
              </div>
              <Badge variant={corp.isActive ? 'default' : 'secondary'} className="h-5 shrink-0">
                {corp.isActive ? 'active' : 'inactive'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => onToggleActive(corp.corporationId)}>
                {corp.isActive ? 'Disable' : 'Enable'}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onDelete(corp.corporationId)}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CorpESIManagementPanel;
