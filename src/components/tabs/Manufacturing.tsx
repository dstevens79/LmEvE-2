import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoginPrompt } from '@/components/LoginPrompt';
import { useKV } from '@github/spark/hooks';
import { useAuth } from '@/lib/auth-provider';
import { useLMeveData } from '@/lib/LMeveDataContext';
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

interface ManufacturingProps {
  onLoginClick?: () => void;
  isMobileView?: boolean;
}

export function Manufacturing({ onLoginClick, isMobileView }: ManufacturingProps) {
  const { user } = useAuth();
  const { 
    manufacturingJobs,
    members,
    dataSource,
    loading,
    refreshManufacturing
  } = useLMeveData();
  
  const [blueprints, setBlueprints] = useKV<Blueprint[]>('blueprints-library', []);
  const [productionPlans, setProductionPlans] = useKV<ProductionPlan[]>('production-plans', []);
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
  
  // Handler for station click - show station popup
  const handleStationClick = (stationId: number, stationName?: string) => {
    setSelectedStation({
      id: stationId,
      name: stationName || `Station ${stationId}`
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

  // Refresh manufacturing data
  const handleRefreshData = async () => {
    try {
      await refreshManufacturing();
      toast.success('Manufacturing data refreshed');
    } catch (error) {
      console.error('Failed to refresh manufacturing data:', error);
      toast.error('Failed to refresh data');
    }
  };

  // Load data on mount
  useEffect(() => {
    if (user) {
      console.log('🏭 Manufacturing tab: Loading manufacturing data from unified service');
      refreshManufacturing();
    }
  }, [user]);

  // Convert ManufacturingJob to ManufacturingTask for UI display
  const convertJobToTask = React.useCallback((job: ManufacturingJob): ManufacturingTask => {
    const installer = members.find(m => m.characterId === job.installerId);
    const installerName = installer?.characterName || installer?.name || job.installerName || `Character ${job.installerId}`;
    
    let taskStatus: 'assigned' | 'in_progress' | 'completed' | 'unassigned' = 'in_progress';
    if (job.status === 'active') {
      taskStatus = 'in_progress';
    } else if (job.status === 'delivered' || job.status === 'ready' || job.status === 'completed') {
      taskStatus = 'completed';
    } else if (job.status === 'cancelled' || job.status === 'reverted') {
      taskStatus = 'unassigned';
    }

    return {
      id: job.id || `job-${job.jobId}`,
      targetItem: {
        typeId: job.productTypeId,
        typeName: job.productTypeName,
        quantity: job.productQuantity
      },
      assignedTo: job.installerId.toString(),
      assignedToName: installerName,
      status: taskStatus,
      payModifier: null,
      estimatedDuration: job.duration,
      createdDate: job.startDate,
      startedDate: job.startDate,
      completedDate: job.completedDate,
      corporationId: user?.corporationId,
      stationId: job.facilityId,
      stationName: job.facilityName || job.facility,
      materials: job.materials || [],
      blueprintId: job.blueprintId,
      blueprintName: job.blueprintName,
      runs: job.runs,
      taskType: getActivityType(job.activityId)
    };
  }, [members, user]);

  // Manufacturing jobs come from unified data service
  // Convert ManufacturingJob (from database/ESI) to ManufacturingTask (for UI display)
  const manufacturingTasks = React.useMemo(() => {
    return manufacturingJobs.map(job => convertJobToTask(job));
  }, [manufacturingJobs, convertJobToTask]);

  // Map ESI activity IDs to task types
  const getActivityType = (activityId?: number): 'manufacturing' | 'research' | 'invention' | 'copy' | 'reaction' => {
    switch (activityId) {
      case 1: return 'manufacturing';
      case 3: return 'research';
      case 4: return 'research';
      case 5: return 'copy';
      case 8: return 'invention';
      case 9: return 'reaction';
      default: return 'manufacturing';
    }
  };

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
  // Note: In database-first mode, these would update the database via API
  // For now, these are placeholders showing where integration is needed
  const handleUpdateTask = (taskId: string, updates: Partial<ManufacturingTask>) => {
    console.log('TODO: Update task in database:', taskId, updates);
    toast.info('Task updates require database integration');
  };

  const handleCreateTask = (itemTypeId: number, itemName: string, quantity: number, pilotId: string, pilotName: string, payModifier?: string) => {
    console.log('TODO: Create task in database:', { itemTypeId, itemName, quantity, pilotId, payModifier });
    toast.info('Task creation requires database integration');
    setCurrentView('jobs');
  };

  const handleClaimTask = (taskId: string, pilotId: string, pilotName: string) => {
    console.log('TODO: Claim task in database:', taskId, pilotId);
    toast.info('Task claiming requires database integration');
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
          <Badge variant="outline" className={
            dataSource.manufacturing === 'database' ? "bg-green-500/20 text-green-400 border-green-500/50" :
            dataSource.manufacturing === 'esi' ? "bg-blue-500/20 text-blue-400 border-blue-500/50" :
            dataSource.manufacturing === 'mock' ? "bg-orange-500/20 text-orange-400 border-orange-500/50" :
            "bg-gray-500/20 text-gray-400 border-gray-500/50"
          }>
            <Database size={14} className="mr-1" />
            {dataSource.manufacturing === 'database' ? 'Database' :
             dataSource.manufacturing === 'esi' ? 'ESI' :
             dataSource.manufacturing === 'mock' ? 'Mock Data' :
             'No Data'}
          </Badge>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshData}
            disabled={loading.manufacturing || !user}
            className="gap-2"
          >
            {loading.manufacturing ? (
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

      {/* Show info about data source */}
      {dataSource.manufacturing === 'mock' && user && (
        <Alert>
          <Warning size={16} />
          <AlertDescription>
            Using mock data. Run a data sync in Settings → Data Sync to populate manufacturing jobs from ESI into the database.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Show loading state */}
      {loading.manufacturing && (
        <Alert>
          <ArrowClockwise size={16} className="animate-spin" />
          <AlertDescription>
            Loading manufacturing jobs...
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