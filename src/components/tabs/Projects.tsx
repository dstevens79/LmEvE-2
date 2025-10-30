import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useKV } from '@/lib/kv';
import { useAuth } from '@/lib/auth-provider';
import { useProjectsESI } from '@/lib/projects-esi-service';
import {
  FolderOpen,
  Package,
  Plus,
  Trash,
  CheckCircle,
  Clock,
  Users,
  TrendUp,
  Archive,
  Eye,
  Pencil,
  CurrencyDollar,
  Warning,
  ArrowRight,
  Calendar,
  Factory,
  Truck,
  ArrowClockwise
} from '@phosphor-icons/react';

interface CorporationProject {
  id: string;
  name: string;
  description: string;
  hangarId: number;
  hangarName: string;
  hangarDivision: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'critical';
  createdDate: string;
  createdBy: string;
  targetCompletionDate?: string;
  completedDate?: string;
  requirements: ProjectRequirement[];
  deliveries: ProjectDelivery[];
  assignedMembers: string[];
  notes?: string;
  estimatedValue: number;
  actualValue: number;
}

interface ProjectRequirement {
  id: string;
  typeId: number;
  typeName: string;
  quantityRequired: number;
  quantityDelivered: number;
  unitValue: number;
  priority: 'low' | 'normal' | 'high';
  notes?: string;
}

interface ProjectDelivery {
  id: string;
  projectId: string;
  requirementId: string;
  typeId: number;
  typeName: string;
  quantity: number;
  deliveredBy: string;
  deliveredByCharacterId?: number;
  deliveryDate: string;
  verifiedByESI: boolean;
  locationId: number;
  locationName: string;
  flagId: number;
  flagName: string;
  value: number;
  notes?: string;
}

interface HangarDivision {
  id: number;
  name: string;
  division: number;
}

interface ProjectsProps {
  isMobileView?: boolean;
  onLoginClick?: () => void;
}

const HANGAR_DIVISIONS: HangarDivision[] = [
  { id: 1, name: 'Hangar 1', division: 1 },
  { id: 2, name: 'Hangar 2', division: 2 },
  { id: 3, name: 'Hangar 3', division: 3 },
  { id: 4, name: 'Hangar 4', division: 4 },
  { id: 5, name: 'Hangar 5', division: 5 },
  { id: 6, name: 'Hangar 6', division: 6 },
  { id: 7, name: 'Hangar 7', division: 7 }
];

export function Projects({ isMobileView, onLoginClick }: ProjectsProps) {
  const { user } = useAuth();
  const projectsESI = useProjectsESI();
  const [projects, setProjects] = useKV<CorporationProject[]>('corp-projects', []);
  const [activeView, setActiveView] = useState<'overview' | 'active' | 'completed'>('overview');
  const [selectedProject, setSelectedProject] = useState<CorporationProject | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showAddRequirementDialog, setShowAddRequirementDialog] = useState(false);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    hangarDivision: 1,
    priority: 'normal' as const,
    targetCompletionDate: '',
    assignedMembers: [] as string[],
    notes: ''
  });

  const [newRequirement, setNewRequirement] = useState({
    typeId: 0,
    typeName: '',
    quantityRequired: 0,
    unitValue: 0,
    priority: 'normal' as const,
    notes: ''
  });

  useEffect(() => {
    if (projects.length === 0) {
      initializeSampleData();
    }
  }, []);

  const initializeSampleData = () => {
    const sampleProjects: CorporationProject[] = [
      {
        id: 'proj-1',
        name: 'Capital Ship Construction',
        description: 'Gathering materials for Thanatos construction',
        hangarId: 1,
        hangarName: 'Hangar 1',
        hangarDivision: 1,
        status: 'active',
        priority: 'high',
        createdDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'Director Smith',
        targetCompletionDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        assignedMembers: ['Pilot Johnson', 'Manufacturing Chief'],
        estimatedValue: 1500000000,
        actualValue: 850000000,
        requirements: [
          {
            id: 'req-1',
            typeId: 11399,
            typeName: 'Capital Ship Assembly Array',
            quantityRequired: 1,
            quantityDelivered: 1,
            unitValue: 500000000,
            priority: 'high'
          },
          {
            id: 'req-2',
            typeId: 16681,
            typeName: 'Capital Construction Parts',
            quantityRequired: 5000,
            quantityDelivered: 3200,
            unitValue: 150000,
            priority: 'high'
          },
          {
            id: 'req-3',
            typeId: 44,
            typeName: 'Enriched Uranium',
            quantityRequired: 15000,
            quantityDelivered: 15000,
            unitValue: 8500,
            priority: 'normal'
          }
        ],
        deliveries: [
          {
            id: 'del-1',
            projectId: 'proj-1',
            requirementId: 'req-1',
            typeId: 11399,
            typeName: 'Capital Ship Assembly Array',
            quantity: 1,
            deliveredBy: 'Pilot Johnson',
            deliveredByCharacterId: 456789123,
            deliveryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            verifiedByESI: true,
            locationId: 60003760,
            locationName: 'Jita IV - Moon 4',
            flagId: 62,
            flagName: 'CorpDeliveries',
            value: 500000000
          },
          {
            id: 'del-2',
            projectId: 'proj-1',
            requirementId: 'req-2',
            typeId: 16681,
            typeName: 'Capital Construction Parts',
            quantity: 3200,
            deliveredBy: 'Manufacturing Chief',
            deliveredByCharacterId: 789123456,
            deliveryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            verifiedByESI: true,
            locationId: 60003760,
            locationName: 'Jita IV - Moon 4',
            flagId: 62,
            flagName: 'CorpDeliveries',
            value: 480000000
          }
        ],
        notes: 'Priority project for alliance deployment'
      },
      {
        id: 'proj-2',
        name: 'T2 Module Production Line',
        description: 'Materials for mass T2 module production',
        hangarId: 2,
        hangarName: 'Hangar 2',
        hangarDivision: 2,
        status: 'active',
        priority: 'normal',
        createdDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'Manufacturing Chief',
        targetCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        assignedMembers: ['Pilot Johnson'],
        estimatedValue: 450000000,
        actualValue: 125000000,
        requirements: [
          {
            id: 'req-4',
            typeId: 16672,
            typeName: 'R.A.M.- Electronics',
            quantityRequired: 500,
            quantityDelivered: 125,
            unitValue: 250000,
            priority: 'normal'
          }
        ],
        deliveries: [],
        notes: 'Ongoing production pipeline'
      }
    ];

    setProjects(sampleProjects);
  };

  const handleCreateProject = () => {
    if (!newProject.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    const hangar = HANGAR_DIVISIONS.find(h => h.division === newProject.hangarDivision);
    
    const project: CorporationProject = {
      id: `proj-${Date.now()}`,
      name: newProject.name,
      description: newProject.description,
      hangarId: hangar?.id || 1,
      hangarName: hangar?.name || 'Hangar 1',
      hangarDivision: newProject.hangarDivision,
      status: 'active',
      priority: newProject.priority,
      createdDate: new Date().toISOString(),
      createdBy: user?.characterName || 'Unknown',
      targetCompletionDate: newProject.targetCompletionDate || undefined,
      assignedMembers: newProject.assignedMembers,
      notes: newProject.notes,
      requirements: [],
      deliveries: [],
      estimatedValue: 0,
      actualValue: 0
    };

    setProjects(prev => [...prev, project]);
    setShowCreateDialog(false);
    setNewProject({
      name: '',
      description: '',
      hangarDivision: 1,
      priority: 'normal',
      targetCompletionDate: '',
      assignedMembers: [],
      notes: ''
    });
    toast.success('Project created successfully');
  };

  const handleAddRequirement = () => {
    if (!selectedProject) return;
    if (!newRequirement.typeName.trim() || newRequirement.quantityRequired <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    const requirement: ProjectRequirement = {
      id: `req-${Date.now()}`,
      typeId: newRequirement.typeId || Math.floor(Math.random() * 100000),
      typeName: newRequirement.typeName,
      quantityRequired: newRequirement.quantityRequired,
      quantityDelivered: 0,
      unitValue: newRequirement.unitValue,
      priority: newRequirement.priority,
      notes: newRequirement.notes
    };

    setProjects(prev => prev.map(p => 
      p.id === selectedProject.id 
        ? { ...p, requirements: [...p.requirements, requirement] }
        : p
    ));

    setNewRequirement({
      typeId: 0,
      typeName: '',
      quantityRequired: 0,
      unitValue: 0,
      priority: 'normal',
      notes: ''
    });
    setShowAddRequirementDialog(false);
    toast.success('Requirement added');
  };

  const scanHangarForDeliveries = async () => {
    if (!selectedProject) return;

    setIsScanning(true);
    toast.info('Scanning hangar for deliveries via ESI...');

    try {
      const esiDeliveries = projectsESI.simulateDeliveryScan(
        selectedProject.requirements,
        selectedProject.hangarDivision
      );

      if (esiDeliveries.length > 0) {
        const newDeliveries: ProjectDelivery[] = esiDeliveries.map(esiDel => {
          const req = selectedProject.requirements.find(r => r.typeId === esiDel.typeId);
          return {
            id: `del-${Date.now()}-${Math.random()}`,
            projectId: selectedProject.id,
            requirementId: req?.id || '',
            typeId: esiDel.typeId,
            typeName: req?.typeName || `Item ${esiDel.typeId}`,
            quantity: esiDel.quantity,
            deliveredBy: user?.characterName || 'Unknown',
            deliveredByCharacterId: esiDel.characterId,
            deliveryDate: esiDel.timestamp,
            verifiedByESI: esiDel.verified,
            locationId: esiDel.locationId,
            locationName: 'Corporation Hangar',
            flagId: 62,
            flagName: esiDel.locationFlag,
            value: esiDel.quantity * (req?.unitValue || 0),
            notes: 'Auto-detected via ESI container logs'
          };
        });

        setProjects(prev => prev.map(p => {
          if (p.id === selectedProject.id) {
            const updatedRequirements = p.requirements.map(req => {
              const deliveriesForReq = newDeliveries.filter(d => d.requirementId === req.id);
              const totalNewDelivered = deliveriesForReq.reduce((sum, d) => sum + d.quantity, 0);
              
              return {
                ...req,
                quantityDelivered: req.quantityDelivered + totalNewDelivered
              };
            });

            const totalNewValue = newDeliveries.reduce((sum, d) => sum + d.value, 0);

            return {
              ...p,
              requirements: updatedRequirements,
              deliveries: [...p.deliveries, ...newDeliveries],
              actualValue: p.actualValue + totalNewValue
            };
          }
          return p;
        }));

        toast.success(`Found ${newDeliveries.length} new deliveries worth ${(newDeliveries.reduce((s, d) => s + d.value, 0) / 1000000).toFixed(1)}M ISK`);
        
        if (selectedProject) {
          const updated = projects.find(p => p.id === selectedProject.id);
          if (updated) {
            setSelectedProject({
              ...updated,
              deliveries: [...updated.deliveries, ...newDeliveries]
            });
          }
        }
      } else {
        toast.info('No new deliveries found in hangar');
      }
    } catch (error) {
      console.error('Error scanning hangar:', error);
      toast.error('Failed to scan hangar. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const getProjectCompletionPercentage = (project: CorporationProject): number => {
    if (project.requirements.length === 0) return 0;
    
    const totalRequired = project.requirements.reduce((sum, req) => sum + req.quantityRequired, 0);
    const totalDelivered = project.requirements.reduce((sum, req) => sum + req.quantityDelivered, 0);
    
    return Math.round((totalDelivered / totalRequired) * 100);
  };

  const getRequirementCompletionPercentage = (req: ProjectRequirement): number => {
    return Math.round((req.quantityDelivered / req.quantityRequired) * 100);
  };

  const activeProjects = projects.filter(p => p.status === 'active');
  const completedProjects = projects.filter(p => p.status === 'completed');

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-400 bg-red-500/20';
      case 'high': return 'text-orange-400 bg-orange-500/20';
      case 'normal': return 'text-blue-400 bg-blue-500/20';
      case 'low': return 'text-gray-400 bg-gray-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen size={24} />
              Corporation Projects
            </CardTitle>
            <CardDescription>Authentication required</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Sign in to access corporation project management and hangar tracking.
            </p>
            <Button onClick={onLoginClick}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FolderOpen size={32} className="text-accent" />
            Corporation Projects
          </h1>
          <p className="text-muted-foreground mt-1">
            Track material deliveries and project progress via industry hangar
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-accent hover:bg-accent/90">
          <Plus size={18} className="mr-2" />
          New Project
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{activeProjects.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently tracking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">
              {(projects.reduce((sum, p) => sum + p.actualValue, 0) / 1000000).toFixed(1)}M
            </div>
            <p className="text-xs text-muted-foreground mt-1">ISK delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">
              {projects.length > 0 
                ? Math.round(projects.reduce((sum, p) => sum + getProjectCompletionPercentage(p), 0) / projects.length)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Average progress</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="active">
            Active Projects
            {activeProjects.length > 0 && (
              <Badge variant="secondary" className="ml-2">{activeProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest deliveries across all projects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {projects
                  .flatMap(p => p.deliveries.map(d => ({ ...d, projectName: p.name })))
                  .sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime())
                  .slice(0, 5)
                  .map((delivery, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <Package size={20} className="text-accent" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{delivery.typeName}</div>
                        <div className="text-xs text-muted-foreground">
                          {delivery.projectName} • {delivery.deliveredBy} • {new Date(delivery.deliveryDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm">{delivery.quantity.toLocaleString()}</div>
                        <div className="text-xs text-green-400">{(delivery.value / 1000000).toFixed(1)}M ISK</div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {activeProjects.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <FolderOpen size={48} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No active projects</p>
                <Button onClick={() => setShowCreateDialog(true)} variant="outline" className="mt-4">
                  Create First Project
                </Button>
              </CardContent>
            </Card>
          ) : (
            activeProjects.map(project => {
              const completion = getProjectCompletionPercentage(project);
              return (
                <Card key={project.id} className="hover:border-accent/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {project.name}
                          <Badge className={getPriorityColor(project.priority)}>
                            {project.priority}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">{project.description}</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProject(project);
                          setShowDetailsDialog(true);
                        }}
                      >
                        <Eye size={16} className="mr-2" />
                        Details
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Overall Progress</span>
                        <span className="text-sm font-medium">{completion}%</span>
                      </div>
                      <Progress value={completion} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">Hangar</div>
                        <div className="font-medium">{project.hangarName}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Requirements</div>
                        <div className="font-medium">{project.requirements.length}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Deliveries</div>
                        <div className="font-medium">{project.deliveries.length}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Value</div>
                        <div className="font-medium text-green-400">
                          {(project.actualValue / 1000000).toFixed(1)}M
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedProjects.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <CheckCircle size={48} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No completed projects yet</p>
              </CardContent>
            </Card>
          ) : (
            completedProjects.map(project => (
              <Card key={project.id}>
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>{project.description}</CardDescription>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Define a new corporation project to track material deliveries
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Project Name</Label>
              <Input
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="e.g., Capital Ship Construction"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                placeholder="Describe the project goals..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Delivery Hangar</Label>
                <Select
                  value={newProject.hangarDivision.toString()}
                  onValueChange={(v) => setNewProject({ ...newProject, hangarDivision: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HANGAR_DIVISIONS.map(h => (
                      <SelectItem key={h.id} value={h.division.toString()}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={newProject.priority}
                  onValueChange={(v) => setNewProject({ ...newProject, priority: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Target Completion Date (Optional)</Label>
              <Input
                type="date"
                value={newProject.targetCompletionDate}
                onChange={(e) => setNewProject({ ...newProject, targetCompletionDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={newProject.notes}
                onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
                placeholder="Additional project notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateProject} className="bg-accent hover:bg-accent/90">
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedProject && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedProject.name}
                  <Badge className={getPriorityColor(selectedProject.priority)}>
                    {selectedProject.priority}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{selectedProject.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Hangar</div>
                    <div className="font-medium">{selectedProject.hangarName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Created</div>
                    <div className="font-medium">{new Date(selectedProject.createdDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Progress</div>
                    <div className="font-medium">{getProjectCompletionPercentage(selectedProject)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Value</div>
                    <div className="font-medium text-green-400">
                      {(selectedProject.actualValue / 1000000).toFixed(1)}M ISK
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Requirements</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddRequirementDialog(true)}
                    >
                      <Plus size={16} className="mr-2" />
                      Add Requirement
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {selectedProject.requirements.map(req => {
                      const completion = getRequirementCompletionPercentage(req);
                      return (
                        <div key={req.id} className="p-3 bg-muted/30 rounded-lg space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{req.typeName}</div>
                              <div className="text-xs text-muted-foreground">
                                {req.quantityDelivered.toLocaleString()} / {req.quantityRequired.toLocaleString()} units
                              </div>
                            </div>
                            <Badge variant={completion === 100 ? 'default' : 'secondary'}>
                              {completion}%
                            </Badge>
                          </div>
                          <Progress value={completion} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Deliveries</h3>
                    <Button
                      size="sm"
                      onClick={scanHangarForDeliveries}
                      disabled={isScanning}
                      className="bg-accent hover:bg-accent/90"
                    >
                      <ArrowClockwise size={16} className={`mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                      {isScanning ? 'Scanning...' : 'Scan Hangar'}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {selectedProject.deliveries.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        No deliveries yet. Scan hangar to detect new deliveries.
                      </div>
                    ) : (
                      selectedProject.deliveries
                        .sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime())
                        .map(delivery => (
                          <div key={delivery.id} className="flex items-center gap-3 p-3 bg-muted/20 rounded">
                            <Package size={18} className="text-accent" />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{delivery.typeName}</div>
                              <div className="text-xs text-muted-foreground">
                                {delivery.deliveredBy} • {new Date(delivery.deliveryDate).toLocaleDateString()}
                                {delivery.verifiedByESI && (
                                  <Badge variant="secondary" className="ml-2 text-xs">ESI Verified</Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-sm">{delivery.quantity.toLocaleString()}</div>
                              <div className="text-xs text-green-400">{(delivery.value / 1000000).toFixed(2)}M</div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAddRequirementDialog} onOpenChange={setShowAddRequirementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Requirement</DialogTitle>
            <DialogDescription>Define a material requirement for this project</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item Name</Label>
              <Input
                value={newRequirement.typeName}
                onChange={(e) => setNewRequirement({ ...newRequirement, typeName: e.target.value })}
                placeholder="e.g., Tritanium"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity Required</Label>
                <Input
                  type="number"
                  value={newRequirement.quantityRequired || ''}
                  onChange={(e) => setNewRequirement({ ...newRequirement, quantityRequired: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Unit Value (ISK)</Label>
                <Input
                  type="number"
                  value={newRequirement.unitValue || ''}
                  onChange={(e) => setNewRequirement({ ...newRequirement, unitValue: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={newRequirement.priority}
                onValueChange={(v) => setNewRequirement({ ...newRequirement, priority: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRequirementDialog(false)}>Cancel</Button>
            <Button onClick={handleAddRequirement} className="bg-accent hover:bg-accent/90">
              Add Requirement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
