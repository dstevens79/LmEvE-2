import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoginPrompt } from '@/components/LoginPrompt';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Package, 
  MagnifyingGlass,
  Building,
  Cube,
  X,
  Database,
  Blueprint,
  Rocket,
  Target,
  Robot,
  Stack,
  Circle,
  ArrowsClockwise,
  SpinnerGap
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-provider';
import { TabComponentProps, ManufacturingTask } from '@/lib/types';
import { useKV } from '@github/spark/hooks';
import { ItemInfoPopup } from '@/components/popups/ItemInfoPopup';
import { BlueprintInfoPopup } from '@/components/popups/BlueprintInfoPopup';
import { useLMeveData } from '@/lib/LMeveDataContext';
import { toast } from 'sonner';

interface Station {
  id: number;
  name: string;
  system?: string;
  region?: string;
  hasOffice?: boolean;
}

interface CorpHangar {
  division: number;
  name: string;
  itemCount: number;
  totalVolume: number;
  totalValue: number;
}

interface AssetItem {
  id: string;
  typeId: number;
  typeName: string;
  quantity: number;
  locationId: number;
  locationFlag?: string;
  hangar?: string;
  isSingleton?: boolean;
  volume?: number;
  estimatedValue: number;
  category: string;
  group?: string;
}

interface FilterOption {
  id: string;
  label: string;
  categories: string[];
  groups?: string[];
  active: boolean;
}

interface SupplyNeed {
  typeId: number;
  typeName: string;
  needed: number;
  available: number;
  shortage: number;
  source: string;
  priority: 'high' | 'medium' | 'low';
}

const HANGAR_NAMES: Record<number, string> = {
  1: 'Hangar 1',
  2: 'Hangar 2', 
  3: 'Hangar 3',
  4: 'Hangar 4',
  5: 'Hangar 5',
  6: 'Hangar 6',
  7: 'Hangar 7'
};

function categorizeItem(typeName: string): string {
  const name = typeName.toLowerCase();
  
  if (name.includes('tritanium') || name.includes('pyerite') || name.includes('mexallon') || 
      name.includes('isogen') || name.includes('nocxium') || name.includes('zydrine') || 
      name.includes('megacyte')) return 'Mineral';
  
  if (name.includes('ore') || name.includes('veldspar') || name.includes('scordite') || 
      name.includes('pyroxeres') || name.includes('plagioclase')) return 'Ore';
  
  if (name.includes('blueprint')) return 'Blueprint';
  
  if (name.includes('frigate') || name.includes('destroyer') || name.includes('cruiser') || 
      name.includes('battlecruiser') || name.includes('battleship') || name.includes('carrier') || 
      name.includes('dreadnought')) return 'Ship';
  
  if (name.includes('ammo') || name.includes('charge') || name.includes('missile')) return 'Ammo';
  
  if (name.includes('drone')) return 'Drone';
  
  if (name.includes('component') || name.includes('parts')) return 'Component';
  
  return 'Other';
}

export function Assets({ onLoginClick, isMobileView }: TabComponentProps) {
  const { user } = useAuth();
  const { assets, loading, refreshAssets, setupStatus } = useLMeveData();
  const [selectedStation, setSelectedStation] = useKV<number | null>('assets-selected-station', null);
  const [selectedHangar, setSelectedHangar] = useKV<number | null>('assets-selected-hangar', null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useKV<string[]>('assets-active-filters', []);
  const [selectedItem, setSelectedItem] = useState<AssetItem | null>(null);
  const [selectedBlueprint, setSelectedBlueprint] = useState<any | null>(null);
  const [manufacturingTasks] = useKV<ManufacturingTask[]>('manufacturing-tasks', []);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const stations = useMemo<Station[]>(() => {
    const locationMap = new Map<number, Station>();
    
    assets.forEach(asset => {
      if (!locationMap.has(asset.locationId)) {
        locationMap.set(asset.locationId, {
          id: asset.locationId,
          name: asset.location || `Location ${asset.locationId}`,
        });
      }
    });
    
    return Array.from(locationMap.values()).sort((stationA, stationB) => stationA.name.localeCompare(stationB.name));
  }, [assets]);

  const hangars = useMemo<CorpHangar[]>(() => {
    if (!selectedStation) return [];
    
    const hangarMap = new Map<number, AssetItem[]>();
    
    const stationAssets = assets.filter(a => a.locationId === selectedStation);
    
    stationAssets.forEach(asset => {
      const hangarFlag = asset.hangar || asset.locationFlag || 'Hangar 1';
      const hangarMatch = hangarFlag.match(/(\d)/);
      const division = hangarMatch ? parseInt(hangarMatch[1]) : 1;
      
      if (!hangarMap.has(division)) {
        hangarMap.set(division, []);
      }
      hangarMap.get(division)!.push({
        id: asset.id,
        typeId: asset.typeId,
        typeName: asset.typeName || `Item ${asset.typeId}`,
        quantity: asset.quantity,
        locationId: asset.locationId,
        locationFlag: asset.locationFlag,
        hangar: asset.hangar,
        isSingleton: asset.isSingleton,
        volume: (asset.volume || 1) * asset.quantity,
        estimatedValue: asset.estimatedValue,
        category: categorizeItem(asset.typeName || ''),
        group: asset.category
      });
    });
    
    return Array.from(hangarMap.entries()).map(([division, items]) => {
      const totalVolume = items.reduce((sum, i) => sum + (i.volume || 0), 0);
      const totalValue = items.reduce((sum, i) => sum + i.estimatedValue, 0);
      
      return {
        division,
        name: HANGAR_NAMES[division] || `Hangar ${division}`,
        itemCount: items.length,
        totalVolume,
        totalValue
      };
    }).sort((a, b) => a.division - b.division);
  }, [assets, selectedStation]);

  const hangarItems = useMemo<AssetItem[]>(() => {
    if (!selectedStation || selectedHangar === null) return [];
    
    return assets
      .filter(a => {
        if (a.locationId !== selectedStation) return false;
        
        const hangarFlag = a.hangar || a.locationFlag || 'Hangar 1';
        const hangarMatch = hangarFlag.match(/(\d)/);
        const division = hangarMatch ? parseInt(hangarMatch[1]) : 1;
        
        return division === selectedHangar;
      })
      .map(asset => ({
        id: asset.id,
        typeId: asset.typeId,
        typeName: asset.typeName || `Item ${asset.typeId}`,
        quantity: asset.quantity,
        locationId: asset.locationId,
        locationFlag: asset.locationFlag,
        hangar: asset.hangar,
        isSingleton: asset.isSingleton,
        volume: (asset.volume || 1) * asset.quantity,
        estimatedValue: asset.estimatedValue,
        category: categorizeItem(asset.typeName || ''),
        group: asset.category
      }));
  }, [assets, selectedStation, selectedHangar]);

  useEffect(() => {
    if (stations.length > 0 && !selectedStation) {
      setSelectedStation(stations[0].id);
    }
  }, [stations, selectedStation, setSelectedStation]);

  // Prevent runaway refresh: only attempt one automatic refresh when ESI+DB are configured
  const didAutoRefresh = useRef(false);
  useEffect(() => {
    if (
      !didAutoRefresh.current &&
      user &&
      setupStatus?.databaseConnected &&
      setupStatus?.esiConfigured &&
      assets.length === 0 &&
      !loading.assets
    ) {
      didAutoRefresh.current = true;
      refreshAssets();
    }
  }, [user, setupStatus?.databaseConnected, setupStatus?.esiConfigured, assets.length, loading.assets, refreshAssets]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshAssets();
      toast.success('Assets refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh assets');
    } finally {
      setIsRefreshing(false);
    }
  };

  const filterOptions: FilterOption[] = [
    { 
      id: 'materials', 
      label: 'Materials', 
      categories: ['Mineral', 'Processed Materials', 'Ice Products', 'Ore', 'Compressed Ore', 'Moon Ore'],
      active: false 
    },
    { 
      id: 'blueprints', 
      label: 'Blueprints', 
      categories: ['Blueprint', 'Blueprint Copy'],
      active: false 
    },
    { 
      id: 'ships', 
      label: 'Ships', 
      categories: ['Ship', 'Frigate', 'Destroyer', 'Cruiser', 'Battlecruiser', 'Battleship', 'Capital', 'Freighter'],
      active: false 
    },
    { 
      id: 'ammo', 
      label: 'Ammo', 
      categories: ['Ammo', 'Projectile Ammo', 'Hybrid Ammo', 'Missiles', 'Bombs', 'Charges'],
      active: false 
    },
    { 
      id: 'drones', 
      label: 'Drones', 
      categories: ['Drone', 'Combat Drone', 'Mining Drone', 'Salvage Drone', 'Logistics Drone'],
      active: false 
    },
    { 
      id: 'components', 
      label: 'Components', 
      categories: ['Component', 'Ship Components', 'Structure Components', 'Advanced Components'],
      active: false 
    },
  ];

  const currentStation = stations.find(s => s.id === selectedStation) || stations[0];

  const toggleFilter = (filterId: string) => {
    setActiveFilters((current) => {
      if (current.includes(filterId)) {
        return current.filter(id => id !== filterId);
      } else {
        return [...current, filterId];
      }
    });
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
  };

  const getFilteredItems = (): AssetItem[] => {
    let filtered = hangarItems;

    if (activeFilters.length > 0) {
      const activeFilterCategories = filterOptions
        .filter(f => activeFilters.includes(f.id))
        .flatMap(f => f.categories);
      
      filtered = filtered.filter(item => 
        activeFilterCategories.includes(item.category) || 
        activeFilterCategories.includes(item.group)
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.typeName.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.group.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredItems = getFilteredItems();

  const formatNumber = (num: number) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return new Intl.NumberFormat('en-US').format(Math.floor(num));
  };

  const formatISK = (num: number) => {
    if (num === undefined || num === null || isNaN(num)) return '0 ISK';
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(2)}B ISK`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M ISK`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K ISK`;
    return `${num.toFixed(2)} ISK`;
  };

  const formatVolume = (num: number) => {
    if (num === undefined || num === null || isNaN(num)) return '0 m³';
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M m³`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K m³`;
    return `${num.toFixed(2)} m³`;
  };

  const getTotalStats = () => {
    const items = filteredItems;
    return {
      count: items.length,
      totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
      totalVolume: items.reduce((sum, i) => sum + i.volume, 0),
      totalValue: items.reduce((sum, i) => sum + i.estimatedValue, 0),
    };
  };

  const stats = getTotalStats();

  // Calculate supply needs from manufacturing tasks for the current station
  const getSupplyNeeds = (): SupplyNeed[] => {
    const needs: Map<number, SupplyNeed> = new Map();
    
    // Filter tasks by current station and active status
    const stationTasks = (manufacturingTasks || []).filter(task => 
      task.stationId === selectedStation && 
      (task.status === 'assigned' || task.status === 'in_progress')
    );

    // Aggregate materials from all active tasks at this station
    stationTasks.forEach(task => {
      if (!task.materials) return;
      
      task.materials.forEach(material => {
        const existing = needs.get(material.typeId);
        if (existing) {
          existing.needed += material.quantity;
          existing.shortage = existing.needed - existing.available;
        } else {
          // Simulate available quantity (in real implementation, check against assets)
          const available = Math.floor(material.quantity * Math.random() * 0.8); // 0-80% available
          const shortage = Math.max(0, material.quantity - available);
          
          needs.set(material.typeId, {
            typeId: material.typeId,
            typeName: material.typeName,
            needed: material.quantity,
            available,
            shortage,
            source: `${task.targetItem.typeName} (${task.targetItem.quantity}x)`,
            priority: shortage > material.quantity * 0.5 ? 'high' : shortage > 0 ? 'medium' : 'low'
          });
        }
      });
    });

    return Array.from(needs.values()).sort((a, b) => {
      // Sort by priority then shortage
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.shortage - a.shortage;
    });
  };

  const supplyNeeds = getSupplyNeeds();

  if (!user && onLoginClick) {
    return (
      <LoginPrompt 
        onLoginClick={onLoginClick}
        title="Corporation Assets"
        description="Sign in to view and manage your corporation's assets across all hangars"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package size={24} />
            Corporation Assets
          </h2>
          <p className="text-muted-foreground text-sm">
            {loading.assets ? 'Loading assets from ESI...' : 
             assets.length > 0 ? `${assets.length} items across ${stations.length} locations` :
             'No assets found - refresh to load from ESI'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || loading.assets}
          >
            {isRefreshing || loading.assets ? (
              <>
                <SpinnerGap size={16} className="mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <ArrowsClockwise size={16} className="mr-2" />
                Refresh ESI Data
              </>
            )}
          </Button>
          {stations.length > 0 && (
            <div className="w-96">
              <Select 
                value={selectedStation?.toString() || ''} 
                onValueChange={(value) => {
                  setSelectedStation(parseInt(value));
                  setSelectedHangar(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a station">
                    {currentStation && (
                      <div className="flex items-center gap-2">
                        <Building size={16} className="shrink-0" />
                        <div className="text-left truncate">
                          <div className="font-medium text-sm truncate">{currentStation.name}</div>
                        </div>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stations.map(station => (
                    <SelectItem key={station.id} value={station.id.toString()}>
                      <div className="flex items-start gap-2 py-1">
                        <Building size={16} className="mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium text-sm">{station.name}</div>
                          {station.system && station.region && (
                            <div className="text-xs text-muted-foreground">
                              {station.system} • {station.region}
                            </div>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {loading.assets && assets.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-96">
            <div className="text-center space-y-3">
              <SpinnerGap size={48} className="mx-auto text-accent animate-spin" />
              <div>
                <h3 className="text-lg font-semibold mb-1">Loading Assets</h3>
                <p className="text-sm text-muted-foreground">
                  Fetching asset data from ESI...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : stations.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-96">
            <div className="text-center space-y-3">
              <Database size={48} className="mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-1">No Assets Found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Click "Refresh ESI Data" to load your corporation's assets
                </p>
                <Button onClick={handleRefresh} disabled={isRefreshing}>
                  <ArrowsClockwise size={16} className="mr-2" />
                  Refresh Assets
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>

      <div className={`grid ${isMobileView ? 'grid-cols-1 gap-4' : 'grid-cols-12 gap-4'}`}>
        {/* Left Side - Hangar List */}
        <Card className={isMobileView ? '' : 'col-span-3'}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database size={18} />
              Hangars ({hangars.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {hangars.map((hangar) => {
                const isSelected = selectedHangar === hangar.division;
                return (
                  <button
                    key={hangar.division}
                    onClick={() => setSelectedHangar(hangar.division)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isSelected 
                        ? 'bg-accent text-accent-foreground' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        isSelected ? 'bg-accent-foreground' : 'bg-accent'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm mb-1 truncate">
                          {hangar.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {hangar.itemCount} items • {formatVolume(hangar.totalVolume)} • {formatISK(hangar.totalValue)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right Side - Hangar Contents */}
        <div className={isMobileView ? 'space-y-4' : 'col-span-9 space-y-4'}>
          {selectedHangar === null ? (
            <Card className="h-full">
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center space-y-3">
                  <Database size={48} className="mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Select a Hangar</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose a hangar from the list to view its contents
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Filter Bar - Search Inline with Buttons */}
              <Card>
                <CardContent className="p-0 px-2 py-0.5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5">
                    {/* Search Input - Left Side */}
                    <div className="relative w-full sm:w-64">
                      <MagnifyingGlass size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-7 h-6 text-xs"
                      />
                    </div>
                    
                    {/* Filter Buttons - Right Side */}
                    <div className="flex flex-wrap items-center gap-1.5 flex-1">
                      {filterOptions.map((filter) => {
                        const isActive = activeFilters.includes(filter.id);
                        const Icon = 
                          filter.id === 'materials' ? Stack :
                          filter.id === 'blueprints' ? Blueprint :
                          filter.id === 'ships' ? Rocket :
                          filter.id === 'ammo' ? Target :
                          filter.id === 'drones' ? Robot :
                          Cube;
                        
                        return (
                          <Button
                            key={filter.id}
                            variant={isActive ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleFilter(filter.id)}
                            className={`h-6 text-xs px-2 ${isActive ? 'bg-accent text-accent-foreground' : ''}`}
                          >
                            <Icon size={12} className="mr-1" />
                            {filter.label}
                          </Button>
                        );
                      })}
                      
                      {activeFilters.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllFilters}
                          className="h-6 text-xs px-2 ml-auto"
                        >
                          <X size={12} className="mr-1" />
                          Clear All
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items List */}
              <Card>
                <CardContent className="p-0">
                  <div className="border-t border-border">
                    {!isMobileView && (
                      <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border font-medium text-xs text-muted-foreground">
                        <span className="w-64">Item Name</span>
                        <span className="w-24 text-right">Quantity</span>
                        <span className="w-24 text-right">Volume</span>
                        <span className="w-24 text-right">Est. Value</span>
                        <span className="w-24">Category</span>
                      </div>
                    )}
                    <div className="max-h-[500px] overflow-y-auto">
                      {filteredItems.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-center space-y-2">
                            <Cube size={32} className="mx-auto text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              {searchQuery || activeFilters.length > 0 
                                ? 'No items match your filters' 
                                : 'This hangar is empty'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/50">
                          {filteredItems.map((item) => {
                            const isBlueprint = item.category === 'Blueprint' || item.category === 'Blueprint Copy';
                            const handleItemClick = () => {
                              if (isBlueprint) {
                                setSelectedBlueprint({
                                  id: item.id,
                                  typeId: item.typeId,
                                  typeName: item.typeName,
                                  location: currentStation?.name || 'Unknown',
                                  locationId: currentStation?.id || item.locationId,
                                  materialEfficiency: Math.floor(Math.random() * 11),
                                  timeEfficiency: Math.floor(Math.random() * 21),
                                  runs: item.category === 'Blueprint' ? -1 : Math.floor(Math.random() * 300) + 1,
                                  isOriginal: item.category === 'Blueprint',
                                  category: item.group
                                });
                              } else {
                                setSelectedItem(item);
                              }
                            };

                            if (isMobileView) {
                              return (
                                <button 
                                  key={item.id} 
                                  onClick={handleItemClick}
                                  className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-start gap-2 flex-1">
                                      <Cube size={16} className="mt-0.5 text-muted-foreground flex-shrink-0" />
                                      <div>
                                        <div className="font-medium text-sm">{item.typeName}</div>
                                        <Badge variant="secondary" className="text-xs mt-1">
                                          {item.category}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div>
                                      <div className="text-muted-foreground">Qty</div>
                                      <div className="font-medium">{formatNumber(item.quantity)}</div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">Volume</div>
                                      <div className="font-medium">{formatVolume(item.volume || 0)}</div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">Value</div>
                                      <div className="font-medium text-accent">{formatISK(item.estimatedValue)}</div>
                                    </div>
                                  </div>
                                </button>
                              );
                            }

                            return (
                              <button 
                                key={item.id} 
                                onClick={handleItemClick}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 text-sm transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2 w-64">
                                  <Cube size={16} className="text-muted-foreground flex-shrink-0" />
                                  <span className="font-medium truncate">{item.typeName}</span>
                                </div>
                                <span className="w-24 text-right text-muted-foreground">
                                  {formatNumber(item.quantity)}
                                </span>
                                <span className="w-24 text-right text-muted-foreground">
                                  {formatVolume(item.volume || 0)}
                                </span>
                                <span className="w-24 text-right text-accent">
                                  {formatISK(item.estimatedValue)}
                                </span>
                                <div className="w-24">
                                  <Badge variant="secondary" className="text-xs">
                                    {item.category}
                                  </Badge>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Supplies Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Stack size={18} />
            Required Supplies for {currentStation.name}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Materials needed for active manufacturing jobs at this station
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t border-border">
            {!isMobileView && (
              <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border font-medium text-xs text-muted-foreground">
                <span className="w-48">Material</span>
                <span className="w-32 text-right">Needed</span>
                <span className="w-32 text-right">Available</span>
                <span className="w-32 text-right">Shortage</span>
                <span className="flex-1">Source</span>
                <span className="w-20">Priority</span>
              </div>
            )}
            <div className="max-h-80 overflow-y-auto">
              {supplyNeeds.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-2">
                    <Stack size={32} className="mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No supply requirements for active jobs at this station
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {supplyNeeds.map((supply) => {
                    if (isMobileView) {
                      return (
                        <div key={supply.typeId} className="px-4 py-3 hover:bg-muted/30">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-start gap-2 flex-1">
                              <Stack size={16} className="mt-0.5 text-muted-foreground flex-shrink-0" />
                              <div>
                                <div className="font-medium text-sm">{supply.typeName}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{supply.source}</div>
                              </div>
                            </div>
                            <Badge 
                              variant={supply.priority === 'high' ? 'destructive' : supply.priority === 'medium' ? 'default' : 'secondary'}
                              className="text-xs ml-2"
                            >
                              {supply.priority}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-muted-foreground">Needed</div>
                              <div className="font-medium">{formatNumber(supply.needed)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Available</div>
                              <div className="font-medium">{formatNumber(supply.available)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Shortage</div>
                              <div className="font-medium text-destructive">{formatNumber(supply.shortage)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={supply.typeId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 text-sm">
                        <div className="flex items-center gap-2 w-48">
                          <Stack size={16} className="text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{supply.typeName}</span>
                        </div>
                        <span className="w-32 text-right text-muted-foreground">
                          {formatNumber(supply.needed)}
                        </span>
                        <span className="w-32 text-right text-muted-foreground">
                          {formatNumber(supply.available)}
                        </span>
                        <span className="w-32 text-right text-destructive font-medium">
                          {formatNumber(supply.shortage)}
                        </span>
                        <span className="flex-1 text-xs text-muted-foreground truncate">
                          {supply.source}
                        </span>
                        <div className="w-20">
                          <Badge 
                            variant={supply.priority === 'high' ? 'destructive' : supply.priority === 'medium' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {supply.priority}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
        </>
      )}

      {/* Item Info Popup */}
      {selectedItem && (
        <ItemInfoPopup
          itemTypeId={selectedItem.typeId}
          itemName={selectedItem.typeName}
          onClose={() => setSelectedItem(null)}
          onAssignJob={() => {
            spark.kv.set('active-tab', 'manufacturing');
            spark.kv.set('manufacturing-view', 'assign-task');
            spark.kv.set('assign-task-item', selectedItem);
            setSelectedItem(null);
          }}
        />
      )}

      {/* Blueprint Info Popup */}
      {selectedBlueprint && (
        <BlueprintInfoPopup
          blueprint={selectedBlueprint}
          onClose={() => setSelectedBlueprint(null)}
          onAssignJob={(blueprint) => {
            spark.kv.set('active-tab', 'manufacturing');
            spark.kv.set('manufacturing-view', 'assign-task');
            spark.kv.set('assign-task-blueprint', blueprint);
            setSelectedBlueprint(null);
          }}
        />
      )}
    </div>
  );
}