import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoginPrompt } from '@/components/LoginPrompt';
import { 
  Package, 
  MagnifyingGlass,
  Building,
  FolderOpen,
  File,
  Cube,
  Stack,
  ListBullets,
  WarningCircle
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-provider';
import { TabComponentProps } from '@/lib/types';
import { useKV } from '@github/spark/hooks';

interface Station {
  id: number;
  name: string;
  system: string;
  region: string;
  hasOffice: boolean;
}

interface AssetItem {
  id: string;
  name: string;
  type: 'folder' | 'item';
  quantity?: number;
  volume?: number;
  estimatedValue?: number;
  category?: string;
  children?: AssetItem[];
}

interface SupplyItem {
  id: string;
  name: string;
  required: number;
  available: number;
  shortage: number;
  category: string;
}

const MOCK_STATIONS: Station[] = [
  { id: 1, name: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', system: 'Jita', region: 'The Forge', hasOffice: true },
  { id: 2, name: 'Amarr VIII (Oris) - Emperor Family Academy', system: 'Amarr', region: 'Domain', hasOffice: true },
  { id: 3, name: 'Dodixie IX - Moon 20 - Federation Navy Assembly Plant', system: 'Dodixie', region: 'Sinq Laison', hasOffice: true },
  { id: 4, name: 'Rens VI - Moon 8 - Brutor Tribe Treasury', system: 'Rens', region: 'Heimatar', hasOffice: true },
];

const MOCK_HANGARS: AssetItem[] = [
  {
    id: 'hangar-1',
    name: 'Corporation Hangar 1',
    type: 'folder',
    children: [
      { id: 'item-1', name: 'Tritanium', type: 'item', quantity: 1500000, volume: 1500, estimatedValue: 7500000, category: 'Mineral' },
      { id: 'item-2', name: 'Pyerite', type: 'item', quantity: 850000, volume: 850, estimatedValue: 5100000, category: 'Mineral' },
      { id: 'item-3', name: 'Mexallon', type: 'item', quantity: 420000, volume: 420, estimatedValue: 4200000, category: 'Mineral' },
    ]
  },
  {
    id: 'hangar-2',
    name: 'Corporation Hangar 2',
    type: 'folder',
    children: [
      { id: 'item-4', name: 'Compressed Veldspar', type: 'item', quantity: 25000, volume: 2500, estimatedValue: 15000000, category: 'Ore' },
      { id: 'item-5', name: 'Compressed Scordite', type: 'item', quantity: 18000, volume: 1800, estimatedValue: 12000000, category: 'Ore' },
    ]
  },
  {
    id: 'hangar-3',
    name: 'Corporation Hangar 3',
    type: 'folder',
    children: [
      { id: 'item-6', name: 'Raven Blueprint', type: 'item', quantity: 5, volume: 0.01, estimatedValue: 500000000, category: 'Blueprint' },
      { id: 'item-7', name: 'Drake Blueprint', type: 'item', quantity: 12, volume: 0.01, estimatedValue: 240000000, category: 'Blueprint' },
    ]
  },
  {
    id: 'hangar-4',
    name: 'Corporation Hangar 4',
    type: 'folder',
    children: [
      { id: 'item-8', name: 'Capital Construction Parts', type: 'item', quantity: 1500, volume: 3000, estimatedValue: 75000000, category: 'Component' },
      { id: 'item-9', name: 'R.A.M.- Starship Tech', type: 'item', quantity: 850, volume: 170, estimatedValue: 42500000, category: 'Component' },
    ]
  },
];

const MOCK_SUPPLIES: SupplyItem[] = [
  { id: 's1', name: 'Tritanium', required: 2000000, available: 1500000, shortage: 500000, category: 'Mineral' },
  { id: 's2', name: 'Pyerite', required: 1000000, available: 850000, shortage: 150000, category: 'Mineral' },
  { id: 's3', name: 'Mexallon', required: 500000, available: 420000, shortage: 80000, category: 'Mineral' },
  { id: 's4', name: 'Capital Construction Parts', required: 2000, available: 1500, shortage: 500, category: 'Component' },
  { id: 's5', name: 'R.A.M.- Starship Tech', required: 1000, available: 850, shortage: 150, category: 'Component' },
];

export function Assets({ onLoginClick, isMobileView }: TabComponentProps) {
  const { user } = useAuth();
  const [selectedStation, setSelectedStation] = useKV<number>('assets-selected-station', 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useKV<string[]>('assets-expanded-folders', []);
  const [viewMode, setViewMode] = useKV<'hangars' | 'supplies'>('assets-view-mode', 'hangars');

  if (!user && onLoginClick) {
    return (
      <LoginPrompt 
        onLoginClick={onLoginClick}
        title="Corporation Assets"
        description="Sign in to view and manage your corporation's assets"
      />
    );
  }

  const currentStation = MOCK_STATIONS.find(s => s.id === selectedStation) || MOCK_STATIONS[0];

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((current) => {
      if (current.includes(folderId)) {
        return current.filter(id => id !== folderId);
      } else {
        return [...current, folderId];
      }
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatISK = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(2)}B ISK`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M ISK`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K ISK`;
    return `${num.toFixed(2)} ISK`;
  };

  const renderAssetItem = (item: AssetItem, depth: number = 0) => {
    const isExpanded = expandedFolders.includes(item.id);
    const paddingLeft = depth * (isMobileView ? 12 : 20);

    if (item.type === 'folder') {
      return (
        <div key={item.id}>
          <div
            className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b border-border/50"
            style={{ paddingLeft: `${paddingLeft + 12}px` }}
            onClick={() => toggleFolder(item.id)}
          >
            <FolderOpen size={18} className="text-accent" />
            <span className="flex-1 font-medium text-sm">{item.name}</span>
            <Badge variant="secondary" className="text-xs">
              {item.children?.length || 0} items
            </Badge>
          </div>
          {isExpanded && item.children?.map(child => renderAssetItem(child, depth + 1))}
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 border-b border-border/30 text-sm"
        style={{ paddingLeft: `${paddingLeft + 12}px` }}
      >
        <Cube size={16} className="text-muted-foreground" />
        <span className="flex-1">{item.name}</span>
        {!isMobileView && (
          <>
            <span className="text-muted-foreground text-xs w-24 text-right">
              {formatNumber(item.quantity || 0)}x
            </span>
            <span className="text-muted-foreground text-xs w-24 text-right">
              {item.volume?.toFixed(1)} m³
            </span>
            <span className="text-accent text-xs w-32 text-right">
              {formatISK(item.estimatedValue || 0)}
            </span>
          </>
        )}
        {isMobileView && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{formatNumber(item.quantity || 0)}x</div>
            <div className="text-xs text-accent">{formatISK(item.estimatedValue || 0)}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Package size={24} />
          Corporation Assets
        </h2>
        <p className="text-muted-foreground text-sm">
          Track and manage corporation assets across all stations
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building size={18} />
            Station Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid ${isMobileView ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'} gap-2`}>
            {MOCK_STATIONS.map(station => (
              <Button
                key={station.id}
                variant={selectedStation === station.id ? 'default' : 'outline'}
                className={`justify-start h-auto py-3 px-3 ${
                  selectedStation === station.id 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-muted'
                }`}
                onClick={() => setSelectedStation(station.id)}
              >
                <div className="text-left">
                  <div className="font-medium text-sm truncate">{station.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {station.system} • {station.region}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'hangars' | 'supplies')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="hangars" className="flex items-center gap-2">
            <Stack size={16} />
            Hangars
          </TabsTrigger>
          <TabsTrigger value="supplies" className="flex items-center gap-2">
            <ListBullets size={16} />
            Industrial Supplies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hangars" className="space-y-3 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Corporation Hangars</CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 h-8 text-sm"
                  />
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MagnifyingGlass size={16} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-t border-border">
                {!isMobileView && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border font-medium text-xs text-muted-foreground">
                    <span className="flex-1 pl-8">Item Name</span>
                    <span className="w-24 text-right">Quantity</span>
                    <span className="w-24 text-right">Volume</span>
                    <span className="w-32 text-right">Est. Value</span>
                  </div>
                )}
                <div className="max-h-96 overflow-y-auto">
                  {MOCK_HANGARS.map(hangar => renderAssetItem(hangar))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className={`grid ${isMobileView ? 'grid-cols-2' : 'grid-cols-4'} gap-4`}>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {MOCK_HANGARS.reduce((sum, h) => sum + (h.children?.length || 0), 0)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Total Items</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {formatNumber(
                      MOCK_HANGARS.reduce((sum, h) => 
                        sum + (h.children?.reduce((s, i) => s + (i.quantity || 0), 0) || 0), 0
                      )
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Total Quantity</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">
                    {formatISK(
                      MOCK_HANGARS.reduce((sum, h) => 
                        sum + (h.children?.reduce((s, i) => s + (i.estimatedValue || 0), 0) || 0), 0
                      )
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Total Value</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {formatNumber(
                      MOCK_HANGARS.reduce((sum, h) => 
                        sum + (h.children?.reduce((s, i) => s + (i.volume || 0), 0) || 0), 0
                      )
                    )} m³
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Total Volume</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supplies" className="space-y-3 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <WarningCircle size={18} />
                Industrial Supply Requirements
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Materials needed for active manufacturing jobs at {currentStation.name}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-t border-border">
                {!isMobileView && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border font-medium text-xs text-muted-foreground">
                    <span className="flex-1">Material Name</span>
                    <span className="w-28 text-right">Required</span>
                    <span className="w-28 text-right">Available</span>
                    <span className="w-28 text-right">Shortage</span>
                    <span className="w-24 text-right">Status</span>
                  </div>
                )}
                <div className="divide-y divide-border/50">
                  {MOCK_SUPPLIES.map(supply => {
                    const percentAvailable = (supply.available / supply.required) * 100;
                    const hasShortage = supply.shortage > 0;

                    if (isMobileView) {
                      return (
                        <div key={supply.id} className="p-3 hover:bg-muted/30">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{supply.name}</div>
                              <div className="text-xs text-muted-foreground">{supply.category}</div>
                            </div>
                            <Badge 
                              variant={hasShortage ? 'destructive' : 'default'}
                              className="text-xs"
                            >
                              {hasShortage ? 'Shortage' : 'Sufficient'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-muted-foreground">Required</div>
                              <div className="font-medium">{formatNumber(supply.required)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Available</div>
                              <div className="font-medium">{formatNumber(supply.available)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Short</div>
                              <div className="font-medium text-destructive">{formatNumber(supply.shortage)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={supply.id} className="flex items-center gap-2 px-4 py-3 hover:bg-muted/30">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{supply.name}</div>
                          <div className="text-xs text-muted-foreground">{supply.category}</div>
                        </div>
                        <span className="w-28 text-right text-sm">{formatNumber(supply.required)}</span>
                        <span className="w-28 text-right text-sm">{formatNumber(supply.available)}</span>
                        <span className={`w-28 text-right text-sm font-medium ${hasShortage ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {formatNumber(supply.shortage)}
                        </span>
                        <div className="w-24 flex justify-end">
                          <Badge 
                            variant={hasShortage ? 'destructive' : 'default'}
                            className="text-xs"
                          >
                            {percentAvailable.toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className={`grid ${isMobileView ? 'grid-cols-2' : 'grid-cols-3'} gap-4`}>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {MOCK_SUPPLIES.length}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Supply Items</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-destructive">
                    {MOCK_SUPPLIES.filter(s => s.shortage > 0).length}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Items Short</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">
                    {((MOCK_SUPPLIES.filter(s => s.shortage === 0).length / MOCK_SUPPLIES.length) * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Fulfillment</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}