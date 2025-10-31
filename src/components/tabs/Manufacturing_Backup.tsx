import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useKV } from '@/lib/kv';
import { useEVEData } from '@/hooks/useEVEData';
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
  Flask,
  Copy,
  Star,
  Warning,
  CheckCircle,
  ArrowCounterClockwise,
  Globe
} from '@phosphor-icons/react';
import { ManufacturingJob, Blueprint, ProductionPlan, MaterialRequirement, CorpSettings } from '@/lib/types';
import { JobDetailsDialog } from '@/components/manufacturing/JobDetailsDialog';
import { BlueprintDetailsDialog } from '@/components/manufacturing/BlueprintDetailsDialog';
import { ProductionPlanDialog } from '@/components/manufacturing/ProductionPlanDialog';
import { toast } from 'sonner';

export function Manufacturing() {
  const [activeJobs, setActiveJobs] = useKV<ManufacturingJob[]>('manufacturing-jobs', []);
  const [blueprints, setBlueprints] = useKV<Blueprint[]>('blueprints-library', []);
  const [productionPlans, setProductionPlans] = useKV<ProductionPlan[]>('production-plans', []);
  const [settings] = useKV<CorpSettings>('corp-settings', {
    corpName: 'Test Alliance Please Ignore',
    corpTicker: 'TEST',
    corpId: 498125261,
    timezone: 'UTC',
    language: 'en',
    notifications: {
      manufacturing: true,
      mining: true,
      killmails: false,
      markets: true,
    },
    apiKeys: [],
    eveOnlineSync: {
      enabled: false,
      autoSync: false,
      syncInterval: 30,
      lastSync: new Date().toISOString(),
      corporationId: 498125261,
      characterId: 91316135
    }
  });
  
  const [selectedTab, setSelectedTab] = useState('jobs');
  const [newJobDialogOpen, setNewJobDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ManufacturingJob | null>(null);
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [blueprintDetailsOpen, setBlueprintDetailsOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);

  // Ensure safe access to settings
  const eveOnlineSync = settings?.eveOnlineSync || {
    enabled: false,
    autoSync: false,
    syncInterval: 30,
    corporationId: 498125261,
    characterId: 91316135
  };

  // EVE Online integration - ensure settings is properly initialized
  const { data: eveData, refreshData, refreshIndustryJobs } = useEVEData(
    eveOnlineSync.corporationId,
    eveOnlineSync.characterId
  );

  // Ensure eveData is properly initialized
  const safeEveData = eveData || {
    industryJobs: [],
    blueprints: [],
    assets: [],
    marketPrices: [],
    lastUpdate: null,
    isLoading: false,
    error: null
  };

  // Initialize with sample data if empty
  useEffect(() => {
    if (activeJobs.length === 0) {
      const sampleJobs: ManufacturingJob[] = [
        {
          id: 'job-1',
          blueprintId: 12005,
          blueprintName: 'Rifter Blueprint',
          productTypeId: 587,
          productTypeName: 'Rifter',
          runs: 10,
          startDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          facility: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
          facilityId: 60003760,
          installerId: 12345,
          installerName: 'Industrial Pilot Alpha',
          cost: 85000000,
          productQuantity: 10,
          materialEfficiency: 10,
          timeEfficiency: 20,
          duration: 21600,
          materials: [
            { typeId: 34, typeName: 'Tritanium', quantity: 89000, available: 89000, category: 'mineral', unitPrice: 5.2, totalValue: 462800 },
            { typeId: 35, typeName: 'Pyerite', quantity: 12000, available: 12000, category: 'mineral', unitPrice: 8.1, totalValue: 97200 }
          ],
          priority: 'normal'
        },
        {
          id: 'job-2',
          blueprintId: 12008,
          blueprintName: 'Punisher Blueprint',
          productTypeId: 590,
          productTypeName: 'Punisher',
          runs: 5,
          startDate: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          facility: 'Amarr VIII (Oris) - Emperor Family Academy',
          facilityId: 60008494,
          installerId: 12346,
          installerName: 'Industrial Pilot Beta',
          cost: 125000000,
          productQuantity: 5,
          materialEfficiency: 10,
          timeEfficiency: 18,
          duration: 28800,
          materials: [
            { typeId: 34, typeName: 'Tritanium', quantity: 95000, available: 95000, category: 'mineral', unitPrice: 5.2, totalValue: 494000 },
            { typeId: 36, typeName: 'Mexallon', quantity: 8500, available: 8500, category: 'mineral', unitPrice: 95.5, totalValue: 811750 }
          ],
          priority: 'high'
        }
      ];
      setActiveJobs(sampleJobs);
    }

    if (blueprints.length === 0) {
      const sampleBlueprints: Blueprint[] = [
        {
          id: 'bp-1',
          typeId: 12005,
          typeName: 'Rifter Blueprint',
          productTypeId: 587,
          productTypeName: 'Rifter',
          materialEfficiency: 10,
          timeEfficiency: 20,
          runs: -1,
          maxRuns: -1,
          category: 'ship',
          jobType: 'manufacturing',
          isOriginal: true,
          location: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
          locationId: 60003760,
          ownerId: 12345,
          ownerName: 'Industrial Pilot Alpha',
          baseMaterials: [
            { typeId: 34, typeName: 'Tritanium', quantity: 8900, available: 89000, category: 'mineral', unitPrice: 5.2, totalValue: 46280 },
            { typeId: 35, typeName: 'Pyerite', quantity: 1200, available: 12000, category: 'mineral', unitPrice: 8.1, totalValue: 9720 }
          ],
          baseTime: 2160,
          estimatedValue: 25000000
        },
        {
          id: 'bp-2',
          typeId: 12008,
          typeName: 'Punisher Blueprint',
          productTypeId: 590,
          productTypeName: 'Punisher',
          materialEfficiency: 10,
          timeEfficiency: 18,
          runs: -1,
          maxRuns: -1,
          category: 'ship',
          jobType: 'manufacturing',
          isOriginal: true,
          location: 'Amarr VIII (Oris) - Emperor Family Academy',
          locationId: 60008494,
          ownerId: 12346,
          ownerName: 'Industrial Pilot Beta',
          baseMaterials: [
            { typeId: 34, typeName: 'Tritanium', quantity: 9500, available: 95000, category: 'mineral', unitPrice: 5.2, totalValue: 49400 },
            { typeId: 36, typeName: 'Mexallon', quantity: 850, available: 8500, category: 'mineral', unitPrice: 95.5, totalValue: 81175 }
          ],
          baseTime: 2880,
          estimatedValue: 35000000
        }
      ];
      setBlueprints(sampleBlueprints);
    }
  }, [activeJobs.length, blueprints.length, setActiveJobs, setBlueprints]);

  const handleJobUpdate = (jobId: string, updates: Partial<ManufacturingJob>) => {
    setActiveJobs(currentJobs => 
      currentJobs.map(job => 
        job.id === jobId ? { ...job, ...updates } : job
      )
    );
  };

  const handleJobDetails = (job: ManufacturingJob) => {
    setSelectedJob(job);
    setJobDetailsOpen(true);
  };

  const handleBlueprintDetails = (blueprint: Blueprint) => {
    setSelectedBlueprint(blueprint);
    setBlueprintDetailsOpen(true);
  };

  const handleStartJobFromBlueprint = (blueprintId: string, runs: number, facility: string) => {
    const blueprint = blueprints.find(bp => bp.id === blueprintId);
    if (!blueprint) return;

    const newJob: ManufacturingJob = {
      id: `job-${Date.now()}`,
      blueprintId: blueprint.typeId,
      blueprintName: blueprint.typeName,
      productTypeId: blueprint.productTypeId,
      productTypeName: blueprint.productTypeName,
      runs,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + (blueprint.baseTime * runs * 1000)).toISOString(),
      status: 'active',
      facility,
      facilityId: 60003760, // Default facility ID
      installerId: 12345,
      installerName: 'Current User',
      cost: blueprint.baseMaterials.reduce((sum, mat) => sum + (mat.totalValue * runs), 0),
      productQuantity: runs,
      materialEfficiency: blueprint.materialEfficiency,
      timeEfficiency: blueprint.timeEfficiency,
      duration: blueprint.baseTime * runs,
      materials: blueprint.baseMaterials.map(mat => ({
        ...mat,
        quantity: mat.quantity * runs,
        totalValue: mat.totalValue * runs
      })),
      priority: 'normal'
    };

    setActiveJobs(currentJobs => [...currentJobs, newJob]);
  };

  const handleSaveProductionPlan = (plan: ProductionPlan) => {
    setProductionPlans(currentPlans => [...currentPlans, plan]);
  };

  const getJobProgress = (job: ManufacturingJob) => {
    const start = new Date(job.startDate).getTime();
    const end = new Date(job.endDate).getTime();
    const now = Date.now();
    const progress = Math.min(Math.max(((now - start) / (end - start)) * 100, 0), 100);
    return progress;
  };

  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate).getTime();
    const now = Date.now();
    const diff = end - now;
    
    if (diff <= 0) return 'Completed';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const getStatusBadge = (status: string, priority?: string) => {
    const variants: Record<string, any> = {
      active: { variant: 'default', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
      paused: { variant: 'secondary', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      completed: { variant: 'secondary', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      cancelled: { variant: 'destructive', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
      ready: { variant: 'secondary', className: 'bg-accent/20 text-accent border-accent/30' }
    };

    return (
      <div className="flex gap-2">
        <Badge {...variants[status] || variants.active}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
        {priority && priority !== 'normal' && (
          <Badge variant="outline" className={`text-xs ${
            priority === 'high' ? 'border-orange-500/50 text-orange-400' :
            priority === 'urgent' ? 'border-red-500/50 text-red-400' :
            'border-blue-500/50 text-blue-400'
          }`}>
            {priority}
          </Badge>
        )}
      </div>
    );
  };

  const formatISK = (amount: number) => {
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B ISK`;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M ISK`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(0)}K ISK`;
    return `${Math.round(amount)} ISK`;
  };

  const JobsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Manufacturing Jobs</h3>
          <p className="text-sm text-muted-foreground">
            Monitor ongoing production activities
            {eveOnlineSync.enabled && safeEveData.industryJobs.length > 0 && (
              <span className="ml-2 text-green-400">
                • {safeEveData.industryJobs.length} EVE jobs detected
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {eveOnlineSync.enabled && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={refreshIndustryJobs}
              disabled={safeEveData.isLoading}
            >
              {safeEveData.isLoading ? (
                <ArrowCounterClockwise size={16} className="mr-2 animate-spin" />
              ) : (
                <Globe size={16} className="mr-2" />
              )}
              Sync EVE Data
            </Button>
          )}
          <Button onClick={() => setNewJobDialogOpen(true)}>
            <Plus size={16} className="mr-2" />
            New Job
          </Button>
        </div>
      </div>

      {/* EVE Online Jobs Section */}
      {eveOnlineSync.enabled && safeEveData.industryJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-green-400" />
            <h4 className="font-medium text-green-400">Live EVE Online Jobs</h4>
            <Badge variant="outline" className="text-green-400 border-green-500/50">
              {safeEveData.industryJobs.length} active
            </Badge>
          </div>
          
          <div className="grid gap-3">
            {safeEveData.industryJobs.slice(0, 3).map((job) => (
              <Card key={job.job_id} className="bg-card border-green-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Globe size={16} className="text-green-400" />
                        <span className="font-medium">EVE Job #{job.job_id}</span>
                        <Badge variant="outline" className="text-green-400 border-green-500/50 text-xs">
                          {job.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Blueprint ID: {job.blueprint_type_id} • Runs: {job.runs}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Started: {new Date(job.start_date).toLocaleDateString()} • 
                        Ends: {new Date(job.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-400 font-medium">
                        {Math.round(((Date.now() - new Date(job.start_date).getTime()) / 
                                   (new Date(job.end_date).getTime() - new Date(job.start_date).getTime())) * 100)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Complete</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Local Jobs Section */}
      <div className="space-y-4">
        {activeJobs.length > 0 && (
          <div className="flex items-center gap-2">
            <Factory size={18} />
            <h4 className="font-medium">Local Manufacturing Jobs</h4>
          </div>
        )}
        
        <div className="grid gap-4">
          {activeJobs.map((job) => (
          <Card key={job.id} className="bg-card border-border">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-2">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        <Factory size={18} />
                        {job.productTypeName} 
                        <span className="text-muted-foreground">x{job.productQuantity}</span>
                      </h4>
                      <p className="text-sm text-muted-foreground">{job.blueprintName}</p>
                      <p className="text-xs text-muted-foreground mt-1">{job.facility}</p>
                    </div>
                    {getStatusBadge(job.status, job.priority)}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(getJobProgress(job))}%</span>
                    </div>
                    <Progress value={getJobProgress(job)} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Started: {new Date(job.startDate).toLocaleDateString()}</span>
                      <span>Remaining: {getTimeRemaining(job.endDate)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm">
                    <p className="text-muted-foreground">Efficiency</p>
                    <div className="flex gap-4 mt-1">
                      <span className="text-blue-400">ME: {job.materialEfficiency}%</span>
                      <span className="text-green-400">TE: {job.timeEfficiency}%</span>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground">Cost</p>
                    <p className="text-foreground font-medium">{formatISK(job.cost)}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground">Installer</p>
                    <p className="text-foreground">{job.installerName}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start"
                    onClick={() => handleJobDetails(job)}
                  >
                    <Eye size={14} className="mr-2" />
                    Details
                  </Button>
                  {job.status === 'active' && (
                    <Button variant="outline" size="sm" className="justify-start">
                      <Pause size={14} className="mr-2" />
                      Pause
                    </Button>
                  )}
                  {job.status === 'paused' && (
                    <Button variant="outline" size="sm" className="justify-start">
                      <Play size={14} className="mr-2" />
                      Resume
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="justify-start text-red-400 hover:text-red-300">
                    <Stop size={14} className="mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      </div>
    </div>
  );

  const BlueprintsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Blueprint Library</h3>
          <p className="text-sm text-muted-foreground">Manage blueprints and research</p>
        </div>
        <Button variant="outline">
          <Plus size={16} className="mr-2" />
          Add Blueprint
        </Button>
      </div>

      <div className="grid gap-4">
        {blueprints.map((blueprint) => (
          <Card key={blueprint.id} className="bg-card border-border">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Package size={18} />
                    {blueprint.typeName}
                    {blueprint.isOriginal && <Star size={14} className="text-accent" />}
                  </h4>
                  <p className="text-sm text-muted-foreground">Produces: {blueprint.productTypeName}</p>
                  <p className="text-xs text-muted-foreground mt-1">{blueprint.location}</p>
                  
                  <div className="flex gap-2 mt-3">
                    <Badge variant="outline" className="text-xs">
                      {blueprint.category}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {blueprint.jobType}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm">
                    <p className="text-muted-foreground">Research Levels</p>
                    <div className="flex gap-4 mt-1">
                      <span className="text-blue-400">ME: {blueprint.materialEfficiency}</span>
                      <span className="text-green-400">TE: {blueprint.timeEfficiency}</span>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground">Runs</p>
                    <p className="text-foreground">{blueprint.runs === -1 ? 'Original' : `${blueprint.runs}/${blueprint.maxRuns}`}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground">Base Time</p>
                    <p className="text-foreground">{Math.round(blueprint.baseTime / 60)} minutes</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start"
                    onClick={() => handleBlueprintDetails(blueprint)}
                  >
                    <Factory size={14} className="mr-2" />
                    Start Job
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start">
                    <Wrench size={14} className="mr-2" />
                    Research
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start">
                    <Copy size={14} className="mr-2" />
                    Copy
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const ScheduleTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Production Plans</h3>
          <p className="text-sm text-muted-foreground">Plan and schedule manufacturing operations</p>
        </div>
        <Button onClick={() => setPlanDialogOpen(true)}>
          <Plus size={16} className="mr-2" />
          New Plan
        </Button>
      </div>

      {productionPlans.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-center py-12">
              <Calendar size={48} className="mx-auto text-muted-foreground mb-4" />
              <h4 className="text-lg font-semibold mb-2">No Production Plans</h4>
              <p className="text-muted-foreground mb-4">
                Create your first production plan to optimize manufacturing operations
              </p>
              <Button onClick={() => setPlanDialogOpen(true)}>
                <Plus size={16} className="mr-2" />
                Create Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {productionPlans.map((plan) => (
            <Card key={plan.id} className="bg-card border-border">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-2">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-foreground flex items-center gap-2">
                          <Package size={18} />
                          {plan.name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Target: {plan.targetProduct.quantity}x {plan.targetProduct.typeName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {plan.blueprints.length} blueprint(s) | Created {new Date(plan.createdDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-xs ${
                        plan.status === 'draft' ? 'border-yellow-500/50 text-yellow-400' :
                        plan.status === 'approved' ? 'border-blue-500/50 text-blue-400' :
                        plan.status === 'in_progress' ? 'border-green-500/50 text-green-400' :
                        'border-gray-500/50 text-gray-400'
                      }`}>
                        {plan.status.charAt(0).toUpperCase() + plan.status.slice(1).replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm">
                      <p className="text-muted-foreground">Estimated Cost</p>
                      <p className="text-foreground font-medium">{formatISK(plan.estimatedCost)}</p>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground">Estimated Profit</p>
                      <p className={`font-medium ${plan.estimatedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatISK(plan.estimatedProfit)}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground">Duration</p>
                      <p className="text-foreground">{Math.round(plan.estimatedDuration / 3600)}h</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" className="justify-start">
                      <Eye size={14} className="mr-2" />
                      View Details
                    </Button>
                    {plan.status === 'draft' && (
                      <Button variant="outline" size="sm" className="justify-start">
                        <Factory size={14} className="mr-2" />
                        Start Production
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="justify-start">
                      <Copy size={14} className="mr-2" />
                      Duplicate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Factory size={24} />
          Manufacturing Operations
        </h2>
        <p className="text-muted-foreground">
          Manage manufacturing jobs, blueprints, and production scheduling
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Jobs</p>
                <p className="text-2xl font-bold text-green-400">
                  {activeJobs.filter(j => j.status === 'active').length}
                </p>
                {safeEveData.industryJobs.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    EVE: {safeEveData.industryJobs.filter(j => j.status === 'active').length}
                  </p>
                )}
              </div>
              <Factory size={24} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blueprints</p>
                <p className="text-2xl font-bold text-blue-400">{blueprints.length}</p>
                {safeEveData.blueprints.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    EVE: {safeEveData.blueprints.length}
                  </p>
                )}
              </div>
              <Package size={24} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Investment</p>
                <p className="text-2xl font-bold text-accent">
                  {formatISK(activeJobs.reduce((sum, job) => sum + job.cost, 0))}
                </p>
              </div>
              <TrendUp size={24} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold text-green-400">94%</p>
              </div>
              <CheckCircle size={24} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">EVE Data</p>
                {eveOnlineSync.enabled ? (
                  <div>
                    <p className="text-sm font-bold text-green-400">Connected</p>
                    {safeEveData.lastUpdate && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(safeEveData.lastUpdate).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-bold text-muted-foreground">Offline</p>
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <Globe size={20} className={eveOnlineSync.enabled ? 'text-green-400' : 'text-muted-foreground'} />
                {eveOnlineSync.enabled && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-auto p-1"
                    onClick={refreshIndustryJobs}
                    disabled={safeEveData.isLoading}
                  >
                    <ArrowCounterClockwise size={12} className={safeEveData.isLoading ? 'animate-spin' : ''} />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-3 w-fit bg-muted">
          <TabsTrigger value="jobs">Active Jobs</TabsTrigger>
          <TabsTrigger value="blueprints">Blueprints</TabsTrigger>
          <TabsTrigger value="schedule">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <JobsTab />
        </TabsContent>

        <TabsContent value="blueprints">
          <BlueprintsTab />
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleTab />
        </TabsContent>
      </Tabs>

      {/* New Job Dialog */}
      <Dialog open={newJobDialogOpen} onOpenChange={setNewJobDialogOpen}>
        <DialogContent className="max-w-2xl bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory size={20} />
              Start New Manufacturing Job
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="blueprint">Blueprint</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select blueprint" />
                  </SelectTrigger>
                  <SelectContent>
                    {blueprints.map((bp) => (
                      <SelectItem key={bp.id} value={bp.id}>
                        {bp.typeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="runs">Number of Runs</Label>
                <Input type="number" placeholder="1" min="1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="facility">Facility</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select facility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jita">Jita IV - Moon 4 - Caldari Navy Assembly Plant</SelectItem>
                    <SelectItem value="amarr">Amarr VIII (Oris) - Emperor Family Academy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Normal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewJobDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setNewJobDialogOpen(false)}>
                Start Job
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Job Details Dialog */}
      <JobDetailsDialog
        job={selectedJob}
        open={jobDetailsOpen}
        onOpenChange={setJobDetailsOpen}
        onJobUpdate={handleJobUpdate}
      />

      {/* Blueprint Details Dialog */}
      <BlueprintDetailsDialog
        blueprint={selectedBlueprint}
        open={blueprintDetailsOpen}
        onOpenChange={setBlueprintDetailsOpen}
        onStartJob={handleStartJobFromBlueprint}
      />

      {/* Production Plan Dialog */}
      <ProductionPlanDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        blueprints={blueprints}
        onSavePlan={handleSaveProductionPlan}
      />
    </div>
  );
}
