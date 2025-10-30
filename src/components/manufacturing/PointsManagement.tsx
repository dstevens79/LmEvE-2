import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Star,
  TrendUp,
  Clock,
  Award,
  Users,
  Calculator,
  Edit,
  Plus,
  History,
  CheckCircle,
  Factory
} from '@phosphor-icons/react';
import { useKV } from '@/lib/kv';
import { useAuth } from '@/lib/auth-provider';
import { Member } from '@/lib/types';
import { toast } from 'sonner';

// Point system types
export interface PointsRate {
  id: string;
  jobType: 'manufacturing' | 'research' | 'invention' | 'copy' | 'reaction';
  category: string;
  pointsPerHour: number;
  description: string;
  multiplier?: number;
  enabled: boolean;
  createdDate: string;
  updatedDate: string;
}

export interface PointsTransaction {
  id: string;
  memberId: string;
  memberName: string;
  taskId?: string;
  taskName?: string;
  jobType: string;
  category: string;
  hoursWorked: number;
  pointsEarned: number;
  pointsRate: number;
  multiplier?: number;
  description: string;
  status: 'pending' | 'approved' | 'paid' | 'disputed';
  createdDate: string;
  approvedDate?: string;
  approvedBy?: string;
  paidDate?: string;
  paidBy?: string;
}

export interface MemberPoints {
  memberId: string;
  memberName: string;
  totalPoints: number;
  pendingPoints: number;
  paidPoints: number;
  lastActivity?: string;
  joinedDate: string;
}

interface PointsManagementProps {
  members: Member[];
  isMobileView?: boolean;
}

export function PointsManagement({ members, isMobileView }: PointsManagementProps) {
  const { user } = useAuth();
  const [pointsRates, setPointsRates] = useKV<PointsRate[]>('points-rates', []);
  const [pointsTransactions, setPointsTransactions] = useKV<PointsTransaction[]>('points-transactions', []);
  const [memberPoints, setMemberPoints] = useKV<MemberPoints[]>('member-points', []);
  
  const [selectedTab, setSelectedTab] = useState('overview');
  const [editRateDialog, setEditRateDialog] = useState(false);
  const [editingRate, setEditingRate] = useState<PointsRate | null>(null);
  const [newRateForm, setNewRateForm] = useState({
    jobType: 'manufacturing' as const,
    category: '',
    pointsPerHour: 0,
    description: '',
    multiplier: 1
  });

  // Initialize default rates if empty
  useEffect(() => {
    if ((pointsRates || []).length === 0) {
      const defaultRates: PointsRate[] = [
        {
          id: 'rate-manufacturing-subcapital',
          jobType: 'manufacturing',
          category: 'Subcapital Ships',
          pointsPerHour: 100,
          description: 'Standard subcapital ship manufacturing',
          enabled: true,
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString()
        },
        {
          id: 'rate-manufacturing-capital',
          jobType: 'manufacturing',
          category: 'Capital Ships',
          pointsPerHour: 250,
          description: 'Capital ship manufacturing - higher complexity',
          multiplier: 2.5,
          enabled: true,
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString()
        },
        {
          id: 'rate-manufacturing-modules',
          jobType: 'manufacturing',
          category: 'Modules & Equipment',
          pointsPerHour: 75,
          description: 'Module and equipment manufacturing',
          enabled: true,
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString()
        },
        {
          id: 'rate-research-me',
          jobType: 'research',
          category: 'Material Efficiency',
          pointsPerHour: 50,
          description: 'Blueprint material efficiency research',
          enabled: true,
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString()
        },
        {
          id: 'rate-research-te',
          jobType: 'research',
          category: 'Time Efficiency',
          pointsPerHour: 50,
          description: 'Blueprint time efficiency research',
          enabled: true,
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString()
        },
        {
          id: 'rate-invention',
          jobType: 'invention',
          category: 'Tech II Invention',
          pointsPerHour: 150,
          description: 'Tech II blueprint invention',
          multiplier: 1.5,
          enabled: true,
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString()
        },
        {
          id: 'rate-copy',
          jobType: 'copy',
          category: 'Blueprint Copying',
          pointsPerHour: 25,
          description: 'Blueprint copying operations',
          enabled: true,
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString()
        }
      ];
      setPointsRates(defaultRates);
    }
  }, [pointsRates, setPointsRates]);

  // Calculate member points from transactions
  useEffect(() => {
    const updatedMemberPoints: MemberPoints[] = [];
    const transactions = pointsTransactions || [];
    
    // Get all unique members from transactions and members list
    const allMemberIds = new Set([
      ...transactions.map(t => t.memberId),
      ...members.map(m => m.characterId.toString())
    ]);
    
    allMemberIds.forEach(memberId => {
      const member = members.find(m => m.characterId.toString() === memberId);
      const memberTransactions = transactions.filter(t => t.memberId === memberId);
      
      const totalPoints = memberTransactions
        .filter(t => t.status === 'approved' || t.status === 'paid')
        .reduce((sum, t) => sum + t.pointsEarned, 0);
      
      const pendingPoints = memberTransactions
        .filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + t.pointsEarned, 0);
      
      const paidPoints = memberTransactions
        .filter(t => t.status === 'paid')
        .reduce((sum, t) => sum + t.pointsEarned, 0);
      
      const lastActivity = memberTransactions.length > 0 
        ? Math.max(...memberTransactions.map(t => new Date(t.createdDate).getTime()))
        : undefined;
      
      if (member || memberTransactions.length > 0) {
        updatedMemberPoints.push({
          memberId,
          memberName: member?.characterName || member?.name || 'Unknown Member',
          totalPoints,
          pendingPoints,
          paidPoints,
          lastActivity: lastActivity ? new Date(lastActivity).toISOString() : undefined,
          joinedDate: member?.joinedDate || new Date().toISOString()
        });
      }
    });
    
    setMemberPoints(updatedMemberPoints);
  }, [pointsTransactions, members, setMemberPoints]);

  // Utility function to calculate points for a task
  const calculateTaskPoints = (jobType: string, category: string, hoursWorked: number): number => {
    const rate = (pointsRates || []).find(r => 
      r.jobType === jobType && 
      r.category.toLowerCase() === category.toLowerCase() && 
      r.enabled
    );
    
    if (!rate) return 0;
    
    const basePoints = rate.pointsPerHour * hoursWorked;
    const multiplier = rate.multiplier || 1;
    return Math.round(basePoints * multiplier);
  };

  // Format points display
  const formatPoints = (points: number): string => {
    if (points >= 1000000) return `${(points / 1000000).toFixed(1)}M pts`;
    if (points >= 1000) return `${(points / 1000).toFixed(1)}K pts`;
    return `${Math.round(points)} pts`;
  };

  const handleSaveRate = () => {
    if (!newRateForm.category || !newRateForm.pointsPerHour) {
      toast.error('Please fill in all required fields');
      return;
    }

    const rate: PointsRate = {
      id: editingRate?.id || `rate-${Date.now()}`,
      jobType: newRateForm.jobType,
      category: newRateForm.category,
      pointsPerHour: newRateForm.pointsPerHour,
      description: newRateForm.description,
      multiplier: newRateForm.multiplier,
      enabled: true,
      createdDate: editingRate?.createdDate || new Date().toISOString(),
      updatedDate: new Date().toISOString()
    };

    if (editingRate) {
      setPointsRates(current => 
        (current || []).map(r => r.id === rate.id ? rate : r)
      );
    } else {
      setPointsRates(current => [...(current || []), rate]);
    }

    setEditRateDialog(false);
    setEditingRate(null);
    setNewRateForm({
      jobType: 'manufacturing',
      category: '',
      pointsPerHour: 0,
      description: '',
      multiplier: 1
    });
    
    toast.success(editingRate ? 'Rate updated successfully' : 'New rate created successfully');
  };

  const openEditRate = (rate?: PointsRate) => {
    if (rate) {
      setEditingRate(rate);
      setNewRateForm({
        jobType: rate.jobType,
        category: rate.category,
        pointsPerHour: rate.pointsPerHour,
        description: rate.description,
        multiplier: rate.multiplier || 1
      });
    } else {
      setEditingRate(null);
      setNewRateForm({
        jobType: 'manufacturing',
        category: '',
        pointsPerHour: 0,
        description: '',
        multiplier: 1
      });
    }
    setEditRateDialog(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Award size={24} className="text-accent" />
          Manufacturing Points Management
        </h3>
        <p className="text-muted-foreground">
          Hour-based reward system for manufacturing tasks. Points are earned based on job type and time invested.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Members</p>
                <p className="text-2xl font-bold text-accent">
                  {(memberPoints || []).length}
                </p>
              </div>
              <Users size={24} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Points</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatPoints((memberPoints || []).reduce((sum, m) => sum + m.totalPoints, 0))}
                </p>
              </div>
              <Star size={24} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Points</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {formatPoints((memberPoints || []).reduce((sum, m) => sum + m.pendingPoints, 0))}
                </p>
              </div>
              <Clock size={24} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Rates</p>
                <p className="text-2xl font-bold text-blue-400">
                  {(pointsRates || []).filter(r => r.enabled).length}
                </p>
              </div>
              <Calculator size={24} className="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-4 w-fit bg-muted">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rates">Rates</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendUp size={20} />
                  Points System Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">How It Works</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Points are earned based on hours worked on manufacturing tasks</li>
                      <li>• Different job types have different point rates</li>
                      <li>• Complex jobs (Capital ships, T2 invention) have multipliers</li>
                      <li>• Points are awarded upon task completion</li>
                      <li>• Directors approve point awards before payment</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Current Rates (Points/Hour)</h4>
                    <div className="space-y-1 text-sm">
                      {(pointsRates || [])
                        .filter(r => r.enabled)
                        .slice(0, 5)
                        .map(rate => (
                          <div key={rate.id} className="flex justify-between">
                            <span className="text-muted-foreground">{rate.category}:</span>
                            <span className="font-medium">
                              {rate.pointsPerHour}
                              {rate.multiplier && rate.multiplier !== 1 && (
                                <span className="text-accent"> x{rate.multiplier}</span>
                              )}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rates">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-semibold">Points Rates Configuration</h4>
                <p className="text-sm text-muted-foreground">
                  Manage point rates for different job types and categories
                </p>
              </div>
              <Button onClick={() => openEditRate()}>
                <Plus size={16} className="mr-2" />
                Add Rate
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table className="data-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Points/Hour</TableHead>
                    <TableHead>Multiplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pointsRates || []).map((rate) => (
                    <TableRow key={rate.id}>
                      <TableCell className="capitalize">{rate.jobType}</TableCell>
                      <TableCell>{rate.category}</TableCell>
                      <TableCell className="font-mono">{rate.pointsPerHour}</TableCell>
                      <TableCell>
                        {rate.multiplier && rate.multiplier !== 1 ? (
                          <Badge variant="outline" className="text-accent">
                            x{rate.multiplier}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rate.enabled ? "default" : "secondary"}>
                          {rate.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditRate(rate)}
                        >
                          <Edit size={14} className="mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="members">
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold">Member Points Summary</h4>
              <p className="text-sm text-muted-foreground">
                Track points earned by each corporation member
              </p>
            </div>

            <div className="overflow-x-auto">
              <Table className="data-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Total Points</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(memberPoints || []).map((memberPoint) => (
                    <TableRow key={memberPoint.memberId}>
                      <TableCell className="font-medium">{memberPoint.memberName}</TableCell>
                      <TableCell className="font-mono text-accent">
                        {formatPoints(memberPoint.totalPoints)}
                      </TableCell>
                      <TableCell className="font-mono text-yellow-400">
                        {formatPoints(memberPoint.pendingPoints)}
                      </TableCell>
                      <TableCell className="font-mono text-green-400">
                        {formatPoints(memberPoint.paidPoints)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {memberPoint.lastActivity ? 
                          new Date(memberPoint.lastActivity).toLocaleDateString() : 
                          'No activity'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-green-400">
                          Active
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold">Points Transactions</h4>
              <p className="text-sm text-muted-foreground">
                History of all points earned and awarded
              </p>
            </div>

            {(pointsTransactions || []).length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center py-12">
                    <History size={48} className="mx-auto text-muted-foreground mb-4" />
                    <h4 className="text-lg font-semibold mb-2">No Transactions</h4>
                    <p className="text-muted-foreground">
                      Points transactions will appear here when tasks are completed and processed.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-x-auto">
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Job Type</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(pointsTransactions || []).map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">{transaction.memberName}</TableCell>
                        <TableCell className="truncate max-w-48">
                          {transaction.taskName || transaction.description}
                        </TableCell>
                        <TableCell className="capitalize">{transaction.jobType}</TableCell>
                        <TableCell className="font-mono">{transaction.hoursWorked.toFixed(1)}h</TableCell>
                        <TableCell className="font-mono text-accent">
                          {formatPoints(transaction.pointsEarned)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            transaction.status === 'paid' ? 'default' :
                            transaction.status === 'approved' ? 'secondary' :
                            transaction.status === 'pending' ? 'outline' : 'destructive'
                          }>
                            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(transaction.createdDate).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Rate Dialog */}
      <Dialog open={editRateDialog} onOpenChange={setEditRateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator size={20} />
              {editingRate ? 'Edit Points Rate' : 'Create Points Rate'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="jobType">Job Type</Label>
                <select
                  id="jobType"
                  value={newRateForm.jobType}
                  onChange={(e) => setNewRateForm(prev => ({ ...prev, jobType: e.target.value as any }))}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="manufacturing">Manufacturing</option>
                  <option value="research">Research</option>
                  <option value="invention">Invention</option>
                  <option value="copy">Blueprint Copy</option>
                  <option value="reaction">Reaction</option>
                </select>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={newRateForm.category}
                  onChange={(e) => setNewRateForm(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Capital Ships"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pointsPerHour">Points per Hour</Label>
                <Input
                  id="pointsPerHour"
                  type="number"
                  min="1"
                  value={newRateForm.pointsPerHour}
                  onChange={(e) => setNewRateForm(prev => ({ ...prev, pointsPerHour: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="multiplier">Multiplier (optional)</Label>
                <Input
                  id="multiplier"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={newRateForm.multiplier}
                  onChange={(e) => setNewRateForm(prev => ({ ...prev, multiplier: parseFloat(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newRateForm.description}
                onChange={(e) => setNewRateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this rate category"
              />
            </div>

            {newRateForm.pointsPerHour > 0 && (
              <Card className="bg-muted/20">
                <CardContent className="p-4">
                  <div className="text-sm">
                    <p className="font-medium mb-2">Rate Preview:</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>1 hour:</span>
                        <span className="font-mono">
                          {Math.round(newRateForm.pointsPerHour * newRateForm.multiplier)} points
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>8 hours:</span>
                        <span className="font-mono">
                          {formatPoints(newRateForm.pointsPerHour * newRateForm.multiplier * 8)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>24 hours:</span>
                        <span className="font-mono">
                          {formatPoints(newRateForm.pointsPerHour * newRateForm.multiplier * 24)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRate}>
              {editingRate ? 'Update Rate' : 'Create Rate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export the points calculation utility for use in task assignment
export { calculateTaskPoints };

function calculateTaskPoints(jobType: string, category: string, hoursWorked: number, rates: PointsRate[]): number {
  const rate = rates.find(r => 
    r.jobType === jobType && 
    r.category.toLowerCase() === category.toLowerCase() && 
    r.enabled
  );
  
  if (!rate) return 0;
  
  const basePoints = rate.pointsPerHour * hoursWorked;
  const multiplier = rate.multiplier || 1;
  return Math.round(basePoints * multiplier);
}