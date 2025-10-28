import React from 'react';
import { X, Building, Package, ArrowRight, Wrench, Users, Clock } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ManufacturingTask } from '@/lib/types';

interface StationInfoPopupProps {
  stationId: number;
  stationName: string;
  onClose: () => void;
  onViewAssets?: () => void;
}

interface StationData {
  name: string;
  typeId: number;
  typeName: string;
  systemId: number;
  systemName: string;
  regionName: string;
  securityStatus: number;
  owner?: string;
}

interface SupplyItem {
  typeId: number;
  typeName: string;
  requiredQuantity: number;
  availableQuantity: number;
  category: string;
}

export function StationInfoPopup({ stationId, stationName, onClose, onViewAssets }: StationInfoPopupProps) {
  const [stationData, setStationData] = React.useState<StationData | null>(null);
  const [supplies, setSupplies] = React.useState<SupplyItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadStationData = async () => {
      setLoading(true);
      try {
        const cachedStation = await spark.kv.get<StationData>(`station-info-${stationId}`);
        const cachedSupplies = await spark.kv.get<SupplyItem[]>(`station-supplies-${stationId}`);
        
        if (cachedStation) {
          setStationData(cachedStation);
        } else {
          setStationData({
            name: stationName,
            typeId: 52678,
            typeName: 'Astrahus',
            systemId: 30000142,
            systemName: stationName.includes('Jita') ? 'Jita' : 'Unknown System',
            regionName: stationName.includes('Jita') ? 'The Forge' : 'Unknown Region',
            securityStatus: 0.9,
            owner: 'Your Corporation'
          });
        }
        
        const tasks = await spark.kv.get<ManufacturingTask[]>('manufacturing-tasks') || [];
        const stationTasks = tasks.filter(task => task.stationId === stationId);
        
        const supplyMap = new Map<number, SupplyItem>();
        
        stationTasks.forEach(task => {
          if (task.requirements?.materials) {
            task.requirements.materials.forEach(mat => {
              const existing = supplyMap.get(mat.typeId);
              if (existing) {
                existing.requiredQuantity += mat.quantity;
              } else {
                supplyMap.set(mat.typeId, {
                  typeId: mat.typeId,
                  typeName: mat.typeName,
                  requiredQuantity: mat.quantity,
                  availableQuantity: Math.floor(mat.quantity * (0.3 + Math.random() * 0.7)),
                  category: 'Raw Materials'
                });
              }
            });
          }
        });
        
        if (cachedSupplies) {
          setSupplies(cachedSupplies);
        } else {
          setSupplies(Array.from(supplyMap.values()));
        }
      } catch (error) {
        console.error('Error loading station data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStationData();
  }, [stationId, stationName]);

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const getSecurityColor = (sec: number): string => {
    if (sec >= 0.5) return 'text-green-400';
    if (sec > 0.0) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSupplyStatus = (item: SupplyItem): { color: string; text: string } => {
    const percentage = (item.availableQuantity / item.requiredQuantity) * 100;
    if (percentage >= 100) return { color: 'text-green-400', text: 'Stocked' };
    if (percentage >= 50) return { color: 'text-yellow-400', text: 'Low Stock' };
    return { color: 'text-red-400', text: 'Critical' };
  };

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-card border-2 border-accent/30 rounded-lg w-full max-w-4xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* EVE-style Header */}
        <div className="bg-gradient-to-r from-accent/20 to-accent/10 border-b-2 border-accent/30 p-4">
          <div className="flex items-start gap-4">
            {/* Station Image */}
            <div className="w-24 h-24 bg-background/50 border border-accent/30 rounded flex-shrink-0 overflow-hidden">
              <img 
                src={stationData ? `https://images.evetech.net/types/${stationData.typeId}/render?size=128` : `https://images.evetech.net/types/52678/render?size=128`}
                alt={stationName}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMjIyIi8+CjxwYXRoIGQ9Ik02NCAzMkw5NiA2NEw2NCA5NkwzMiA2NEw2NCAzMloiIGZpbGw9IiM2NjYiLz4KPC9zdmc+';
                }}
              />
            </div>

            {/* Primary Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-foreground mb-1 truncate">
                    {stationName}
                  </h2>
                  {stationData && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">
                        {stationData.systemName}
                      </span>
                      <span className={getSecurityColor(stationData.securityStatus)}>
                        {stationData.securityStatus.toFixed(1)}
                      </span>
                      <span className="text-muted-foreground">
                        {stationData.regionName}
                      </span>
                    </div>
                  )}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </Button>
              </div>
              
              <div className="flex gap-2 mt-3">
                <Badge variant="outline" className="text-xs bg-accent/10 border-accent/30">
                  <Building size={12} className="mr-1" />
                  {stationData?.typeName || 'Structure'}
                </Badge>
                {stationData?.owner && (
                  <Badge variant="outline" className="text-xs bg-blue-500/10 border-blue-500/30 text-blue-400">
                    <Users size={12} className="mr-1" />
                    {stationData.owner}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="p-6">
          <Tabs defaultValue="supplies" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="supplies">
                <Package size={16} className="mr-2" />
                Required Supplies
              </TabsTrigger>
              <TabsTrigger value="info">
                <Building size={16} className="mr-2" />
                Station Info
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Clock size={16} className="mr-2" />
                Activity
              </TabsTrigger>
            </TabsList>

            {/* Required Supplies Tab */}
            <TabsContent value="supplies" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Wrench size={18} />
                  Manufacturing Supplies Needed
                </h3>
                {onViewAssets && (
                  <Button 
                    onClick={onViewAssets}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    <Package size={16} className="mr-2" />
                    View in Assets
                    <ArrowRight size={16} className="ml-2" />
                  </Button>
                )}
              </div>

              {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package size={48} className="mx-auto mb-4 animate-pulse" />
                  <p>Loading supply requirements...</p>
                </div>
              ) : supplies.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-lg border border-border">
                  <Package size={48} className="mx-auto mb-4 text-muted-foreground" />
                  <h4 className="text-lg font-semibold mb-2">No Active Requirements</h4>
                  <p className="text-muted-foreground">
                    There are no manufacturing tasks requiring supplies at this station.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {supplies.map((item) => {
                    const status = getSupplyStatus(item);
                    const shortage = Math.max(0, item.requiredQuantity - item.availableQuantity);
                    
                    return (
                      <div 
                        key={item.typeId}
                        className="bg-muted/20 border border-border rounded p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <img 
                            src={`https://images.evetech.net/types/${item.typeId}/icon?size=32`}
                            alt={item.typeName}
                            className="w-8 h-8 flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0xNiA4TDI0IDE2TDE2IDI0TDggMTZMMTYgOFoiIGZpbGw9IiM2NjYiLz4KPC9zdmc+';
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-medium text-foreground">{item.typeName}</h4>
                                <p className="text-xs text-muted-foreground">{item.category}</p>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={`${status.color} border-current/30 whitespace-nowrap`}
                              >
                                {status.text}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Required:</span>
                                <span className="text-foreground font-medium">
                                  {formatNumber(item.requiredQuantity)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Available:</span>
                                <span className={`font-medium ${item.availableQuantity >= item.requiredQuantity ? 'text-green-400' : 'text-yellow-400'}`}>
                                  {formatNumber(item.availableQuantity)}
                                </span>
                              </div>
                              {shortage > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground">Need:</span>
                                  <span className="text-red-400 font-medium">
                                    {formatNumber(shortage)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Station Info Tab */}
            <TabsContent value="info" className="space-y-4">
              {stationData && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/20 border border-border rounded p-4">
                    <h4 className="text-sm text-muted-foreground mb-2">Station Type</h4>
                    <p className="text-lg font-medium">{stationData.typeName}</p>
                  </div>
                  <div className="bg-muted/20 border border-border rounded p-4">
                    <h4 className="text-sm text-muted-foreground mb-2">Location</h4>
                    <p className="text-lg font-medium">{stationData.systemName}</p>
                    <p className="text-sm text-muted-foreground">{stationData.regionName}</p>
                  </div>
                  <div className="bg-muted/20 border border-border rounded p-4">
                    <h4 className="text-sm text-muted-foreground mb-2">Security Status</h4>
                    <p className={`text-lg font-medium ${getSecurityColor(stationData.securityStatus)}`}>
                      {stationData.securityStatus.toFixed(1)}
                    </p>
                  </div>
                  <div className="bg-muted/20 border border-border rounded p-4">
                    <h4 className="text-sm text-muted-foreground mb-2">Owner</h4>
                    <p className="text-lg font-medium">{stationData.owner || 'Unknown'}</p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-4">
              <div className="text-center py-12 bg-muted/20 rounded-lg border border-border">
                <Clock size={48} className="mx-auto mb-4 text-muted-foreground" />
                <h4 className="text-lg font-semibold mb-2">Recent Activity</h4>
                <p className="text-muted-foreground">
                  Station activity logs will be displayed here.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
