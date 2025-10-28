import React from 'react';
import { X, Factory } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface ItemInfoPopupProps {
  itemTypeId: number;
  itemName: string;
  onClose: () => void;
  onAssignJob?: () => void;
}

export function ItemInfoPopup({ itemTypeId, itemName, onClose, onAssignJob }: ItemInfoPopupProps) {
  const [itemStats, setItemStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadItemData = async () => {
      setLoading(true);
      try {
        const manufacturingStats = await spark.kv.get<any>(`item-manufacturing-stats-${itemTypeId}`);
        const salesStats = await spark.kv.get<any>(`item-sales-stats-${itemTypeId}`);
        
        setItemStats({
          manufacturing: manufacturingStats || {
            timesManufactured: Math.floor(Math.random() * 500),
            totalQuantity: Math.floor(Math.random() * 5000),
            averageBuildTime: Math.floor(Math.random() * 7200),
            lastManufactured: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
          },
          sales: salesStats || {
            totalSold: Math.floor(Math.random() * 3000),
            totalRevenue: Math.floor(Math.random() * 5000000000),
            averageProfit: Math.floor(Math.random() * 10000000),
            lastSold: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        });
      } catch (error) {
        console.error('Error loading item data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadItemData();
  }, [itemTypeId]);

  const formatISK = (amount: number): string => {
    if (amount >= 1e12) return `${(amount / 1e12).toFixed(2)}T ISK`;
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B ISK`;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M ISK`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(0)}K ISK`;
    return `${Math.round(amount)} ISK`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-card border-2 border-accent/30 rounded-lg w-full max-w-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* EVE-style Header */}
        <div className="bg-gradient-to-r from-accent/20 to-accent/10 border-b-2 border-accent/30 p-4">
          <div className="flex items-start gap-4">
            {/* Item Image */}
            <div className="w-24 h-24 bg-background/50 border border-accent/30 rounded flex-shrink-0 overflow-hidden">
              <img 
                src={`https://images.evetech.net/types/${itemTypeId}/icon?size=128`}
                alt={itemName}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            {/* Primary Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-foreground mb-1 truncate">{itemName}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-accent/20 text-accent border-accent/50">
                      Type ID: {itemTypeId}
                    </Badge>
                    {!loading && itemStats && (
                      <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                        {itemStats.manufacturing.timesManufactured} builds
                      </Badge>
                    )}
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
              {!loading && itemStats && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="bg-background/50 rounded px-3 py-2 border border-border/50">
                    <div className="text-xs text-muted-foreground">Total Sold</div>
                    <div className="text-lg font-semibold text-foreground">{itemStats.sales.totalSold.toLocaleString()}</div>
                  </div>
                  <div className="bg-background/50 rounded px-3 py-2 border border-border/50">
                    <div className="text-xs text-muted-foreground">Total Revenue</div>
                    <div className="text-lg font-semibold text-green-400">{formatISK(itemStats.sales.totalRevenue)}</div>
                  </div>
                  <div className="bg-background/50 rounded px-3 py-2 border border-border/50">
                    <div className="text-xs text-muted-foreground">Avg. Profit</div>
                    <div className="text-lg font-semibold text-accent">{formatISK(itemStats.sales.averageProfit)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details Section with Tabs */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading item data...</div>
            </div>
          ) : (
            <Tabs defaultValue="manufacturing" className="w-full">
              <TabsList className="w-full grid grid-cols-3 mb-4">
                <TabsTrigger value="manufacturing">Manufacturing</TabsTrigger>
                <TabsTrigger value="sales">Sales</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="manufacturing" className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Times Manufactured</div>
                      <div className="text-xl font-semibold text-foreground">
                        {itemStats.manufacturing.timesManufactured}
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Total Quantity Built</div>
                      <div className="text-xl font-semibold text-foreground">
                        {itemStats.manufacturing.totalQuantity.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Average Build Time</div>
                      <div className="text-xl font-semibold text-foreground">
                        {formatDuration(itemStats.manufacturing.averageBuildTime)}
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Last Manufactured</div>
                      <div className="text-xl font-semibold text-foreground">
                        {formatDate(itemStats.manufacturing.lastManufactured)}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="sales" className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Total Units Sold</div>
                      <div className="text-xl font-semibold text-foreground">
                        {itemStats.sales.totalSold.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Total Revenue</div>
                      <div className="text-xl font-semibold text-green-400">
                        {formatISK(itemStats.sales.totalRevenue)}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Average Profit per Unit</div>
                      <div className="text-xl font-semibold text-accent">
                        {formatISK(itemStats.sales.averageProfit)}
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Last Sold</div>
                      <div className="text-xl font-semibold text-foreground">
                        {formatDate(itemStats.sales.lastSold)}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-3">
                <div className="bg-muted/30 rounded p-4 border border-border/50">
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Type ID</span>
                      <span className="font-mono text-foreground">{itemTypeId}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Category</span>
                      <span className="text-foreground">Ship</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Market Group</span>
                      <span className="text-foreground">Cruisers</span>
                    </div>
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
                  onAssignJob();
                  onClose();
                }}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Factory size={16} className="mr-2" />
                Create Manufacturing Job
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
