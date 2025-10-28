import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wrench, Users, Package, CheckCircle, Building } from '@phosphor-icons/react';
import { ManufacturingTask, User, Member } from '@/lib/types';
import { toast } from 'sonner';
import { ItemInfoPopup } from '@/components/popups/ItemInfoPopup';

interface UnassignedJobsViewProps {
  tasks: ManufacturingTask[];
  currentUser: User | null;
  members: Member[];
  onClaimTask: (taskId: string, pilotId: string, pilotName: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  getPayModifierDisplay: (modifier: string | null) => string | null;
  onStationClick?: (stationId: number) => void;
  isMobileView?: boolean;
}

export function UnassignedJobsView({
  tasks,
  currentUser,
  members,
  onClaimTask,
  getStatusBadge,
  getPayModifierDisplay,
  onStationClick,
  isMobileView
}: UnassignedJobsViewProps) {
  const [selectedItem, setSelectedItem] = React.useState<{ typeId: number; typeName: string } | null>(null);
  
  const handleClaimJob = (task: ManufacturingTask) => {
    if (!currentUser) {
      toast.error('You must be logged in to claim a job');
      return;
    }
    
    const characterId = currentUser.characterId?.toString();
    const characterName = currentUser.characterName;
    
    if (!characterId || !characterName) {
      toast.error('Unable to identify your character information');
      return;
    }
    
    onClaimTask(task.id, characterId, characterName);
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {selectedItem && (
        <ItemInfoPopup
          itemTypeId={selectedItem.typeId}
          itemName={selectedItem.typeName}
          onClose={() => setSelectedItem(null)}
        />
      )}
      
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wrench size={20} />
            Unassigned Manufacturing Jobs
          </h3>
          <p className="text-sm text-muted-foreground">
            Available jobs waiting for pilots to claim them
          </p>
        </div>
        <Badge variant="outline" className="text-orange-400 border-orange-500/50">
          {tasks.length} Available
        </Badge>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-lg">
          <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
          <h4 className="text-lg font-semibold mb-2">All Jobs Assigned</h4>
          <p className="text-muted-foreground">
            Great! There are no unassigned manufacturing jobs at this time.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <Card key={task.id} className="bg-card border-border hover:bg-muted/30 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Item Icon and Details */}
                    <div className="flex items-center gap-3">
                      <img 
                        src={task.targetItem.typeId > 0 ? `https://images.evetech.net/types/${task.targetItem.typeId}/icon?size=64` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzMzIiByeD0iOCIvPgo8cGF0aCBkPSJNMzIgMTZMMTYgMjRMMzIgMzJMNDggMjRMMzIgMTZaIiBmaWxsPSIjNjY2Ii8+CjxwYXRoIGQ9Ik0zMiAzMkwxNiA0MEwzMiA0OEw0OCA0MEwzMiAzMloiIGZpbGw9IiM0NDQiLz4KPC9zdmc+'}
                        alt={task.targetItem.typeName}
                        className="w-12 h-12 rounded cursor-pointer hover:ring-2 hover:ring-accent transition-all"
                        onClick={() => setSelectedItem({ typeId: task.targetItem.typeId, typeName: task.targetItem.typeName })}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjMzMzIiByeD0iOCIvPgo8cGF0aCBkPSJNMjQgMTJMMTIgMThMMjQgMjRMMzYgMThMMjQgMTJaIiBmaWxsPSIjNjY2Ii8+CjxwYXRoIGQ9Ik0yNCAyNEwxMiAzMEwyNCAzNkwzNiAzMEwyNCAyNFoiIGZpbGw9IiM0NDQiLz4KPC9zdmc+';
                        }}
                      />
                      <div>
                        <h4 
                          className="text-lg font-semibold text-foreground cursor-pointer hover:text-accent transition-colors"
                          onClick={() => setSelectedItem({ typeId: task.targetItem.typeId, typeName: task.targetItem.typeName })}
                        >
                          {task.targetItem.typeName}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Package size={14} />
                            {task.targetItem.quantity.toLocaleString()}x
                          </span>
                          <span className="flex items-center gap-1">
                            <Wrench size={14} />
                            Est. {formatDuration(task.estimatedDuration)}
                          </span>
                          {task.stationName && task.stationId && onStationClick ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onStationClick(task.stationId!)}
                              className="h-auto p-0.5 px-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 -ml-1"
                              title="View in Assets"
                            >
                              <Building size={12} className="mr-1" />
                              {task.stationName.split(' - ')[0]}
                            </Button>
                          ) : task.stationName ? (
                            <span className="flex items-center gap-1 text-xs">
                              <Building size={14} />
                              {task.stationName.split(' - ')[0]}
                            </span>
                          ) : null}
                          <span>
                            Created: {new Date(task.createdDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Pay Modifier */}
                    <div className="flex flex-col items-end gap-2">
                      {task.payModifier ? (
                        <Badge variant="outline" className="text-green-400 border-green-500/50">
                          {getPayModifierDisplay(task.payModifier)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-muted">
                          Standard Rate
                        </Badge>
                      )}
                      {getStatusBadge(task.status)}
                    </div>
                  </div>
                  
                  {/* Claim Button */}
                  <div className="ml-4">
                    <Button 
                      onClick={() => handleClaimJob(task)}
                      className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/50"
                      disabled={!currentUser}
                    >
                      <Users size={16} className="mr-2" />
                      Claim Job
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!currentUser && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-400">
            <Users size={18} />
            <span className="font-medium">Sign in required</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            You must be logged in to claim manufacturing jobs.
          </p>
        </div>
      )}
    </div>
  );
}