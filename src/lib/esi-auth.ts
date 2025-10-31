import { 
  ESIAuthState, 
  ESITokenResponse, 
  ESICharacterData, 
  LMeveUser, 
  CorporationConfig 
} from './types';
import { getEVERoleMapping, createUserWithRole } from './roles';
import { 
  validateESIUser, 
  validateRequiredScopes, 
  getValidationErrorMessage,
  createDefaultCorporationConfig 
} from './corp-validation';

/**
 * EVE Online SSO Authentication Service
 * 
 * Implements OAuth2 with PKCE (Proof Key for Code Exchange) as per EVE SSO documentation
 * Reference: https://developers.eveonline.com/docs/services/sso/
 * 
 * Key Features:
 * - OAuth2 Authorization Code Flow with PKCE (RFC 7636)
 * - JWT token validation (access tokens are JWTs as of 2023)
 * - State parameter validation for CSRF protection
 * - Token refresh using refresh tokens
 * - Proper scope validation for character and corporation permissions
 * 
 * Security Notes:
 * - Access tokens are JWT format and contain character information
 * - JWT signatures can be validated using JWKS endpoint (optional)
 * - State parameter protects against CSRF attacks
 * - PKCE protects against authorization code interception
 * - Tokens should be stored securely and never logged
 * 
 * Token Endpoints:
 * - Authorization: https://login.eveonline.com/v2/oauth/authorize
 * - Token: https://login.eveonline.com/v2/oauth/token
 * - Verify: https://login.eveonline.com/oauth/verify
 * - Revoke: https://login.eveonline.com/v2/oauth/revoke
 * - JWKS: https://login.eveonline.com/oauth/jwks
 */

// EVE Online SSO endpoints (OAuth2 v2)
const ESI_BASE_URL = 'https://esi.evetech.net';
const SSO_BASE_URL = 'https://login.eveonline.com';
const SSO_AUTH_URL = `${SSO_BASE_URL}/v2/oauth/authorize`;
const SSO_TOKEN_URL = `${SSO_BASE_URL}/v2/oauth/token`;
const SSO_VERIFY_URL = `${SSO_BASE_URL}/oauth/verify`;
const SSO_REVOKE_URL = `${SSO_BASE_URL}/v2/oauth/revoke`;
const SSO_JWKS_URL = `${SSO_BASE_URL}/oauth/jwks`;

// Character-specific scopes (do not require corporation roles)
// Note: There is no 'esi-characters.read_character_info.v1' scope; basic identity requires no scope.
const CHARACTER_SCOPES = [
  'esi-characters.read_corporation_roles.v1',
  'esi-industry.read_character_jobs.v1',
  'esi-wallet.read_character_wallet.v1',
  'esi-assets.read_assets.v1',
  'esi-characters.read_blueprints.v1',
  'esi-characters.read_notifications.v1',
  'esi-planets.manage_planets.v1',
  'esi-skills.read_skills.v1'
];

// Corporation scopes (require Director/CEO roles in the corporation)
const CORPORATION_SCOPES = [
  'esi-corporations.read_corporation_membership.v1',
  'esi-corporations.read_titles.v1',
  'esi-assets.read_corporation_assets.v1',
  'esi-industry.read_corporation_jobs.v1',
  'esi-wallet.read_corporation_wallets.v1',
  'esi-killmails.read_corporation_killmails.v1',
  'esi-universe.read_structures.v1',
  'esi-markets.read_corporation_orders.v1',
  'esi-contracts.read_corporation_contracts.v1',
  'esi-industry.read_corporation_mining.v1',
  'esi-planets.read_customs_offices.v1',
  'esi-corporations.read_blueprints.v1',
  'esi-corporations.read_containers_logs.v1',
  'esi-corporations.read_divisions.v1',
  'esi-corporations.read_facilities.v1',
  'esi-corporations.read_medals.v1',
  'esi-corporations.read_outposts.v1',
  'esi-corporations.read_standings.v1',
  'esi-corporations.track_members.v1'
];

// Required scopes for different authentication levels
// Basic login requires no scopes (identity comes from the token verify endpoint)
const BASIC_SCOPES: string[] = [];

const ENHANCED_SCOPES = [
  ...BASIC_SCOPES,
  'esi-industry.read_character_jobs.v1',
  'esi-wallet.read_character_wallet.v1',
  'esi-assets.read_assets.v1',
  'esi-characters.read_blueprints.v1'
];

const FULL_SCOPES = [
  ...CHARACTER_SCOPES,
  ...CORPORATION_SCOPES
];

// Map scope types to scope arrays
const SCOPE_SETS = {
  basic: BASIC_SCOPES,
  enhanced: ENHANCED_SCOPES,
  corporation: FULL_SCOPES
};

// Legacy compatibility - remove after testing
const REQUIRED_SCOPES = FULL_SCOPES;

export class ESIAuthService {
  private clientId: string;
  private clientSecret?: string;
  private redirectUri: string;
  private registeredCorporations: CorporationConfig[];

  constructor(clientId: string, clientSecret?: string, registeredCorps: CorporationConfig[] = [], redirectUri?: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri && redirectUri.trim().length > 0 ? redirectUri : `${window.location.origin}/`;
    this.registeredCorporations = registeredCorps;
  }

  /**
   * Update registered corporations list
   */
  updateRegisteredCorporations(corporations: CorporationConfig[]): void {
    this.registeredCorporations = corporations;
    console.log('✅ Updated registered corporations:', corporations.length);
  }

  /**
   * Generate PKCE challenge and verifier
   */
  private async generatePKCE(): Promise<{ verifier: string; challenge: string | null }> {
    try {
      // Generate code verifier (random string)
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const verifier = btoa(String.fromCharCode.apply(null, Array.from(array)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      // Generate code challenge (SHA256 hash of verifier)
      if (crypto?.subtle?.digest) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        const challenge = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        return { verifier, challenge };
      } else {
        console.warn('PKCE SHA-256 not available (insecure context). Falling back to non-PKCE flow.');
        return { verifier, challenge: null };
      }
    } catch (e) {
      console.warn('PKCE generation failed, falling back to non-PKCE flow:', e);
      return { verifier: '', challenge: null };
    }
  }

  /**
   * Generate random state parameter
   */
  private generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Initiate EVE SSO login with OAuth2 PKCE flow
   * Constructs authorization URL per EVE SSO specification
   */
  async initiateLogin(scopeType: 'basic' | 'enhanced' | 'corporation' = 'basic'): Promise<string> {
    console.log('🚀 Initiating EVE SSO OAuth2 login with scope type:', scopeType);
    
  const { verifier, challenge } = await this.generatePKCE();
    const state = this.generateState();
  const scopes = SCOPE_SETS[scopeType];

    const authState: ESIAuthState = {
      state,
      verifier,
      challenge: challenge || undefined as any,
      timestamp: Date.now(),
      scopeType,
      scopes
    };

    sessionStorage.setItem('esi-auth-state', JSON.stringify(authState));
    sessionStorage.setItem('esi-login-attempt', 'true');

    const params = new URLSearchParams({
      response_type: 'code',
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      state: state
    });
    if (scopes && scopes.length > 0) {
      params.set('scope', scopes.join(' '));
    }

    // Only include PKCE parameters when a challenge is available
    if (challenge) {
      params.set('code_challenge', challenge);
      params.set('code_challenge_method', 'S256');
    }

    const authUrl = `${SSO_AUTH_URL}?${params.toString()}`;
    console.log('🔗 OAuth2 authorization URL generated for', scopeType, 'scopes');
    console.log('📋 Scopes requested:', scopes.length, 'scopes');
    
    return authUrl;
  }

  /**
   * Initiate login with an explicit set of scopes (overrides presets)
   */
  async initiateLoginWithScopes(scopes: string[]): Promise<string> {
    console.log('🚀 Initiating EVE SSO OAuth2 login with explicit scopes:', scopes.length);

    const { verifier, challenge } = await this.generatePKCE();
    const state = this.generateState();

    const authState: ESIAuthState = {
      state,
      verifier,
      challenge: challenge || undefined as any,
      timestamp: Date.now(),
      scopeType: scopes.length > 0 ? 'enhanced' : 'basic',
      scopes
    };

    sessionStorage.setItem('esi-auth-state', JSON.stringify(authState));
    sessionStorage.setItem('esi-login-attempt', 'true');

    const params = new URLSearchParams({
      response_type: 'code',
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      state: state
    });
    if (scopes && scopes.length > 0) {
      params.set('scope', scopes.join(' '));
    }

    if (challenge) {
      params.set('code_challenge', challenge);
      params.set('code_challenge_method', 'S256');
    }

    const authUrl = `${SSO_AUTH_URL}?${params.toString()}`;
    console.log('🔗 OAuth2 authorization URL generated with explicit scopes');
    return authUrl;
  }

  /**
   * Handle the OAuth2 authorization callback with full validation
   * Validates state, exchanges code for token, and validates JWT
   */
  async handleCallback(
    code: string, 
    state: string,
    registeredCorps?: CorporationConfig[]
  ): Promise<LMeveUser> {
    console.log('🔄 Processing OAuth2 callback with state validation');
    
    const corporations = registeredCorps || this.registeredCorporations;
    
    const storedStateData = sessionStorage.getItem('esi-auth-state');
    if (!storedStateData) {
      throw new Error('No stored authentication state found - possible session timeout');
    }

    const authState: ESIAuthState = JSON.parse(storedStateData);
    
    if (state !== authState.state) {
      console.error('❌ State mismatch - CSRF attack detected');
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    if (Date.now() - authState.timestamp > 5 * 60 * 1000) {
      throw new Error('Authentication state has expired (>5 minutes)');
    }

    console.log('✅ State validation passed');

    try {
      const tokenResponse = await this.exchangeCodeForToken(code, authState.verifier);
      
      const characterData = await this.getCharacterInfo(tokenResponse.access_token);
      
      const corporationRoles = await this.getCharacterRoles(
        characterData.character_id, 
        tokenResponse.access_token
      );

      const validation = validateESIUser(characterData, corporationRoles, corporations);
      
      if (!validation.isValid) {
        throw new Error(validation.reason || 'Corporation validation failed');
      }

      const userScopes = tokenResponse.scope?.split(' ') || characterData.scopes;
      const characterOnlyScopes = userScopes.filter(scope => 
        CHARACTER_SCOPES.includes(scope)
      );
      const corpOnlyScopes = userScopes.filter(scope => 
        CORPORATION_SCOPES.includes(scope)
      );
      
      const scopeValidation = validateRequiredScopes(
        userScopes, 
        validation.corporationConfig,
        validation.suggestedRole
      );
      
      if (!scopeValidation.isValid) {
        console.warn('⚠️ Missing required scopes for role:', {
          role: validation.suggestedRole,
          missingScopes: scopeValidation.missingScopes
        });
        
        if (['corp_director', 'corp_admin'].includes(validation.suggestedRole) && 
            scopeValidation.missingScopes.some(scope => CORPORATION_SCOPES.includes(scope))) {
          throw new Error(
            `Missing required corporation scopes for ${validation.suggestedRole} role. ` +
            `Please re-authenticate with corporation permissions. ` +
            `Missing: ${scopeValidation.missingScopes.join(', ')}`
          );
        }
      }
      
      console.log('✅ Scope validation:', {
        totalScopes: userScopes.length,
        characterScopes: characterOnlyScopes.length,
        corporationScopes: corpOnlyScopes.length,
        hasAllRequired: scopeValidation.isValid
      });

      let corporationName = '';
      try {
        corporationName = await this.getCorporationName(characterData.corporation_id);
      } catch (error) {
        console.warn('Failed to get corporation name:', error);
        corporationName = 'Unknown Corporation';
      }

      let allianceName: string | undefined;
      if (characterData.alliance_id) {
        try {
          allianceName = await this.getAllianceName(characterData.alliance_id);
        } catch (error) {
          console.warn('Failed to get alliance name:', error);
        }
      }

      const userData: Partial<LMeveUser> = {
        characterId: characterData.character_id,
        characterName: characterData.character_name,
        corporationId: characterData.corporation_id,
        corporationName,
        allianceId: characterData.alliance_id,
        allianceName,
        authMethod: 'esi',
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenExpiry: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
        scopes: userScopes,
        characterScopes: characterOnlyScopes,
        corporationScopes: corpOnlyScopes
      };

      const user = createUserWithRole(userData, validation.suggestedRole);

      console.log('✅ ESI authentication successful:', {
        characterName: user.characterName,
        corporationName: user.corporationName,
        role: user.role,
        validationReason: validation.reason
      });

      if (!validation.corporationConfig && validation.suggestedRole === 'corp_admin') {
        console.log('🏢 New corporation self-registration detected');
        
        (user as any)._requiresCorporationRegistration = {
          corporationId: characterData.corporation_id,
          corporationName,
          characterId: characterData.character_id
        };
      }

      sessionStorage.removeItem('esi-auth-state');
      sessionStorage.removeItem('esi-login-attempt');

      return user;
      
    } catch (error) {
      console.error('❌ ESI authentication failed:', error);
      
      sessionStorage.removeItem('esi-auth-state');
      sessionStorage.removeItem('esi-login-attempt');
      
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token using PKCE
   * Implements OAuth2 token endpoint specification
   */
  private async exchangeCodeForToken(code: string, verifier: string): Promise<ESITokenResponse> {
    console.log('🔄 Exchanging authorization code for access token');
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      code: code
    });
    // Only include code_verifier when PKCE was used
    if (verifier) {
      body.append('code_verifier', verifier);
    }

    if (this.clientSecret) {
      body.append('client_secret', this.clientSecret);
    }

    const response = await fetch(SSO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'LMeve/1.0 (https://github.com/dstevens79/lmeve)',
        'Host': 'login.eveonline.com'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Token exchange failed:', response.status, errorText);
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokenData: ESITokenResponse = await response.json();
    
    if (!tokenData.access_token) {
      throw new Error('Token response missing access_token');
    }
    
    if (!tokenData.refresh_token) {
      console.warn('⚠️ Token response missing refresh_token');
    }
    
    console.log('✅ Token exchange successful - received JWT access token');
    
    return tokenData;
  }

  /**
   * Decode and validate JWT token
   * 
   * Note: For production use, JWT signatures should be validated against CCP's public keys
   * available at https://login.eveonline.com/oauth/jwks
   * 
   * This implementation validates the JWT structure and claims but does not verify
   * the signature. The /oauth/verify endpoint provides additional validation.
   * 
   * For full JWT signature verification, implement:
   * 1. Fetch JWKS from https://login.eveonline.com/oauth/jwks
   * 2. Extract the kid from JWT header
   * 3. Find matching key in JWKS
   * 4. Verify signature using the public key
   */
  private decodeJWT(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT token format');
      }
      
      const payload = parts[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      
      return decoded;
    } catch (error) {
      console.error('JWT decode error:', error);
      throw new Error('Failed to decode JWT token');
    }
  }

  /**
   * Validate JWT token claims
   */
  private validateJWTClaims(claims: any): void {
    const now = Math.floor(Date.now() / 1000);
    
    if (claims.exp && claims.exp < now) {
      throw new Error('JWT token has expired');
    }
    
    if (claims.iss !== 'login.eveonline.com') {
      throw new Error('Invalid JWT issuer');
    }
    
    if (claims.azp !== this.clientId) {
      throw new Error('JWT azp claim does not match client ID');
    }
    
    console.log('✅ JWT claims validated:', {
      subject: claims.sub,
      name: claims.name,
      owner: claims.owner,
      exp: new Date(claims.exp * 1000).toISOString()
    });
  }

  /**
   * Get character information from ESI with JWT validation
   */
  private async getCharacterInfo(accessToken: string): Promise<ESICharacterData> {
    console.log('🔄 Getting character info with JWT validation');
    
    const jwtClaims = this.decodeJWT(accessToken);
    this.validateJWTClaims(jwtClaims);
    
    const characterId = parseInt(jwtClaims.sub.replace('CHARACTER:EVE:', ''));
    const characterName = jwtClaims.name;
    const owner = jwtClaims.owner;
    
    console.log('✅ JWT decoded:', {
      characterId,
      characterName,
      owner,
      scopes: jwtClaims.scp
    });
    
    const response = await fetch(SSO_VERIFY_URL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'LMeve/1.0 (https://github.com/dstevens79/lmeve)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to verify token: ${response.status}`);
    }

    const verifyData = await response.json();
    console.log('✅ Token verified via /oauth/verify');
    
    const charResponse = await fetch(
      `${ESI_BASE_URL}/latest/characters/${characterId}/`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'LMeve/1.0 (https://github.com/dstevens79/lmeve)'
        }
      }
    );

    if (!charResponse.ok) {
      throw new Error(`Failed to get character data: ${charResponse.status}`);
    }

    const charData = await charResponse.json();
    console.log('✅ Character data retrieved:', charData.name);
    
    return {
      character_id: characterId,
      character_name: characterName,
      corporation_id: charData.corporation_id,
      alliance_id: charData.alliance_id,
      scopes: jwtClaims.scp || verifyData.Scopes?.split(' ') || []
    };
  }

  /**
   * Get character's corporation roles
   */
  private async getCharacterRoles(characterId: number, accessToken: string): Promise<string[]> {
    console.log('🔄 Getting character roles');
    
    try {
      const response = await fetch(
        `${ESI_BASE_URL}/latest/characters/${characterId}/roles/`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'LMeve/1.0 (https://github.com/dstevens79/lmeve)'
          }
        }
      );

      if (!response.ok) {
        console.warn('Failed to get character roles, using default');
        return [];
      }

      const rolesData = await response.json();
      const roles = rolesData.roles || [];
      
      console.log('✅ Character roles retrieved:', roles);
      return roles;
      
    } catch (error) {
      console.warn('Error getting character roles:', error);
      return [];
    }
  }

  /**
   * Get corporation name
   */
  private async getCorporationName(corporationId: number): Promise<string> {
    const response = await fetch(
      `${ESI_BASE_URL}/latest/corporations/${corporationId}/`,
      {
        headers: {
          'User-Agent': 'LMeve/1.0 (https://github.com/dstevens79/lmeve)'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get corporation info: ${response.status}`);
    }

    const data = await response.json();
    return data.name;
  }

  /**
   * Get alliance name
   */
  private async getAllianceName(allianceId: number): Promise<string> {
    const response = await fetch(
      `${ESI_BASE_URL}/latest/alliances/${allianceId}/`,
      {
        headers: {
          'User-Agent': 'LMeve/1.0 (https://github.com/dstevens79/lmeve)'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get alliance info: ${response.status}`);
    }

    const data = await response.json();
    return data.name;
  }

  /**
   * Refresh access token using refresh token
   * Implements OAuth2 refresh token flow
   */
  async refreshToken(refreshToken: string): Promise<ESITokenResponse> {
    console.log('🔄 Refreshing access token using refresh token');
    
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId
    });

    if (this.clientSecret) {
      body.append('client_secret', this.clientSecret);
    }

    const response = await fetch(SSO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'LMeve/1.0 (https://github.com/dstevens79/lmeve)',
        'Host': 'login.eveonline.com'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Token refresh failed:', response.status, errorText);
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const tokenData: ESITokenResponse = await response.json();
    
    if (!tokenData.access_token) {
      throw new Error('Refresh response missing access_token');
    }
    
    console.log('✅ Token refresh successful - new JWT received');
    
    return tokenData;
  }

  /**
   * Validate if access token is still valid
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(SSO_VERIFY_URL, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'LMeve/1.0 (https://github.com/dstevens79/lmeve)'
        }
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Revoke access token (OAuth2 token revocation)
   */
  async revokeToken(accessToken: string): Promise<void> {
    try {
      await fetch(SSO_REVOKE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'LMeve/1.0 (https://github.com/dstevens79/lmeve)'
        },
        body: new URLSearchParams({
          token_type_hint: 'access_token',
          token: accessToken
        }).toString()
      });
      
      console.log('✅ Token revoked successfully');
    } catch (error) {
      console.warn('Failed to revoke token:', error);
    }
  }
}

/**
 * Default ESI Auth Service instance
 * Will be configured based on application settings
 */
export let esiAuthService: ESIAuthService | null = null;

/**
 * Initialize ESI Auth Service with configuration
 */
export function initializeESIAuth(
  clientId: string, 
  clientSecret?: string, 
  registeredCorps: CorporationConfig[] = [],
  redirectUri?: string
): void {
  esiAuthService = new ESIAuthService(clientId, clientSecret, registeredCorps, redirectUri);
  console.log('✅ ESI Auth Service initialized');
}

/**
 * Get the configured ESI Auth Service
 */
export function getESIAuthService(): ESIAuthService {
  if (!esiAuthService) {
    throw new Error('ESI Auth Service not initialized. Call initializeESIAuth() first.');
  }
  return esiAuthService;
}