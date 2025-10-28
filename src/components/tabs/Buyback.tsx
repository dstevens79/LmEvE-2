import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
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
  Database,
  Copy,
  X,
  FileText
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
  validationKey: string;
  characterName: string;
  items: BuybackCalculatedItem[];
  totalValue: number;
  payoutValue: number;
  status: 'open' | 'completed';
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

interface BuybackCalculatedItem {
  typeId: number;
  typeName: string;
  quantity: number;
  unitPrice: number;
  totalItemValue: number;
  buybackPercentage: number;
  payoutPerItem: number;
  totalPayout: number;
  excluded: boolean;
  isManualPrice: boolean;
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
  const [activeTab, setActiveTab] = useKV<string>('buyback-tab', 'calculator');
  const [contracts, setContracts] = useKV<BuybackContract[]>('buyback-contracts', []);
  const [buybackPilotName, setBuybackPilotName] = useKV<string>('buyback-pilot-name', '');
  
  const [pasteText, setPasteText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [calculatedItems, setCalculatedItems] = useState<BuybackCalculatedItem[]>([]);
  
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

  const parseEVEText = (text: string): BuybackCalculatedItem[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const items: BuybackCalculatedItem[] = [];
    
    for (const line of lines) {
      const quantityMatch = line.match(/^(.+?)\s+(\d[\d\s,]*)/);
      if (quantityMatch) {
        const itemName = quantityMatch[1].trim();
        const quantityStr = quantityMatch[2].replace(/[\s,]/g, '');
        const quantity = parseInt(quantityStr);
        
        if (itemName && !isNaN(quantity) && quantity > 0) {
          const matchedItem = mockEVEItems.find(
            item => item.typeName.toLowerCase() === itemName.toLowerCase()
          );
          
          if (matchedItem) {
            const config = getItemConfig(matchedItem.typeId);
            const mockPrice = Math.random() * 10000 + 100;
            const percentage = getEffectivePercentage(config);
            const totalItemValue = mockPrice * quantity;
            const payoutPerItem = config.excluded ? 0 : (mockPrice * percentage / 100);
            const totalPayout = payoutPerItem * quantity;
            
            items.push({
              typeId: matchedItem.typeId,
              typeName: matchedItem.typeName,
              quantity,
              unitPrice: mockPrice,
              totalItemValue,
              buybackPercentage: config.excluded ? 0 : percentage,
              payoutPerItem,
              totalPayout,
              excluded: config.excluded,
              isManualPrice: config.useManualPrice && config.manualPercentage !== undefined
            });
          }
        }
      }
    }
    
    return items;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const text = e.dataTransfer.getData('text');
    if (text) {
      setPasteText(text);
      const parsed = parseEVEText(text);
      setCalculatedItems(parsed);
      if (parsed.length > 0) {
        toast.success(`Parsed ${parsed.length} items`);
      } else {
        toast.error('No valid items found in text');
      }
    }
  };

  const handlePaste = () => {
    const parsed = parseEVEText(pasteText);
    setCalculatedItems(parsed);
    if (parsed.length > 0) {
      toast.success(`Parsed ${parsed.length} items`);
    } else {
      toast.error('No valid items found in text');
    }
  };

  const handleClearCalculation = () => {
    setPasteText('');
    setCalculatedItems([]);
    toast.success('Calculator cleared');
  };

  const generateValidationKey = (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `BB-${timestamp}-${random}`;
  };

  const handleAcceptContract = () => {
    const validationKey = generateValidationKey();
    const totalValue = calculatedItems.reduce((sum, item) => sum + item.totalItemValue, 0);
    const payoutValue = calculatedItems.reduce((sum, item) => sum + item.totalPayout, 0);

    const contract: BuybackContract = {
      id: Date.now().toString(),
      validationKey,
      characterName: user?.characterName || 'Unknown',
      items: calculatedItems,
      totalValue,
      payoutValue,
      status: 'open',
      createdAt: new Date().toISOString()
    };

    setContracts(current => [contract, ...current]);
    
    navigator.clipboard.writeText(validationKey);
    toast.success('Contract created! Validation key copied to clipboard');
    
    setPasteText('');
    setCalculatedItems([]);
    
    setActiveTab('contracts');
  };

  const handleCompleteContract = (contractId: string) => {
    setContracts(current =>
      current.map(c =>
        c.id === contractId
          ? { ...c, status: 'completed', completedAt: new Date().toISOString() }
          : c
      )
    );
    toast.success('Contract marked as completed');
  };

  const handleDeleteContract = (contractId: string) => {
    if (confirm('Are you sure you want to delete this contract?')) {
      setContracts(current => current.filter(c => c.id !== contractId));
      toast.success('Contract deleted');
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
    const openContracts = contracts.filter(c => c.status === 'open').length;
    const completedContracts = contracts.filter(c => c.status === 'completed').length;
    const totalPayout = contracts
      .filter(c => c.status === 'completed')
      .reduce((sum, c) => sum + c.payoutValue, 0);

    return {
      totalContracts,
      openContracts,
      completedContracts,
      totalPayout
    };
  };

  const stats = calculateStats();

  const openContracts = contracts.filter(c => c.status === 'open');
  const completedContracts = contracts.filter(c => c.status === 'completed');
  
  const calculationSummary = useMemo(() => {
    if (calculatedItems.length === 0) {
      return { totalValue: 0, totalPayout: 0, excludedCount: 0, manualCount: 0 };
    }
    
    return {
      totalValue: calculatedItems.reduce((sum, item) => sum + item.totalItemValue, 0),
      totalPayout: calculatedItems.reduce((sum, item) => sum + item.totalPayout, 0),
      excludedCount: calculatedItems.filter(item => item.excluded).length,
      manualCount: calculatedItems.filter(item => item.isManualPrice).length
    };
  }, [calculatedItems]);

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
          Buyback Calculator
        </h2>
        <p className="text-muted-foreground">
          Calculate buyback values and manage contracts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Contracts</p>
                <p className="text-2xl font-bold">{stats.totalContracts}</p>
              </div>
              <Receipt size={32} className="text-accent opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Open Contracts</p>
                <p className="text-2xl font-bold">{stats.openContracts}</p>
              </div>
              <Package size={32} className="text-orange-500 opacity-50" />
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
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} max-w-2xl`}>
          <TabsTrigger value="calculator">Calculator</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin">Admin</TabsTrigger>}
        </TabsList>

        <TabsContent value="calculator" className="mt-6 space-y-4">
          {buybackPilotName && (
            <Card className="border-accent/50 bg-accent/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <img 
                      src={`https://images.evetech.net/characters/1/portrait?size=128`}
                      alt="Buyback Pilot"
                      className="w-16 h-16 rounded border-2 border-accent/50"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzMzIi8+CjxjaXJjbGUgY3g9IjMyIiBjeT0iMjQiIHI9IjgiIGZpbGw9IiM5OTkiLz4KPHBhdGggZD0iTTQ4IDU2QzQ4IDQ3LjE2MzQgNDEuNzMyMSA0MCAzNCA0MEgzMEMyMi4yNjc5IDQwIDE2IDQ3LjE2MzQgMTYgNTZINDhaIiBmaWxsPSIjOTk5Ii8+Cjwvc3ZnPg==';
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-accent text-accent-foreground">Contract Recipient</Badge>
                    </div>
                    <p className="text-lg font-bold mb-1">{buybackPilotName}</p>
                    <p className="text-sm text-muted-foreground">
                      Send your in-game item exchange contract to this character. 
                      Make sure to include the validation key in the contract description after you accept the buyback.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Paste Items from EVE Online</CardTitle>
                <CardDescription>Drag and drop or paste copied item list from EVE Online</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  className={`
                    border-2 border-dashed rounded-lg p-6 transition-colors
                    ${isDragging ? 'border-accent bg-accent/10' : 'border-border'}
                    ${calculatedItems.length > 0 ? 'opacity-50' : ''}
                  `}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-center">
                      <FileText size={48} className="text-muted-foreground opacity-50" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        Drag and drop text here or paste below
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Copy items from EVE inventory (Ctrl+C in game) and paste here
                      </p>
                    </div>
                    
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder="Tritanium  50000&#10;Pyerite  25000&#10;Mexallon  10000"
                      disabled={calculatedItems.length > 0}
                      className="w-full h-32 px-3 py-2 text-sm rounded-md border border-input bg-input/50 resize-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />

                    <div className="flex gap-2">
                      <Button
                        onClick={handlePaste}
                        disabled={!pasteText.trim() || calculatedItems.length > 0}
                        className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                      >
                        <TrendUp size={16} className="mr-2" />
                        Calculate Buyback
                      </Button>
                      {calculatedItems.length > 0 && (
                        <Button
                          onClick={handleClearCalculation}
                          variant="outline"
                        >
                          <X size={16} className="mr-2" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {calculatedItems.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total Value</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Payout</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calculatedItems.map((item, index) => (
                          <TableRow 
                            key={index}
                            className={item.excluded ? 'bg-red-500/10' : item.isManualPrice ? 'bg-yellow-500/10' : ''}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.typeName}</span>
                                {item.excluded && (
                                  <Badge variant="destructive" className="text-xs bg-red-500/20 text-red-500 border-red-500/30">
                                    Not Accepted
                                  </Badge>
                                )}
                                {item.isManualPrice && !item.excluded && (
                                  <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                                    Manual Rate
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {item.quantity.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatISK(item.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatISK(item.totalItemValue)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-medium ${item.excluded ? 'text-red-500' : item.isManualPrice ? 'text-yellow-500' : ''}`}>
                                {item.buybackPercentage}%
                                {item.isManualPrice && !item.excluded && (
                                  <span className="text-xs ml-1">({formatISK(item.payoutPerItem)}/unit)</span>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              <span className={item.excluded ? 'text-red-500' : 'text-green-500'}>
                                {formatISK(item.totalPayout)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-accent/50 lg:sticky lg:top-4 h-fit">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
                <CardDescription>
                  {calculatedItems.length > 0 ? `${calculatedItems.length} items calculated` : 'Ready to calculate'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Items</p>
                    <p className="text-2xl font-bold">{calculatedItems.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="text-lg font-bold">{formatISK(calculationSummary.totalValue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Your Payout</p>
                    <p className="text-lg font-bold text-green-500">{formatISK(calculationSummary.totalPayout)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Effective Rate</p>
                    <p className="text-lg font-bold">
                      {calculationSummary.totalValue > 0 
                        ? ((calculationSummary.totalPayout / calculationSummary.totalValue) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>

                {calculatedItems.length > 0 && (calculationSummary.excludedCount > 0 || calculationSummary.manualCount > 0) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      {calculationSummary.excludedCount > 0 && (
                        <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/30 w-full justify-center">
                          {calculationSummary.excludedCount} excluded items
                        </Badge>
                      )}
                      {calculationSummary.manualCount > 0 && (
                        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 w-full justify-center">
                          {calculationSummary.manualCount} manual rates
                        </Badge>
                      )}
                    </div>
                  </>
                )}

                <Separator />

                <div className="space-y-3">
                  {calculatedItems.length > 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground text-center">
                        Click Accept to generate contract validation key
                      </p>
                      <Button
                        onClick={handleAcceptContract}
                        size="lg"
                        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                      >
                        <CheckCircle size={20} className="mr-2" />
                        Accept & Generate Contract
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">
                        Paste items to see your buyback calculation
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Open Contracts</CardTitle>
              <CardDescription>Contracts awaiting completion</CardDescription>
            </CardHeader>
            <CardContent>
              {openContracts.length > 0 ? (
                <div className="space-y-4">
                  {openContracts.map((contract) => (
                    <Card key={contract.id} className="border-accent/30">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-semibold">{contract.characterName}</h4>
                              <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">
                                Open
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Validation Key:</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                    {contract.validationKey}
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => {
                                      navigator.clipboard.writeText(contract.validationKey);
                                      toast.success('Validation key copied');
                                    }}
                                  >
                                    <Copy size={14} />
                                  </Button>
                                </div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Items:</span>
                                <p className="font-medium">{contract.items.length}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Total Value:</span>
                                <p className="font-medium">{formatISK(contract.totalValue)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Payout:</span>
                                <p className="font-medium text-green-500">{formatISK(contract.payoutValue)}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCompleteContract(contract.id)}
                              className="text-green-500 border-green-500/50 hover:bg-green-500/10"
                            >
                              <CheckCircle size={16} className="mr-2" />
                              Complete
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteContract(contract.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash size={16} />
                            </Button>
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          Created: {new Date(contract.createdAt).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground">No open contracts</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Completed Contracts</CardTitle>
              <CardDescription>Contract history</CardDescription>
            </CardHeader>
            <CardContent>
              {completedContracts.length > 0 ? (
                <div className="space-y-4">
                  {completedContracts.map((contract) => (
                    <Card key={contract.id} className="border-green-500/30 bg-green-500/5">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-semibold">{contract.characterName}</h4>
                              <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                                Completed
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Validation Key:</span>
                                <p className="font-mono text-xs mt-1">{contract.validationKey}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Items:</span>
                                <p className="font-medium">{contract.items.length}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Total Value:</span>
                                <p className="font-medium">{formatISK(contract.totalValue)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Payout:</span>
                                <p className="font-medium text-green-500">{formatISK(contract.payoutValue)}</p>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteContract(contract.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                        
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Created: {new Date(contract.createdAt).toLocaleString()}</span>
                          {contract.completedAt && (
                            <span>Completed: {new Date(contract.completedAt).toLocaleString()}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground">No completed contracts</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gear size={20} />
                  Buyback Configuration
                </CardTitle>
                <CardDescription>Configure buyback pilot and contract settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="buybackPilotName">Buyback Pilot Name</Label>
                  <div className="flex gap-2">
                    <Input
                      id="buybackPilotName"
                      value={buybackPilotName}
                      onChange={(e) => setBuybackPilotName(e.target.value)}
                      placeholder="Enter character name to receive contracts"
                      className="flex-1"
                    />
                    <Button
                      onClick={() => {
                        toast.success('Buyback pilot name saved');
                      }}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      Save
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This character name will be displayed to users when creating buyback contracts
                  </p>
                </div>
              </CardContent>
            </Card>

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
