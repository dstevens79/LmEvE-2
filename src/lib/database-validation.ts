import { DatabaseManager, DatabaseConfig } from '@/lib/database';

export async function validateDatabaseConnection(config: DatabaseConfig): Promise<{
  success: boolean;
  validated: boolean;
  error?: string;
  latency?: number;
}> {
  const manager = new DatabaseManager(config);
  
  try {
    const result = await manager.testConnection();
    return result;
  } catch (error) {
    return {
      success: false,
      validated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export { DatabaseManager };
