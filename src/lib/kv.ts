/**
 * Local key/value storage for LMeve client state.
 * Backed by localStorage — no third-party runtime dependency.
 */

import React from 'react';

export type LocalKV = {
  keys: () => Promise<string[]>;
  get: <T>(key: string) => Promise<T | undefined>;
  set: <T>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

function createLocalStorageKV(): LocalKV {
  return {
    async keys() {
      try {
        return Object.keys(localStorage);
      } catch {
        return [];
      }
    },
    async get<T>(key: string) {
      try {
        const raw = localStorage.getItem(key);
        if (raw == null) return undefined;
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },
    async set<T>(key: string, value: T) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* quota / private mode */
      }
    },
    async delete(key: string) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

/** Async localStorage KV used by services and popups. */
export const localKv: LocalKV = createLocalStorageKV();

/** React hook with localStorage persistence. */
export function useKV<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const initializer = () => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch {
      /* ignore */
    }
    return defaultValue;
  };
  const [value, setValue] = React.useState<T>(initializer);
  const setAndPersist = (next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        /* ignore */
      }
      return resolved;
    });
  };
  return [value, setAndPersist];
}

export const useLocalKV = useKV;
