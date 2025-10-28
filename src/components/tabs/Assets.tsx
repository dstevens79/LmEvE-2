import React, { useState, useEffect } from 'react';
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
  FunnelSimple,
  Database,
  Blueprint,
  Rocket,
  Target,
  Robot,
  Stack,
  Circle
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

interface CorpHangar {
  division: number;
  name: string;
  itemCount: number;
  totalVolume: number;
  totalValue: number;
}

interface AssetItem {
  itemId: string;
  typeId: number;
  typeName: string;
  quantity: number;
  locationId: number;
  locationFlag: string;
  isSingleton: boolean;
  volume: number;
  estimatedValue: number;
  category: string;
  group: string;
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

const MOCK_STATIONS: Station[] = [
  { id: 1, name: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', system: 'Jita', region: 'The Forge', hasOffice: true },
  { id: 2, name: 'Amarr VIII (Oris) - Emperor Family Academy', system: 'Amarr', region: 'Domain', hasOffice: true },
  { id: 3, name: 'Dodixie IX - Moon 20 - Federation Navy Assembly Plant', system: 'Dodixie', region: 'Sinq Laison', hasOffice: true },
  { id: 4, name: 'Rens VI - Moon 8 - Brutor Tribe Treasury', system: 'Rens', region: 'Heimatar', hasOffice: true },
  { id: 5, name: 'Hek VIII - Moon 12 - Boundless Creation Factory', system: 'Hek', region: 'Metropolis', hasOffice: true },
  { id: 6, name: 'Perimeter - Tranquility Trading Tower', system: 'Perimeter', region: 'The Forge', hasOffice: true },
  { id: 7, name: 'Oursulaert VII - Moon 4 - Federal Intelligence Office', system: 'Oursulaert', region: 'Essence', hasOffice: true },
  { id: 8, name: 'Tash-Murkon Prime V - Moon 1 - Tash-Murkon Family Bureau', system: 'Tash-Murkon Prime', region: 'Tash-Murkon', hasOffice: true },
];

const MOCK_HANGARS: CorpHangar[] = [
  { division: 1, name: 'Raw Materials', itemCount: 142, totalVolume: 125450.5, totalValue: 850000000 },
  { division: 2, name: 'Compressed Ores', itemCount: 68, totalVolume: 45230.2, totalValue: 320000000 },
  { division: 3, name: 'Blueprints', itemCount: 234, totalVolume: 2.34, totalValue: 4500000000 },
  { division: 4, name: 'Components', itemCount: 89, totalVolume: 8920.5, totalValue: 680000000 },
  { division: 5, name: 'Ships & Modules', itemCount: 156, totalVolume: 234567.8, totalValue: 1200000000 },
  { division: 6, name: 'Ammo & Drones', itemCount: 423, totalVolume: 12345.6, totalValue: 180000000 },
  { division: 7, name: 'Miscellaneous', itemCount: 91, totalVolume: 5678.9, totalValue: 95000000 },
];

const MOCK_SUPPLY_NEEDS: SupplyNeed[] = [
  { typeId: 34, typeName: 'Tritanium', needed: 5000000, available: 3200000, shortage: 1800000, source: 'Manufacturing Job #1234', priority: 'high' },
  { typeId: 35, typeName: 'Pyerite', needed: 2500000, available: 2100000, shortage: 400000, source: 'Manufacturing Job #1234', priority: 'medium' },
  { typeId: 36, typeName: 'Mexallon', needed: 500000, available: 450000, shortage: 50000, source: 'Manufacturing Job #1235', priority: 'low' },
  { typeId: 37, typeName: 'Isogen', needed: 150000, available: 0, shortage: 150000, source: 'Manufacturing Job #1235', priority: 'high' },
  { typeId: 38, typeName: 'Nocxium', needed: 50000, available: 48000, shortage: 2000, source: 'Manufacturing Job #1236', priority: 'low' },
];

const generateMockItems = (hangar: CorpHangar, count: number = 50): AssetItem[] => {
  const items: AssetItem[] = [];
  const categories = {
    1: ['Mineral', 'Processed Materials', 'Ice Products'],
    2: ['Ore', 'Compressed Ore', 'Moon Ore'],
    3: ['Blueprint', 'Blueprint Copy'],
    4: ['Ship Components', 'Structure Components', 'Advanced Components'],
    5: ['Frigate', 'Destroyer', 'Cruiser', 'Battlecruiser', 'Battleship', 'Ship Equipment'],
    6: ['Projectile Ammo', 'Hybrid Ammo', 'Missiles', 'Combat Drone', 'Mining Drone'],
    7: ['Fuel', 'Salvage', 'Planetary Materials', 'Data Cores']
  };

  const itemsByCategory = {
    'Mineral': ['Tritanium', 'Pyerite', 'Mexallon', 'Isogen', 'Nocxium', 'Zydrine', 'Megacyte'],
    'Ore': ['Compressed Veldspar', 'Compressed Scordite', 'Compressed Pyroxeres', 'Compressed Plagioclase'],
    'Blueprint': ['Raven Blueprint', 'Drake Blueprint', 'Naga Blueprint', 'Ferox Blueprint'],
    'Ship Components': ['Capital Construction Parts', 'R.A.M.- Starship Tech', 'Fusion Reactor Unit'],
    'Frigate': ['Rifter', 'Merlin', 'Incursus', 'Punisher', 'Tristan'],
    'Cruiser': ['Rupture', 'Caracal', 'Vexor', 'Maller', 'Osprey'],
    'Battleship': ['Raven', 'Scorpion', 'Rokh', 'Megathron', 'Hyperion'],
    'Projectile Ammo': ['EMP S', 'EMP M', 'EMP L', 'Fusion S', 'Fusion M', 'Fusion L'],
    'Combat Drone': ['Warrior I', 'Warrior II', 'Valkyrie I', 'Valkyrie II', 'Hornet I', 'Hornet II'],
  };

  const relevantCategories = categories[hangar.division as keyof typeof categories] || [];
  
  for (let i = 0; i < count; i++) {
    const category = relevantCategories[Math.floor(Math.random() * relevantCategories.length)];
    const itemList = itemsByCategory[category as keyof typeof itemsByCategory] || ['Generic Item'];
    const typeName = itemList[Math.floor(Math.random() * itemList.length)];
    
    const baseQuantity = category === 'Mineral' ? 100000 : category === 'Ore' ? 5000 : category === 'Blueprint' ? 1 : 50;
    const quantity = Math.floor(Math.random() * baseQuantity) + 1;
    const volume = category === 'Blueprint' ? 0.01 : Math.random() * 100 + 1;
    const estimatedValue = Math.floor(Math.random() * 10000000) + 1000;

    items.push({
      itemId: `${hangar.division}-${i}`,
      typeId: 34 + i,
      typeName,
      quantity,
      locationId: 60003760,
      locationFlag: `CorpSAG${hangar.division}`,
      isSingleton: false,
      volume: volume * quantity,
      estimatedValue: estimatedValue * quantity,
      category,
      group: category
    });
  }

  return items;
};

export function Assets({ onLoginClick, isMobileView }: TabComponentProps) {
  const { user } = useAuth();
  const [selectedStation, setSelectedStation] = useKV<number>('assets-selected-station', 1);
  const [selectedHangar, setSelectedHangar] = useKV<number | null>('assets-selected-hangar', null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useKV<string[]>('assets-active-filters', []);
  const [hangarItems, setHangarItems] = useState<AssetItem[]>([]);

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
      categories: ['Frigate', 'Destroyer', 'Cruiser', 'Battlecruiser', 'Battleship', 'Capital', 'Freighter'],
      active: false 
    },
    { 
      id: 'ammo', 
      label: 'Ammo', 
      categories: ['Projectile Ammo', 'Hybrid Ammo', 'Missiles', 'Bombs', 'Charges'],
      active: false 
    },
    { 
      id: 'drones', 
      label: 'Drones', 
      categories: ['Combat Drone', 'Mining Drone', 'Salvage Drone', 'Logistics Drone'],
      active: false 
    },
    { 
      id: 'components', 
      label: 'Components', 
      categories: ['Ship Components', 'Structure Components', 'Advanced Components'],
      active: false 
    },
  ];

  const currentStation = MOCK_STATIONS.find(s => s.id === selectedStation) || MOCK_STATIONS[0];

  useEffect(() => {
    if (selectedHangar !== null) {
      const hangar = MOCK_HANGARS.find(h => h.division === selectedHangar);
      if (hangar) {
        const items = generateMockItems(hangar);
        setHangarItems(items);
      }
    } else {
      setHangarItems([]);
    }
  }, [selectedHangar]);

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
    return new Intl.NumberFormat('en-US').format(Math.floor(num));
  };

  const formatISK = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(2)}B ISK`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M ISK`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K ISK`;
    return `${num.toFixed(2)} ISK`;
  };

  const formatVolume = (num: number) => {
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
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package size={24} />
            Corporation Hangars
          </h2>
          <p className="text-muted-foreground text-sm">
            Browse and manage items across all corporation hangar divisions
          </p>
        </div>
        <div className="w-96">
          <Select 
            value={selectedStation.toString()} 
            onValueChange={(value) => setSelectedStation(parseInt(value))}
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
              {MOCK_STATIONS.map(station => (
                <SelectItem key={station.id} value={station.id.toString()}>
                  <div className="flex items-start gap-2 py-1">
                    <Building size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium text-sm">{station.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {station.system} • {station.region}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={`grid ${isMobileView ? 'grid-cols-1 gap-4' : 'grid-cols-12 gap-4'}`}>
        {/* Left Side - Hangar List */}
        <Card className={isMobileView ? '' : 'col-span-3'}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database size={18} />
              Hangars ({MOCK_HANGARS.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {MOCK_HANGARS.map((hangar) => {
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
              {/* Filter Bar */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FunnelSimple size={18} className="text-muted-foreground" />
                      <span className="text-sm font-medium">Quick Filters</span>
                      {activeFilters.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllFilters}
                          className="ml-auto h-7 text-xs"
                        >
                          <X size={14} className="mr-1" />
                          Clear All
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
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
                            className={`h-8 ${isActive ? 'bg-accent text-accent-foreground' : ''}`}
                          >
                            <Icon size={14} className="mr-1.5" />
                            {filter.label}
                          </Button>
                        );
                      })}
                    </div>

                    <div className="relative">
                      <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search items by name, category, or group..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats Bar */}
              <Card>
                <CardContent className="pt-6">
                  <div className={`grid ${isMobileView ? 'grid-cols-2' : 'grid-cols-4'} gap-4`}>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-foreground">
                        {formatNumber(stats.count)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {activeFilters.length > 0 || searchQuery ? 'Filtered Items' : 'Total Items'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-foreground">
                        {formatNumber(stats.totalQuantity)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Total Quantity</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">
                        {formatISK(stats.totalValue)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Total Value</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-foreground">
                        {formatVolume(stats.totalVolume)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Total Volume</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items List */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {MOCK_HANGARS.find(h => h.division === selectedHangar)?.name || `Hangar ${selectedHangar}`} Contents
                  </CardTitle>
                </CardHeader>
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
                            if (isMobileView) {
                              return (
                                <div key={item.itemId} className="px-4 py-3 hover:bg-muted/30">
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
                                      <div className="font-medium">{formatVolume(item.volume)}</div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">Value</div>
                                      <div className="font-medium text-accent">{formatISK(item.estimatedValue)}</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={item.itemId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 text-sm">
                                <div className="flex items-center gap-2 w-64">
                                  <Cube size={16} className="text-muted-foreground flex-shrink-0" />
                                  <span className="font-medium truncate">{item.typeName}</span>
                                </div>
                                <span className="w-24 text-right text-muted-foreground">
                                  {formatNumber(item.quantity)}
                                </span>
                                <span className="w-24 text-right text-muted-foreground">
                                  {formatVolume(item.volume)}
                                </span>
                                <span className="w-24 text-right text-accent">
                                  {formatISK(item.estimatedValue)}
                                </span>
                                <div className="w-24">
                                  <Badge variant="secondary" className="text-xs">
                                    {item.category}
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
              {MOCK_SUPPLY_NEEDS.length === 0 ? (
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
                  {MOCK_SUPPLY_NEEDS.map((supply) => {
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
    </div>
  );
}