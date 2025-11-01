// Tab Data Service: cache-first (localStorage), then server DB/API via /api/data.php
// This is a lightweight data layer to decouple tabs from direct ESI calls.

export type DataResource = 'industry_jobs' | 'blueprints' | 'assets' | 'market_prices';

type CacheEntry<T> = { data: T; ts: number };

const CACHE_KEY_PREFIX = 'lmeve:tabdata:';
const DEFAULT_TTL = 60_000; // 1 min
const TTL: Partial<Record<DataResource, number>> = {
  blueprints: 5 * 60_000,
  assets: 5 * 60_000,
  market_prices: 60 * 60_000
};

function getCache<T>(resource: DataResource): T | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + resource);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    const ttl = TTL[resource] ?? DEFAULT_TTL;
    if (Date.now() - entry.ts < ttl) return entry.data;
    return null;
  } catch {
    return null;
  }
}

function setCache<T>(resource: DataResource, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    localStorage.setItem(CACHE_KEY_PREFIX + resource, JSON.stringify(entry));
  } catch {}
}

export async function fetchResource<T = any>(resource: DataResource, params?: Record<string, string | number>): Promise<T> {
  // 1) Cache first
  const cached = getCache<T>(resource);
  if (cached) return cached;

  // 2) Server
  const q = new URLSearchParams({ resource });
  if (params) for (const [k, v] of Object.entries(params)) q.set(k, String(v));
  const resp = await fetch(`/api/data.php?${q.toString()}`, { headers: { 'Accept': 'application/json' } });
  if (!resp.ok) throw new Error(`Failed to fetch ${resource}: ${resp.status}`);
  const data = await resp.json();
  setCache(resource, data);
  return data as T;
}

export function clearResourceCache(resource?: DataResource): void {
  if (!resource) {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
    return;
  }
  localStorage.removeItem(CACHE_KEY_PREFIX + resource);
}
