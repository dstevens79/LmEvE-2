import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Clock, Star, Trash } from '@phosphor-icons/react';
import { useKV } from '@/lib/kv';
import { RequestHistory, EveApiEndpoint } from '@/lib/types';
import { API_CATEGORIES } from '@/lib/api-data';

interface SidebarProps {
  onSelectEndpoint: (endpoint: EveApiEndpoint) => void;
}

export function Sidebar({ onSelectEndpoint }: SidebarProps) {
  const [favorites, setFavorites] = useKV<string[]>('favorite-endpoints', []);
  const [history, setHistory] = useKV<RequestHistory[]>('request-history', []);

  const getFavoriteEndpoints = () => {
    const allEndpoints = API_CATEGORIES.flatMap(cat => cat.endpoints);
    return (favorites || []).map(favKey => {
      const [method, path] = favKey.split(':', 2);
      return allEndpoints.find(ep => ep.method === method && ep.path === path);
    }).filter(Boolean) as EveApiEndpoint[];
  };

  const removeFavorite = (endpoint: EveApiEndpoint) => {
    const endpointKey = `${endpoint.method}:${endpoint.path}`;
    setFavorites((current) => (current || []).filter(key => key !== endpointKey));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const favoriteEndpoints = getFavoriteEndpoints();
  const recentHistory = (history || []).slice(-10).reverse();

  return (
    <div className="space-y-6">
      {/* Favorites */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star size={16} />
            Favorites
          </CardTitle>
        </CardHeader>
        <CardContent>
          {favoriteEndpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No favorites yet</p>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {favoriteEndpoints.map((endpoint, index) => (
                  <div
                    key={`${endpoint.method}-${endpoint.path}-${index}`}
                    className="group flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => onSelectEndpoint(endpoint)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <Badge 
                          variant={endpoint.method === 'GET' ? 'secondary' : 'default'}
                          className="text-xs"
                        >
                          {endpoint.method}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {endpoint.summary}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavorite(endpoint);
                      }}
                    >
                      <Trash size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock size={16} />
              Recent
            </CardTitle>
            {(history || []).length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearHistory}>
                <Trash size={12} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {recentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent requests</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {recentHistory.map((historyItem) => (
                  <div
                    key={historyItem.id}
                    className="p-2 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => onSelectEndpoint(historyItem.endpoint)}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <Badge 
                        variant={historyItem.endpoint.method === 'GET' ? 'secondary' : 'default'}
                        className="text-xs"
                      >
                        {historyItem.endpoint.method}
                      </Badge>
                      <Badge 
                        variant={
                          historyItem.response.status >= 200 && historyItem.response.status < 300
                            ? 'default'
                            : 'destructive'
                        }
                        className="text-xs"
                      >
                        {historyItem.response.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mb-1">
                      {historyItem.endpoint.summary}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(historyItem.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sm h-8"
            onClick={() => window.open('https://docs.esi.evetech.net/', '_blank')}
          >
            ESI Documentation
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sm h-8"
            onClick={() => window.open('https://developers.eveonline.com/', '_blank')}
          >
            EVE Developers
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sm h-8"
            onClick={() => window.open('https://github.com/esi/esi-swagger-ui', '_blank')}
          >
            ESI on GitHub
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}