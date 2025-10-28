import React, { useState } from 'react';
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
  Eye
} from '@phosphor-icons/react';
import { useKV } from '@github/spark/hooks';
import { toast } from 'sonner';

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

interface BuybackProps {
  isMobileView?: boolean;
}

export function Buyback({ isMobileView }: BuybackProps) {
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
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="calculator">Calculator</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
