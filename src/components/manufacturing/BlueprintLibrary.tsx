import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Copy, 
  FileText, 
  ArrowClockwise, 
  MagnifyingGlass,
  SortAscending,
  SortDescending,
  Package,
  MapPin,
  Star,
  Clock
} from '@phosphor-icons/react';
import { useBlueprints } from '@/hooks/useBlueprints';
import { useAuth } from '@/lib/auth-provider';
import { Blueprint } from '@/lib/types';

interface BlueprintLibraryProps {
  isMobileView?: boolean;
}

export function BlueprintLibrary({ isMobileView }: BlueprintLibraryProps) {
  const { user } = useAuth();
  const { blueprints, isLoading, error, refreshBlueprints, lastUpdate } = useBlueprints(
    user?.corporationId,
    user?.accessToken
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'original' | 'copy'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'me' | 'te' | 'runs'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const categories = useMemo(() => {
    const cats = new Set(blueprints.map(bp => bp.category));
    return ['all', ...Array.from(cats).sort()];
  }, [blueprints]);

  const filteredAndSortedBlueprints = useMemo(() => {
    let filtered = blueprints.filter(bp => {
      const matchesSearch = bp.typeName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || bp.category === categoryFilter;
      const matchesType = typeFilter === 'all' || 
        (typeFilter === 'original' && bp.isOriginal) || 
        (typeFilter === 'copy' && bp.isCopy);
      
      return matchesSearch && matchesCategory && matchesType;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.typeName.localeCompare(b.typeName);
          break;
        case 'me':
          comparison = a.materialEfficiency - b.materialEfficiency;
          break;
        case 'te':
          comparison = a.timeEfficiency - b.timeEfficiency;
          break;
        case 'runs':
          comparison = a.runs - b.runs;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [blueprints, searchTerm, categoryFilter, typeFilter, sortBy, sortOrder]);

  const stats = useMemo(() => {
    const total = blueprints.length;
    const originals = blueprints.filter(bp => bp.isOriginal).length;
    const copies = blueprints.filter(bp => bp.isCopy).length;
    const perfect = blueprints.filter(bp => bp.materialEfficiency === 10 && bp.timeEfficiency === 20).length;
    
    return { total, originals, copies, perfect };
  }, [blueprints]);

  const toggleSort = (field: 'name' | 'me' | 'te' | 'runs') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: 'name' | 'me' | 'te' | 'runs' }) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <SortAscending size={14} /> : <SortDescending size={14} />;
  };

  const getEfficiencyColor = (value: number, max: number) => {
    const percentage = (value / max) * 100;
    if (percentage === 100) return 'text-green-400';
    if (percentage >= 75) return 'text-blue-400';
    if (percentage >= 50) return 'text-yellow-400';
    return 'text-muted-foreground';
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Please sign in to view corporation blueprints
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText size={24} className="text-accent" />
              Blueprint Library
            </CardTitle>
            <div className="flex items-center gap-2">
              {lastUpdate && (
                <span className="text-xs text-muted-foreground">
                  Updated: {new Date(lastUpdate).toLocaleTimeString()}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={refreshBlueprints}
                disabled={isLoading}
              >
                <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
                {!isMobileView && <span className="ml-2">Refresh</span>}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="text-2xl font-bold text-accent">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Blueprints</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-400">{stats.originals}</div>
              <div className="text-xs text-muted-foreground">Originals</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-400">{stats.copies}</div>
              <div className="text-xs text-muted-foreground">Copies</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="text-2xl font-bold text-green-400">{stats.perfect}</div>
              <div className="text-xs text-muted-foreground">Perfect (10/20)</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div className="relative md:col-span-2">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search blueprints..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | 'original' | 'copy')}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="original">Originals Only</SelectItem>
                <SelectItem value="copy">Copies Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowClockwise size={32} className="animate-spin mx-auto mb-2" />
              <p>Loading blueprints from ESI...</p>
            </div>
          ) : filteredAndSortedBlueprints.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package size={32} className="mx-auto mb-2 opacity-50" />
              <p>No blueprints found</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('name')}>
                      <div className="flex items-center gap-1">
                        Blueprint Name
                        <SortIcon field="name" />
                      </div>
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('me')}>
                      <div className="flex items-center gap-1">
                        ME
                        <SortIcon field="me" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('te')}>
                      <div className="flex items-center gap-1">
                        TE
                        <SortIcon field="te" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('runs')}>
                      <div className="flex items-center gap-1">
                        Runs
                        <SortIcon field="runs" />
                      </div>
                    </TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedBlueprints.map((bp) => (
                    <TableRow key={bp.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {bp.isOriginal && <Star size={14} className="text-yellow-400" weight="fill" />}
                          {bp.typeName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={bp.isOriginal ? 'default' : 'secondary'} className="text-xs">
                          {bp.isOriginal ? (
                            <>
                              <FileText size={12} className="mr-1" />
                              BPO
                            </>
                          ) : (
                            <>
                              <Copy size={12} className="mr-1" />
                              BPC
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{bp.category}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-mono font-semibold ${getEfficiencyColor(bp.materialEfficiency, 10)}`}>
                          {bp.materialEfficiency}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-mono font-semibold ${getEfficiencyColor(bp.timeEfficiency, 20)}`}>
                          {bp.timeEfficiency}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {bp.isOriginal ? '∞' : bp.runs.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin size={12} />
                          <span className="truncate max-w-[200px]" title={bp.location}>
                            {bp.locationFlag}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 text-xs text-muted-foreground text-center">
            Showing {filteredAndSortedBlueprints.length} of {blueprints.length} blueprints
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
