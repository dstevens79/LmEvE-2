import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Factory, Users, Play, Clock, CheckCircle, Building } from '@phosphor-icons/react';
import { ManufacturingTask, User } from '@/lib/types';

interface JobActivityViewProps {
  tasks: ManufacturingTask[];
  currentUser: User | null;
  filter: 'my-tasks' | 'all-tasks';
  onFilterChange: (filter: 'my-tasks' | 'all-tasks') => void;
  onUpdateTask: (taskId: string, updates: Partial<ManufacturingTask>) => void;
  getJobProgress: (task: ManufacturingTask) => number;
  getStatusBadge: (status: string) => React.ReactNode;
  getPayModifierDisplay: (modifier: string | null) => string | null;
  onStationClick?: (stationId: number) => void;
  isMobileView?: boolean;
}

export function JobActivityView({
  tasks,
  currentUser,
  filter,
  onFilterChange,
  onUpdateTask,
  getJobProgress,
  getStatusBadge,
  getPayModifierDisplay,
  onStationClick,
  isMobileView
}: JobActivityViewProps) {
  
  const filteredTasks = filter === 'my-tasks' 
    ? tasks.filter(task => 
        task.assignedTo && (
          task.assignedTo === currentUser?.characterId?.toString() || 
          task.assignedToName === currentUser?.characterName
        )
      )
    : tasks;

  const handleStartTask = (taskId: string) => {
    onUpdateTask(taskId, { 
      status: 'in_progress', 
      startedDate: new Date().toISOString() 
    });
  };

  const handleCompleteTask = (taskId: string) => {
    onUpdateTask(taskId, { 
      status: 'completed', 
      completedDate: new Date().toISOString() 
    });
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Manufacturing Job Activity</h3>
          <p className="text-sm text-muted-foreground">
            Monitor ongoing production activities and assigned tasks
          </p>
        </div>
        
        {/* Filter Toggle */}
        <div className="flex gap-2">
          <Button
            variant={filter === 'my-tasks' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('my-tasks')}
          >
            My Tasks
          </Button>
          <Button
            variant={filter === 'all-tasks' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('all-tasks')}
          >
            All Corp Tasks
          </Button>
        </div>
      </div>

      {/* Task List - Thin Rows */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-lg">
          <Factory size={48} className="mx-auto text-muted-foreground mb-4" />
          <h4 className="text-lg font-semibold mb-2">
            {filter === 'my-tasks' ? 'No Tasks Assigned to You' : 'No Manufacturing Tasks'}
          </h4>
          <p className="text-muted-foreground">
            {filter === 'my-tasks' 
              ? "You don't have any manufacturing tasks assigned to you yet." 
              : "No manufacturing tasks have been created yet."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 p-3 text-xs font-medium text-muted-foreground border-b border-border">
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Pilot</div>
            <div className="col-span-2">Item</div>
            <div className="col-span-1">Quantity</div>
            <div className="col-span-2">Station</div>
            <div className="col-span-1">Progress</div>
            <div className="col-span-1">Duration</div>
            <div className="col-span-1">Pay</div>
            <div className="col-span-1">Actions</div>
          </div>

          {/* Task Rows */}
          {filteredTasks.map((task) => (
            <div 
              key={task.id} 
              className="grid grid-cols-12 gap-4 p-3 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              {/* Status */}
              <div className="col-span-1 flex items-center">
                {getStatusBadge(task.status)}
              </div>

              {/* Pilot Avatar + Name */}
              <div className="col-span-2 flex items-center gap-2">
                <img 
                  src={`https://images.evetech.net/characters/${task.assignedTo}/portrait?size=32`}
                  alt={task.assignedToName}
                  className="w-6 h-6 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI2IiB5PSI2Ij4KPHBhdGggZD0iTTYgN0M1LjQgNyA1IDYuNiA1IDZDNSA1LjQgNS40IDUgNiA1QzYuNiA1IDcgNS40IDcgNkM3IDYuNiA2LjYgNyA2IDdaIiBmaWxsPSIjOTk5Ii8+CjxwYXRoIGQ9Ik02IDhDNC44IDggNCA3LjIgNCA2QzQgNC44IDQuOCA0IDYgNEM3LjIgNCA4IDQuOCA4IDZDOBC4IDcuMiA3LjIgOCA2IDhaIiBmaWxsPSIjOTk5Ii8+Cjwvc3ZnPgo8L3N2Zz4K';
                  }}
                />
                <span className="text-sm text-foreground truncate">
                  {task.assignedToName}
                </span>
              </div>

              {/* Item Icon + Name */}
              <div className="col-span-2 flex items-center gap-2">
                <img 
                  src={`https://images.evetech.net/types/${task.targetItem.typeId}/icon?size=32`}
                  alt={task.targetItem.typeName}
                  className="w-6 h-6"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0xMiA2TDE4IDEyTDEyIDE4TDYgMTJMMTIgNloiIGZpbGw9IiM2NjYiLz4KPC9zdmc+';
                  }}
                />
                <span className="text-sm text-foreground truncate">
                  {task.targetItem.typeName}
                </span>
              </div>

              {/* Quantity */}
              <div className="col-span-1 flex items-center">
                <span className="text-sm text-accent font-medium">
                  {task.targetItem.quantity.toLocaleString()}x
                </span>
              </div>

              {/* Station */}
              <div className="col-span-2 flex items-center">
                {task.stationName && task.stationId ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onStationClick?.(task.stationId!)}
                    className="h-auto p-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 -ml-1"
                    title="View in Assets"
                  >
                    <Building size={12} className="mr-1 flex-shrink-0" />
                    <span className="truncate">
                      {task.stationName.split(' - ')[0]}
                    </span>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">No station</span>
                )}
              </div>

              {/* Progress */}
              <div className="col-span-1 flex items-center">
                {task.status === 'in_progress' ? (
                  <div className="w-full space-y-1">
                    <Progress value={getJobProgress(task)} className="h-2" />
                    <span className="text-xs text-muted-foreground">
                      {Math.round(getJobProgress(task))}%
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {task.status === 'completed' ? 'Done' : 'Pending'}
                  </span>
                )}
              </div>

              {/* Duration */}
              <div className="col-span-1 flex items-center">
                <span className="text-xs text-foreground">
                  {formatDuration(task.estimatedDuration)}
                </span>
              </div>

              {/* Pay Modifier */}
              <div className="col-span-1 flex items-center">
                {task.payModifier ? (
                  <Badge variant="outline" className="text-xs text-green-400 border-green-500/50">
                    {getPayModifierDisplay(task.payModifier)}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Standard</span>
                )}
              </div>

              {/* Actions */}
              <div className="col-span-1 flex items-center">
                {task.status === 'assigned' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStartTask(task.id)}
                    className="text-green-400 hover:text-green-300 h-8 w-8 p-0"
                    title="Start Task"
                  >
                    <Play size={14} />
                  </Button>
                )}
                {task.status === 'in_progress' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCompleteTask(task.id)}
                    className="text-blue-400 hover:text-blue-300 h-8 w-8 p-0"
                    title="Mark Complete"
                  >
                    <CheckCircle size={14} />
                  </Button>
                )}
                {task.status === 'completed' && (
                  <div className="flex items-center justify-center h-8 w-8">
                    <CheckCircle size={14} className="text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mobile View - Stack Cards for smaller screens */}
      {isMobileView && filteredTasks.length > 0 && (
        <div className="md:hidden space-y-3">
          {filteredTasks.map((task) => (
            <div key={task.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <img 
                    src={`https://images.evetech.net/characters/${task.assignedTo}/portrait?size=32`}
                    alt={task.assignedToName}
                    className="w-8 h-8 rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTggMTBDNi45IDEwIDYgOS4xIDYgOEM2IDYuOSA2LjkgNiA4IDZDOS4xIDYgMTAgNi45IDEwIDhDMTAgOS4xIDkuMSAxMCA4IDEwWiIgZmlsbD0iIzk5OSIvPgo8cGF0aCBkPSJNOCAxMkM1LjggMTIgNCA5LjggNCA4QzQgNi4yIDUuOCA0IDggNEM5LjggNCA4IDUuOCA4IDhDOCA5LjggOS44IDEyIDggMTJaIiBmaWxsPSIjOTk5Ii8+Cjwvc3ZnPgo8L3N2Zz4K';
                    }}
                  />
                  <div>
                    <p className="font-medium text-foreground">{task.assignedToName}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.targetItem.quantity}x {task.targetItem.typeName}
                    </p>
                  </div>
                </div>
                {getStatusBadge(task.status)}
              </div>

              {task.status === 'in_progress' && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Progress</span>
                    <span>{Math.round(getJobProgress(task))}%</span>
                  </div>
                  <Progress value={getJobProgress(task)} className="h-2" />
                </div>
              )}

              <div className="flex justify-between items-center text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">
                    Duration: {formatDuration(task.estimatedDuration)}
                  </div>
                  {task.payModifier && (
                    <Badge variant="outline" className="text-xs text-green-400 border-green-500/50">
                      {getPayModifierDisplay(task.payModifier)}
                    </Badge>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {task.status === 'assigned' && (
                    <Button
                      size="sm"
                      onClick={() => handleStartTask(task.id)}
                      className="bg-green-500/20 text-green-400 hover:bg-green-500/30"
                    >
                      <Play size={14} className="mr-1" />
                      Start
                    </Button>
                  )}
                  {task.status === 'in_progress' && (
                    <Button
                      size="sm"
                      onClick={() => handleCompleteTask(task.id)}
                      className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                    >
                      <CheckCircle size={14} className="mr-1" />
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}