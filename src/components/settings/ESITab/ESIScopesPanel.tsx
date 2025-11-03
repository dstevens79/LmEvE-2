import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface ESIScopesPanelProps {
  characterCatalog: string[];
  corporationCatalog: string[];
  activeCharScopes: string[];
  activeCorpScopes: string[];
  requestedCharScopes: string[];
  requestedCorpScopes: string[];
  onToggleChar: (scope: string) => void;
  onToggleCorp: (scope: string) => void;
  onReleaseChar: () => void;
  onRefreshChar: () => void;
  onReleaseCorp: () => void;
  onRefreshCorp: () => void;
}

export const ESIScopesPanel: React.FC<ESIScopesPanelProps> = ({
  characterCatalog,
  corporationCatalog,
  activeCharScopes,
  activeCorpScopes,
  requestedCharScopes,
  requestedCorpScopes,
  onToggleChar,
  onToggleCorp,
  onReleaseChar,
  onRefreshChar,
  onReleaseCorp,
  onRefreshCorp,
}) => {
  const ScopeList: React.FC<{
    title: string;
    catalog: string[];
    requested: string[];
    active: Set<string>;
    onToggle: (s: string) => void;
    onRelease: () => void;
    onRefresh: () => void;
  }> = ({ title, catalog, requested, active, onToggle, onRelease, onRefresh }) => (
    <div className="border border-border rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">
          Active: {active.size} · Requested: {requested.length}
        </div>
      </div>
      <div className="max-h-48 overflow-auto space-y-1">
        {catalog.map(scope => {
          const isActive = active.has(scope);
          const isChecked = isActive || requested.includes(scope);
          return (
            <label key={scope} className={`flex items-center gap-2 text-xs p-1 rounded ${isActive ? 'opacity-80' : ''}`}>
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isActive}
                onChange={() => onToggle(scope)}
              />
              <span className="font-mono text-[11px] break-all">{scope}</span>
              {isActive && <Badge variant="outline" className="h-4 px-1 text-[10px]">active</Badge>}
            </label>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <Button size="sm" variant="destructive" onClick={onRelease}>Release</Button>
        <Button size="sm" variant="outline" onClick={onRefresh}>Refresh</Button>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <ScopeList
        title="Character Scopes"
        catalog={characterCatalog}
        requested={requestedCharScopes}
        active={new Set(activeCharScopes)}
        onToggle={onToggleChar}
        onRelease={onReleaseChar}
        onRefresh={onRefreshChar}
      />
      <ScopeList
        title="Corporation Scopes"
        catalog={corporationCatalog}
        requested={requestedCorpScopes}
        active={new Set(activeCorpScopes)}
        onToggle={onToggleCorp}
        onRelease={onReleaseCorp}
        onRefresh={onRefreshCorp}
      />
    </div>
  );
};

export default ESIScopesPanel;
