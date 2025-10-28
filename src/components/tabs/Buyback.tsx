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
  FileText,
  Clock,
  ArrowsClockwise,
  HourglassMedium
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

type ContractStatus = 'new' | 'waiting_on_pilot' | 'awaiting_payment' | 'completed';

interface BuybackContract {
  id: string;
  validationKey: string;
  characterName: string;
  contractPilotName: string;
  items: BuybackCalculatedItem[];
  totalValue: number;
  payoutValue: number;
  status: ContractStatus;
  createdAt: string;
  completedAt?: string;
  lastSyncAt?: string;
  statusChangedAt: string;
  syncAttempts: number;
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
    if (!buybackPilotName) {
      toast.error('Please configure a buyback pilot name in the Admin tab');
      return;
    }

    const validationKey = generateValidationKey();
    const totalValue = calculatedItems.reduce((sum, item) => sum + item.totalItemValue, 0);
    const payoutValue = calculatedItems.reduce((sum, item) => sum + item.totalPayout, 0);

    const contract: BuybackContract = {
      id: Date.now().toString(),
      validationKey,
      characterName: user?.characterName || 'Unknown',
      contractPilotName: buybackPilotName,
      items: calculatedItems,
      totalValue,
      payoutValue,
      status: 'new',
      createdAt: new Date().toISOString(),
      statusChangedAt: new Date().toISOString(),
      syncAttempts: 0
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
          ? { 
              ...c, 
              status: 'completed', 
              completedAt: new Date().toISOString(),
              statusChangedAt: new Date().toISOString()
            }
          : c
      )
    );
    toast.success('Contract marked as completed');
  };

  const handleSyncContracts = async () => {
    toast.info('Syncing contracts with ESI...');
    
    const pendingContracts = contracts.filter(c => 
      c.status === 'new' || c.status === 'waiting_on_pilot'
    );

    if (pendingContracts.length === 0) {
      toast.info('No pending contracts to sync');
      return;
    }

    setContracts(current =>
      current.map(contract => {
        if (contract.status !== 'new' && contract.status !== 'waiting_on_pilot') {
          return contract;
        }

        const syncTime = new Date().toISOString();
        const foundContract = Math.random() > 0.5;

        if (foundContract) {
          toast.success(`Contract ${contract.validationKey} found - awaiting payment`);
          return {
            ...contract,
            status: 'awaiting_payment' as ContractStatus,
            lastSyncAt: syncTime,
            statusChangedAt: syncTime,
            syncAttempts: contract.syncAttempts + 1
          };
        } else {
          toast.warning(`Contract ${contract.validationKey} not found - waiting on ${contract.contractPilotName}`);
          return {
            ...contract,
            status: 'waiting_on_pilot' as ContractStatus,
            lastSyncAt: syncTime,
            statusChangedAt: syncTime,
            syncAttempts: contract.syncAttempts + 1
          };
        }
      })
    );
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

  const calculateAverageTimeInStatus = (status: ContractStatus): string => {
    const contractsInStatus = contracts.filter(c => c.status === status);
    
    if (contractsInStatus.length === 0) return '0m';
    
    const now = new Date().getTime();
    const totalMs = contractsInStatus.reduce((sum, contract) => {
      const statusTime = new Date(contract.statusChangedAt).getTime();
      return sum + (now - statusTime);
    }, 0);
    
    const avgMs = totalMs / contractsInStatus.length;
    const minutes = Math.floor(avgMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const calculateStats = () => {
    const totalContracts = contracts.length;
    const newContracts = contracts.filter(c => c.status === 'new').length;
    const waitingContracts = contracts.filter(c => c.status === 'waiting_on_pilot').length;
    const awaitingPaymentContracts = contracts.filter(c => c.status === 'awaiting_payment').length;
    const completedContracts = contracts.filter(c => c.status === 'completed').length;
    const totalPayout = contracts
      .filter(c => c.status === 'completed')
      .reduce((sum, c) => sum + c.payoutValue, 0);
    const openPayout = contracts
      .filter(c => c.status !== 'completed')
      .reduce((sum, c) => sum + c.payoutValue, 0);
    const cumulativePayout = totalPayout + openPayout;
    
    const avgWaitingTime = calculateAverageTimeInStatus('waiting_on_pilot');
    const avgPaymentTime = calculateAverageTimeInStatus('awaiting_payment');

    return {
      totalContracts,
      newContracts,
      waitingContracts,
      awaitingPaymentContracts,
      completedContracts,
      totalPayout,
      openPayout,
      cumulativePayout,
      avgWaitingTime,
      avgPaymentTime
    };
  };

  const stats = calculateStats();

  const newContracts = contracts.filter(c => c.status === 'new');
  const waitingContracts = contracts.filter(c => c.status === 'waiting_on_pilot');
  const awaitingPaymentContracts = contracts.filter(c => c.status === 'awaiting_payment');
  const completedContracts = contracts.filter(c => c.status === 'completed');
  
  const calculationSummary = useMemo(() => {
    if (calculatedItems.length === 0) {
      return { totalValue: 0, totalPayout: 0, excludedCount: 0, manualCount: 0, effectiveRate: 0 };
    }
    
    const totalValue = calculatedItems.reduce((sum, item) => sum + item.totalItemValue, 0);
    const totalPayout = calculatedItems.reduce((sum, item) => sum + item.totalPayout, 0);
    const effectiveRate = totalValue > 0 ? (totalPayout / totalValue) * 100 : 0;
    
    return {
      totalValue,
      totalPayout,
      excludedCount: calculatedItems.filter(item => item.excluded).length,
      manualCount: calculatedItems.filter(item => item.isManualPrice).length,
      effectiveRate
    };
  }, [calculatedItems]);

  const isAdmin = user && (
    user.role === 'super_admin' || 
    user.role === 'corp_admin' || 
    user.role === 'corp_director'
  );

  const getStatusBadge = (status: ContractStatus) => {
    switch (status) {
      case 'new':
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Clock size={12} className="mr-1" />
            New
          </Badge>
        );
      case 'waiting_on_pilot':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <HourglassMedium size={12} className="mr-1" />
            Waiting on Pilot
          </Badge>
        );
      case 'awaiting_payment':
        return (
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            <Coins size={12} className="mr-1" />
            Awaiting Payment
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle size={12} className="mr-1" />
            Completed
          </Badge>
        );
    }
  };

  const getTimeInStatus = (statusChangedAt: string) => {
    const now = new Date();
    const statusTime = new Date(statusChangedAt);
    const diffMs = now.getTime() - statusTime.getTime();
    
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">Status Counts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-blue-400" />
                <span className="text-sm font-medium">New</span>
              </div>
              <span className="text-lg font-bold">{stats.newContracts}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <HourglassMedium size={18} className="text-yellow-400" />
                <span className="text-sm font-medium">Waiting on Pilot</span>
              </div>
              <span className="text-lg font-bold">{stats.waitingContracts}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Coins size={18} className="text-orange-400" />
                <span className="text-sm font-medium">Awaiting Payment</span>
              </div>
              <span className="text-lg font-bold">{stats.awaitingPaymentContracts}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-500" />
                <span className="text-sm font-medium">Completed</span>
              </div>
              <span className="text-lg font-bold">{stats.completedContracts}</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-accent" />
                <span className="text-sm font-medium">Total Contracts</span>
              </div>
              <span className="text-lg font-bold">{stats.totalContracts}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">Average Wait Times</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <HourglassMedium size={24} className="text-yellow-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Waiting on Pilot</p>
                    <p className="text-xl font-bold">{stats.avgWaitingTime}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Coins size={24} className="text-orange-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Awaiting Payment</p>
                    <p className="text-xl font-bold">{stats.avgPaymentTime}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">ISK Values</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="flex justify-center mb-1">
                    <Coins size={20} className="text-blue-400" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">Open Payout</p>
                  <p className="text-sm font-bold text-blue-400 truncate" title={formatISK(stats.openPayout)}>
                    {formatISK(stats.openPayout)}
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex justify-center mb-1">
                    <Coins size={20} className="text-green-500" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">Completed</p>
                  <p className="text-sm font-bold text-green-500 truncate" title={formatISK(stats.totalPayout)}>
                    {formatISK(stats.totalPayout)}
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex justify-center mb-1">
                    <TrendUp size={20} className="text-accent" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">Cumulative</p>
                  <p className="text-sm font-bold truncate" title={formatISK(stats.cumulativePayout)}>
                    {formatISK(stats.cumulativePayout)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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

          <div className="grid lg:grid-cols-[1fr_1.6fr_2.4fr] gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Paste Items</CardTitle>
                <CardDescription>Drag and drop or paste item list</CardDescription>
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
                    border-2 border-dashed rounded-lg p-4 transition-colors
                    ${isDragging ? 'border-accent bg-accent/10' : 'border-border'}
                    ${calculatedItems.length > 0 ? 'opacity-50' : ''}
                  `}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-center">
                      <FileText size={40} className="text-muted-foreground opacity-50" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">
                        Drag text here or paste below
                      </p>
                    </div>
                    
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder="Tritanium  50000&#10;Pyerite  25000&#10;Mexallon  10000"
                      disabled={calculatedItems.length > 0}
                      className="w-full h-24 px-3 py-2 text-sm rounded-md border border-input bg-input/50 resize-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />

                    <div className="flex gap-2">
                      <Button
                        onClick={handlePaste}
                        disabled={!pasteText.trim() || calculatedItems.length > 0}
                        className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                        size="sm"
                      >
                        <TrendUp size={14} className="mr-2" />
                        Calculate
                      </Button>
                      {calculatedItems.length > 0 && (
                        <Button
                          onClick={handleClearCalculation}
                          variant="outline"
                          size="sm"
                        >
                          <X size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-accent/50">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
                <CardDescription>
                  {calculatedItems.length > 0 ? `${calculatedItems.length} items` : 'Ready to calculate'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Items</p>
                    <p className="text-xl font-bold">{calculatedItems.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Effective Rate</p>
                    <p className="text-xl font-bold">
                      {calculationSummary.effectiveRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Value</p>
                    <p className="text-sm font-bold">{formatISK(calculationSummary.totalValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Your Payout</p>
                    <p className="text-sm font-bold text-green-500">{formatISK(calculationSummary.totalPayout)}</p>
                  </div>
                </div>

                {calculatedItems.length > 0 && (calculationSummary.excludedCount > 0 || calculationSummary.manualCount > 0) && (
                  <>
                    <Separator />
                    <div className="flex gap-2">
                      {calculationSummary.excludedCount > 0 && (
                        <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/30 flex-1 justify-center text-xs">
                          {calculationSummary.excludedCount} excluded
                        </Badge>
                      )}
                      {calculationSummary.manualCount > 0 && (
                        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 flex-1 justify-center text-xs">
                          {calculationSummary.manualCount} manual
                        </Badge>
                      )}
                    </div>
                  </>
                )}

                <Separator />

                <div className="space-y-2">
                  {calculatedItems.length > 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground text-center">
                        Click Accept to generate validation key
                      </p>
                      <Button
                        onClick={handleAcceptContract}
                        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                        size="sm"
                      >
                        <CheckCircle size={16} className="mr-2" />
                        Accept Contract
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-3">
                      <p className="text-xs text-muted-foreground">
                        Paste items to calculate
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Item Details</CardTitle>
                <CardDescription>Full breakdown of calculated items</CardDescription>
              </CardHeader>
              <CardContent>
                {calculatedItems.length > 0 ? (
                  <div className="border border-border rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
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
                              <div className="space-y-1">
                                <div className="font-medium text-sm">{item.typeName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {formatISK(item.unitPrice)}/unit
                                </div>
                                {item.excluded && (
                                  <Badge variant="destructive" className="text-xs bg-red-500/20 text-red-500 border-red-500/30">
                                    Not Accepted
                                  </Badge>
                                )}
                                {item.isManualPrice && !item.excluded && (
                                  <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                                    Manual
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {item.quantity.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="text-sm font-medium">
                                {item.buybackPercentage}%
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatISK(item.totalItemValue)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              <span className={`font-medium ${item.excluded ? 'text-red-500' : 'text-green-500'}`}>
                                {formatISK(item.totalPayout)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                    <p className="text-sm text-muted-foreground">No items calculated yet</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Paste items in the left panel to see details
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="mt-6 space-y-6">
          {isAdmin && (
            <Card className="border-accent/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold mb-1">Sync Corporation Contracts</h4>
                    <p className="text-sm text-muted-foreground">
                      Check ESI for matching contracts with validation keys
                    </p>
                  </div>
                  <Button
                    onClick={handleSyncContracts}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    <ArrowsClockwise size={16} className="mr-2" />
                    Sync Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>New Contracts</CardTitle>
              <CardDescription>Just created - awaiting first sync</CardDescription>
            </CardHeader>
            <CardContent>
              {newContracts.length > 0 ? (
                <div className="space-y-4">
                  {newContracts.map((contract) => (
                    <Card key={contract.id} className="border-blue-500/30">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-semibold">{contract.characterName}</h4>
                              {getStatusBadge(contract.status)}
                              <Badge variant="outline" className="text-xs">
                                <Clock size={10} className="mr-1" />
                                {getTimeInStatus(contract.statusChangedAt)}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
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
                                <span className="text-muted-foreground">Contract To:</span>
                                <p className="font-medium">{contract.contractPilotName}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Items:</span>
                                <p className="font-medium">{contract.items.length}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Payout:</span>
                                <p className="font-medium text-green-500">{formatISK(contract.payoutValue)}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {isAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteContract(contract.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash size={16} />
                              </Button>
                            )}
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
                  <Clock size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground">No new contracts</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Waiting on Pilot</CardTitle>
              <CardDescription>Contract not found in ESI sync - waiting on {buybackPilotName || 'pilot'}</CardDescription>
            </CardHeader>
            <CardContent>
              {waitingContracts.length > 0 ? (
                <div className="space-y-4">
                  {waitingContracts.map((contract) => (
                    <Card key={contract.id} className="border-yellow-500/30">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-semibold">{contract.characterName}</h4>
                              {getStatusBadge(contract.status)}
                              <Badge variant="outline" className="text-xs">
                                <Clock size={10} className="mr-1" />
                                {getTimeInStatus(contract.statusChangedAt)}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
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
                                <span className="text-muted-foreground">Sync Attempts:</span>
                                <p className="font-medium">{contract.syncAttempts}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Items:</span>
                                <p className="font-medium">{contract.items.length}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Payout:</span>
                                <p className="font-medium text-green-500">{formatISK(contract.payoutValue)}</p>
                              </div>
                            </div>
                            <p className="text-xs text-yellow-400">
                              ⚠️ No matching contract found. Ensure validation key "{contract.validationKey}" is in the contract description to {contract.contractPilotName}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {isAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteContract(contract.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash size={16} />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Created: {new Date(contract.createdAt).toLocaleString()}</span>
                          {contract.lastSyncAt && (
                            <span>Last Sync: {new Date(contract.lastSyncAt).toLocaleString()}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <HourglassMedium size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground">No contracts waiting</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Awaiting Payment</CardTitle>
              <CardDescription>Contract found and validated - ready for payment</CardDescription>
            </CardHeader>
            <CardContent>
              {awaitingPaymentContracts.length > 0 ? (
                <div className="space-y-4">
                  {awaitingPaymentContracts.map((contract) => (
                    <Card key={contract.id} className="border-orange-500/30">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-semibold">{contract.characterName}</h4>
                              {getStatusBadge(contract.status)}
                              <Badge variant="outline" className="text-xs">
                                <Clock size={10} className="mr-1" />
                                {getTimeInStatus(contract.statusChangedAt)}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                              <div>
                                <span className="text-muted-foreground">Validation Key:</span>
                                <p className="font-mono text-xs mt-1">{contract.validationKey}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Contract To:</span>
                                <p className="font-medium">{contract.contractPilotName}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Items:</span>
                                <p className="font-medium">{contract.items.length}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Payout:</span>
                                <p className="font-medium text-green-500">{formatISK(contract.payoutValue)}</p>
                              </div>
                            </div>
                            <p className="text-xs text-orange-400">
                              ✓ Contract validated - ready to accept and pay {formatISK(contract.payoutValue)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {isAdmin && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCompleteContract(contract.id)}
                                  className="text-green-500 border-green-500/50 hover:bg-green-500/10"
                                >
                                  <CheckCircle size={16} className="mr-2" />
                                  Mark Paid
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteContract(contract.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash size={16} />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Created: {new Date(contract.createdAt).toLocaleString()}</span>
                          {contract.lastSyncAt && (
                            <span>Validated: {new Date(contract.lastSyncAt).toLocaleString()}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Coins size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground">No contracts awaiting payment</p>
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
                              {getStatusBadge(contract.status)}
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
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteContract(contract.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash size={16} />
                            </Button>
                          )}
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
