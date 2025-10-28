import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoginPrompt } from '@/components/LoginPrompt';
import { useKV } from '@github/spark/hooks';
import { useAuth } from '@/lib/auth-provider';
import { 
  Factory, 
  Plus, 
  Clock, 
  Package, 
  TrendUp,
  Pause,
  Play,
  Stop,
  Eye,
  Calendar,
  Wrench,
  Copy,
  Star,
  CheckCircle,
  ArrowClockwise,
  Globe,
  Users,
  Database,
  Warning
} from '@phosphor-icons/react';
import { ManufacturingJob, Blueprint, ProductionPlan, ManufacturingTask, Member } from '@/lib/types';
import { JobDetailsDialog } from '@/components/manufacturing/JobDetailsDialog';
import { AdministrationView } from '@/components/manufacturing/AdministrationView';
import { JobActivityView } from '@/components/manufacturing/JobActivityView';
import { AssignTaskView } from '@/components/manufacturing/AssignTaskView';
import { UnassignedJobsView } from '@/components/manufacturing/UnassignedJobsView';
import { BlueprintLibrary } from '@/components/manufacturing/BlueprintLibrary';
import { StationInfoPopup } from '@/components/popups/StationInfoPopup';
import { toast } from 'sonner';
import { ESIDataFetchService } from '@/lib/esi-data-service';
import { getDatabaseService } from '@/lib/database';

interface ManufacturingProps {
  onLoginClick?: () => void;
  isMobileView?: boolean;
}

export function Manufacturing({ onLoginClick, isMobileView }: ManufacturingProps) {
  const { user, getRegisteredCorporations, getESIAccessToken } = useAuth();
  const [activeJobs, setActiveJobs] = useKV<ManufacturingJob[]>('manufacturing-jobs', []);
  const [blueprints, setBlueprints] = useKV<Blueprint[]>('blueprints-library', []);
  const [productionPlans, setProductionPlans] = useKV<ProductionPlan[]>('production-plans', []);
  const [manufacturingTasks, setManufacturingTasks] = useKV<ManufacturingTask[]>('manufacturing-tasks', []);
  const [members] = useKV<Member[]>('corp-members', []);
  const [payModifiers, setPayModifiers] = useKV('manufacturing-pay-modifiers', {
    rush: 1.25,
    specialDelivery: 1.15,
    excessWork: 1.1
  });

  const [payRatesPerHour, setPayRatesPerHour] = useKV('manufacturing-pay-rates', {
    manufacturing: 50000,
    copying: 25000,
    reactions: 75000,
    research: 30000,
    invention: 40000
  });

  const [currentView, setCurrentView] = useState<'administration' | 'jobs' | 'assign-task' | 'unassigned' | 'blueprints'>('administration');
  const [newJobDialogOpen, setNewJobDialogOpen] = useState(false);
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ManufacturingJob | null>(null);
  const [editingTask, setEditingTask] = useState<ManufacturingTask | null>(null);
  const [taskFilter, setTaskFilter] = useState<'my-tasks' | 'all-tasks'>('my-tasks');
  const [selectedStation, setSelectedStation] = useState<{ id: number; name: string } | null>(null);
  
  const [isLoadingESIData, setIsLoadingESIData] = useState(false);
  const [esiDataLastSync, setESIDataLastSync] = useKV<string | null>('manufacturing-esi-last-sync', null);
  const [useMockData, setUseMockData] = useState(true);
  
  // Handler for station click - show station popup
  const handleStationClick = (stationId: number, stationName?: string) => {
    const tasks = manufacturingTasks || [];
    const task = tasks.find(t => t.stationId === stationId);
    const finalStationName = stationName || task?.stationName || `Station ${stationId}`;
    
    setSelectedStation({
      id: stationId,
      name: finalStationName
    });
  };

  const handleViewAssetsFromStation = async () => {
    if (!selectedStation) return;
    
    try {
      await spark.kv.set('assets-selected-station', selectedStation.id);
      await spark.kv.set('active-tab', 'assets');
      
      setSelectedStation(null);
      
      toast.success('Navigating to Assets tab...', {
        duration: 1500
      });
      
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (error) {
      console.error('Error navigating to assets:', error);
      toast.error('Failed to navigate to Assets tab');
    }
  };

  // Load manufacturing data from ESI/Database
  const loadESIManufacturingData = async () => {
    if (!user) {
      console.log('❌ No user authenticated - cannot load ESI data');
      return;
    }

    const registeredCorps = getRegisteredCorporations();
    if (registeredCorps.length === 0) {
      console.log('⚠️ No registered corporations - using mock data');
      setUseMockData(true);
      return;
    }

    setIsLoadingESIData(true);
    setUseMockData(false);

    try {
      const dbService = getDatabaseService();
      const esiService = new ESIDataFetchService();

      // Try to load from database first (cached data)
      console.log('📥 Loading manufacturing jobs from database...');
      const dbJobs = await dbService.getIndustryJobs();
      
      if (dbJobs && dbJobs.length > 0) {
        console.log(`✅ Loaded ${dbJobs.length} industry jobs from database`);
        
        // Convert database jobs to manufacturing tasks
        const tasks = dbJobs.map(job => convertESIJobToTask(job));
        setManufacturingTasks(tasks);
        setESIDataLastSync(new Date().toISOString());
      } else {
        // If no cached data, try to fetch from ESI directly
        console.log('⚠️ No cached jobs in database, attempting ESI fetch...');
        
        const primaryCorp = registeredCorps[0];
        const accessToken = await getESIAccessToken(primaryCorp.corporationId);
        
        if (!accessToken) {
          throw new Error('Failed to get ESI access token');
        }

        const result = await esiService.fetchIndustryJobsDetailed({
          corporationId: primaryCorp.corporationId,
          accessToken,
          useCache: true,
          maxPages: 5
        });

        if (result.success && result.data.length > 0) {
          console.log(`✅ Fetched ${result.data.length} industry jobs from ESI`);
          
          // Store in database for caching (pass corporation ID)
          await dbService.storeIndustryJobs(primaryCorp.corporationId, result.data);
          
          // Convert to tasks
          const tasks = result.data.map(job => convertESIJobToTask(job));
          setManufacturingTasks(tasks);
          setESIDataLastSync(new Date().toISOString());
          
          toast.success(`Loaded ${result.data.length} industry jobs from ESI`);
        } else {
          console.log('⚠️ No industry jobs found in ESI - using mock data');
          setUseMockData(true);
        }
      }
    } catch (error) {
      console.error('❌ Error loading ESI manufacturing data:', error);
      toast.error('Failed to load ESI data - using mock data');
      setUseMockData(true);
    } finally {
      setIsLoadingESIData(false);
    }
  };

  // Convert ESI industry job to manufacturing task
  const convertESIJobToTask = (job: any): ManufacturingTask => {
    // Map ESI status to our task status
    let status: 'assigned' | 'in_progress' | 'completed' | 'unassigned' = 'in_progress';
    if (job.status === 'active') {
      status = 'in_progress';
    } else if (job.status === 'delivered' || job.status === 'ready') {
      status = 'completed';
    } else if (job.status === 'cancelled' || job.status === 'reverted') {
      status = 'unassigned';
    }

    // Find installer name from members
    const installer = members?.find(m => m.characterId === job.installer_id);
    const installerName = installer?.characterName || installer?.name || `Character ${job.installer_id}`;

    return {
      id: `esi-job-${job.job_id}`,
      targetItem: {
        typeId: job.product_type_id,
        typeName: job.product_type_name || `Type ${job.product_type_id}`,
        quantity: job.product_quantity || job.runs
      },
      assignedTo: job.installer_id.toString(),
      assignedToName: installerName,
      status: status,
      payModifier: null,
      estimatedDuration: job.duration || 0,
      createdDate: job.start_date,
      startedDate: job.start_date,
      completedDate: job.completed_date,
      corporationId: user?.corporationId,
      stationId: job.station_id || job.facility_id,
      stationName: job.facility_name || `Station ${job.station_id || job.facility_id}`,
      materials: [],
      
      // Additional ESI fields
      blueprintId: job.blueprint_type_id,
      blueprintName: job.blueprint_type_name,
      runs: job.runs,
      taskType: getActivityType(job.activity_id)
    };
  };

  // Map ESI activity IDs to task types
  const getActivityType = (activityId?: number): 'manufacturing' | 'research' | 'invention' | 'copy' | 'reaction' => {
    switch (activityId) {
      case 1: return 'manufacturing';
      case 3: return 'research'; // TE research
      case 4: return 'research'; // ME research  
      case 5: return 'copy';
      case 8: return 'invention';
      case 9: return 'reaction';
      default: return 'manufacturing';
    }
  };

  // Load ESI data on component mount if user is authenticated
  useEffect(() => {
    if (user && user.authMethod === 'esi') {
      console.log('🔄 Manufacturing tab: User authenticated with ESI, loading data...');
      loadESIManufacturingData();
    } else if (user && user.authMethod === 'manual') {
      console.log('ℹ️ Manufacturing tab: User authenticated manually, using mock data');
      setUseMockData(true);
    }
  }, [user]);

  // Initialize sample data if empty - only when using mock data
  React.useEffect(() => {
    // Only initialize mock data if we're using mock data mode
    if (!useMockData) {
      console.log('ℹ️ Using ESI data mode - skipping mock data initialization');
      return;
    }

    console.log('ℹ️ Using mock data mode - initializing sample data');

    // Sample members/pilots for task assignment (cached locally for testing)
    if ((members || []).length === 0) {
      const sampleMembers: Member[] = [
        {
          id: 1,
          characterId: 91316135,
          characterName: 'Director Smith',
          name: 'Director Smith',
          corporationId: 498125261,
          corporationName: 'Test Alliance Please Ignore',
          roles: ['Director', 'Manager'],
          titles: ['Fleet Commander', 'Manufacturing Director'],
          title: 'Manufacturing Director',
          lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          location: 'Jita IV - Moon 4',
          ship: 'Buzzard',
          isActive: true,
          accessLevel: 'director',
          joinedDate: '2023-01-15',
          totalSkillPoints: 85000000,
          securityStatus: 5.0
        },
        {
          id: 2,
          characterId: 456789123,
          characterName: 'Pilot Johnson',
          name: 'Pilot Johnson',
          corporationId: 498125261,
          corporationName: 'Test Alliance Please Ignore',
          roles: ['Member'],
          titles: ['Industrialist'],
          title: 'Industrialist',
          lastLogin: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          location: 'Dodixie IX - Moon 20',
          ship: 'Retriever',
          isActive: true,
          accessLevel: 'member',
          joinedDate: '2023-03-22',
          totalSkillPoints: 45000000,
          securityStatus: 2.1
        },
        {
          id: 3,
          characterId: 987654321,
          characterName: 'Engineer Chen',
          name: 'Engineer Chen',
          corporationId: 498125261,
          corporationName: 'Test Alliance Please Ignore',
          roles: ['Member'],
          titles: ['Senior Manufacturer', 'Blueprint Researcher'],
          title: 'Senior Manufacturer',
          lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          location: 'Jita IV - Moon 4',
          ship: 'Charon',
          isActive: true,
          accessLevel: 'member',
          joinedDate: '2023-02-10',
          totalSkillPoints: 72000000,
          securityStatus: 3.5
        }
      ];
      
      // Save sample members to KV storage (cached locally for testing)
      spark.kv.set('corp-members', sampleMembers);
    }

    // Sample manufacturing tasks representing actual industry jobs from ESI
    // These would normally be populated from Data Sync -> manufacturing endpoint
    if ((manufacturingTasks || []).length === 0) {
      const sampleTasks: ManufacturingTask[] = [
        {
          id: 'task-1',
          targetItem: {
            typeId: 621,
            typeName: 'Caracal',
            quantity: 5
          },
          assignedTo: '456789123',
          assignedToName: 'Pilot Johnson',
          status: 'assigned',
          payModifier: null,
          estimatedDuration: 18000,
          createdDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          corporationId: 498125261,
          stationId: 60003760,
          stationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
          materials: [
            { typeId: 34, typeName: 'Tritanium', quantity: 250000, totalValue: 1250000, category: 'Mineral' },
            { typeId: 35, typeName: 'Pyerite', quantity: 120000, totalValue: 720000, category: 'Mineral' },
            { typeId: 36, typeName: 'Mexallon', quantity: 45000, totalValue: 450000, category: 'Mineral' },
            { typeId: 37, typeName: 'Isogen', quantity: 18000, totalValue: 180000, category: 'Mineral' },
            { typeId: 11399, typeName: 'Morphite', quantity: 250, totalValue: 250000, category: 'Mineral' }
          ]
        },
        {
          id: 'task-2', 
          targetItem: {
            typeId: 12742,
            typeName: 'Hammerhead II',
            quantity: 50
          },
          assignedTo: '91316135',
          assignedToName: 'Director Smith',
          status: 'in_progress',
          payModifier: 'rush',
          estimatedDuration: 90000,
          startedDate: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          createdDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          corporationId: 498125261,
          stationId: 60011866,
          stationName: 'Dodixie IX - Moon 20 - Federation Navy Assembly Plant',
          materials: [
            { typeId: 34, typeName: 'Tritanium', quantity: 450000, totalValue: 2250000, category: 'Mineral' },
            { typeId: 35, typeName: 'Pyerite', quantity: 180000, totalValue: 1080000, category: 'Mineral' },
            { typeId: 36, typeName: 'Mexallon', quantity: 75000, totalValue: 750000, category: 'Mineral' },
            { typeId: 3689, typeName: 'Robotics', quantity: 500, totalValue: 1500000, category: 'Component' }
          ]
        },
        {
          id: 'task-3',
          targetItem: {
            typeId: 1031,
            typeName: 'Vexor',
            quantity: 2
          },
          assignedTo: '987654321',
          assignedToName: 'Engineer Chen', 
          status: 'in_progress',
          payModifier: 'specialDelivery',
          estimatedDuration: 10800,
          startedDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          createdDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          corporationId: 498125261,
          stationId: 60008494,
          stationName: 'Amarr VIII (Oris) - Emperor Family Academy',
          materials: [
            { typeId: 34, typeName: 'Tritanium', quantity: 320000, totalValue: 1600000, category: 'Mineral' },
            { typeId: 35, typeName: 'Pyerite', quantity: 150000, totalValue: 900000, category: 'Mineral' },
            { typeId: 36, typeName: 'Mexallon', quantity: 55000, totalValue: 550000, category: 'Mineral' },
            { typeId: 37, typeName: 'Isogen', quantity: 22000, totalValue: 220000, category: 'Mineral' }
          ]
        },
        {
          id: 'task-4',
          targetItem: {
            typeId: 638,
            typeName: 'Moa',
            quantity: 10
          },
          assignedTo: null,
          assignedToName: 'Unassigned',
          status: 'unassigned',
          payModifier: null,
          estimatedDuration: 14400,
          createdDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          corporationId: 498125261,
          stationId: 60003760,
          stationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
          materials: [
            { typeId: 34, typeName: 'Tritanium', quantity: 580000, totalValue: 2900000, category: 'Mineral' },
            { typeId: 35, typeName: 'Pyerite', quantity: 220000, totalValue: 1320000, category: 'Mineral' },
            { typeId: 36, typeName: 'Mexallon', quantity: 95000, totalValue: 950000, category: 'Mineral' },
            { typeId: 38, typeName: 'Nocxium', quantity: 18000, totalValue: 360000, category: 'Mineral' },
            { typeId: 16272, typeName: 'Capital Construction Parts', quantity: 150, totalValue: 7500000, category: 'Component' }
          ]
        },
        {
          id: 'task-5',
          targetItem: {
            typeId: 11567,
            typeName: 'Raven',
            quantity: 3
          },
          assignedTo: null,
          assignedToName: 'Unassigned',
          status: 'unassigned',
          payModifier: null,
          estimatedDuration: 28800,
          createdDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          corporationId: 498125261,
          stationId: 60003760,
          stationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
          materials: [
            { typeId: 34, typeName: 'Tritanium', quantity: 1200000, totalValue: 6000000, category: 'Mineral' },
            { typeId: 35, typeName: 'Pyerite', quantity: 580000, totalValue: 3480000, category: 'Mineral' },
            { typeId: 36, typeName: 'Mexallon', quantity: 220000, totalValue: 2200000, category: 'Mineral' },
            { typeId: 37, typeName: 'Isogen', quantity: 95000, totalValue: 950000, category: 'Mineral' },
            { typeId: 38, typeName: 'Nocxium', quantity: 42000, totalValue: 840000, category: 'Mineral' },
            { typeId: 39, typeName: 'Zydrine', quantity: 18000, totalValue: 360000, category: 'Mineral' },
            { typeId: 40, typeName: 'Megacyte', quantity: 7500, totalValue: 150000, category: 'Mineral' }
          ]
        }
      ];
      setManufacturingTasks(sampleTasks);
    }
  }, [members, manufacturingTasks, setManufacturingTasks, useMockData]);

  const eveDataHook = null; // Removed eve data integration for simplification

  // Helper functions
  const formatISK = (amount: number): string => {
    if (amount >= 1e12) return `${(amount / 1e12).toFixed(1)}T ISK`;
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(1)}B ISK`;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(1)}M ISK`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(0)}K ISK`;
    return `${Math.round(amount)} ISK`;
  };

  const getJobProgress = (task: ManufacturingTask): number => {
    if (task.status !== 'in_progress' || !task.startedDate) return 0;
    
    const now = new Date().getTime();
    const start = new Date(task.startedDate).getTime();
    const duration = task.estimatedDuration * 1000;
    const elapsed = now - start;
    
    return Math.min(100, Math.max(0, (elapsed / duration) * 100));
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      in_progress: 'bg-green-500/20 text-green-400 border-green-500/50', 
      completed: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
      unassigned: 'bg-orange-500/20 text-orange-400 border-orange-500/50'
    };

    return (
      <Badge variant="outline" className={colors[status as keyof typeof colors] || colors.assigned}>
        {status === 'in_progress' ? 'In Progress' : 
         status === 'unassigned' ? 'Unassigned' :
         status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPayModifierDisplay = (modifier: string | null) => {
    if (!modifier) return null;
    const modifiers: Record<string, string> = {
      rush: 'RUSH +25%',
      specialDelivery: 'Special Delivery +15%',
      excessWork: 'Excess Work +10%'
    };
    return modifiers[modifier] || modifier;
  };

  // Event handlers
  const handleUpdateTask = (taskId: string, updates: Partial<ManufacturingTask>) => {
    setManufacturingTasks(current => 
      (current || []).map(task => 
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
  };

  const handleCreateTask = (itemTypeId: number, itemName: string, quantity: number, pilotId: string, pilotName: string, payModifier?: string) => {
    const newTask: ManufacturingTask = {
      id: `task-${Date.now()}`,
      targetItem: {
        typeId: itemTypeId,
        typeName: itemName,
        quantity
      },
      assignedTo: pilotId,
      assignedToName: pilotName,
      status: 'assigned',
      payModifier: payModifier || null,
      estimatedDuration: 3600 + (quantity * 300), // Base time estimation
      createdDate: new Date().toISOString(),
      corporationId: 498125261
    };

    setManufacturingTasks(current => [...(current || []), newTask]);
    toast.success(`Task assigned to ${pilotName}: ${quantity}x ${itemName}`);
    setCurrentView('jobs');
  };

  const handleClaimTask = (taskId: string, pilotId: string, pilotName: string) => {
    setManufacturingTasks(current => 
      (current || []).map(task => 
        task.id === taskId ? { 
          ...task, 
          assignedTo: pilotId,
          assignedToName: pilotName,
          status: 'assigned'
        } : task
      )
    );
    toast.success(`Task claimed by ${pilotName}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Factory size={24} />
            Manufacturing Operations
          </h2>
          <p className="text-muted-foreground">
            Manage manufacturing tasks and track production progress
          </p>
        </div>
        
        {/* Data source indicator and refresh */}
        <div className="flex items-center gap-3">
          {useMockData ? (
            <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/50">
              <Database size={14} className="mr-1" />
              Mock Data
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
              <Database size={14} className="mr-1" />
              ESI Data
            </Badge>
          )}
          
          {esiDataLastSync && !useMockData && (
            <span className="text-xs text-muted-foreground">
              Last sync: {new Date(esiDataLastSync).toLocaleTimeString()}
            </span>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={loadESIManufacturingData}
            disabled={isLoadingESIData || !user}
            className="gap-2"
          >
            {isLoadingESIData ? (
              <>
                <ArrowClockwise size={16} className="animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ArrowClockwise size={16} />
                Refresh Data
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Show warning if using mock data with ESI user */}
      {useMockData && user?.authMethod === 'esi' && (
        <Alert>
          <Warning size={16} />
          <AlertDescription>
            Using mock data. Click "Refresh Data" to load industry jobs from ESI, or ensure your corporation has industry jobs synced in Settings → Data Sync.
          </AlertDescription>
        </Alert>
      )}

      {/* Navigation */}
      <div className="flex gap-4 border-b border-border">
        <Button
          variant={currentView === 'administration' ? 'default' : 'ghost'}
          onClick={() => setCurrentView('administration')}
        >
          <Users size={16} className="mr-2" />
          Administration
        </Button>
        <Button
          variant={currentView === 'jobs' ? 'default' : 'ghost'}
          onClick={() => setCurrentView('jobs')}
        >
          <Factory size={16} className="mr-2" />
          Job Activity
        </Button>
        <Button
          variant={currentView === 'unassigned' ? 'default' : 'ghost'}
          onClick={() => setCurrentView('unassigned')}
          className="relative"
        >
          <Wrench size={16} className="mr-2" />
          Unassigned Jobs
          {(manufacturingTasks || []).filter(t => t.status === 'unassigned').length > 0 && (
            <Badge 
              variant="secondary" 
              className="ml-2 bg-orange-500/20 text-orange-400 border-orange-500/50"
            >
              {(manufacturingTasks || []).filter(t => t.status === 'unassigned').length}
            </Badge>
          )}
        </Button>
        <Button
          variant={currentView === 'blueprints' ? 'default' : 'ghost'}
          onClick={() => setCurrentView('blueprints')}
        >
          <Copy size={16} className="mr-2" />
          Blueprints
        </Button>
        {currentView === 'assign-task' && (
          <Button variant="default" disabled>
            <Plus size={16} className="mr-2" />
            Assign Task
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Assigned Tasks</p>
                <p className="text-2xl font-bold text-blue-400">
                  {(manufacturingTasks || []).filter(t => t.status === 'assigned').length}
                </p>
              </div>
              <Users size={24} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-green-400">
                  {(manufacturingTasks || []).filter(t => t.status === 'in_progress').length}
                </p>
              </div>
              <Factory size={24} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unassigned</p>
                <p className="text-2xl font-bold text-orange-400">
                  {(manufacturingTasks || []).filter(t => t.status === 'unassigned').length}
                </p>
              </div>
              <Wrench size={24} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-gray-400">
                  {(manufacturingTasks || []).filter(t => t.status === 'completed').length}
                </p>
              </div>
              <CheckCircle size={24} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Pilots</p>
                <p className="text-2xl font-bold text-accent">
                  {new Set((manufacturingTasks || []).filter(t => t.status !== 'completed' && t.assignedTo).map(t => t.assignedTo)).size}
                </p>
              </div>
              <Globe size={24} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Page Content */}
      {currentView === 'administration' && (
        <AdministrationView 
          members={members || []}
          onAssignTask={() => setCurrentView('assign-task')}
          payModifiers={payModifiers}
          payRatesPerHour={payRatesPerHour}
          onUpdatePayModifiers={setPayModifiers}
          onUpdatePayRates={setPayRatesPerHour}
          isMobileView={isMobileView}
        />
      )}

      {currentView === 'jobs' && (
        <JobActivityView
          tasks={manufacturingTasks || []}
          currentUser={user}
          filter={taskFilter}
          onFilterChange={setTaskFilter}
          onUpdateTask={handleUpdateTask}
          getJobProgress={getJobProgress}
          getStatusBadge={getStatusBadge}
          getPayModifierDisplay={getPayModifierDisplay}
          onStationClick={handleStationClick}
          members={members || []}
          isMobileView={isMobileView}
        />
      )}

      {currentView === 'unassigned' && (
        <UnassignedJobsView
          tasks={(manufacturingTasks || []).filter(t => t.status === 'unassigned')}
          currentUser={user}
          members={members || []}
          onClaimTask={handleClaimTask}
          getStatusBadge={getStatusBadge}
          getPayModifierDisplay={getPayModifierDisplay}
          onStationClick={handleStationClick}
          isMobileView={isMobileView}
        />
      )}

      {currentView === 'assign-task' && (
        <AssignTaskView
          members={members || []}
          payModifiers={payModifiers}
          onCreateTask={handleCreateTask}
          onCancel={() => setCurrentView('administration')}
          isMobileView={isMobileView}
        />
      )}

      {currentView === 'blueprints' && (
        <BlueprintLibrary isMobileView={isMobileView} />
      )}

      {/* Job Details Dialog */}
      <JobDetailsDialog
        job={selectedJob}
        open={jobDetailsOpen}
        onOpenChange={setJobDetailsOpen}
        onJobUpdate={() => {}}
      />

      {/* Station Info Popup */}
      {selectedStation && (
        <StationInfoPopup
          stationId={selectedStation.id}
          stationName={selectedStation.name}
          onClose={() => setSelectedStation(null)}
          onViewAssets={handleViewAssetsFromStation}
        />
      )}
    </div>
  );
}