import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useKV } from '@/lib/kv';
import { useAuth } from '@/lib/auth-provider';
import { useLMeveData } from '@/lib/LMeveDataContext';
import {
  Planet,
  Package,
  Truck,
  Plus,
  Trash2,
  CurrencyDollar,
  TrendUp,
  CheckCircle,
  Calendar,
  ArrowUp,
  ArrowDown,
  ArrowsClockwise,
  Warning,
  Gear,
  Users
} from '@phosphor-icons/react';

interface PIComponentTier {
  tier: number;
  name: string;
  components: PIComponent[];
}

interface PIComponent {
  typeId: number;
  name: string;
  tier: number;
  icon?: string;
}

interface PIAssignment {
  id: string;
  pilotId: string;
  pilotName: string;
  characterId?: string;
  componentTypeId: number;
  componentName: string;
  componentTier: number;
  monthlyQuota: number;
  payoutPerUnit: number;
  assignedDate: string;
  status: 'active' | 'paused' | 'inactive';
}

interface PIDelivery {
  id: string;
  assignmentId: string;
  pilotId: string;
  pilotName: string;
  characterId?: string;
  componentTypeId: number;
  componentName: string;
  quantity: number;
  deliveryDate: string;
  verifiedByESI: boolean;
  payoutAmount: number;
  notes?: string;
  esiItemId?: number;
  hangarDivision?: number;
}

interface PlanetaryInteractionProps {
  isMobileView?: boolean;
}

const PI_COMPONENT_TIERS: PIComponentTier[] = [
  {
    tier: 0,
    name: 'Raw Materials (Tier 0)',
    components: [
      { typeId: 2268, name: 'Aqueous Liquids', tier: 0 },
      { typeId: 2270, name: 'Autotrophs', tier: 0 },
      { typeId: 2272, name: 'Base Metals', tier: 0 },
      { typeId: 2267, name: 'Carbon Compounds', tier: 0 },
      { typeId: 2273, name: 'Complex Organisms', tier: 0 }
    ]
  },
  {
    tier: 1,
    name: 'Processed Materials (Tier 1)',
    components: [
      { typeId: 2389, name: 'Bacteria', tier: 1 },
      { typeId: 2390, name: 'Biofuels', tier: 1 },
      { typeId: 2392, name: 'Biomass', tier: 1 },
      { typeId: 2393, name: 'Chiral Structures', tier: 1 },
      { typeId: 2395, name: 'Electrolytes', tier: 1 }
    ]
  },
  {
    tier: 2,
    name: 'Refined Commodities (Tier 2)',
    components: [
      { typeId: 2312, name: 'Biocells', tier: 2 },
      { typeId: 2317, name: 'Construction Blocks', tier: 2 },
      { typeId: 2321, name: 'Consumer Electronics', tier: 2 },
      { typeId: 2327, name: 'Coolant', tier: 2 },
      { typeId: 2328, name: 'Enriched Uranium', tier: 2 },
      { typeId: 2329, name: 'Fertilizer', tier: 2 }
    ]
  },
  {
    tier: 3,
    name: 'Specialized Commodities (Tier 3)',
    components: [
      { typeId: 2867, name: 'Biotech Research Reports', tier: 3 },
      { typeId: 2329, name: 'Camera Drones', tier: 3 },
      { typeId: 2463, name: 'Robotics', tier: 3 },
      { typeId: 2463, name: 'Smartfab Units', tier: 3 },
      { typeId: 2463, name: 'Supercomputers', tier: 3 }
    ]
  },
  {
    tier: 4,
    name: 'Advanced Commodities (Tier 4)',
    components: [
      { typeId: 2463, name: 'Broadcast Node', tier: 4 },
      { typeId: 2463, name: 'Integrity Response Drones', tier: 4 },
      { typeId: 2463, name: 'Nano-Factory', tier: 4 },
      { typeId: 28974, name: 'Recursive Computing Module', tier: 4 }
    ]
  }
];

export function PlanetaryInteraction({ isMobileView = false }: PlanetaryInteractionProps) {
  const { user } = useAuth();
  const { members } = useLMeveData();
  
  const [piAssignments, setPiAssignments] = useKV<PIAssignment[]>('pi-assignments', []);
  const [piDeliveries, setPiDeliveries] = useKV<PIDelivery[]>('pi-deliveries', []);
  const [hangarItems, setHangarItems] = useState<any[]>([]);
  const [lastSyncTime, setLastSyncTime] = useKV<string>('pi-last-sync', '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [deliveryHangarConfig, setDeliveryHangarConfig] = useKV<{
    hangarDivision: number;
    hangarName: string;
    autoSync: boolean;
    syncInterval: number;
  }>('pi-delivery-hangar-config', {
    hangarDivision: 2,
    hangarName: 'Industry Deliveries',
    autoSync: false,
    syncInterval: 60
  });
  const [piPayoutRates, setPiPayoutRates] = useKV<{
    [key: number]: {
      typeId: number;
      componentName: string;
      tier: number;
      defaultRate: number;
      lastUpdated: string;
    }
  }>('pi-payout-rates', {});
  
  const [activeTab, setActiveTab] = useState<'my-pi' | 'management' | 'administration'>('my-pi');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  
  const [newAssignment, setNewAssignment] = useState({
    pilotId: '',
    componentTypeId: 0,
    componentName: '',
    componentTier: 0,
    monthlyQuota: 0,
    payoutPerUnit: 0
  });
  
  const [newDelivery, setNewDelivery] = useState({
    assignmentId: '',
    quantity: 0,
    notes: ''
  });
  
  const [editingRates, setEditingRates] = useState<{[key: number]: number}>({});

  useEffect(() => {
    if (piAssignments.length === 0) {
      const sampleAssignments: PIAssignment[] = [
        {
          id: 'pi-001',
          pilotId: 'pilot-001',
          pilotName: 'John Doe',
          characterId: '95465499',
          componentTypeId: 2463,
          componentName: 'Robotics',
          componentTier: 3,
          monthlyQuota: 10000,
          payoutPerUnit: 45000,
          assignedDate: new Date(Date.now() - 30 * 86400000).toISOString(),
          status: 'active'
        },
        {
          id: 'pi-002',
          pilotId: 'pilot-002',
          pilotName: 'Jane Smith',
          characterId: '95465500',
          componentTypeId: 2328,
          componentName: 'Enriched Uranium',
          componentTier: 2,
          monthlyQuota: 25000,
          payoutPerUnit: 8500,
          assignedDate: new Date(Date.now() - 45 * 86400000).toISOString(),
          status: 'active'
        },
        {
          id: 'pi-003',
          pilotId: 'pilot-003',
          pilotName: 'Bob Johnson',
          characterId: '95465501',
          componentTypeId: 2312,
          componentName: 'Mechanical Parts',
          componentTier: 2,
          monthlyQuota: 50000,
          payoutPerUnit: 1200,
          assignedDate: new Date(Date.now() - 60 * 86400000).toISOString(),
          status: 'active'
        }
      ];
      
      setPiAssignments(sampleAssignments);
      
      const sampleDeliveries: PIDelivery[] = [
        {
          id: 'del-001',
          assignmentId: 'pi-001',
          pilotId: 'pilot-001',
          pilotName: 'John Doe',
          componentTypeId: 2463,
          componentName: 'Robotics',
          quantity: 7500,
          deliveryDate: new Date(Date.now() - 15 * 86400000).toISOString(),
          verifiedByESI: true,
          payoutAmount: 337500000
        },
        {
          id: 'del-002',
          assignmentId: 'pi-001',
          pilotId: 'pilot-001',
          pilotName: 'John Doe',
          componentTypeId: 2463,
          componentName: 'Robotics',
          quantity: 2500,
          deliveryDate: new Date(Date.now() - 2 * 86400000).toISOString(),
          verifiedByESI: true,
          payoutAmount: 112500000
        },
        {
          id: 'del-003',
          assignmentId: 'pi-002',
          pilotId: 'pilot-002',
          pilotName: 'Jane Smith',
          componentTypeId: 2328,
          componentName: 'Enriched Uranium',
          quantity: 18000,
          deliveryDate: new Date(Date.now() - 10 * 86400000).toISOString(),
          verifiedByESI: true,
          payoutAmount: 153000000
        },
        {
          id: 'del-004',
          assignmentId: 'pi-003',
          pilotId: 'pilot-003',
          pilotName: 'Bob Johnson',
          componentTypeId: 2312,
          componentName: 'Mechanical Parts',
          quantity: 45000,
          deliveryDate: new Date(Date.now() - 5 * 86400000).toISOString(),
          verifiedByESI: true,
          payoutAmount: 54000000
        }
      ];
      
      setPiDeliveries(sampleDeliveries);
    }
  }, []);

  const getUserAssignments = () => {
    return piAssignments.filter(assignment => 
      assignment.pilotName === user?.characterName
    );
  };

  const getDeliveriesForAssignment = (assignmentId: string) => {
    return piDeliveries.filter(d => d.assignmentId === assignmentId);
  };

  const getDeliveriesThisMonth = (assignmentId: string) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return piDeliveries.filter(d => 
      d.assignmentId === assignmentId && 
      new Date(d.deliveryDate) >= startOfMonth
    );
  };

  const getTotalDelivered = (assignmentId: string) => {
    return getDeliveriesForAssignment(assignmentId)
      .reduce((sum, d) => sum + d.quantity, 0);
  };

  const getMonthlyDelivered = (assignmentId: string) => {
    return getDeliveriesThisMonth(assignmentId)
      .reduce((sum, d) => sum + d.quantity, 0);
  };

  const getTotalPayout = (assignmentId: string) => {
    return getDeliveriesForAssignment(assignmentId)
      .reduce((sum, d) => sum + d.payoutAmount, 0);
  };

  const getMonthlyPayout = (assignmentId: string) => {
    return getDeliveriesThisMonth(assignmentId)
      .reduce((sum, d) => sum + d.payoutAmount, 0);
  };

  const formatISK = (amount: number) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '0 ISK';
    if (amount >= 1000000000) {
      return `${(amount / 1000000000).toFixed(2)}B ISK`;
    } else if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M ISK`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K ISK`;
    }
    return `${amount.toLocaleString()} ISK`;
  };

  const formatNumber = (num: number) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toLocaleString();
  };

  const syncHangarDeliveries = async () => {
    if (!user?.accessToken || !user?.corporationId) {
      toast.error('ESI authentication required to sync deliveries');
      return;
    }

    setIsSyncing(true);
    
    try {
      const corporationId = user.corporationId;
      const accessToken = user.accessToken;

      const assetsResponse = await fetch(
        `https://esi.evetech.net/latest/corporations/${corporationId}/assets/?datasource=tranquility`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!assetsResponse.ok) {
        throw new Error(`Failed to fetch corporation assets: ${assetsResponse.statusText}`);
      }

      const allAssets = await assetsResponse.json();

      let deliveryDivision = deliveryHangarConfig.hangarDivision;
      
      const divisionsResponse = await fetch(
        `https://esi.evetech.net/latest/corporations/${corporationId}/divisions/?datasource=tranquility`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (divisionsResponse.ok) {
        const divisions = await divisionsResponse.json();
        const deliveryHangar = divisions.hangar?.find((d: any) => 
          d.division === deliveryHangarConfig.hangarDivision ||
          (d.name?.toLowerCase().includes('industry') && 
           d.name?.toLowerCase().includes('deliveries'))
        );
        
        if (deliveryHangar) {
          deliveryDivision = deliveryHangar.division;
          console.log('📦 Found delivery hangar:', deliveryHangar.name, 'Division:', deliveryDivision);
          
          if (deliveryHangar.name !== deliveryHangarConfig.hangarName) {
            setDeliveryHangarConfig(prev => ({
              ...prev,
              hangarName: deliveryHangar.name
            }));
          }
        } else {
          console.log('⚠️ Using configured division:', deliveryDivision);
        }
      }

      const deliveryAssets = allAssets.filter((asset: any) => {
        const locationFlag = asset.location_flag || '';
        return locationFlag === `CorpSAG${deliveryDivision}`;
      });

      console.log('📦 Assets in delivery hangar:', deliveryAssets.length);

      const newDeliveries: PIDelivery[] = [];

      for (const asset of deliveryAssets) {
        const typeId = asset.type_id;
        const quantity = asset.quantity || 1;
        
        const assignment = piAssignments.find(a => a.componentTypeId === typeId && a.status === 'active');
        
        if (assignment) {
          const existingDelivery = piDeliveries.find(d => d.esiItemId === asset.item_id);
          
          if (!existingDelivery) {
            const delivery: PIDelivery = {
              id: `esi-del-${Date.now()}-${asset.item_id}`,
              assignmentId: assignment.id,
              pilotId: assignment.pilotId,
              pilotName: assignment.pilotName,
              characterId: assignment.characterId,
              componentTypeId: typeId,
              componentName: assignment.componentName,
              quantity: quantity,
              deliveryDate: new Date().toISOString(),
              verifiedByESI: true,
              payoutAmount: quantity * assignment.payoutPerUnit,
              esiItemId: asset.item_id,
              hangarDivision: deliveryDivision,
              notes: `Auto-detected from ${deliveryHangarConfig.hangarName} (Division ${deliveryDivision})`
            };
            
            newDeliveries.push(delivery);
            console.log('✅ New delivery detected:', delivery.componentName, quantity, 'for', assignment.pilotName);
          }
        }
      }

      if (newDeliveries.length > 0) {
        setPiDeliveries(prev => [...prev, ...newDeliveries]);
        toast.success(`Synced ${newDeliveries.length} new deliveries from hangar`);
      } else {
        toast.info('No new deliveries found in hangar');
      }

      setLastSyncTime(new Date().toISOString());
      setHangarItems(deliveryAssets);
      
    } catch (error) {
      console.error('❌ Error syncing hangar deliveries:', error);
      toast.error('Failed to sync deliveries. Check console for details.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateAssignment = () => {
    if (!newAssignment.pilotId || !newAssignment.componentName || newAssignment.monthlyQuota <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    const pilot = members?.find(m => m.characterId === newAssignment.pilotId);
    
    const assignment: PIAssignment = {
      id: `pi-${Date.now()}`,
      pilotId: newAssignment.pilotId,
      pilotName: pilot?.characterName || 'Unknown Pilot',
      characterId: newAssignment.pilotId,
      componentTypeId: newAssignment.componentTypeId,
      componentName: newAssignment.componentName,
      componentTier: newAssignment.componentTier,
      monthlyQuota: newAssignment.monthlyQuota,
      payoutPerUnit: newAssignment.payoutPerUnit,
      assignedDate: new Date().toISOString(),
      status: 'active'
    };

    setPiAssignments(prev => [...prev, assignment]);
    
    setNewAssignment({
      pilotId: '',
      componentTypeId: 0,
      componentName: '',
      componentTier: 0,
      monthlyQuota: 0,
      payoutPerUnit: 0
    });
    
    setShowAssignDialog(false);
    toast.success(`PI assignment created for ${pilot?.characterName}`);
  };

  const handleRecordDelivery = () => {
    if (!newDelivery.assignmentId || newDelivery.quantity <= 0) {
      toast.error('Please select an assignment and enter a valid quantity');
      return;
    }

    const assignment = piAssignments.find(a => a.id === newDelivery.assignmentId);
    if (!assignment) {
      toast.error('Assignment not found');
      return;
    }

    const delivery: PIDelivery = {
      id: `del-${Date.now()}`,
      assignmentId: newDelivery.assignmentId,
      pilotId: assignment.pilotId,
      pilotName: assignment.pilotName,
      componentTypeId: assignment.componentTypeId,
      componentName: assignment.componentName,
      quantity: newDelivery.quantity,
      deliveryDate: new Date().toISOString(),
      verifiedByESI: false,
      payoutAmount: newDelivery.quantity * assignment.payoutPerUnit,
      notes: newDelivery.notes
    };

    setPiDeliveries(prev => [...prev, delivery]);
    
    setNewDelivery({
      assignmentId: '',
      quantity: 0,
      notes: ''
    });
    
    setShowDeliveryDialog(false);
    toast.success(`Delivery recorded: ${formatNumber(delivery.quantity)} ${assignment.componentName} - ${formatISK(delivery.payoutAmount)}`);
  };

  const handleDeleteAssignment = (assignmentId: string) => {
    if (confirm('Are you sure you want to delete this assignment? This will also remove all associated deliveries.')) {
      setPiAssignments(prev => prev.filter(a => a.id !== assignmentId));
      setPiDeliveries(prev => prev.filter(d => d.assignmentId !== assignmentId));
      toast.success('Assignment deleted');
    }
  };

  const canManage = user?.role === 'ceo' || user?.role === 'director' || user?.role === 'manager';

  const userAssignments = getUserAssignments();

  const totalMonthlyPayout = piDeliveries
    .filter(d => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return new Date(d.deliveryDate) >= startOfMonth;
    })
    .reduce((sum, d) => sum + d.payoutAmount, 0);

  const totalAllTimePayout = piDeliveries.reduce((sum, d) => sum + d.payoutAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Planet size={32} className="text-accent" />
            Planetary Interaction
          </h1>
          <p className="text-muted-foreground mt-1">
            Track PI component assignments and deliveries via Industry Deliveries hangar
          </p>
        </div>
        
        <div className="flex gap-2">
          {user?.accessToken && (
            <Button 
              onClick={syncHangarDeliveries} 
              variant="outline"
              disabled={isSyncing}
              className="border-accent/30 hover:bg-accent/10"
            >
              <ArrowsClockwise size={16} className={`mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Hangar'}
            </Button>
          )}
          {canManage && (
            <Button onClick={() => setShowAssignDialog(true)} className="bg-accent hover:bg-accent/90">
              <Plus size={16} className="mr-2" />
              Assign PI
            </Button>
          )}
          <Button onClick={() => setShowDeliveryDialog(true)} variant="outline">
            <Truck size={16} className="mr-2" />
            Manual Entry
          </Button>
        </div>
      </div>

      {!user?.accessToken && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Warning size={20} className="text-yellow-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-yellow-500">ESI Authentication Required</p>
                <p className="text-sm text-muted-foreground mt-1">
                  To automatically track PI deliveries from the Industry Deliveries hangar, 
                  please log in with EVE SSO. This requires corporation asset read permissions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {user?.accessToken && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle size={20} className="text-accent mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-accent">Automatic Delivery Tracking Enabled</p>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>How it works:</strong> When pilots place PI components in the 
                  "Industry Deliveries" corporation hangar, click "Sync Hangar" to automatically 
                  detect and record deliveries. The system matches items to active assignments 
                  and calculates payouts automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {lastSyncTime && (
        <div className="text-sm text-muted-foreground">
          Last synced: {new Date(lastSyncTime).toLocaleString()}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Assignments</p>
                <p className="text-2xl font-bold">{piAssignments.filter(a => a.status === 'active').length}</p>
              </div>
              <Package size={24} className="text-accent" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Deliveries</p>
                <p className="text-2xl font-bold">{piDeliveries.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {piDeliveries.filter(d => d.verifiedByESI).length} ESI verified
                </p>
              </div>
              <Truck size={24} className="text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-lg font-bold">{formatISK(totalMonthlyPayout)}</p>
              </div>
              <Calendar size={24} className="text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">All Time</p>
                <p className="text-lg font-bold">{formatISK(totalAllTimePayout)}</p>
              </div>
              <TrendUp size={24} className="text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="my-pi">My PI</TabsTrigger>
          {canManage && <TabsTrigger value="management">Overview</TabsTrigger>}
          {canManage && <TabsTrigger value="administration">Administration</TabsTrigger>}
        </TabsList>

        <TabsContent value="my-pi" className="space-y-6 mt-6">
          {userAssignments.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Planet size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No PI Assignments</h3>
                <p className="text-muted-foreground">
                  You don't have any planetary interaction assignments yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {userAssignments.map((assignment) => {
                const monthlyDelivered = getMonthlyDelivered(assignment.id);
                const totalDelivered = getTotalDelivered(assignment.id);
                const monthlyPayout = getMonthlyPayout(assignment.id);
                const totalPayout = getTotalPayout(assignment.id);
                const characterImageUrl = assignment.characterId 
                  ? `https://images.evetech.net/characters/${assignment.characterId}/portrait?size=128`
                  : null;

                return (
                  <Card key={assignment.id}>
                    <CardHeader>
                      <div className="flex items-center gap-4">
                        {characterImageUrl && (
                          <img 
                            src={characterImageUrl}
                            alt={assignment.pilotName}
                            className="w-16 h-16 rounded-full border-2 border-accent/30"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            <Package size={20} />
                            {assignment.componentName}
                            <Badge variant="secondary" className="ml-2">
                              Tier {assignment.componentTier}
                            </Badge>
                            {getDeliveriesForAssignment(assignment.id).some(d => d.verifiedByESI) && (
                              <Badge variant="secondary" className="ml-2 bg-green-400/20 text-green-400 border-green-400/30">
                                <CheckCircle size={12} className="mr-1" />
                                ESI Verified
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            Assigned on {new Date(assignment.assignedDate).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge 
                          className={
                            assignment.status === 'active' 
                              ? 'bg-green-400/20 text-green-400 border-green-400/30' 
                              : 'bg-gray-400/20 text-gray-400 border-gray-400/30'
                          }
                        >
                          {assignment.status.toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">This Month</p>
                          <p className="text-lg font-bold text-accent">{formatNumber(monthlyDelivered)}</p>
                          <p className="text-xs text-muted-foreground">
                            / {formatNumber(assignment.monthlyQuota)} quota
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">All Time</p>
                          <p className="text-lg font-bold">{formatNumber(totalDelivered)}</p>
                          <p className="text-xs text-muted-foreground">total delivered</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Monthly Income</p>
                          <p className="text-lg font-bold text-accent">{formatISK(monthlyPayout)}</p>
                          <p className="text-xs text-muted-foreground">
                            @ {formatISK(assignment.payoutPerUnit)}/unit
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Income</p>
                          <p className="text-lg font-bold">{formatISK(totalPayout)}</p>
                          <p className="text-xs text-muted-foreground">all time</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="management" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All PI Assignments</CardTitle>
                <CardDescription>
                  Manage planetary interaction assignments across the corporation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {piAssignments.map((assignment) => {
                    const monthlyDelivered = getMonthlyDelivered(assignment.id);
                    const totalDelivered = getTotalDelivered(assignment.id);
                    const monthlyPayout = getMonthlyPayout(assignment.id);
                    const totalPayout = getTotalPayout(assignment.id);
                    const characterImageUrl = assignment.characterId 
                      ? `https://images.evetech.net/characters/${assignment.characterId}/portrait?size=64`
                      : null;

                    return (
                      <div key={assignment.id} className="flex items-center gap-4 p-4 border border-border rounded-lg">
                        <div className="flex items-center gap-3 flex-1">
                          {characterImageUrl && (
                            <img 
                              src={characterImageUrl}
                              alt={assignment.pilotName}
                              className="w-12 h-12 rounded-full border-2 border-accent/30"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-medium">{assignment.pilotName}</p>
                            <p className="text-sm text-muted-foreground">
                              {assignment.componentName} (Tier {assignment.componentTier})
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-6 text-sm">
                          <div>
                            <p className="text-muted-foreground">Month</p>
                            <p className="font-bold">{formatNumber(monthlyDelivered)}</p>
                            <p className="text-xs text-muted-foreground">
                              / {formatNumber(assignment.monthlyQuota)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total</p>
                            <p className="font-bold">{formatNumber(totalDelivered)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Payout</p>
                            <p className="font-bold text-accent">{formatISK(totalPayout)}</p>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteAssignment(assignment.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Deliveries</CardTitle>
                <CardDescription>
                  Latest PI deliveries from all pilots
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {piDeliveries
                    .sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime())
                    .slice(0, 20)
                    .map((delivery) => {
                      const characterImageUrl = delivery.characterId 
                        ? `https://images.evetech.net/characters/${delivery.characterId}/portrait?size=32`
                        : null;

                      return (
                        <div key={delivery.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors">
                          {characterImageUrl && (
                            <img 
                              src={characterImageUrl}
                              alt={delivery.pilotName}
                              className="w-8 h-8 rounded-full border border-accent/30"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{delivery.pilotName}</p>
                              {delivery.verifiedByESI && (
                                <Badge variant="secondary" className="text-xs bg-green-400/20 text-green-400 border-green-400/30">
                                  <CheckCircle size={10} className="mr-1" />
                                  ESI
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {delivery.componentName} × {formatNumber(delivery.quantity)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-accent">{formatISK(delivery.payoutAmount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(delivery.deliveryDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  {piDeliveries.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No deliveries recorded yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="administration" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gear size={20} />
                  Delivery Hangar Configuration
                </CardTitle>
                <CardDescription>
                  Configure which corporation hangar division to monitor for PI deliveries
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Hangar Division</Label>
                    <Select 
                      value={deliveryHangarConfig.hangarDivision.toString()}
                      onValueChange={(value) => setDeliveryHangarConfig(prev => ({
                        ...prev,
                        hangarDivision: parseInt(value)
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7].map(div => (
                          <SelectItem key={div} value={div.toString()}>
                            Division {div}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Corporation hangar division number to monitor
                    </p>
                  </div>

                  <div>
                    <Label>Hangar Name</Label>
                    <Input
                      value={deliveryHangarConfig.hangarName}
                      onChange={(e) => setDeliveryHangarConfig(prev => ({
                        ...prev,
                        hangarName: e.target.value
                      }))}
                      placeholder="e.g., Industry Deliveries"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Display name for reference
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-accent/5 border border-accent/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={20} className="text-accent mt-0.5" />
                    <div>
                      <p className="font-medium text-accent">Current Configuration</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Monitoring <strong>Division {deliveryHangarConfig.hangarDivision}</strong> ({deliveryHangarConfig.hangarName}) 
                        for PI component deliveries. Items placed in this hangar will be automatically detected when "Sync Hangar" is clicked.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={() => {
                      toast.success('Hangar configuration saved');
                    }}
                    className="bg-accent hover:bg-accent/90"
                  >
                    Save Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CurrencyDollar size={20} />
                  PI Component Payout Rates
                </CardTitle>
                <CardDescription>
                  Set default payout rates per unit for PI components (can be overridden per assignment)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {PI_COMPONENT_TIERS.map((tier) => (
                    <div key={tier.tier}>
                      <h4 className="font-semibold text-sm mb-3 text-muted-foreground">{tier.name}</h4>
                      <div className="grid gap-3">
                        {tier.components.map((component) => {
                          const existingRate = piPayoutRates[component.typeId];
                          const editingRate = editingRates[component.typeId] ?? (existingRate?.defaultRate || 0);
                          
                          return (
                            <div key={component.typeId} className="flex items-center gap-4 p-3 border border-border rounded-lg">
                              <div className="flex-1">
                                <p className="font-medium">{component.name}</p>
                                <p className="text-xs text-muted-foreground">Type ID: {component.typeId}</p>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={editingRate}
                                  onChange={(e) => setEditingRates(prev => ({
                                    ...prev,
                                    [component.typeId]: parseInt(e.target.value) || 0
                                  }))}
                                  placeholder="ISK per unit"
                                  className="w-32"
                                />
                                <span className="text-sm text-muted-foreground">ISK/unit</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setPiPayoutRates(prev => ({
                                      ...prev,
                                      [component.typeId]: {
                                        typeId: component.typeId,
                                        componentName: component.name,
                                        tier: component.tier,
                                        defaultRate: editingRate,
                                        lastUpdated: new Date().toISOString()
                                      }
                                    }));
                                    toast.success(`Rate updated for ${component.name}`);
                                  }}
                                  disabled={editingRate === (existingRate?.defaultRate || 0)}
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users size={20} />
                  Pilot Assignment Management
                </CardTitle>
                <CardDescription>
                  Assign PI components to corporation pilots for production and delivery tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      {piAssignments.filter(a => a.status === 'active').length} active assignments
                    </p>
                    <Button 
                      onClick={() => setShowAssignDialog(true)}
                      className="bg-accent hover:bg-accent/90"
                    >
                      <Plus size={16} className="mr-2" />
                      New Assignment
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {piAssignments.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Package size={48} className="mx-auto mb-3 opacity-50" />
                        <p>No PI assignments created yet</p>
                        <p className="text-sm mt-1">Click "New Assignment" to assign PI components to pilots</p>
                      </div>
                    ) : (
                      piAssignments.map((assignment) => {
                        const monthlyDelivered = getMonthlyDelivered(assignment.id);
                        const monthlyProgress = assignment.monthlyQuota > 0 
                          ? (monthlyDelivered / assignment.monthlyQuota) * 100 
                          : 0;
                        const characterImageUrl = assignment.characterId 
                          ? `https://images.evetech.net/characters/${assignment.characterId}/portrait?size=64`
                          : null;

                        return (
                          <div key={assignment.id} className="p-4 border border-border rounded-lg">
                            <div className="flex items-start gap-4">
                              {characterImageUrl && (
                                <img 
                                  src={characterImageUrl}
                                  alt={assignment.pilotName}
                                  className="w-12 h-12 rounded-full border-2 border-accent/30"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              )}
                              
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <p className="font-medium">{assignment.pilotName}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {assignment.componentName} (Tier {assignment.componentTier})
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      className={
                                        assignment.status === 'active' 
                                          ? 'bg-green-400/20 text-green-400 border-green-400/30' 
                                          : 'bg-gray-400/20 text-gray-400 border-gray-400/30'
                                      }
                                    >
                                      {assignment.status.toUpperCase()}
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setPiAssignments(prev => 
                                          prev.map(a => 
                                            a.id === assignment.id 
                                              ? { ...a, status: a.status === 'active' ? 'paused' : 'active' } 
                                              : a
                                          )
                                        );
                                        toast.success(`Assignment ${assignment.status === 'active' ? 'paused' : 'activated'}`);
                                      }}
                                    >
                                      {assignment.status === 'active' ? 'Pause' : 'Activate'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDeleteAssignment(assignment.id)}
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-4 gap-4 mb-3">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Monthly Quota</p>
                                    <p className="font-medium">{formatNumber(assignment.monthlyQuota)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Delivered</p>
                                    <p className="font-medium text-accent">{formatNumber(monthlyDelivered)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Rate</p>
                                    <p className="font-medium">{formatISK(assignment.payoutPerUnit)}/unit</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Monthly Payout</p>
                                    <p className="font-medium text-accent">{formatISK(getMonthlyPayout(assignment.id))}</p>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Progress</span>
                                    <span>{monthlyProgress.toFixed(1)}%</span>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full transition-all ${
                                        monthlyProgress >= 100 
                                          ? 'bg-green-400' 
                                          : monthlyProgress >= 75 
                                          ? 'bg-accent' 
                                          : 'bg-yellow-400'
                                      }`}
                                      style={{ width: `${Math.min(monthlyProgress, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendUp size={20} />
                  Income Integration
                </CardTitle>
                <CardDescription>
                  PI deliveries are automatically integrated with the Income tab
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">This Month</p>
                    <p className="text-2xl font-bold text-accent">{formatISK(totalMonthlyPayout)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {piDeliveries.filter(d => {
                        const now = new Date();
                        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                        return new Date(d.deliveryDate) >= startOfMonth;
                      }).length} deliveries
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">All Time</p>
                    <p className="text-2xl font-bold">{formatISK(totalAllTimePayout)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {piDeliveries.length} deliveries
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">ESI Verified</p>
                    <p className="text-2xl font-bold text-green-400">
                      {piDeliveries.filter(d => d.verifiedByESI).length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {((piDeliveries.filter(d => d.verifiedByESI).length / Math.max(piDeliveries.length, 1)) * 100).toFixed(0)}% verified
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Active Pilots</p>
                    <p className="text-2xl font-bold">{new Set(piAssignments.filter(a => a.status === 'active').map(a => a.pilotId)).size}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      producing PI
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-accent/5 border border-accent/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Integration:</strong> All PI deliveries are automatically tracked in the Income tab 
                    under the "Planetary Interaction" category. Payouts are calculated based on assignment rates 
                    and delivery quantities. ESI-verified deliveries are marked as such for audit purposes.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign PI Component</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pilot</Label>
              <Select 
                value={newAssignment.pilotId} 
                onValueChange={(value) => setNewAssignment(prev => ({ ...prev, pilotId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pilot" />
                </SelectTrigger>
                <SelectContent>
                  {members?.map((member) => (
                    <SelectItem key={member.characterId} value={member.characterId}>
                      {member.characterName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>PI Component</Label>
              <Select 
                value={newAssignment.componentName}
                onValueChange={(value) => {
                  const [tier, name] = value.split('|');
                  const component = PI_COMPONENT_TIERS
                    .find(t => t.tier === parseInt(tier))
                    ?.components.find(c => c.name === name);
                  
                  if (component) {
                    const defaultRate = piPayoutRates[component.typeId]?.defaultRate || 0;
                    setNewAssignment(prev => ({
                      ...prev,
                      componentTypeId: component.typeId,
                      componentName: component.name,
                      componentTier: component.tier,
                      payoutPerUnit: defaultRate
                    }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select component" />
                </SelectTrigger>
                <SelectContent>
                  {PI_COMPONENT_TIERS.map((tier) => (
                    <React.Fragment key={tier.tier}>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                        {tier.name}
                      </div>
                      {tier.components.map((component) => (
                        <SelectItem 
                          key={component.typeId} 
                          value={`${tier.tier}|${component.name}`}
                        >
                          {component.name}
                          {piPayoutRates[component.typeId] && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({formatISK(piPayoutRates[component.typeId].defaultRate)}/unit)
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
              {newAssignment.componentTypeId > 0 && piPayoutRates[newAssignment.componentTypeId] && (
                <p className="text-xs text-muted-foreground mt-1">
                  Default rate: {formatISK(piPayoutRates[newAssignment.componentTypeId].defaultRate)}/unit
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Monthly Quota</Label>
                <Input
                  type="number"
                  value={newAssignment.monthlyQuota}
                  onChange={(e) => setNewAssignment(prev => ({ 
                    ...prev, 
                    monthlyQuota: parseInt(e.target.value) || 0 
                  }))}
                  placeholder="e.g., 10000"
                />
              </div>
              <div>
                <Label>Payout Per Unit (ISK)</Label>
                <Input
                  type="number"
                  value={newAssignment.payoutPerUnit}
                  onChange={(e) => setNewAssignment(prev => ({ 
                    ...prev, 
                    payoutPerUnit: parseInt(e.target.value) || 0 
                  }))}
                  placeholder="e.g., 45000"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAssignment}>
                Create Assignment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeliveryDialog} onOpenChange={setShowDeliveryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual PI Delivery Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Deliveries placed in the Industry Deliveries hangar will be 
                automatically detected and verified when you click "Sync Hangar". Manual entries are 
                for tracking deliveries outside the ESI system.
              </p>
            </div>
            <div>
              <Label>Assignment</Label>
              <Select 
                value={newDelivery.assignmentId}
                onValueChange={(value) => setNewDelivery(prev => ({ ...prev, assignmentId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignment" />
                </SelectTrigger>
                <SelectContent>
                  {userAssignments.map((assignment) => (
                    <SelectItem key={assignment.id} value={assignment.id}>
                      {assignment.componentName} ({assignment.pilotName})
                    </SelectItem>
                  ))}
                  {canManage && piAssignments.filter(a => !userAssignments.find(u => u.id === a.id)).map((assignment) => (
                    <SelectItem key={assignment.id} value={assignment.id}>
                      {assignment.componentName} ({assignment.pilotName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantity Delivered</Label>
              <Input
                type="number"
                value={newDelivery.quantity}
                onChange={(e) => setNewDelivery(prev => ({ 
                  ...prev, 
                  quantity: parseInt(e.target.value) || 0 
                }))}
                placeholder="e.g., 1000"
              />
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Input
                value={newDelivery.notes}
                onChange={(e) => setNewDelivery(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Delivery notes..."
              />
            </div>

            {newDelivery.assignmentId && newDelivery.quantity > 0 && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Payout Preview</p>
                <p className="text-2xl font-bold text-accent">
                  {formatISK(
                    newDelivery.quantity * 
                    (piAssignments.find(a => a.id === newDelivery.assignmentId)?.payoutPerUnit || 0)
                  )}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowDeliveryDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleRecordDelivery}>
                Record Delivery
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
