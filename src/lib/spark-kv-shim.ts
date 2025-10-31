// Spark KV shim: ensure window.spark.kv exists and uses localStorage under the hood

type KV = {
  keys: () => Promise<string[]>;
  get: <T>(key: string) => Promise<T | undefined>;
  set: <T>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

function createLocalStorageKV(): KV {
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
      } catch {}
    },
    async delete(key: string) {
      try {
        localStorage.removeItem(key);
      } catch {}
    },
  };
}

// Install shim if spark.kv is missing or if we explicitly want to force local
(() => {
  const w = window as any;
  if (!w.spark) w.spark = {};
  const kv = createLocalStorageKV();
  w.spark.kv = kv;
})();

export {};