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
import { BlueprintInfoPopup } from '@/components/popups/BlueprintInfoPopup';

interface BlueprintLibraryProps {
  isMobileView?: boolean;
  onAssignJob?: (blueprint: Blueprint) => void;
}

export function BlueprintLibrary({ isMobileView, onAssignJob }: BlueprintLibraryProps) {
  const { user } = useAuth();
  const { blueprints, isLoading, error, refreshBlueprints, lastUpdate } = useBlueprints(
    user?.corporationId,
    user?.accessToken
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'original' | 'copy'>('all');
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'me' | 'te' | 'runs'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const stationsWithBlueprints = useMemo(() => {
    const stations = new Set(blueprints.map(bp => bp.location));
    return ['all', ...Array.from(stations).sort()];
  }, [blueprints]);

  const categories = useMemo(() => {
    const cats = new Set(blueprints.map(bp => bp.category));
    return ['all', ...Array.from(cats).sort()];
  }, [blueprints]);

  const filteredAndSortedBlueprints = useMemo(() => {
    let filtered = blueprints.filter(bp => {
      const matchesSearch = bp.typeName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStation = stationFilter === 'all' || bp.location === stationFilter;
      const matchesCategory = categoryFilter === 'all' || bp.category === categoryFilter;
      const matchesType = typeFilter === 'all' || 
        (typeFilter === 'original' && bp.isOriginal) || 
        (typeFilter === 'copy' && bp.isCopy);
      
      return matchesSearch && matchesStation && matchesCategory && matchesType;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      
      comparison = a.location.localeCompare(b.location);
      if (comparison !== 0) return comparison;
      
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
  }, [blueprints, searchTerm, stationFilter, categoryFilter, typeFilter, sortBy, sortOrder]);

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
    <div className="space-y-3">
      {selectedBlueprint && (
        <BlueprintInfoPopup
          blueprint={selectedBlueprint}
          onClose={() => setSelectedBlueprint(null)}
          onAssignJob={onAssignJob}
        />
      )}
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText size={20} className="text-accent" />
              Blueprint Library
            </CardTitle>
            <div className="flex items-center gap-2">
              {lastUpdate && (
                <span className="text-xs text-muted-foreground">
                  {new Date(lastUpdate).toLocaleTimeString()}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={refreshBlueprints}
                disabled={isLoading}
                className="h-7 px-2"
              >
                <ArrowClockwise size={14} className={isLoading ? 'animate-spin' : ''} />
                {!isMobileView && <span className="ml-1 text-xs">Refresh</span>}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-1 space-y-2">
              <div className="relative">
                <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search blueprints..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              
              <Select value={stationFilter} onValueChange={setStationFilter}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Station" />
                </SelectTrigger>
                <SelectContent>
                  {stationsWithBlueprints.map(station => (
                    <SelectItem key={station} value={station}>
                      {station === 'all' ? 'All Stations' : station}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 text-sm flex-1">
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
                  <SelectTrigger className="h-8 text-sm flex-1">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="original">Originals</SelectItem>
                    <SelectItem value="copy">Copies</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-2.5 space-y-1.5 min-w-[140px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-lg font-bold text-accent">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Originals</span>
                <span className="text-sm font-semibold text-blue-400">{stats.originals}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Copies</span>
                <span className="text-sm font-semibold text-purple-400">{stats.copies}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Perfect</span>
                <span className="text-sm font-semibold text-green-400">{stats.perfect}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-3">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowClockwise size={24} className="animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading blueprints from ESI...</p>
            </div>
          ) : filteredAndSortedBlueprints.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No blueprints found</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer h-8 text-xs" onClick={() => toggleSort('name')}>
                      <div className="flex items-center gap-1">
                        Blueprint Name
                        <SortIcon field="name" />
                      </div>
                    </TableHead>
                    <TableHead className="h-8 text-xs">Type</TableHead>
                    <TableHead className="h-8 text-xs">Category</TableHead>
                    <TableHead className="cursor-pointer h-8 text-xs" onClick={() => toggleSort('me')}>
                      <div className="flex items-center gap-1">
                        ME
                        <SortIcon field="me" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer h-8 text-xs" onClick={() => toggleSort('te')}>
                      <div className="flex items-center gap-1">
                        TE
                        <SortIcon field="te" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer h-8 text-xs" onClick={() => toggleSort('runs')}>
                      <div className="flex items-center gap-1">
                        Runs
                        <SortIcon field="runs" />
                      </div>
                    </TableHead>
                    <TableHead className="h-8 text-xs">Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedBlueprints.map((bp) => (
                    <TableRow 
                      key={bp.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors h-9"
                      onClick={() => setSelectedBlueprint(bp)}
                    >
                      <TableCell className="font-medium py-1.5">
                        <div className="flex items-center gap-2">
                          {bp.isOriginal && <Star size={12} className="text-yellow-400" weight="fill" />}
                          <span className="hover:text-accent transition-colors text-sm">{bp.typeName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant={bp.isOriginal ? 'default' : 'secondary'} className="text-xs h-5 px-1.5">
                          {bp.isOriginal ? (
                            <>
                              <FileText size={10} className="mr-0.5" />
                              BPO
                            </>
                          ) : (
                            <>
                              <Copy size={10} className="mr-0.5" />
                              BPC
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <span className="text-xs text-muted-foreground">{bp.category}</span>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <span className={`font-mono font-semibold text-sm ${getEfficiencyColor(bp.materialEfficiency, 10)}`}>
                          {bp.materialEfficiency}
                        </span>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <span className={`font-mono font-semibold text-sm ${getEfficiencyColor(bp.timeEfficiency, 20)}`}>
                          {bp.timeEfficiency}
                        </span>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <span className="font-mono text-xs">
                          {bp.isOriginal ? '∞' : bp.runs.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin size={10} />
                          <span className="truncate max-w-[160px]" title={bp.location}>
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

          <div className="mt-2 text-xs text-muted-foreground text-center">
            Showing {filteredAndSortedBlueprints.length} of {blueprints.length} blueprints
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
