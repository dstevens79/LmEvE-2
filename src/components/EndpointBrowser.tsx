import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MagnifyingGlass, ArrowSquareOut, Star } from '@phosphor-icons/react';
import { API_CATEGORIES } from '@/lib/api-data';
import { EveApiEndpoint } from '@/lib/types';
import { useKV } from '@/lib/kv';

interface EndpointBrowserProps {
  onSelectEndpoint: (endpoint: EveApiEndpoint) => void;
}

export function EndpointBrowser({ onSelectEndpoint }: EndpointBrowserProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [favorites, setFavorites] = useKV<string[]>('favorite-endpoints', []);

  const filteredCategories = API_CATEGORIES.map(category => ({
    ...category,
    endpoints: category.endpoints.filter(endpoint =>
      endpoint.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      endpoint.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      endpoint.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.endpoints.length > 0);

  const toggleFavorite = (endpoint: EveApiEndpoint) => {
    const endpointKey = `${endpoint.method}:${endpoint.path}`;
    setFavorites((current) => {
      const currentArray = current || [];
      if (currentArray.includes(endpointKey)) {
        return currentArray.filter(key => key !== endpointKey);
      } else {
        return [...currentArray, endpointKey];
      }
    });
  };

  const isFavorite = (endpoint: EveApiEndpoint) => {
    const endpointKey = `${endpoint.method}:${endpoint.path}`;
    return (favorites || []).includes(endpointKey);
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
        <Input
          placeholder="Search endpoints..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-6">
        {filteredCategories.map((category) => (
          <Card key={category.name}>
            <CardHeader>
              <CardTitle className="text-lg">{category.name}</CardTitle>
              <CardDescription>{category.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {category.endpoints.map((endpoint, index) => (
                  <div
                    key={`${endpoint.method}-${endpoint.path}-${index}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => onSelectEndpoint(endpoint)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant={endpoint.method === 'GET' ? 'secondary' : 'default'}
                          className="font-mono text-xs"
                        >
                          {endpoint.method}
                        </Badge>
                        <code className="text-sm font-mono text-primary truncate">
                          {endpoint.path}
                        </code>
                        {endpoint.requiresAuth && (
                          <Badge variant="outline" className="text-xs">
                            Auth Required
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{endpoint.summary}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(endpoint);
                        }}
                        className={`p-1 rounded hover:bg-muted ${
                          isFavorite(endpoint) ? 'text-accent' : 'text-muted-foreground'
                        }`}
                      >
                        <Star size={16} weight={isFavorite(endpoint) ? 'fill' : 'regular'} />
                      </button>
                      <ArrowSquareOut size={16} className="text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCategories.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <MagnifyingGlass size={48} className="mx-auto mb-4 opacity-50" />
              <p>No endpoints found matching "{searchTerm}"</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}