import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Receipt,
  Plus,
  Trash,
  CheckCircle,
  Coins,
  TrendUp,
  Package,
  Pencil,
  Eye,
  MagnifyingGlass,
  FunnelSimple,
  Gear,
  WarningCircle,
  Database
} from '@phosphor-icons/react';
import { useKV } from '@github/spark/hooks';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-provider';

interface BuybackProgram {
  id: string;
  name: string;
  description: string;
  percentage: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  categories: string[];
  excludedItems: string[];
  minValue: number;
  maxValue: number;
  location?: string;
}

interface BuybackContract {
  id: string;
  programId: string;
  characterId: number;
  characterName: string;
  items: BuybackContractItem[];
  totalValue: number;
  payoutValue: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  createdAt: string;
  completedAt?: string;
}

interface BuybackContractItem {
  typeId: number;
  typeName: string;
  quantity: number;
  jitaBuyPrice: number;
  totalValue: number;
}

interface BuybackItemConfig {
  typeId: number;
  typeName: string;
  category: string;
  manualPercentage?: number;
  excluded: boolean;
  useManualPrice: boolean;
  manualPrice?: number;
}

interface BuybackPriceConfig {
  comparisonStation: string;
  pricingType: 'buy' | 'sell';
  defaultPercentage: number;
}

interface BuybackProps {
  isMobileView?: boolean;
}

export function Buyback({ isMobileView }: BuybackProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useKV<string>('buyback-tab', 'programs');
  const [programs, setPrograms] = useKV<BuybackProgram[]>('buyback-programs', [
    {
      id: '1',
      name: 'Ore Buyback',
      description: 'Buy ore and compressed ore at 90% Jita buy',
      percentage: 90,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      categories: ['Ore', 'Compressed Ore'],
      excludedItems: [],
      minValue: 0,
      maxValue: 0,
      location: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant'
    },
    {
      id: '2',
      name: 'Salvage Buyback',
      description: 'Buy all salvage materials at 85% Jita buy',
      percentage: 85,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      categories: ['Salvaged Materials'],
      excludedItems: [],
      minValue: 1000000,
      maxValue: 0,
      location: 'Any Corporation Hangar'
    }
  ]);
  const [contracts, setContracts] = useKV<BuybackContract[]>('buyback-contracts', []);
  const [showAddProgram, setShowAddProgram] = useState(false);
  const [editingProgram, setEditingProgram] = useState<BuybackProgram | null>(null);
  const [newProgram, setNewProgram] = useState<Partial<BuybackProgram>>({
    name: '',
    description: '',
    percentage: 90,
    enabled: true,
    categories: [],
    excludedItems: [],
    minValue: 0,
    maxValue: 0,
    location: ''
  });

  const [priceConfig, setPriceConfig] = useKV<BuybackPriceConfig>('buyback-price-config', {
    comparisonStation: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
    pricingType: 'buy',
    defaultPercentage: 90
  });

  const [itemConfigs, setItemConfigs] = useKV<BuybackItemConfig[]>('buyback-item-configs', []);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [massAssignPercentage, setMassAssignPercentage] = useState(90);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  
  const mockEVEItems: BuybackItemConfig[] = useMemo(() => {
    const existingConfigs = new Map(itemConfigs.map(item => [item.typeId, item]));
    
    const baseItems = [
      { typeId: 34, typeName: 'Tritanium', category: 'Mineral' },
      { typeId: 35, typeName: 'Pyerite', category: 'Mineral' },
      { typeId: 36, typeName: 'Mexallon', category: 'Mineral' },
      { typeId: 37, typeName: 'Isogen', category: 'Mineral' },
      { typeId: 38, typeName: 'Nocxium', category: 'Mineral' },
      { typeId: 39, typeName: 'Zydrine', category: 'Mineral' },
      { typeId: 40, typeName: 'Megacyte', category: 'Mineral' },
      { typeId: 1230, typeName: 'Veldspar', category: 'Ore' },
      { typeId: 1228, typeName: 'Scordite', category: 'Ore' },
      { typeId: 1224, typeName: 'Pyroxeres', category: 'Ore' },
      { typeId: 1227, typeName: 'Plagioclase', category: 'Ore' },
      { typeId: 17470, typeName: 'Compressed Veldspar', category: 'Compressed Ore' },
      { typeId: 17471, typeName: 'Compressed Scordite', category: 'Compressed Ore' },
      { typeId: 25595, typeName: 'Melted Nanoribbons', category: 'Salvaged Materials' },
      { typeId: 25596, typeName: 'Charred Micro Circuit', category: 'Salvaged Materials' },
      { typeId: 25597, typeName: 'Fried Interface Circuit', category: 'Salvaged Materials' },
      { typeId: 30370, typeName: 'Contaminated Nanite Compound', category: 'Salvaged Materials' },
      { typeId: 597, typeName: 'PLEX', category: 'Special Commodities' },
      { typeId: 44992, typeName: 'Large Skill Injector', category: 'Special Commodities' },
      { typeId: 11399, typeName: 'Morphite', category: 'Mineral' },
      { typeId: 16272, typeName: 'Heavy Water', category: 'Ice Product' },
      { typeId: 16273, typeName: 'Liquid Ozone', category: 'Ice Product' },
      { typeId: 16274, typeName: 'Strontium Clathrates', category: 'Ice Product' },
      { typeId: 16275, typeName: 'Helium Isotopes', category: 'Ice Product' },
      { typeId: 3683, typeName: 'Oxygen Isotopes', category: 'Ice Product' },
      { typeId: 9832, typeName: 'Nitrogen Isotopes', category: 'Ice Product' },
      { typeId: 17888, typeName: 'Hydrogen Isotopes', category: 'Ice Product' },
    ];

    return baseItems.map(item => {
      const existing = existingConfigs.get(item.typeId);
      if (existing) return existing;
      
      return {
        ...item,
        excluded: false,
        useManualPrice: false
      };
    });
  }, [itemConfigs]);

  const allCategories = useMemo(() => {
    const categories = new Set(mockEVEItems.map(item => item.category));
    return ['all', ...Array.from(categories).sort()];
  }, [mockEVEItems]);

  const filteredItems = useMemo(() => {
    return mockEVEItems.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.typeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.typeId.toString().includes(searchQuery);
      
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [mockEVEItems, searchQuery, categoryFilter]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const handleAddProgram = () => {
    if (!newProgram.name || !newProgram.description || !newProgram.percentage) {
      toast.error('Please fill in all required fields');
      return;
    }

    const program: BuybackProgram = {
      id: Date.now().toString(),
      name: newProgram.name,
      description: newProgram.description,
      percentage: newProgram.percentage,
      enabled: newProgram.enabled ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      categories: newProgram.categories || [],
      excludedItems: newProgram.excludedItems || [],
      minValue: newProgram.minValue || 0,
      maxValue: newProgram.maxValue || 0,
      location: newProgram.location || ''
    };

    setPrograms(current => [...current, program]);
    setNewProgram({
      name: '',
      description: '',
      percentage: 90,
      enabled: true,
      categories: [],
      excludedItems: [],
      minValue: 0,
      maxValue: 0,
      location: ''
    });
    setShowAddProgram(false);
    toast.success('Buyback program created successfully');
  };

  const handleUpdateProgram = (programId: string, updates: Partial<BuybackProgram>) => {
    setPrograms(current => 
      current.map(p => 
        p.id === programId 
          ? { ...p, ...updates, updatedAt: new Date().toISOString() }
          : p
      )
    );
    toast.success('Program updated successfully');
  };

  const handleDeleteProgram = (programId: string) => {
    if (confirm('Are you sure you want to delete this buyback program?')) {
      setPrograms(current => current.filter(p => p.id !== programId));
      toast.success('Program deleted successfully');
    }
  };

  const handleUpdateItemConfig = (typeId: number, updates: Partial<BuybackItemConfig>) => {
    setItemConfigs(current => {
      const existing = current.find(item => item.typeId === typeId);
      const baseItem = mockEVEItems.find(item => item.typeId === typeId);
      
      if (!baseItem) return current;
      
      if (existing) {
        return current.map(item => 
          item.typeId === typeId ? { ...item, ...updates } : item
        );
      } else {
        return [...current, { ...baseItem, ...updates }];
      }
    });
  };

  const handleMassAssignPercentage = () => {
    if (selectedItems.size === 0) {
      toast.error('No items selected');
      return;
    }

    const itemsToUpdate = Array.from(selectedItems);
    setItemConfigs(current => {
      const updatedItems = [...current];
      
      itemsToUpdate.forEach(typeId => {
        const existingIndex = updatedItems.findIndex(item => item.typeId === typeId);
        const baseItem = mockEVEItems.find(item => item.typeId === typeId);
        
        if (!baseItem) return;
        
        if (existingIndex >= 0) {
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            manualPercentage: massAssignPercentage,
            useManualPrice: true
          };
        } else {
          updatedItems.push({
            ...baseItem,
            manualPercentage: massAssignPercentage,
            useManualPrice: true
          });
        }
      });
      
      return updatedItems;
    });

    setSelectedItems(new Set());
    toast.success(`Updated ${itemsToUpdate.length} items to ${massAssignPercentage}%`);
  };

  const handleAssignAllPricingType = () => {
    toast.success(`All items now use ${priceConfig.pricingType} pricing from ${priceConfig.comparisonStation}`);
  };

  const toggleItemSelection = (typeId: number) => {
    setSelectedItems(current => {
      const newSet = new Set(current);
      if (newSet.has(typeId)) {
        newSet.delete(typeId);
      } else {
        newSet.add(typeId);
      }
      return newSet;
    });
  };

  const toggleAllItems = () => {
    if (selectedItems.size === paginatedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(paginatedItems.map(item => item.typeId)));
    }
  };

  const getItemConfig = (typeId: number): BuybackItemConfig => {
    const config = itemConfigs.find(item => item.typeId === typeId);
    const baseItem = mockEVEItems.find(item => item.typeId === typeId);
    
    if (!baseItem) {
      return {
        typeId,
        typeName: 'Unknown',
        category: 'Unknown',
        excluded: false,
        useManualPrice: false
      };
    }
    
    return config || baseItem;
  };

  const getEffectivePercentage = (item: BuybackItemConfig): number => {
    if (item.manualPercentage !== undefined && item.useManualPrice) {
      return item.manualPercentage;
    }
    return priceConfig.defaultPercentage;
  };

  const formatISK = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) + ' ISK';
  };

  const calculateStats = () => {
    const totalContracts = contracts.length;
    const pendingContracts = contracts.filter(c => c.status === 'pending').length;
    const completedContracts = contracts.filter(c => c.status === 'completed').length;
    const totalPayout = contracts
      .filter(c => c.status === 'completed')
      .reduce((sum, c) => sum + c.payoutValue, 0);

    return {
      totalContracts,
      pendingContracts,
      completedContracts,
      totalPayout
    };
  };

  const stats = calculateStats();

  const isAdmin = user && (
    user.role === 'super_admin' || 
    user.role === 'corp_admin' || 
    user.role === 'corp_director'
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Receipt size={24} />
          Buyback Programs
        </h2>
        <p className="text-muted-foreground">
          Manage corporation buyback programs and contracts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Programs</p>
                <p className="text-2xl font-bold">{programs.filter(p => p.enabled).length}</p>
              </div>
              <Package size={32} className="text-accent opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Contracts</p>
                <p className="text-2xl font-bold">{stats.pendingContracts}</p>
              </div>
              <Receipt size={32} className="text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completedContracts}</p>
              </div>
              <CheckCircle size={32} className="text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Payout</p>
                <p className="text-lg font-bold">{formatISK(stats.totalPayout)}</p>
              </div>
              <Coins size={32} className="text-accent opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} max-w-2xl`}>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="calculator">Calculator</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin">Admin</TabsTrigger>}
        </TabsList>

        <TabsContent value="programs" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Buyback Programs</h3>
            <Button
              onClick={() => setShowAddProgram(true)}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Plus size={16} className="mr-2" />
              New Program
            </Button>
          </div>

          {showAddProgram && (
            <Card className="border-accent/50">
              <CardHeader>
                <CardTitle>Create New Buyback Program</CardTitle>
                <CardDescription>Set up a new buyback program for your corporation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="programName">Program Name</Label>
                    <Input
                      id="programName"
                      value={newProgram.name}
                      onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
                      placeholder="e.g., Ore Buyback"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="percentage">Percentage of Jita Buy</Label>
                    <Input
                      id="percentage"
                      type="number"
                      min="1"
                      max="100"
                      value={newProgram.percentage}
                      onChange={(e) => setNewProgram({ ...newProgram, percentage: parseInt(e.target.value) || 90 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newProgram.description}
                    onChange={(e) => setNewProgram({ ...newProgram, description: e.target.value })}
                    placeholder="Brief description of what this program buys"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minValue">Minimum Value (ISK)</Label>
                    <Input
                      id="minValue"
                      type="number"
                      min="0"
                      value={newProgram.minValue}
                      onChange={(e) => setNewProgram({ ...newProgram, minValue: parseInt(e.target.value) || 0 })}
                      placeholder="0 for no minimum"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location (Optional)</Label>
                    <Input
                      id="location"
                      value={newProgram.location}
                      onChange={(e) => setNewProgram({ ...newProgram, location: e.target.value })}
                      placeholder="e.g., Jita IV - Moon 4"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={newProgram.enabled ?? true}
                      onCheckedChange={(checked) => setNewProgram({ ...newProgram, enabled: checked })}
                    />
                    <Label>Enable program immediately</Label>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddProgram(false);
                        setNewProgram({
                          name: '',
                          description: '',
                          percentage: 90,
                          enabled: true,
                          categories: [],
                          excludedItems: [],
                          minValue: 0,
                          maxValue: 0,
                          location: ''
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddProgram}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      <CheckCircle size={16} className="mr-2" />
                      Create Program
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4">
            {programs.map((program) => (
              <Card key={program.id} className={program.enabled ? '' : 'opacity-60'}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold">{program.name}</h4>
                        <Badge variant={program.enabled ? 'default' : 'secondary'} className={program.enabled ? 'bg-green-500' : ''}>
                          {program.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        <Badge variant="outline" className="font-mono">
                          {program.percentage}% Jita Buy
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{program.description}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {program.location && (
                          <div>
                            <span className="text-muted-foreground">Location:</span>
                            <p className="font-medium">{program.location}</p>
                          </div>
                        )}
                        {program.minValue > 0 && (
                          <div>
                            <span className="text-muted-foreground">Min Value:</span>
                            <p className="font-medium">{formatISK(program.minValue)}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Created:</span>
                          <p className="font-medium">{new Date(program.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateProgram(program.id, { enabled: !program.enabled })}
                      >
                        {program.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingProgram(program)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteProgram(program.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {programs.length === 0 && (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <Receipt size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground mb-4">No buyback programs configured</p>
                  <Button
                    onClick={() => setShowAddProgram(true)}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    <Plus size={16} className="mr-2" />
                    Create First Program
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Buyback Contracts</CardTitle>
              <CardDescription>View and manage member buyback contracts</CardDescription>
            </CardHeader>
            <CardContent>
              {contracts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract ID</TableHead>
                      <TableHead>Character</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total Value</TableHead>
                      <TableHead>Payout</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-mono">#{contract.id.slice(0, 8)}</TableCell>
                        <TableCell>{contract.characterName}</TableCell>
                        <TableCell>
                          {programs.find(p => p.id === contract.programId)?.name || 'Unknown'}
                        </TableCell>
                        <TableCell>{contract.items.length} items</TableCell>
                        <TableCell className="font-mono">{formatISK(contract.totalValue)}</TableCell>
                        <TableCell className="font-mono text-green-500">{formatISK(contract.payoutValue)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            contract.status === 'completed' ? 'default' :
                            contract.status === 'pending' ? 'secondary' :
                            'destructive'
                          }>
                            {contract.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(contract.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            <Eye size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Receipt size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground">No buyback contracts yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Contracts will appear here when members submit buyback requests
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculator" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Buyback Calculator</CardTitle>
              <CardDescription>Calculate buyback values for items based on active programs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendUp size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">Buyback calculator coming soon</p>
                <p className="text-sm text-muted-foreground">
                  This tool will allow you to calculate buyback values for items based on current Jita prices
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gear size={20} />
                  Price Configuration
                </CardTitle>
                <CardDescription>Configure global pricing settings for buyback calculations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="comparisonStation">Comparison Station</Label>
                    <Select
                      value={priceConfig.comparisonStation}
                      onValueChange={(value) => setPriceConfig(current => ({ ...current, comparisonStation: value }))}
                    >
                      <SelectTrigger id="comparisonStation">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Jita IV - Moon 4 - Caldari Navy Assembly Plant">Jita IV - Moon 4</SelectItem>
                        <SelectItem value="Amarr VIII (Oris) - Emperor Family Academy">Amarr VIII (Oris)</SelectItem>
                        <SelectItem value="Dodixie IX - Moon 20 - Federation Navy Assembly Plant">Dodixie IX - Moon 20</SelectItem>
                        <SelectItem value="Rens VI - Moon 8 - Brutor Tribe Treasury">Rens VI - Moon 8</SelectItem>
                        <SelectItem value="Hek VIII - Moon 12 - Boundless Creation Factory">Hek VIII - Moon 12</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pricingType" className="flex items-center justify-between">
                      <span>Pricing Type</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAssignAllPricingType}
                        className="text-xs h-7"
                      >
                        <CheckCircle size={14} className="mr-1" />
                        Apply to All
                      </Button>
                    </Label>
                    <Select
                      value={priceConfig.pricingType}
                      onValueChange={(value: 'buy' | 'sell') => setPriceConfig(current => ({ ...current, pricingType: value }))}
                    >
                      <SelectTrigger id="pricingType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy">Buy Orders</SelectItem>
                        <SelectItem value="sell">Sell Orders</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultPercentage">Default Percentage</Label>
                  <div className="flex gap-2">
                    <Input
                      id="defaultPercentage"
                      type="number"
                      min="1"
                      max="100"
                      value={priceConfig.defaultPercentage}
                      onChange={(e) => setPriceConfig(current => ({ ...current, defaultPercentage: parseInt(e.target.value) || 90 }))}
                      className="max-w-xs"
                    />
                    <span className="flex items-center text-muted-foreground">%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Applied to items without manual percentage overrides
                  </p>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={massAssignPercentage}
                      onChange={(e) => setMassAssignPercentage(parseInt(e.target.value) || 90)}
                      className="w-24"
                      placeholder="90"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <Button
                      onClick={handleMassAssignPercentage}
                      disabled={selectedItems.size === 0}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      <CheckCircle size={16} className="mr-2" />
                      Assign to Selected ({selectedItems.size})
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Select items below and use this to mass assign a custom percentage
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database size={20} />
                  Item Configuration
                </CardTitle>
                <CardDescription>
                  Configure buyback rates and exclusions for individual items
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or type ID..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Select value={categoryFilter} onValueChange={(value) => {
                      setCategoryFilter(value);
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-48">
                        <FunnelSimple size={16} className="mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {cat === 'all' ? 'All Categories' : cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select 
                      value={itemsPerPage.toString()} 
                      onValueChange={(value) => {
                        setItemsPerPage(parseInt(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25 per page</SelectItem>
                        <SelectItem value="50">50 per page</SelectItem>
                        <SelectItem value="100">100 per page</SelectItem>
                        <SelectItem value="200">200 per page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div>
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} items
                  </div>
                  {selectedItems.size > 0 && (
                    <Badge variant="secondary" className="bg-accent/20 text-accent">
                      {selectedItems.size} selected
                    </Badge>
                  )}
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            checked={paginatedItems.length > 0 && selectedItems.size === paginatedItems.length}
                            onChange={toggleAllItems}
                            className="cursor-pointer"
                          />
                        </TableHead>
                        <TableHead>Type ID</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Buyback %</TableHead>
                        <TableHead>Pricing</TableHead>
                        <TableHead>Excluded</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map((item) => {
                        const config = getItemConfig(item.typeId);
                        const effectivePercentage = getEffectivePercentage(config);
                        const isSelected = selectedItems.has(item.typeId);
                        
                        return (
                          <TableRow key={item.typeId} className={isSelected ? 'bg-accent/10' : ''}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleItemSelection(item.typeId)}
                                className="cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">{item.typeId}</TableCell>
                            <TableCell className="font-medium">{item.typeName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={config.manualPercentage ?? effectivePercentage}
                                  onChange={(e) => handleUpdateItemConfig(item.typeId, {
                                    manualPercentage: parseInt(e.target.value) || 90,
                                    useManualPrice: true
                                  })}
                                  className="w-20 h-8 text-sm"
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                                {config.useManualPrice && config.manualPercentage !== undefined && (
                                  <Badge variant="secondary" className="text-xs bg-accent/20 text-accent">
                                    Custom
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={config.useManualPrice && config.manualPrice !== undefined ? 'manual' : priceConfig.pricingType}
                                onValueChange={(value) => {
                                  if (value === 'manual') {
                                    handleUpdateItemConfig(item.typeId, { useManualPrice: true });
                                  } else {
                                    handleUpdateItemConfig(item.typeId, { 
                                      useManualPrice: false,
                                      manualPrice: undefined 
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className="w-28 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="buy">Buy</SelectItem>
                                  <SelectItem value="sell">Sell</SelectItem>
                                  <SelectItem value="manual">Manual</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={config.excluded}
                                onCheckedChange={(checked) => handleUpdateItemConfig(item.typeId, { excluded: checked })}
                              />
                            </TableCell>
                            <TableCell>
                              {config.useManualPrice && config.manualPercentage !== undefined && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateItemConfig(item.typeId, {
                                    manualPercentage: undefined,
                                    useManualPrice: false
                                  })}
                                  className="h-8 text-xs"
                                  title="Reset to default"
                                >
                                  Reset
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}

                {paginatedItems.length === 0 && (
                  <div className="text-center py-12">
                    <WarningCircle size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground">No items found</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Try adjusting your search or filter criteria
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
