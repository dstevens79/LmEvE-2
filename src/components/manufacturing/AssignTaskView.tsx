import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, MagnifyingGlass, Users, Package, Star } from '@phosphor-icons/react';
import { Member } from '@/lib/types';
import { toast } from 'sonner';

interface AssignTaskViewProps {
  members: Member[];
  payModifiers: Record<string, number>;
  onCreateTask: (itemTypeId: number, itemName: string, quantity: number, pilotId: string, pilotName: string, payModifier?: string) => void;
  onCancel: () => void;
  isMobileView?: boolean;
}

// Sample EVE items for autocomplete - including more job types
const sampleItems = [
  // Manufacturing
  { typeId: 621, typeName: 'Caracal', jobType: 'manufacturing' },
  { typeId: 1031, typeName: 'Vexor', jobType: 'manufacturing' },
  { typeId: 12742, typeName: 'Hammerhead II', jobType: 'manufacturing' },
  { typeId: 34, typeName: 'Tritanium', jobType: 'manufacturing' },
  { typeId: 35, typeName: 'Pyerite', jobType: 'manufacturing' },
  { typeId: 36, typeName: 'Mexallon', jobType: 'manufacturing' },
  { typeId: 37, typeName: 'Isogen', jobType: 'manufacturing' },
  { typeId: 38, typeName: 'Nocxium', jobType: 'manufacturing' },
  
  // Copying
  { typeId: 644, typeName: 'Caracal Blueprint Copy', jobType: 'copying' },
  { typeId: 1034, typeName: 'Vexor Blueprint Copy', jobType: 'copying' },
  { typeId: 12745, typeName: 'Hammerhead II Blueprint Copy', jobType: 'copying' },
  
  // Reactions
  { typeId: 16670, typeName: 'Coolant', jobType: 'reactions' },
  { typeId: 16671, typeName: 'Superconductors', jobType: 'reactions' },
  { typeId: 16672, typeName: 'Transmitter', jobType: 'reactions' },
  
  // Research
  { typeId: 645, typeName: 'Caracal Blueprint ME Research', jobType: 'research' },
  { typeId: 1035, typeName: 'Vexor Blueprint TE Research', jobType: 'research' },
  
  // Invention
  { typeId: 646, typeName: 'Caracal T2 Invention', jobType: 'invention' },
  { typeId: 1036, typeName: 'Vexor T2 Invention', jobType: 'invention' }
];

export function AssignTaskView({ 
  members, 
  payModifiers, 
  onCreateTask, 
  onCancel, 
  isMobileView 
}: AssignTaskViewProps) {
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<{typeId: number, typeName: string, jobType: string} | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [pilotSearch, setPilotSearch] = useState('');
  const [selectedPilot, setSelectedPilot] = useState<Member | null>(null);
  const [selectedPayModifier, setSelectedPayModifier] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState('');

  // Filter items based on search
  const filteredItems = sampleItems.filter(item =>
    item.typeName.toLowerCase().includes(itemSearch.toLowerCase())
  );

  // Filter pilots based on search
  const filteredPilots = members.filter(member =>
    member.characterName.toLowerCase().includes(pilotSearch.toLowerCase())
  );

  const handleSubmit = () => {
    if (!selectedItem) {
      toast.error('Please select an item to manufacture');
      return;
    }
    
    if (!selectedPilot) {
      toast.error('Please select a pilot to assign the task to');
      return;
    }
    
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    onCreateTask(
      selectedItem.typeId,
      selectedItem.typeName,
      qty,
      selectedPilot.characterId.toString(),
      selectedPilot.characterName,
      selectedPayModifier || undefined
    );
  };

  const handleReset = () => {
    setItemSearch('');
    setSelectedItem(null);
    setQuantity('1');
    setPilotSearch('');
    setSelectedPilot(null);
    setSelectedPayModifier(null);
    setSelectedStation('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onCancel}>
          <ArrowLeft size={16} className="mr-2" />
          Back to Administration
        </Button>
        <div>
          <h3 className="text-lg font-semibold">Assign Manufacturing Task</h3>
          <p className="text-sm text-muted-foreground">
            Create and assign a new manufacturing task to a corporation member
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Details */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Package size={18} />
              Task Details
            </h4>
            
            {/* Item Selection */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="item-search">Item to Manufacture</Label>
                <div className="relative">
                  <MagnifyingGlass size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="item-search"
                    type="text"
                    placeholder="Type item name..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="pl-10 bg-input border-border text-foreground"
                  />
                </div>
                
                {/* Item Dropdown */}
                {itemSearch && !selectedItem && (
                  <div className="mt-2 bg-card border border-border rounded-md max-h-48 overflow-y-auto">
                    {filteredItems.map((item) => (
                      <button
                        key={item.typeId}
                        onClick={() => {
                          setSelectedItem(item);
                          setItemSearch(item.typeName);
                        }}
                        className="w-full p-3 text-left hover:bg-muted flex items-center gap-3"
                      >
                        <img 
                          src={`https://images.evetech.net/types/${item.typeId}/icon?size=32`}
                          alt={item.typeName}
                          className="w-6 h-6"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0xMiA2TDE4IDEyTDEyIDE4TDYgMTJMMTIgNloiIGZpbGw9IiM2NjYiLz4KPC9zdmc+';
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium">{item.typeName}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">Type ID: {item.typeId}</p>
                            <Badge variant="outline" className="text-xs">
                              {item.jobType}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Selected Item Display */}
                {selectedItem && (
                  <div className="mt-2 p-3 bg-muted rounded-md flex items-center gap-3">
                    <img 
                      src={`https://images.evetech.net/types/${selectedItem.typeId}/icon?size=32`}
                      alt={selectedItem.typeName}
                      className="w-8 h-8"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0xNiA4TDI0IDE2TDE2IDI0TDggMTZMMTYgOFoiIGZpbGw9IiM2NjYiLz4KPC9zdmc+';
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{selectedItem.typeName}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">Type ID: {selectedItem.typeId}</p>
                        <Badge variant="outline" className="text-xs">
                          {selectedItem.jobType}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedItem(null);
                        setItemSearch('');
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className="bg-input border-border text-foreground"
                />
              </div>

              {/* Station Selection */}
              <div>
                <Label htmlFor="station">Manufacturing Station</Label>
                <Input
                  id="station"
                  type="text"
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  placeholder="e.g., Jita IV - Moon 4 - Caldari Navy Assembly Plant"
                  className="bg-input border-border text-foreground"
                />
              </div>

              {/* Materials Cost Estimate */}
              {selectedItem && parseInt(quantity) > 0 && (
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <h5 className="text-sm font-medium mb-2">Estimated Materials Cost</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Materials:</span>
                      <span className="text-foreground font-medium">
                        {(parseInt(quantity) * 2.5e6).toLocaleString()} ISK
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Job Type:</span>
                      <Badge variant="outline" className="text-xs">
                        {selectedItem.jobType}
                      </Badge>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-muted-foreground font-medium">Total Estimate:</span>
                      <span className="text-accent font-bold">
                        {(parseInt(quantity) * 2.5e6 * 1.1).toLocaleString()} ISK
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pilot Assignment */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Users size={18} />
              Assign to Pilot
            </h4>
            
            <div className="space-y-4">
              {/* Pilot Selection */}
              <div>
                <Label htmlFor="pilot-search">Select Pilot</Label>
                <div className="relative">
                  <MagnifyingGlass size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="pilot-search"
                    type="text"
                    placeholder="Type pilot name..."
                    value={pilotSearch}
                    onChange={(e) => setPilotSearch(e.target.value)}
                    className="pl-10 bg-input border-border text-foreground"
                  />
                </div>
                
                {/* Pilot Dropdown */}
                {pilotSearch && !selectedPilot && (
                  <div className="mt-2 bg-card border border-border rounded-md max-h-48 overflow-y-auto">
                    {filteredPilots.map((pilot) => (
                      <button
                        key={pilot.id}
                        onClick={() => {
                          setSelectedPilot(pilot);
                          setPilotSearch(pilot.characterName);
                        }}
                        className="w-full p-3 text-left hover:bg-muted flex items-center gap-3"
                      >
                        <img 
                          src={`https://images.evetech.net/characters/${pilot.characterId}/portrait?size=32`}
                          alt={pilot.characterName}
                          className="w-8 h-8 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTggMTBDNi45IDEwIDYgOS4xIDYgOEM2IDYuOSA2LjkgNiA4IDZDOS4xIDYgMTAgNi45IDEwIDhDMTAgOS4xIDkuMSAxMCA4IDEwWiIgZmlsbD0iIzk5OSIvPgo8cGF0aCBkPSJNOCAxMkM1LjggMTIgNCA5LjggNCA4QzQgNi4yIDUuOCA0IDggNEM5LjggNCA4IDUuOCA4IDhDOCA5LjggOS44IDEyIDggMTJaIiBmaWxsPSIjOTk5Ii8+Cjwvc3ZnPgo8L3N2Zz4K';
                          }}
                        />
                        <div>
                          <p className="font-medium">{pilot.characterName}</p>
                          <p className="text-xs text-muted-foreground">
                            {pilot.title} â€¢ {pilot.accessLevel}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Selected Pilot Display */}
                {selectedPilot && (
                  <div className="mt-2 p-3 bg-muted rounded-md flex items-center gap-3">
                    <img 
                      src={`https://images.evetech.net/characters/${selectedPilot.characterId}/portrait?size=32`}
                      alt={selectedPilot.characterName}
                      className="w-10 h-10 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxMCIgeT0iMTAiPgo8cGF0aCBkPSJNMTAgMTJDOC45IDEyIDggMTEuMSA4IDEwQzggOC45IDguOSA4IDEwIDhDMTEuMSA4IDEyIDguOSAxMiAxMEMxMiAxMS4xIDExLjEgMTIgMTAgMTJaIiBmaWxsPSIjOTk5Ii8+CjxwYXRoIGQ9Ik0xMCAxNEM3LjggMTQgNiAxMi4yIDYgMTBDNiA3LjggNy44IDYgMTAgNkMxMi4yIDYgMTQgNy44IDE0IDEwQzE0IDEyLjIgMTIuMiAxNCAxMCAxNFoiIGZpbGw9IiM5OTkiLz4KPC9zdmc+Cjwvc3ZnPgo=';
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{selectedPilot.characterName}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedPilot.title} â€¢ Last seen: {new Date(selectedPilot.lastLogin).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedPilot(null);
                        setPilotSearch('');
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pay Modifiers */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Star size={18} />
            Pay Modifiers (Optional)
          </h4>
          <p className="text-sm text-muted-foreground mb-4">
            Select one pay modifier to apply to this task. This will affect the pilot's compensation.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(payModifiers).map(([key, multiplier]) => {
              const labels: Record<string, {title: string, description: string, color: string}> = {
                rush: {
                  title: 'RUSH',
                  description: 'For urgent priority manufacturing tasks',
                  color: 'text-orange-400 border-orange-500/50'
                },
                specialDelivery: {
                  title: 'Special Delivery', 
                  description: 'For special delivery requirements',
                  color: 'text-blue-400 border-blue-500/50'
                },
                excessWork: {
                  title: 'Excess Work',
                  description: 'For high volume or overtime work',
                  color: 'text-green-400 border-green-500/50'
                }
              };
              
              const label = labels[key] || { title: key, description: '', color: 'text-muted-foreground' };
              
              return (
                <div key={key} className="flex items-start space-x-2">
                  <Checkbox
                    id={key}
                    checked={selectedPayModifier === key}
                    onCheckedChange={(checked) => {
                      setSelectedPayModifier(checked ? key : null);
                    }}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor={key} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {label.title}
                      <Badge variant="outline" className={`ml-2 ${label.color}`}>
                        +{Math.round((multiplier - 1) * 100)}%
                      </Badge>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {label.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={handleReset}>
          Reset Form
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>
          Assign Task
        </Button>
      </div>
    </div>
  );
}