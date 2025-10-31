import { useState, useCallback, useEffect } from 'react';
import { useKV } from '@/lib/kv';
import { eveApi, type ESIBlueprint } from '@/lib/eveApi';
import { Blueprint } from '@/lib/types';
import { toast } from 'sonner';

interface BlueprintsHook {
  blueprints: Blueprint[];
  isLoading: boolean;
  error: string | null;
  refreshBlueprints: () => Promise<void>;
  lastUpdate: string | null;
}

export function useBlueprints(corporationId?: number, accessToken?: string): BlueprintsHook {
  const [blueprints, setBlueprints] = useKV<Blueprint[]>('blueprints-library', []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useKV<string | null>('blueprints-last-update', null);

  const refreshBlueprints = useCallback(async () => {
    if (!corporationId) {
      setError('Corporation ID not configured');
      return;
    }

    if (!accessToken) {
      setError('Authentication token required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const esiBlueprints = await eveApi.getCorporationBlueprints(corporationId, accessToken);
      
      const uniqueTypeIds = [...new Set(esiBlueprints.map(bp => bp.type_id))];
      const typeNames = await eveApi.getNames(uniqueTypeIds);
      const typeNameMap = new Map(typeNames.map(t => [t.id, t.name]));
      
      const uniqueLocationIds = [...new Set(esiBlueprints.map(bp => bp.location_id))];
      const locationNames = await Promise.all(
        uniqueLocationIds.map(async (locId) => {
          const name = await eveApi.getLocationName(locId, accessToken);
          return { id: locId, name };
        })
      );
      const locationNameMap = new Map(locationNames.map(l => [l.id, l.name]));
      
      const parseHangarFlag = (flag: string): string => {
        const hangarMatch = flag.match(/CorpSAG(\d)/);
        if (hangarMatch) return `Hangar ${hangarMatch[1]}`;
        if (flag === 'Hangar') return 'Personal Hangar';
        return flag;
      };
      
      const determineBlueprintCategory = (typeName: string): string => {
        if (typeName.includes('Blueprint')) {
          if (typeName.includes('Ship')) return 'Ships';
          if (typeName.includes('Module')) return 'Modules';
          if (typeName.includes('Ammunition')) return 'Ammunition';
          if (typeName.includes('Charge')) return 'Ammunition';
          if (typeName.includes('Drone')) return 'Drones';
          if (typeName.includes('Component')) return 'Components';
          if (typeName.includes('Fuel Block')) return 'Fuel';
          return 'Other';
        }
        return 'Unknown';
      };
      
      const transformedBlueprints: Blueprint[] = esiBlueprints.map((esiBp: ESIBlueprint) => {
        const typeName = typeNameMap.get(esiBp.type_id) || `Type ${esiBp.type_id}`;
        const location = locationNameMap.get(esiBp.location_id) || `Location ${esiBp.location_id}`;
        
        const isCopy = esiBp.runs > 0 && esiBp.runs !== -1;
        
        return {
          id: `bp_${esiBp.item_id}`,
          itemId: esiBp.item_id,
          typeId: esiBp.type_id,
          typeName,
          location,
          locationId: esiBp.location_id,
          locationFlag: parseHangarFlag(esiBp.location_flag),
          quantity: esiBp.quantity,
          materialEfficiency: esiBp.material_efficiency,
          timeEfficiency: esiBp.time_efficiency,
          runs: esiBp.runs === -1 ? 0 : esiBp.runs,
          maxRuns: esiBp.runs === -1 ? Infinity : esiBp.runs,
          isCopy,
          isOriginal: !isCopy,
          category: determineBlueprintCategory(typeName),
          owner: 'Corporation',
          lastUpdate: new Date().toISOString()
        };
      });
      
      setBlueprints(transformedBlueprints);
      setLastUpdate(new Date().toISOString());
      setIsLoading(false);
      
      toast.success(`Loaded ${transformedBlueprints.length} blueprints from ESI`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch blueprints';
      setError(errorMessage);
      setIsLoading(false);
      toast.error(errorMessage);
      console.error('Blueprint fetch error:', err);
    }
  }, [corporationId, accessToken, setBlueprints, setLastUpdate]);

  useEffect(() => {
    if (corporationId && accessToken && blueprints.length === 0) {
      refreshBlueprints();
    }
  }, [corporationId, accessToken]);

  return {
    blueprints,
    isLoading,
    error,
    refreshBlueprints,
    lastUpdate
  };
}
