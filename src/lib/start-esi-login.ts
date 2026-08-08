import { toast } from 'sonner';
import type { UserRole } from '@/lib/types';

export type EsiScopeType = 'basic' | 'enhanced' | 'corporation';

export type LoginWithEsiFn = (
  scopeType?: EsiScopeType,
  scopesOverride?: string[]
) => Promise<string>;

/**
 * Canonical browser ESI SSO start.
 * All UI entry points (header, welcome, Settings, Corporations) should call this
 * so redirect_uri / state always go through the auth-provider server start path.
 */
export async function startEsiLogin(
  loginWithESI: LoginWithEsiFn,
  options: {
    scopeType?: EsiScopeType;
    /** When set, admin/corp_admin handoff defaults to corporation scopes. */
    role?: UserRole | string | null;
    clientId?: string | null;
    scopesOverride?: string[];
    /** Optional toast before redirect */
    announce?: boolean;
  } = {}
): Promise<void> {
  const clientId = options.clientId;
  if (!clientId) {
    toast.error('ESI authentication is not configured. Please contact your administrator.');
    return;
  }

  const role = options.role || null;
  const resolvedScope: EsiScopeType =
    options.scopeType ||
    (role === 'super_admin' || role === 'corp_admin' ? 'corporation' : 'basic');

  try {
    const authUrl = await loginWithESI(resolvedScope, options.scopesOverride);
    if (!authUrl) {
      throw new Error('No authorize URL returned');
    }
    if (options.announce !== false) {
      toast.info('Redirecting to EVE SSO...');
    }
    window.location.href = authUrl;
  } catch (error) {
    console.error('ESI login start failed:', error);
    const msg = error instanceof Error ? error.message : 'Failed to initiate ESI login';
    toast.error(msg);
    throw error;
  }
}
