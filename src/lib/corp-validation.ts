import { CorporationConfig, LMeveUser, UserRole } from './types';

/**
 * Corporation validation service for ESI authentication
 * Validates that users are members of registered corporations
 */

/**
 * Check if a corporation is registered and allowed to use LMeve
 */
export function isCorporationRegistered(
  corporationId: number, 
  registeredCorps: CorporationConfig[]
): boolean {
  return registeredCorps.some(corp => 
    corp.corporationId === corporationId && corp.isActive
  );
}

/**
 * Get corporation configuration by ID
 */
export function getCorporationConfig(
  corporationId: number,
  registeredCorps: CorporationConfig[]
): CorporationConfig | null {
  return registeredCorps.find(corp => 
    corp.corporationId === corporationId && corp.isActive
  ) || null;
}

/**
 * Validate ESI user against corporation whitelist
 * This checks if the character's corporation is registered
 */
export function validateESIUser(
  characterData: {
    character_id: number;
    character_name: string;
    corporation_id: number;
    alliance_id?: number;
  },
  corporationRoles: string[],
  registeredCorps: CorporationConfig[]
): {
  isValid: boolean;
  reason?: string;
  suggestedRole: UserRole;
  corporationConfig?: CorporationConfig;
} {
  // Check if corporation is registered
  const corpConfig = getCorporationConfig(characterData.corporation_id, registeredCorps);
  
  if (!corpConfig) {
    // Check if user has director/CEO roles that would allow self-registration
    const hasManagementRole = corporationRoles.some(role => 
      ['Director', 'CEO', 'Personnel_Manager'].includes(role)
    );
    
    if (hasManagementRole) {
      return {
        isValid: true,
        reason: 'Corporation director/CEO can self-register corporation',
        suggestedRole: 'corp_admin', // Directors can manage their corp
        corporationConfig: undefined
      };
    } else {
      return {
        isValid: false,
        reason: 'Corporation is not registered. Contact your corporation leadership to register with LMeve.',
        suggestedRole: 'guest',
        corporationConfig: undefined
      };
    }
  }

  // Corporation is registered - determine role based on EVE roles
  let suggestedRole: UserRole = 'corp_member';
  
  if (corporationRoles.includes('CEO')) {
    suggestedRole = 'corp_admin';
  } else if (corporationRoles.includes('Director')) {
    suggestedRole = 'corp_director';
  } else if (corporationRoles.some(role => 
    ['Personnel_Manager', 'Factory_Manager', 'Station_Manager', 'Accountant'].includes(role)
  )) {
    suggestedRole = 'corp_manager';
  }

  return {
    isValid: true,
    reason: 'Valid corporation member',
    suggestedRole,
    corporationConfig: corpConfig
  };
}

/**
 * Create a default corporation configuration for self-registering directors
 */
export function createDefaultCorporationConfig(
  corporationId: number,
  corporationName: string,
  characterId: number
): CorporationConfig {
  return {
    corporationId,
    corporationName,
    registeredScopes: [
      'esi-characters.read_corporation_roles.v1',
      'esi-corporations.read_corporation_membership.v1',
      'esi-corporations.read_titles.v1',
      'esi-assets.read_corporation_assets.v1',
      'esi-industry.read_corporation_jobs.v1',
      'esi-wallet.read_corporation_wallets.v1'
    ],
    isActive: true,
    registrationDate: new Date().toISOString(),
    lastTokenRefresh: new Date().toISOString()
  };
}

/**
 * Check if required scopes are present for corporation operations
 */
export function validateRequiredScopes(
  userScopes: string[],
  corporationConfig?: CorporationConfig
): {
  isValid: boolean;
  missingScopes: string[];
} {
  const requiredScopes = corporationConfig?.registeredScopes || [
    'esi-characters.read_corporation_roles.v1',
    'esi-corporations.read_corporation_membership.v1'
  ];

  const missingScopes = requiredScopes.filter(scope => 
    !userScopes.includes(scope)
  );

  return {
    isValid: missingScopes.length === 0,
    missingScopes
  };
}

/**
 * Generate validation error message based on validation result
 */
export function getValidationErrorMessage(
  validationResult: ReturnType<typeof validateESIUser>,
  scopeValidation?: ReturnType<typeof validateRequiredScopes>
): string {
  if (!validationResult.isValid) {
    return validationResult.reason || 'Corporation validation failed';
  }

  if (scopeValidation && !scopeValidation.isValid) {
    return `Missing required ESI scopes: ${scopeValidation.missingScopes.join(', ')}. Please re-authenticate with the correct scopes.`;
  }

  return 'Validation successful';
}