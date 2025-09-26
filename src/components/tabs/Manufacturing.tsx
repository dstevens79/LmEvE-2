import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Users
} from '@phosphor-icons/react';
import { ManufacturingJob, Blueprint, ProductionPlan, ManufacturingTask, Member } from '@/lib/types';
import { JobDetailsDialog } from '@/components/manufacturing/JobDetailsDialog';
import { AdministrationView } from '@/components/manufacturing/AdministrationView';
import { JobActivityView } from '@/components/manufacturing/JobActivityView';
import { AssignTaskView } from '@/components/manufacturing/AssignTaskView';
import { toast } from 'sonner';

interface ManufacturingProps {
  onLoginClick?: () => void;
  isMobileView?: boolean;
}

export function Manufacturing({ onLoginClick, isMobileView }: ManufacturingProps) {
  const { user } = useAuth();
  const [activeJobs, setActiveJobs] = useKV<ManufacturingJob[]>('manufacturing-jobs', []);
  const [blueprints, setBlueprints] = useKV<Blueprint[]>('blueprints-library', []);
  const [productionPlans, setProductionPlans] = useKV<ProductionPlan[]>('production-plans', []);
  const [manufacturingTasks, setManufacturingTasks] = useKV<ManufacturingTask[]>('manufacturing-tasks', []);
  const [members] = useKV<Member[]>('corp-members', []);
  const [payModifiers] = useKV('manufacturing-pay-modifiers', {
    qualityBonus: 1.2,
    speedBonus: 1.15,
    difficultyBonus: 1.1
  });

  const [currentView, setCurrentView] = useState<'administration' | 'jobs' | 'assign-task'>('administration');
  const [newJobDialogOpen, setNewJobDialogOpen] = useState(false);
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ManufacturingJob | null>(null);
  const [editingTask, setEditingTask] = useState<ManufacturingTask | null>(null);
  const [taskFilter, setTaskFilter] = useState<'my-tasks' | 'all-tasks'>('my-tasks');

  // Initialize sample data if empty
  React.useEffect(() => {
    // Sample members for task assignment
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
        }
      ];
      
      // Save sample members to KV storage
      spark.kv.set('corp-members', sampleMembers);
    }

    // Sample manufacturing tasks - simple structure
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
          corporationId: 498125261
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
          payModifier: 'qualityBonus',
          estimatedDuration: 90000,
          startedDate: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          createdDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          corporationId: 498125261
        },
        {
          id: 'task-3',
          targetItem: {
            typeId: 1031,
            typeName: 'Vexor',
            quantity: 2
          },
          assignedTo: '456789123',
          assignedToName: 'Pilot Johnson', 
          status: 'completed',
          payModifier: 'speedBonus',
          estimatedDuration: 10800,
          completedDate: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          startedDate: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
          createdDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          corporationId: 498125261
        }
      ];
      setManufacturingTasks(sampleTasks);
    }
  }, [members, manufacturingTasks, setManufacturingTasks]);

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
      completed: 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    };

    return (
      <Badge variant="outline" className={colors[status as keyof typeof colors] || colors.assigned}>
        {status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPayModifierDisplay = (modifier: string | null) => {
    if (!modifier) return null;
    const modifiers: Record<string, string> = {
      qualityBonus: 'Quality +20%',
      speedBonus: 'Speed +15%', 
      difficultyBonus: 'Difficulty +10%'
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Factory size={24} />
          Manufacturing Operations
        </h2>
        <p className="text-muted-foreground">
          Manage manufacturing tasks and track production progress
        </p>
      </div>

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
        {currentView === 'assign-task' && (
          <Button variant="default" disabled>
            <Plus size={16} className="mr-2" />
            Assign Task
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  {new Set((manufacturingTasks || []).filter(t => t.status !== 'completed').map(t => t.assignedTo)).size}
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

      {/* Job Details Dialog */}
      <JobDetailsDialog
        job={selectedJob}
        open={jobDetailsOpen}
        onOpenChange={setJobDetailsOpen}
        onJobUpdate={() => {}}
      />
    </div>
  );
}