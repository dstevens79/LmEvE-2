import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DatabaseManager, DatabaseConfig, DatabaseStatus, defaultDatabaseConfig } from '@/lib/database';
import { useLocalKV } from '@/lib/persistenceService';

interface DatabaseContextType {
  manager: DatabaseManager | null;
  status: DatabaseStatus;
  config: DatabaseConfig;
  isConnected: boolean;
  connect: () => Promise<{ success: boolean; error?: string }>;
  disconnect: () => Promise<void>;
  testConnection: () => Promise<{ success: boolean; latency?: number; error?: string }>;
  updateConfig: (newConfig: Partial<DatabaseConfig>) => void;
  refreshStatus: () => void;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [dbConfig, setDbConfig] = useLocalKV<DatabaseConfig>('database-config', defaultDatabaseConfig);
  const [manager, setManager] = useState<DatabaseManager | null>(null);
  const [status, setStatus] = useState<DatabaseStatus>({
    connected: false,
    connectionCount: 0,
    queryCount: 0,
    avgQueryTime: 0,
    uptime: 0
  });

  // Initialize database manager when config changes
  useEffect(() => {
    const newManager = new DatabaseManager(dbConfig);
    setManager(newManager);
    setStatus(newManager.getStatus());
  }, [dbConfig]);

  const connect = async (): Promise<{ success: boolean; error?: string }> => {
    if (!manager) {
      return { success: false, error: 'Database manager not initialized' };
    }

    const result = await manager.connect();
    setStatus(manager.getStatus());
    return result;
  };

  const disconnect = async (): Promise<void> => {
    if (!manager) return;
    
    await manager.disconnect();
    setStatus(manager.getStatus());
  };

  const testConnection = async (): Promise<{ success: boolean; latency?: number; error?: string }> => {
    if (!manager) {
      return { success: false, error: 'Database manager not initialized' };
    }

    return await manager.testConnection();
  };

  const updateConfig = (newConfig: Partial<DatabaseConfig>): void => {
    setDbConfig((current) => ({ ...current, ...newConfig }));
  };

  const refreshStatus = (): void => {
    if (manager) {
      setStatus(manager.getStatus());
    }
  };

  const value: DatabaseContextType = {
    manager,
    status,
    config: dbConfig,
    isConnected: status.connected,
    connect,
    disconnect,
    testConnection,
    updateConfig,
    refreshStatus
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextType {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

// Hook for executing database queries
export function useDatabaseQuery() {
  const { manager } = useDatabase();

  const executeQuery = async <T = any>(sql: string, params: any[] = []) => {
    if (!manager) {
      throw new Error('Database manager not available');
    }
    return await manager.query<T>(sql, params);
  };

  return { executeQuery };
}