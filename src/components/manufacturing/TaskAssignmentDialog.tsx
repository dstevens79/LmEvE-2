import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { 
  User, 
  Package, 
  Clock, 
  CurrencyDollar, 
  Factory,
  Calendar,
  Tag,
  CheckCircle,
  AlertTriangle,
  Info,
  CaretUpDown,
  Check,
  Eye,
  MagnifyingGlass,
  Users
} from '@phosphor-icons/react';
import { ManufacturingTask, Blueprint, MaterialRequirement, Member } from '@/lib/types';
import { useAuth } from '@/lib/auth-provider';
import { useKV } from '@/lib/kv';
import { PointsRate } from '@/components/manufacturing/PointsManagement';
import { toast } from 'sonner';

interface TaskAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blueprints: Blueprint[];
  members: Member[];
  onCreateTask: (task: ManufacturingTask) => void;
  editTask?: ManufacturingTask | null;
}

export function TaskAssignmentDialog({ 
  open, 
  onOpenChange, 
  blueprints, 
  members,
  onCreateTask,
  editTask 
}: TaskAssignmentDialogProps) {
  const { user } = useAuth();
  const [pointsRates] = useKV<PointsRate[]>('points-rates', []);
  const [formData, setFormData] = useState<Partial<ManufacturingTask>>({
    title: '',
    description: '',
    taskType: 'manufacturing',
    priority: 'normal',
    status: 'pending',
    runs: 1,
    materialEfficiency: 10,
    timeEfficiency: 20,
    reward: {
      type: 'fixed',
      amount: 0,
      paymentStatus: 'pending'
    },
    materials: [],
    estimatedCost: 0,
    estimatedDuration: 0,
    tags: []
  });
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);
  const [currentTab, setCurrentTab] = useState('basic');
  
  // Autocomplete states
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [pilotSearchOpen, setPilotSearchOpen] = useState(false);
  const [itemSearchValue, setItemSearchValue] = useState('');
  const [pilotSearchValue, setPilotSearchValue] = useState('');
  const [showItemDetails, setShowItemDetails] = useState(false);

  // Reset form when dialog opens/closes or edit task changes
  useEffect(() => {
    if (open && editTask) {
      setFormData(editTask);
      const blueprint = blueprints.find(bp => bp.id === editTask.blueprintId?.toString());
      setSelectedBlueprint(blueprint || null);
      setItemSearchValue(blueprint?.productTypeName || '');
      
      // Set pilot search value if task is assigned
      const assignedMember = members.find(m => 
        m.characterId.toString() === editTask.assignedTo || 
        m.characterName === editTask.assignedToName
      );
      setPilotSearchValue(assignedMember?.characterName || editTask.assignedToName || '');
    } else if (open && !editTask) {
      setFormData({
        title: '',
        description: '',
        taskType: 'manufacturing',
        priority: 'normal',
        status: 'pending',
        runs: 1,
        materialEfficiency: 10,
        timeEfficiency: 20,
        reward: {
          type: 'fixed',
          amount: 0,
          paymentStatus: 'pending'
        },
        materials: [],
        estimatedCost: 0,
        estimatedDuration: 0,
        tags: []
      });
      setSelectedBlueprint(null);
      setItemSearchValue('');
      setPilotSearchValue('');
    }
  }, [open, editTask, blueprints, members]);

  // Filtered options for autocomplete
  const filteredBlueprints = useMemo(() => {
    return blueprints.filter(bp => 
      bp.productTypeName.toLowerCase().includes(itemSearchValue.toLowerCase()) ||
      bp.typeName.toLowerCase().includes(itemSearchValue.toLowerCase())
    );
  }, [blueprints, itemSearchValue]);

  const filteredMembers = useMemo(() => {
    return members.filter(member => 
      member.isActive &&
      (member.characterName?.toLowerCase().includes(pilotSearchValue.toLowerCase()) ||
       member.name?.toLowerCase().includes(pilotSearchValue.toLowerCase()))
    );
  }, [members, pilotSearchValue]);

  // Update target item and materials when blueprint changes
  useEffect(() => {
    if (selectedBlueprint && formData.runs) {
      const totalMaterials = selectedBlueprint.baseMaterials.map(mat => ({
        ...mat,
        quantity: mat.quantity * formData.runs!,
        totalValue: mat.totalValue * formData.runs!
      }));
      
      setFormData(prev => ({
        ...prev,
        targetItem: {
          typeId: selectedBlueprint.productTypeId,
          typeName: selectedBlueprint.productTypeName,
          quantity: formData.runs!
        },
        blueprintId: selectedBlueprint.typeId,
        blueprintName: selectedBlueprint.typeName,
        materials: totalMaterials,
        estimatedCost: totalMaterials.reduce((sum, mat) => sum + mat.totalValue, 0),
        estimatedDuration: selectedBlueprint.baseTime * formData.runs!,
        title: prev.title || `Manufacture ${selectedBlueprint.productTypeName} x${formData.runs}`
      }));
    }
  }, [selectedBlueprint, formData.runs]);

  const handleItemSelect = (blueprint: Blueprint) => {
    setSelectedBlueprint(blueprint);
    setItemSearchValue(blueprint.productTypeName);
    setItemSearchOpen(false);
  };

  const handlePilotSelect = (member: Member) => {
    const isAssigning = true;
    setFormData(prev => ({ 
      ...prev, 
      assignedTo: member.characterId.toString(),
      assignedToName: member.characterName || member.name,
      assignedDate: new Date().toISOString(),
      assignedBy: user?.characterId?.toString() || user?.characterName || 'unknown',
      assignedByName: user?.characterName || 'Unknown User',
      status: 'assigned'
    }));
    setPilotSearchValue(member.characterName || member.name || '');
    setPilotSearchOpen(false);
  };

  const handlePilotClear = () => {
    setFormData(prev => ({ 
      ...prev, 
      assignedTo: undefined,
      assignedToName: undefined,
      assignedDate: undefined,
      assignedBy: undefined,
      assignedByName: undefined,
      status: 'pending'
    }));
    setPilotSearchValue('');
  };

  // Calculate points for the task based on duration and job type
  const calculateTaskPoints = (jobType: string, duration: number): number => {
    // Find appropriate rate based on job type and estimated category
    let category = 'Modules & Equipment'; // Default
    
    if (selectedBlueprint) {
      if (selectedBlueprint.category.toLowerCase().includes('ship')) {
        category = selectedBlueprint.category.includes('Capital') ? 'Capital Ships' : 'Subcapital Ships';
      }
    }
    
    const rate = (pointsRates || []).find(r => 
      r.jobType === jobType && 
      r.category === category && 
      r.enabled
    ) || (pointsRates || []).find(r => r.jobType === jobType && r.enabled);
    
    if (!rate) return 0;
    
    const hoursWorked = duration / 3600; // Convert seconds to hours
    const basePoints = rate.pointsPerHour * hoursWorked;
    const multiplier = rate.multiplier || 1;
    return Math.round(basePoints * multiplier);
  };

  // Update form when points are calculated
  useEffect(() => {
    if (formData.taskType && formData.estimatedDuration) {
      const points = calculateTaskPoints(formData.taskType, formData.estimatedDuration);
      
      // Auto-set reward if it's currently 0 or not set
      if (!formData.reward || formData.reward.amount === 0) {
        setFormData(prev => ({
          ...prev,
          reward: {
            ...prev.reward!,
            type: 'points',
            amount: points,
            paymentStatus: 'pending'
          }
        }));
      }
    }
  }, [formData.taskType, formData.estimatedDuration, pointsRates]);

  const getItemIcon = () => {
    if (!selectedBlueprint) return <Package size={16} />;
    
    // Use EVE Online typeID to get item icon from ESI
    const iconUrl = `https://images.evetech.net/types/${selectedBlueprint.productTypeId}/icon?size=32`;
    return (
      <img 
        src={iconUrl} 
        alt={selectedBlueprint.productTypeName} 
        className="w-4 h-4"
        onError={(e) => {
          // Fallback to generic package icon
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.targetItem || !user) {
      toast.error('Please fill in all required fields');
      return;
    }

    const task: ManufacturingTask = {
      id: editTask?.id || `task-${Date.now()}`,
      title: formData.title!,
      description: formData.description || '',
      taskType: formData.taskType!,
      priority: formData.priority!,
      status: formData.status!,
      
      targetItem: formData.targetItem!,
      blueprintId: formData.blueprintId,
      blueprintName: formData.blueprintName,
      runs: formData.runs!,
      materialEfficiency: formData.materialEfficiency,
      timeEfficiency: formData.timeEfficiency,
      
      createdBy: user.characterId?.toString() || user.characterName || 'unknown',
      createdByName: user.characterName || 'Unknown User',
      createdDate: editTask?.createdDate || new Date().toISOString(),
      assignedTo: formData.assignedTo,
      assignedToName: formData.assignedToName,
      assignedDate: formData.assignedDate,
      assignedBy: formData.assignedBy,
      assignedByName: formData.assignedByName,
      
      materials: formData.materials || [],
      estimatedCost: formData.estimatedCost || 0,
      estimatedDuration: formData.estimatedDuration || 0,
      suggestedLocation: formData.suggestedLocation,
      
      reward: formData.reward!,
      deadline: formData.deadline,
      preferredStartTime: formData.preferredStartTime,
      
      corporationId: user.corporationId,
      corporationName: user.corporationName,
      tags: formData.tags || [],
      progressNotes: formData.progressNotes || []
    };

    onCreateTask(task);
    onOpenChange(false);
    toast.success(editTask ? 'Task updated successfully' : 'Manufacturing task created successfully');
  };

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'normal': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory size={20} />
            {editTask ? 'Edit Manufacturing Task' : 'Create Manufacturing Task'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="assignment">Assignment</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title..."
                />
              </div>
              <div>
                <Label htmlFor="taskType">Task Type</Label>
                <Select 
                  value={formData.taskType} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, taskType: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="invention">Invention</SelectItem>
                    <SelectItem value="copy">Blueprint Copy</SelectItem>
                    <SelectItem value="reaction">Reaction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the task requirements and expectations..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="deadline">Deadline (Optional)</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={formData.deadline ? new Date(formData.deadline).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    deadline: e.target.value ? new Date(e.target.value).toISOString() : undefined 
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="location">Suggested Location</Label>
                <Input
                  id="location"
                  value={formData.suggestedLocation || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, suggestedLocation: e.target.value }))}
                  placeholder="e.g., Jita IV - Moon 4"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="blueprint">Select Item to Manufacture *</Label>
                <Popover open={itemSearchOpen} onOpenChange={setItemSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={itemSearchOpen}
                      className="w-full justify-between h-10"
                    >
                      <div className="flex items-center gap-2">
                        {getItemIcon()}
                        <span className="truncate">
                          {selectedBlueprint ? selectedBlueprint.productTypeName : "Search for an item..."}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {selectedBlueprint && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-muted"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowItemDetails(true);
                            }}
                          >
                            <Eye size={14} />
                          </Button>
                        )}
                        <CaretUpDown size={14} className="shrink-0 opacity-50" />
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Type item name to search..." 
                        value={itemSearchValue}
                        onValueChange={setItemSearchValue}
                      />
                      <CommandEmpty>No items found matching your search.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-y-auto">
                        {filteredBlueprints.map((blueprint) => (
                          <CommandItem
                            key={blueprint.id}
                            value={blueprint.productTypeName}
                            onSelect={() => handleItemSelect(blueprint)}
                            className="flex items-center gap-2 p-2 cursor-pointer"
                          >
                            <img 
                              src={`https://images.evetech.net/types/${blueprint.productTypeId}/icon?size=32`}
                              alt={blueprint.productTypeName}
                              className="w-6 h-6 rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMzMzIiByeD0iNCIvPgo8cGF0aCBkPSJNMTIgN2EzIDMgMCAwIDAtMyAzdjRhMyAzIDAgMCAwIDMgM2EzIDMgMCAwIDAgMy0zdi00YTMgMyAwIDAgMC0zLTN6bTAgMTBhMSAxIDAgMCAxLTEtMXYtNGExIDEgMCAwIDEgMi0zeiIgZmlsbD0iIzk5OSIvPgo8L3N2Zz4=';
                              }}
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{blueprint.productTypeName}</div>
                              <div className="text-xs text-muted-foreground">
                                {blueprint.category} • ME: {blueprint.materialEfficiency} • TE: {blueprint.timeEfficiency}
                              </div>
                            </div>
                            <Check
                              className={`ml-auto h-4 w-4 ${selectedBlueprint?.id === blueprint.id ? "opacity-100" : "opacity-0"}`}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="runs">Number of Runs *</Label>
                <Input
                  id="runs"
                  type="number"
                  min="1"
                  value={formData.runs}
                  onChange={(e) => setFormData(prev => ({ ...prev, runs: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            {formData.targetItem && (
              <Card className="bg-muted/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Task Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Target Product:</span>
                    <span className="font-medium">{formData.targetItem.typeName} x{formData.targetItem.quantity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estimated Cost:</span>
                    <span className="font-medium text-accent">{formatISK(formData.estimatedCost || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estimated Duration:</span>
                    <span className="font-medium">{formatDuration(formData.estimatedDuration || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Priority:</span>
                    <Badge className={getPriorityColor(formData.priority!)}>
                      {formData.priority?.charAt(0).toUpperCase() + formData.priority?.slice(1)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="assignment" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="assignedTo">Assign to Pilot</Label>
                <Popover open={pilotSearchOpen} onOpenChange={setPilotSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={pilotSearchOpen}
                      className="w-full justify-between h-10"
                    >
                      <div className="flex items-center gap-2">
                        <Users size={16} />
                        <span className="truncate">
                          {formData.assignedToName ? formData.assignedToName : "Select a pilot or leave unassigned..."}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {formData.assignedToName && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-muted"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePilotClear();
                            }}
                          >
                            ×
                          </Button>
                        )}
                        <CaretUpDown size={14} className="shrink-0 opacity-50" />
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Type pilot name to search..." 
                        value={pilotSearchValue}
                        onValueChange={setPilotSearchValue}
                      />
                      <CommandEmpty>No pilots found matching your search.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-y-auto">
                        <CommandItem
                          value="unassigned"
                          onSelect={() => handlePilotClear()}
                          className="flex items-center gap-2 p-2 cursor-pointer"
                        >
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            <User size={14} />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">Leave Unassigned</div>
                            <div className="text-xs text-muted-foreground">Task will remain available for assignment</div>
                          </div>
                        </CommandItem>
                        {filteredMembers.map((member) => (
                          <CommandItem
                            key={member.characterId}
                            value={member.characterName || member.name}
                            onSelect={() => handlePilotSelect(member)}
                            className="flex items-center gap-2 p-2 cursor-pointer"
                          >
                            {member.characterId ? (
                              <img 
                                src={`https://images.evetech.net/characters/${member.characterId}/portrait?size=64`}
                                alt={member.characterName}
                                className="w-6 h-6 rounded-full"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI2IiB5PSI2Ij4KPHBhdGggZD0iTTYgN0M1IDcgNCA2IDQgNUM0IDQgNSAzIDYgM0M3IDMgOCA0IDggNUM4IDYgNyA3IDYgN1oiIGZpbGw9IiM5OTkiLz4KPHN2ZyBcL3N2Zz4KPC9zdmc+';
                                }}
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                                <User size={14} />
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-sm">{member.characterName || member.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {member.title} • {member.corporationName}
                              </div>
                            </div>
                            <Check
                              className={`ml-auto h-4 w-4 ${formData.assignedTo === member.characterId.toString() ? "opacity-100" : "opacity-0"}`}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="preferredStart">Preferred Start Time</Label>
                <Input
                  id="preferredStart"
                  type="datetime-local"
                  value={formData.preferredStartTime ? new Date(formData.preferredStartTime).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    preferredStartTime: e.target.value ? new Date(e.target.value).toISOString() : undefined 
                  }))}
                />
              </div>
            </div>

            {formData.assignedToName && (
              <Card className="bg-muted/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <User size={20} className="text-accent" />
                    <div>
                      <p className="font-medium">Assigned to: {formData.assignedToName}</p>
                      <p className="text-sm text-muted-foreground">
                        Assigned by {formData.assignedByName} on {formData.assignedDate ? new Date(formData.assignedDate).toLocaleDateString() : 'now'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={formData.tags?.join(', ') || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                }))}
                placeholder="e.g., urgent, capital-ships, daily-production"
              />
            </div>
          </TabsContent>

          <TabsContent value="materials" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Package size={20} />
              <span className="font-medium">Required Materials</span>
              {formData.materials?.length && (
                <Badge variant="outline">
                  {formData.materials.length} items
                </Badge>
              )}
            </div>

            {formData.materials?.length ? (
              <div className="overflow-x-auto">
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.materials.map((material, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{material.typeName}</TableCell>
                        <TableCell>{material.quantity.toLocaleString()}</TableCell>
                        <TableCell>{formatISK(material.unitPrice || (material.totalValue / material.quantity))}</TableCell>
                        <TableCell>{formatISK(material.totalValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package size={48} className="mx-auto mb-4" />
                <p>No materials selected</p>
                <p className="text-sm">Select a blueprint in the Basic Info tab to see required materials</p>
              </div>
            )}

            <Card className="bg-muted/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Estimated Cost:</span>
                  <span className="text-lg font-bold text-accent">
                    {formatISK(formData.estimatedCost || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rewardType">Reward Type</Label>
                <Select 
                  value={formData.reward?.type} 
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    reward: { 
                      ...prev.reward!, 
                      type: value as any 
                    } 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed ISK Amount</SelectItem>
                    <SelectItem value="percentage">Percentage of Materials</SelectItem>
                    <SelectItem value="points">Manufacturing Points</SelectItem>
                    <SelectItem value="market_rate">Market Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rewardAmount">
                  {formData.reward?.type === 'fixed' ? 'Amount (ISK)' : 
                   formData.reward?.type === 'percentage' ? 'Percentage (%)' : 
                   formData.reward?.type === 'points' ? 'Points' :
                   'Rate Multiplier'}
                </Label>
                <Input
                  id="rewardAmount"
                  type="number"
                  min="0"
                  step={formData.reward?.type === 'percentage' ? '0.1' : '1000'}
                  value={formData.reward?.amount}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    reward: { 
                      ...prev.reward!, 
                      amount: parseFloat(e.target.value) || 0 
                    } 
                  }))}
                />
              </div>
            </div>

            <Card className="bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CurrencyDollar size={16} />
                  Reward Calculation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {formData.reward?.type === 'fixed' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Fixed Reward:</span>
                    <span className="font-medium text-green-400">
                      {formatISK(formData.reward.amount)}
                    </span>
                  </div>
                )}
                {formData.reward?.type === 'percentage' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Material Cost:</span>
                      <span className="font-medium">{formatISK(formData.estimatedCost || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Percentage ({formData.reward.amount}%):</span>
                      <span className="font-medium text-green-400">
                        {formatISK((formData.estimatedCost || 0) * (formData.reward.amount / 100))}
                      </span>
                    </div>
                  </>
                )}
                {formData.reward?.type === 'points' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Manufacturing Points:</span>
                    <span className="font-medium text-accent">
                      {Math.round(formData.reward.amount)} pts
                    </span>
                  </div>
                )}
                {formData.reward?.type === 'market_rate' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Market Rate (estimated):</span>
                    <span className="font-medium text-green-400">
                      {formatISK((formData.estimatedCost || 0) * (formData.reward?.amount || 1))}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="p-4 border border-blue-500/30 bg-blue-500/10 rounded-lg">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-blue-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-400">Payment Information</p>
                  <p className="text-blue-300/80 mt-1">
                    Rewards will be processed upon successful completion and delivery of the manufactured items. 
                    Payment status can be tracked in the task management interface.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {editTask ? 'Update Task' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
      
      {/* Item Details Popup */}
      {selectedBlueprint && (
        <Dialog open={showItemDetails} onOpenChange={setShowItemDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <img 
                  src={`https://images.evetech.net/types/${selectedBlueprint.productTypeId}/icon?size=64`}
                  alt={selectedBlueprint.productTypeName}
                  className="w-8 h-8 rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <Package size={20} className="text-accent" />
                {selectedBlueprint.productTypeName}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Blueprint Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Blueprint:</span>
                      <span>{selectedBlueprint.typeName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Category:</span>
                      <span>{selectedBlueprint.category}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="flex items-center gap-1">
                        {selectedBlueprint.isOriginal ? 'Original' : 'Copy'}
                        {selectedBlueprint.isOriginal && <Star size={14} className="text-accent" />}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="text-right">{selectedBlueprint.location}</span>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Production Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base Time:</span>
                      <span>{Math.round(selectedBlueprint.baseTime / 60)} minutes</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Material Efficiency:</span>
                      <span className="text-blue-400">{selectedBlueprint.materialEfficiency}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Time Efficiency:</span>
                      <span className="text-green-400">{selectedBlueprint.timeEfficiency}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Runs Available:</span>
                      <span>{selectedBlueprint.runs === -1 ? 'Unlimited' : `${selectedBlueprint.runs}/${selectedBlueprint.maxRuns || selectedBlueprint.runs}`}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Materials Required */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package size={16} />
                    Materials Required (per run)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table className="data-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Total Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedBlueprint.baseMaterials.map((material, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{material.typeName}</TableCell>
                            <TableCell>{material.quantity.toLocaleString()}</TableCell>
                            <TableCell>{formatISK(material.unitPrice || (material.totalValue / material.quantity))}</TableCell>
                            <TableCell>{formatISK(material.totalValue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex justify-between font-medium">
                      <span>Total Cost per Run:</span>
                      <span className="text-accent">
                        {formatISK(selectedBlueprint.baseMaterials.reduce((sum, mat) => sum + mat.totalValue, 0))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Production Projections */}
              {formData.runs && formData.runs > 1 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Factory size={16} />
                      Production Projection ({formData.runs} runs)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Output:</span>
                      <span className="font-medium">{formData.runs} x {selectedBlueprint.productTypeName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Cost:</span>
                      <span className="font-medium text-accent">{formatISK(formData.estimatedCost || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Duration:</span>
                      <span className="font-medium">{formatDuration(formData.estimatedDuration || 0)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowItemDetails(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}