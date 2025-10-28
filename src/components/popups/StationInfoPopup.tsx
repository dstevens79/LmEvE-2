import React from 'react';
import { X, Building, Package, ArrowRight, Wrench, Users, Clock } from '@phosphor-icons/react';
import { Tabs, TabsContent, TabsList, TabsTrigge
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  stationId: number;
  onClose: () => void;

interface StationData {
  typeId: number;
  systemId: number;
  regionName: string;
  owner?: string;


  requiredQuantity: num
  category: str

  const [stationDat
  const [loading, s
  React.useEffect(() 
      setLoading(true
        const cachedStati
        
 

            typeId: 52
            syste
            regionN
            owner: 'Your Co
        }
        const tasks
 

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
  const formatNumber = (num: number): string 
            task.requirements.materials.forEach(mat => {

              if (existing) {
    if (sec > 0.0) return 'text-yellow-400';
              } else {

                  typeId: mat.typeId,
                  typeName: mat.typeName,
                  requiredQuantity: mat.quantity,
                  availableQuantity: Math.floor(mat.quantity * (0.3 + Math.random() * 0.7)),
                  category: 'Raw Materials'
    <div 
              }
    >
          }
        onC
        
        <div className="bg-gr
          setSupplies(cachedSupplies);
            <div
          setSupplies(Array.from(supplyMap.values()));
        }
      } catch (error) {
        console.error('Error loading station data:', error);
      } finally {
            </div>
      }
      

                  <h2 
  }, [stationId, stationName]);

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const getSecurityColor = (sec: number): string => {
    if (sec >= 0.5) return 'text-green-400';
    if (sec > 0.0) return 'text-yellow-400';
                  )}
    

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
     
      <div 
        className="bg-card border-2 border-accent/30 rounded-lg w-full max-w-4xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
       
        {/* EVE-style Header */}
        <div className="bg-gradient-to-r from-accent/20 to-accent/10 border-b-2 border-accent/30 p-4">
          <div className="flex items-start gap-4">
            {/* Station Image */}
            <div className="w-24 h-24 bg-background/50 border border-accent/30 rounded flex-shrink-0 overflow-hidden">
              </Tab
                src={stationData ? `https://images.evetech.net/types/${stationData.typeId}/render?size=128` : `https://images.evetech.net/types/52678/render?size=128`}
                              <Ba
                                className={`${status.col
                                {
                            </div>
                  
                
                  

                                <sp
                                  {formatNum
                              </div>
                                <div className="
                                  <span className="text-red-400 font-medium">
                                 
                       
                          </div>
                      </div>
                  })}
              )}

            <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <h4 class
                  </div>
                    <h4 className="text-sm text-
                    <p classN
                  <div cla
                    
                    </
                
                    <p 
                </div>
            </TabsContent>
            {/* Activity Tab */}
              <div className="text-center py-12 bg-muted/20 rounded-lg bo
                <
                  Station activit
              </div>
          </Tabs>
      </div>
  );



























































































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
