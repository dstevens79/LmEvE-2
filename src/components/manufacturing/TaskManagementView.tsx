import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, 
  Package, 
  Clock, 
  CurrencyDollar, 
  Factory,
  Calendar,
  Tag,
  CheckCircle,
  Warning,
  Play,
  Pause,
  Stop,
  Eye,
  PencilSimple,
  Archive,
  ChatCircle,
  Upload,
  Check,
  X
} from '@phosphor-icons/react';
import { ManufacturingTask, Member } from '@/lib/types';
import { useAuth } from '@/lib/auth-provider';
import { toast } from 'sonner';

interface TaskManagementViewProps {
  tasks: ManufacturingTask[];
  members: Member[];
  onUpdateTask: (taskId: string, updates: Partial<ManufacturingTask>) => void;
  onEditTask: (task: ManufacturingTask) => void;
  isMobileView?: boolean;
}

export function TaskManagementView({ 
  tasks, 
  members, 
  onUpdateTask, 
  onEditTask,
  isMobileView = false
}: TaskManagementViewProps) {
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState<ManufacturingTask | null>(null);
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressNotes, setProgressNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  const formatISK = (amount: number): string => {
    if (amount >= 1e12) return `${(amount / 1e12).toFixed(1)}T ISK`;
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(1)}B ISK`;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(1)}M ISK`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(0)}K ISK`;
    return `${Math.round(amount)} ISK`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'assigned': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'in_progress': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'completed': return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'normal': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getTaskProgress = (task: ManufacturingTask): number => {
    if (task.status === 'completed') return 100;
    if (task.status === 'cancelled') return 0;
    if (task.status === 'pending') return 0;
    if (task.status === 'assigned') return 10;
    if (task.status === 'in_progress') {
      // Estimate progress based on time elapsed if we have dates
      if (task.startedDate && task.estimatedDuration) {
        const start = new Date(task.startedDate).getTime();
        const now = Date.now();
        const elapsed = (now - start) / 1000;
        return Math.min(90, Math.max(20, (elapsed / task.estimatedDuration) * 100));
      }
      return 50; // Default for in-progress without time tracking
    }
    return 0;
  };

  const canUserModifyTask = (task: ManufacturingTask): boolean => {
    if (!user) return false;
    
    // Task creator can always modify
    if (task.createdBy === user.characterId?.toString() || task.createdBy === user.characterName) return true;
    
    // Assigned user can update progress
    if (task.assignedTo === user.characterId?.toString() || task.assignedTo === user.characterName) return true;
    
    // Corporation directors can modify any task
    if (user.role === 'ceo' || user.role === 'director') return true;
    
    return false;
  };

  const handleTaskAction = async (task: ManufacturingTask, action: string) => {
    setActionLoading(action);
    
    try {
      let updates: Partial<ManufacturingTask> = {};
      
      switch (action) {
        case 'start':
          updates = {
            status: 'in_progress',
            startedDate: new Date().toISOString()
          };
          toast.success(`Task "${task.title}" started`);
          break;
        case 'pause':
          updates = { status: 'assigned' };
          toast.success(`Task "${task.title}" paused`);
          break;
        case 'complete':
          updates = {
            status: 'completed',
            completedDate: new Date().toISOString(),
            reward: {
              ...task.reward,
              paymentStatus: 'approved'
            }
          };
          toast.success(`Task "${task.title}" completed`);
          break;
        case 'cancel':
          updates = { status: 'cancelled' };
          toast.success(`Task "${task.title}" cancelled`);
          break;
      }
      
      onUpdateTask(task.id, updates);
    } catch (error) {
      toast.error(`Failed to ${action} task`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddProgress = (task: ManufacturingTask) => {
    setSelectedTask(task);
    setProgressNotes('');
    setProgressDialogOpen(true);
  };

  const submitProgressUpdate = () => {
    if (!selectedTask || !progressNotes.trim()) return;
    
    const updates: Partial<ManufacturingTask> = {
      progressNotes: [
        ...(selectedTask.progressNotes || []),
        `[${new Date().toLocaleString()}] ${user?.characterName || 'Unknown'}: ${progressNotes.trim()}`
      ]
    };
    
    onUpdateTask(selectedTask.id, updates);
    setProgressDialogOpen(false);
    toast.success('Progress update added');
  };

  const handleViewDetails = (task: ManufacturingTask) => {
    setSelectedTask(task);
    setTaskDetailsOpen(true);
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterAssignee !== 'all') {
      if (filterAssignee === 'unassigned' && task.assignedTo) return false;
      if (filterAssignee !== 'unassigned' && task.assignedTo !== filterAssignee) return false;
    }
    return true;
  });

  // Group tasks by status
  const tasksByStatus = {
    pending: filteredTasks.filter(t => t.status === 'pending'),
    assigned: filteredTasks.filter(t => t.status === 'assigned'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    completed: filteredTasks.filter(t => t.status === 'completed'),
    cancelled: filteredTasks.filter(t => t.status === 'cancelled')
  };

  const TaskCard = ({ task }: { task: ManufacturingTask }) => (
    <Card className="bg-card border-border hover:bg-muted/20 transition-colors">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground truncate">{task.title}</h4>
              <p className="text-sm text-muted-foreground truncate">
                {task.targetItem.typeName} x{task.targetItem.quantity}
              </p>
            </div>
            <div className="flex gap-2 ml-2">
              <Badge className={getStatusColor(task.status)}>
                {task.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <Badge className={getPriorityColor(task.priority)}>
                {task.priority.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(getTaskProgress(task))}%</span>
            </div>
            <Progress value={getTaskProgress(task)} className="h-2" />
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Assignee</p>
              <p className="font-medium">
                {task.assignedToName || 'Unassigned'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Reward</p>
              <p className="font-medium text-green-400">
                {task.reward.type === 'fixed' 
                  ? formatISK(task.reward.amount)
                  : `${task.reward.amount}%`}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Duration</p>
              <p className="font-medium">{formatDuration(task.estimatedDuration)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{new Date(task.createdDate).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewDetails(task)}
              className="flex-1 min-w-0"
            >
              <Eye size={14} className="mr-1" />
              Details
            </Button>
            
            {canUserModifyTask(task) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditTask(task)}
                >
                  <PencilSimple size={14} className="mr-1" />
                  PencilSimple
                </Button>

                {task.status === 'assigned' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTaskAction(task, 'start')}
                    disabled={actionLoading === 'start'}
                  >
                    <Play size={14} className="mr-1" />
                    Start
                  </Button>
                )}

                {task.status === 'in_progress' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddProgress(task)}
                    >
                      <ChatCircle size={14} className="mr-1" />
                      Progress
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTaskAction(task, 'complete')}
                      disabled={actionLoading === 'complete'}
                    >
                      <CheckCircle size={14} className="mr-1" />
                      Complete
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by assignee..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members
              .filter(member => member.isActive)
              .map((member) => (
                <SelectItem key={member.characterId} value={member.characterId.toString()}>
                  {member.characterName || member.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tasks by Status */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-fit">
          <TabsTrigger value="all">
            All ({filteredTasks.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({tasksByStatus.pending.length})
          </TabsTrigger>
          <TabsTrigger value="assigned">
            Assigned ({tasksByStatus.assigned.length})
          </TabsTrigger>
          <TabsTrigger value="in_progress">
            Active ({tasksByStatus.in_progress.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Done ({tasksByStatus.completed.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({tasksByStatus.cancelled.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </TabsContent>

        {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
          <TabsContent key={status} value={status}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {statusTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {filteredTasks.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <Factory size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Tasks Found</h3>
            <p className="text-muted-foreground">
              {filterStatus !== 'all' || filterAssignee !== 'all' 
                ? 'No tasks match the current filters'
                : 'No manufacturing tasks have been created yet'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Progress Update Dialog */}
      <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Add Progress Update</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Task: <strong>{selectedTask?.title}</strong>
            </p>
            <Textarea
              placeholder="Describe your progress on this task..."
              value={progressNotes}
              onChange={(e) => setProgressNotes(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setProgressDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitProgressUpdate} disabled={!progressNotes.trim()}>
                Add Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Details Dialog */}
      <Dialog open={taskDetailsOpen} onOpenChange={setTaskDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory size={20} />
              Task Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-6">
              {/* Task Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-muted/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{selectedTask.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge className={getStatusColor(selectedTask.status)}>
                          {selectedTask.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Priority</p>
                        <Badge className={getPriorityColor(selectedTask.priority)}>
                          {selectedTask.priority.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Target Product</p>
                      <p className="font-medium">{selectedTask.targetItem.typeName} x{selectedTask.targetItem.quantity}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Estimated Reward</p>
                      <p className="text-lg font-bold text-green-400">
                        {selectedTask.reward.type === 'fixed' 
                          ? formatISK(selectedTask.reward.amount)
                          : selectedTask.reward.type === 'percentage'
                          ? `${selectedTask.reward.amount}% (${formatISK(selectedTask.estimatedCost * (selectedTask.reward.amount / 100))})`
                          : `${selectedTask.reward.amount}x market rate`}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Assignment & Timeline</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Created By</p>
                        <p className="font-medium">{selectedTask.createdByName}</p>
                        <p className="text-xs text-muted-foreground">{new Date(selectedTask.createdDate).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Assigned To</p>
                        <p className="font-medium">{selectedTask.assignedToName || 'Unassigned'}</p>
                        {selectedTask.assignedDate && (
                          <p className="text-xs text-muted-foreground">{new Date(selectedTask.assignedDate).toLocaleString()}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progress</span>
                        <span>{Math.round(getTaskProgress(selectedTask))}%</span>
                      </div>
                      <Progress value={getTaskProgress(selectedTask)} className="h-3" />
                    </div>

                    {selectedTask.deadline && (
                      <div>
                        <p className="text-sm text-muted-foreground">Deadline</p>
                        <p className="font-medium">{new Date(selectedTask.deadline).toLocaleString()}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm text-muted-foreground">Estimated Duration</p>
                      <p className="font-medium">{formatDuration(selectedTask.estimatedDuration)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Notes */}
              {selectedTask.progressNotes && selectedTask.progressNotes.length > 0 && (
                <Card className="bg-muted/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Progress Updates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedTask.progressNotes.map((note, index) => (
                        <div key={index} className="p-3 border border-border rounded-lg bg-card/50">
                          <p className="text-sm whitespace-pre-wrap">{note}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Materials */}
              <Card className="bg-muted/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Required Materials</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table className="data-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Total Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedTask.materials.map((material, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{material.typeName}</TableCell>
                            <TableCell>{material.quantity.toLocaleString()}</TableCell>
                            <TableCell>{formatISK(material.totalValue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex justify-between">
                      <span className="font-medium">Total Estimated Cost:</span>
                      <span className="font-bold text-accent">{formatISK(selectedTask.estimatedCost)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}