import React from 'react';
import { X, Factory, Clock, Wrench, Flask, Copy } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Blueprint } from '@/lib/types';

interface BlueprintInfoPopupProps {
  blueprint: Blueprint;
  onClose: () => void;
  onAssignJob?: (blueprint: Blueprint) => void;
}

export function BlueprintInfoPopup({ blueprint, onClose, onAssignJob }: BlueprintInfoPopupProps) {
  const [blueprintData, setBlueprintData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadBlueprintData = async () => {
      setLoading(true);
      try {
        const data = await spark.kv.get<any>(`blueprint-data-${blueprint.typeId}`);
        
        setBlueprintData(data || {
          materials: [
            { typeId: 34, typeName: 'Tritanium', quantity: 250000, category: 'Mineral' },
            { typeId: 35, typeName: 'Pyerite', quantity: 120000, category: 'Mineral' },
            { typeId: 36, typeName: 'Mexallon', quantity: 45000, category: 'Mineral' },
            { typeId: 37, typeName: 'Isogen', quantity: 18000, category: 'Mineral' },
            { typeId: 11399, typeName: 'Morphite', quantity: 250, category: 'Mineral' }
          ],
          buildTime: 14400,
          skillRequirements: [
            { skillName: 'Industry', level: 5 },
            { skillName: 'Caldari Cruiser', level: 4 },
            { skillName: 'Science', level: 3 }
          ],
          outputQuantity: 1
        });
      } catch (error) {
        console.error('Error loading blueprint data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBlueprintData();
  }, [blueprint.typeId]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const calculateAdjustedTime = (baseTime: number, te: number): number => {
    return Math.floor(baseTime * (1 - (te / 100)));
  };

  const calculateAdjustedMaterials = (materials: any[], me: number): any[] => {
    return materials.map(mat => ({
      ...mat,
      adjustedQuantity: Math.ceil(mat.quantity * (1 - (me / 100)))
    }));
  };

  const adjustedTime = blueprintData ? calculateAdjustedTime(blueprintData.buildTime, blueprint.timeEfficiency) : 0;
  const adjustedMaterials = blueprintData ? calculateAdjustedMaterials(blueprintData.materials, blueprint.materialEfficiency) : [];

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-card border-2 border-accent/30 rounded-lg w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* EVE-style Header */}
        <div className="bg-gradient-to-r from-accent/20 to-accent/10 border-b-2 border-accent/30 p-4">
          <div className="flex items-start gap-4">
            {/* Blueprint Image */}
            <div className="w-24 h-24 bg-background/50 border border-accent/30 rounded flex-shrink-0 overflow-hidden">
              <img 
                src={`https://images.evetech.net/types/${blueprint.typeId}/bp?size=128`}
                alt={blueprint.typeName}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://images.evetech.net/types/${blueprint.typeId}/icon?size=128`;
                }}
              />
            </div>

            {/* Primary Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-foreground mb-1 truncate">{blueprint.typeName}</h2>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge variant="outline" className={
                      blueprint.isOriginal 
                        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                        : "bg-blue-500/20 text-blue-400 border-blue-500/50"
                    }>
                      {blueprint.isOriginal ? 'Original' : 'Copy'}
                    </Badge>
                    <Badge variant="outline" className="bg-accent/20 text-accent border-accent/50">
                      {blueprint.category}
                    </Badge>
                    {blueprint.runs !== -1 && (
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                        {blueprint.runs} runs
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {blueprint.location}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="flex-shrink-0 hover:bg-destructive/20 hover:text-destructive"
                >
                  <X size={20} />
                </Button>
              </div>

              {/* Quick Stats Row */}
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="bg-background/50 rounded px-3 py-2 border border-border/50">
                  <div className="text-xs text-muted-foreground">Material Efficiency</div>
                  <div className="text-lg font-semibold text-green-400">{blueprint.materialEfficiency}%</div>
                </div>
                <div className="bg-background/50 rounded px-3 py-2 border border-border/50">
                  <div className="text-xs text-muted-foreground">Time Efficiency</div>
                  <div className="text-lg font-semibold text-blue-400">{blueprint.timeEfficiency}%</div>
                </div>
                <div className="bg-background/50 rounded px-3 py-2 border border-border/50">
                  <div className="text-xs text-muted-foreground">Build Time</div>
                  <div className="text-lg font-semibold text-foreground">
                    {!loading && blueprintData ? formatDuration(adjustedTime) : '...'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Details Section with Tabs */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading blueprint data...</div>
            </div>
          ) : (
            <Tabs defaultValue="materials" className="w-full">
              <TabsList className="w-full grid grid-cols-3 mb-4">
                <TabsTrigger value="materials">Materials</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="requirements">Requirements</TabsTrigger>
              </TabsList>

              <TabsContent value="materials" className="space-y-3">
                <div className="bg-muted/30 rounded p-4 border border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-foreground">Material Requirements</div>
                    <Badge variant="outline" className="text-xs">
                      ME {blueprint.materialEfficiency}% Applied
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {adjustedMaterials.map((material, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                        <div className="w-8 h-8 bg-background/50 border border-border/50 rounded flex-shrink-0">
                          <img 
                            src={`https://images.evetech.net/types/${material.typeId}/icon?size=32`}
                            alt={material.typeName}
                            className="w-full h-full object-contain"
                            onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">{material.typeName}</div>
                          <div className="text-xs text-muted-foreground">{material.category}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-foreground">
                            {material.adjustedQuantity.toLocaleString()}
                          </div>
                          {material.adjustedQuantity !== material.quantity && (
                            <div className="text-xs text-muted-foreground line-through">
                              {material.quantity.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/30 rounded p-4 border border-border/50">
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Blueprint Type</div>
                        <div className="text-base font-semibold text-foreground">
                          {blueprint.isOriginal ? 'Original' : 'Blueprint Copy'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Remaining Runs</div>
                        <div className="text-base font-semibold text-foreground">
                          {blueprint.runs === -1 ? 'Unlimited' : blueprint.runs.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Output per Run</div>
                        <div className="text-base font-semibold text-foreground">
                          {blueprintData.outputQuantity}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted/30 rounded p-4 border border-border/50">
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Base Build Time</div>
                        <div className="text-base font-semibold text-foreground">
                          {formatDuration(blueprintData.buildTime)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Adjusted Build Time</div>
                        <div className="text-base font-semibold text-green-400">
                          {formatDuration(adjustedTime)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Category</div>
                        <div className="text-base font-semibold text-foreground">
                          {blueprint.category}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 rounded p-4 border border-border/50">
                  <div className="text-sm text-muted-foreground mb-1">Location</div>
                  <div className="text-base font-semibold text-foreground">
                    {blueprint.location}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/30 rounded p-3 border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench size={16} className="text-green-400" />
                      <div className="text-sm font-semibold text-foreground">Material Efficiency</div>
                    </div>
                    <div className="text-2xl font-bold text-green-400">{blueprint.materialEfficiency}%</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Reduces material waste
                    </div>
                  </div>
                  <div className="bg-muted/30 rounded p-3 border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={16} className="text-blue-400" />
                      <div className="text-sm font-semibold text-foreground">Time Efficiency</div>
                    </div>
                    <div className="text-2xl font-bold text-blue-400">{blueprint.timeEfficiency}%</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Reduces build time
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="requirements" className="space-y-3">
                <div className="bg-muted/30 rounded p-4 border border-border/50">
                  <div className="text-sm font-semibold text-foreground mb-3">Skill Requirements</div>
                  <div className="space-y-2">
                    {blueprintData.skillRequirements.map((skill: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-2">
                          <Flask size={16} className="text-accent" />
                          <span className="text-sm font-medium text-foreground">{skill.skillName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className={`w-3 h-3 rounded-sm ${
                                level <= skill.level
                                  ? 'bg-accent'
                                  : 'bg-border'
                              }`}
                            />
                          ))}
                          <span className="ml-2 text-sm font-semibold text-accent">
                            Level {skill.level}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-muted/30 rounded p-4 border border-border/50">
                  <div className="text-sm font-semibold text-foreground mb-2">Activity</div>
                  <div className="flex items-center gap-2">
                    <Factory size={20} className="text-accent" />
                    <span className="text-base font-medium text-foreground">Manufacturing</span>
                  </div>
                </div>

                <div className="bg-muted/30 rounded p-4 border border-border/50">
                  <div className="text-sm font-semibold text-foreground mb-2">Manufacturing Notes</div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Production time is affected by structure bonuses and skills</p>
                    <p>• Material costs are reduced by ME research and structure rigs</p>
                    <p>• Can be manufactured in any structure with manufacturing service</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Action Button */}
          {onAssignJob && (
            <div className="mt-4 pt-4 border-t border-border">
              <Button
                onClick={() => {
                  onAssignJob(blueprint);
                  onClose();
                }}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Factory size={16} className="mr-2" />
                Assign Manufacturing Job
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
