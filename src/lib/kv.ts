// Local KV shim to replace Spark KV
// Provides a React hook with the same signature as Spark's useKV,
// but backed by localStorage only.

import React from 'react';

export function useKV<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const initializer = () => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch {}
    return defaultValue;
  };
  const [value, setValue] = React.useState<T>(initializer);
  const setAndPersist = (next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      try { localStorage.setItem(key, JSON.stringify(resolved)); } catch {}
      return resolved;
    });
  };
  return [value, setAndPersist];
}

// Also export the local hook under a descriptive name if needed elsewhere
export const useLocalKV = useKV;
