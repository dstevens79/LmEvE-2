/**
 * Corporation Token Manager
 * Handles ESI token storage, refresh, and selection for sync operations
 */

import { LMeveUser, CorporationConfig } from './types';
import { getESIAuthService } from './esi-auth';

export interface CorporationToken {
  corporationId: number;
  corporationName: string;
  characterId: number;
  characterName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
  lastRefreshed: number;
  isValid: boolean;
}

export interface TokenRefreshResult {
  success: boolean;
  token?: CorporationToken;
  error?: string;
}

export class CorporationTokenManager {
  private static instance: CorporationTokenManager;
  private tokens: Map<number, CorporationToken> = new Map();
  private refreshPromises: Map<number, Promise<TokenRefreshResult>> = new Map();

  private constructor() {
    this.loadTokens();
  }

  static getInstance(): CorporationTokenManager {
    if (!CorporationTokenManager.instance) {
      CorporationTokenManager.instance = new CorporationTokenManager();
    }
    return CorporationTokenManager.instance;
  }

  private async loadTokens() {
    try {
      const stored = await spark.kv.get<Record<number, CorporationToken>>('corp-tokens');
      if (stored) {
        Object.entries(stored).forEach(([corpId, token]) => {
          this.tokens.set(Number(corpId), token);
        });
        console.log(`✅ Loaded ${this.tokens.size} corporation tokens`);
      }
    } catch (error) {
      console.error('Failed to load corporation tokens:', error);
    }
  }

  private async saveTokens() {
    try {
      const tokensObject: Record<number, CorporationToken> = {};
      this.tokens.forEach((token, corpId) => {
        tokensObject[corpId] = token;
      });
      await spark.kv.set('corp-tokens', tokensObject);
    } catch (error) {
      console.error('Failed to save corporation tokens:', error);
    }
  }

  async storeToken(user: LMeveUser): Promise<void> {
    if (!user.corporationId || !user.accessToken || !user.refreshToken) {
      throw new Error('Invalid user data for token storage');
    }

    const token: CorporationToken = {
      corporationId: user.corporationId,
      corporationName: user.corporationName || `Corporation ${user.corporationId}`,
      characterId: user.characterId || 0,
      characterName: user.characterName || 'Unknown',
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      expiresAt: user.tokenExpiry ? new Date(user.tokenExpiry).getTime() : Date.now() + 1200000,
      scopes: user.esiScopes || [],
      lastRefreshed: Date.now(),
      isValid: true
    };

    this.tokens.set(user.corporationId, token);
    await this.saveTokens();
    
    console.log(`✅ Stored token for corporation ${user.corporationName} (${user.corporationId})`);
  }

  async getToken(corporationId: number): Promise<CorporationToken | null> {
    const token = this.tokens.get(corporationId);
    
    if (!token) {
      console.warn(`⚠️ No token found for corporation ${corporationId}`);
      return null;
    }

    if (this.isTokenExpired(token)) {
      console.log(`🔄 Token expired for corporation ${corporationId}, refreshing...`);
      const refreshResult = await this.refreshToken(corporationId);
      
      if (refreshResult.success && refreshResult.token) {
        return refreshResult.token;
      } else {
        console.error(`❌ Failed to refresh token for corporation ${corporationId}:`, refreshResult.error);
        return null;
      }
    }

    if (this.isTokenExpiringSoon(token)) {
      console.log(`⏰ Token expiring soon for corporation ${corporationId}, pre-refreshing...`);
      this.refreshToken(corporationId).catch(error => {
        console.error(`❌ Pre-refresh failed for corporation ${corporationId}:`, error);
      });
    }

    return token;
  }

  private isTokenExpired(token: CorporationToken): boolean {
    return Date.now() >= token.expiresAt;
  }

  private isTokenExpiringSoon(token: CorporationToken, minutesThreshold: number = 5): boolean {
    const threshold = minutesThreshold * 60 * 1000;
    return (token.expiresAt - Date.now()) < threshold;
  }

  async refreshToken(corporationId: number): Promise<TokenRefreshResult> {
    const existingPromise = this.refreshPromises.get(corporationId);
    if (existingPromise) {
      return existingPromise;
    }

    const refreshPromise = this.performTokenRefresh(corporationId);
    this.refreshPromises.set(corporationId, refreshPromise);

    try {
      const result = await refreshPromise;
      return result;
    } finally {
      this.refreshPromises.delete(corporationId);
    }
  }

  private async performTokenRefresh(corporationId: number): Promise<TokenRefreshResult> {
    const token = this.tokens.get(corporationId);
    
    if (!token) {
      return {
        success: false,
        error: 'Token not found'
      };
    }

    try {
      const esiService = getESIAuthService();
      const newTokenData = await esiService.refreshAccessToken(token.refreshToken);

      const updatedToken: CorporationToken = {
        ...token,
        accessToken: newTokenData.access_token,
        refreshToken: newTokenData.refresh_token || token.refreshToken,
        expiresAt: Date.now() + (newTokenData.expires_in * 1000),
        lastRefreshed: Date.now(),
        isValid: true
      };

      this.tokens.set(corporationId, updatedToken);
      await this.saveTokens();

      console.log(`✅ Token refreshed for corporation ${corporationId}`);

      return {
        success: true,
        token: updatedToken
      };
    } catch (error) {
      console.error(`❌ Token refresh failed for corporation ${corporationId}:`, error);
      
      const invalidatedToken = { ...token, isValid: false };
      this.tokens.set(corporationId, invalidatedToken);
      await this.saveTokens();

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async invalidateToken(corporationId: number): Promise<void> {
    const token = this.tokens.get(corporationId);
    if (token) {
      token.isValid = false;
      this.tokens.set(corporationId, token);
      await this.saveTokens();
      console.log(`⚠️ Token invalidated for corporation ${corporationId}`);
    }
  }

  async removeToken(corporationId: number): Promise<void> {
    this.tokens.delete(corporationId);
    await this.saveTokens();
    console.log(`🗑️ Token removed for corporation ${corporationId}`);
  }

  getAllTokens(): CorporationToken[] {
    return Array.from(this.tokens.values());
  }

  getValidTokens(): CorporationToken[] {
    return Array.from(this.tokens.values()).filter(t => t.isValid && !this.isTokenExpired(t));
  }

  hasValidToken(corporationId: number): boolean {
    const token = this.tokens.get(corporationId);
    return token ? token.isValid && !this.isTokenExpired(token) : false;
  }

  hasRequiredScopes(corporationId: number, requiredScopes: string[]): boolean {
    const token = this.tokens.get(corporationId);
    if (!token) return false;

    return requiredScopes.every(scope => token.scopes.includes(scope));
  }

  getTokenScopes(corporationId: number): string[] {
    const token = this.tokens.get(corporationId);
    return token ? token.scopes : [];
  }

  async selectTokenForSync(
    corporations: CorporationConfig[],
    requiredScopes?: string[]
  ): Promise<CorporationToken | null> {
    if (corporations.length === 0) {
      console.warn('⚠️ No corporations configured for sync');
      return null;
    }

    for (const corp of corporations) {
      const token = await this.getToken(corp.corporationId);
      
      if (!token) continue;
      
      if (requiredScopes && !this.hasRequiredScopes(corp.corporationId, requiredScopes)) {
        console.warn(`⚠️ Token for corporation ${corp.corporationId} missing required scopes`);
        continue;
      }

      return token;
    }

    console.error('❌ No valid tokens found for any configured corporation');
    return null;
  }

  getTokenStatus(corporationId: number): {
    exists: boolean;
    isValid: boolean;
    isExpired: boolean;
    expiresIn?: number;
    scopes?: string[];
  } {
    const token = this.tokens.get(corporationId);
    
    if (!token) {
      return {
        exists: false,
        isValid: false,
        isExpired: true
      };
    }

    const expiresIn = Math.max(0, token.expiresAt - Date.now());

    return {
      exists: true,
      isValid: token.isValid,
      isExpired: this.isTokenExpired(token),
      expiresIn,
      scopes: token.scopes
    };
  }
}

export function useCorporationTokens() {
  const [tokens, setTokens] = React.useState<CorporationToken[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const manager = CorporationTokenManager.getInstance();
    setTokens(manager.getAllTokens());
    setIsLoading(false);
  }, []);

  const refreshToken = React.useCallback(async (corporationId: number) => {
    const manager = CorporationTokenManager.getInstance();
    const result = await manager.refreshToken(corporationId);
    if (result.success) {
      setTokens(manager.getAllTokens());
    }
    return result;
  }, []);

  const removeToken = React.useCallback(async (corporationId: number) => {
    const manager = CorporationTokenManager.getInstance();
    await manager.removeToken(corporationId);
    setTokens(manager.getAllTokens());
  }, []);

  const getTokenStatus = React.useCallback((corporationId: number) => {
    const manager = CorporationTokenManager.getInstance();
    return manager.getTokenStatus(corporationId);
  }, []);

  return {
    tokens,
    isLoading,
    refreshToken,
    removeToken,
    getTokenStatus
  };
}

import React from 'react';
