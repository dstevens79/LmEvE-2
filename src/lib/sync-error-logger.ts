/**
 * Sync Error Logger
 * Tracks and logs all sync errors for monitoring and debugging
 */

export interface SyncError {
  id: string;
  processId: string;
  processName: string;
  timestamp: number;
  errorType: 'esi_api' | 'database' | 'auth' | 'network' | 'validation' | 'unknown';
  errorMessage: string;
  errorDetails?: string;
  stackTrace?: string;
  requestUrl?: string;
  responseStatus?: number;
  retryAttempt?: number;
  corporationId?: number;
  characterId?: number;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByProcess: Record<string, number>;
  recentErrors: SyncError[];
  errorRate: number;
  repeatedFailures: Array<{
    processId: string;
    count: number;
    lastError: SyncError;
  }>;
}

export class SyncErrorLogger {
  private static instance: SyncErrorLogger;
  private errors: SyncError[] = [];
  private maxErrors = 500;
  private listeners: Set<(errors: SyncError[]) => void> = new Set();

  private constructor() {
    this.loadErrors();
  }

  static getInstance(): SyncErrorLogger {
    if (!SyncErrorLogger.instance) {
      SyncErrorLogger.instance = new SyncErrorLogger();
    }
    return SyncErrorLogger.instance;
  }

  private async loadErrors() {
    try {
      const stored = await spark.kv.get<SyncError[]>('sync-errors');
      if (stored && Array.isArray(stored)) {
        this.errors = stored;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Failed to load sync errors:', error);
    }
  }

  private async saveErrors() {
    try {
      const toSave = this.errors.slice(-this.maxErrors);
      await spark.kv.set('sync-errors', toSave);
    } catch (error) {
      console.error('Failed to save sync errors:', error);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.errors));
  }

  subscribe(listener: (errors: SyncError[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.errors);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  async logError(error: Omit<SyncError, 'id' | 'timestamp'>): Promise<void> {
    const syncError: SyncError = {
      ...error,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    this.errors.push(syncError);
    
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    await this.saveErrors();
    this.notifyListeners();

    console.error('🔴 Sync Error:', {
      process: syncError.processName,
      type: syncError.errorType,
      message: syncError.errorMessage,
      details: syncError.errorDetails
    });
  }

  async logESIError(
    processId: string,
    processName: string,
    error: any,
    requestUrl?: string,
    retryAttempt?: number
  ): Promise<void> {
    await this.logError({
      processId,
      processName,
      errorType: 'esi_api',
      errorMessage: error.message || 'ESI API error',
      errorDetails: error.response?.data ? JSON.stringify(error.response.data) : undefined,
      stackTrace: error.stack,
      requestUrl,
      responseStatus: error.response?.status,
      retryAttempt
    });
  }

  async logDatabaseError(
    processId: string,
    processName: string,
    error: any,
    query?: string
  ): Promise<void> {
    await this.logError({
      processId,
      processName,
      errorType: 'database',
      errorMessage: error.message || 'Database error',
      errorDetails: query,
      stackTrace: error.stack
    });
  }

  async logAuthError(
    processId: string,
    processName: string,
    error: any,
    corporationId?: number,
    characterId?: number
  ): Promise<void> {
    await this.logError({
      processId,
      processName,
      errorType: 'auth',
      errorMessage: error.message || 'Authentication error',
      errorDetails: error.toString(),
      stackTrace: error.stack,
      corporationId,
      characterId
    });
  }

  getErrors(): SyncError[] {
    return [...this.errors];
  }

  getRecentErrors(limit: number = 20): SyncError[] {
    return this.errors.slice(-limit).reverse();
  }

  getErrorsByProcess(processId: string): SyncError[] {
    return this.errors.filter(e => e.processId === processId);
  }

  getErrorStats(): ErrorStats {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const recentErrors = this.errors.filter(e => e.timestamp > oneHourAgo);

    const errorsByType: Record<string, number> = {};
    const errorsByProcess: Record<string, number> = {};
    const processFailureCounts: Record<string, { count: number; lastError: SyncError }> = {};

    this.errors.forEach(error => {
      errorsByType[error.errorType] = (errorsByType[error.errorType] || 0) + 1;
      errorsByProcess[error.processId] = (errorsByProcess[error.processId] || 0) + 1;
      
      if (!processFailureCounts[error.processId] || 
          error.timestamp > processFailureCounts[error.processId].lastError.timestamp) {
        processFailureCounts[error.processId] = {
          count: (processFailureCounts[error.processId]?.count || 0) + 1,
          lastError: error
        };
      }
    });

    const repeatedFailures = Object.entries(processFailureCounts)
      .filter(([_, data]) => data.count >= 3)
      .map(([processId, data]) => ({
        processId,
        count: data.count,
        lastError: data.lastError
      }))
      .sort((a, b) => b.count - a.count);

    const errorRate = recentErrors.length / 60;

    return {
      totalErrors: this.errors.length,
      errorsByType,
      errorsByProcess,
      recentErrors: this.getRecentErrors(10),
      errorRate,
      repeatedFailures
    };
  }

  async clearErrors(): Promise<void> {
    this.errors = [];
    await this.saveErrors();
    this.notifyListeners();
  }

  async clearOldErrors(olderThanDays: number = 7): Promise<void> {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    this.errors = this.errors.filter(e => e.timestamp > cutoffTime);
    await this.saveErrors();
    this.notifyListeners();
  }
}

export function useSyncErrors() {
  const [errors, setErrors] = React.useState<SyncError[]>([]);
  const [stats, setStats] = React.useState<ErrorStats | null>(null);

  React.useEffect(() => {
    const logger = SyncErrorLogger.getInstance();
    
    const unsubscribe = logger.subscribe((newErrors) => {
      setErrors(newErrors);
      setStats(logger.getErrorStats());
    });

    return unsubscribe;
  }, []);

  const clearErrors = React.useCallback(async () => {
    await SyncErrorLogger.getInstance().clearErrors();
  }, []);

  const clearOldErrors = React.useCallback(async (days: number) => {
    await SyncErrorLogger.getInstance().clearOldErrors(days);
  }, []);

  return {
    errors,
    stats,
    clearErrors,
    clearOldErrors
  };
}

import React from 'react';
