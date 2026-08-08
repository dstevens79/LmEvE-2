import { describe, expect, it } from 'vitest';
import {
  canAccessSettingsTab,
  canAccessTab,
  hasPermission,
  isLocalSiteAdmin,
  normalizeUserRole,
} from './roles';
import type { LMeveUser } from './types';

function user(partial: Partial<LMeveUser> & Pick<LMeveUser, 'characterName' | 'role'>): LMeveUser {
  return {
    id: partial.id ?? 'u1',
    characterId: partial.characterId ?? 0,
    characterName: partial.characterName,
    corporationId: partial.corporationId ?? 0,
    corporationName: partial.corporationName ?? '',
    role: partial.role,
    permissions: partial.permissions as LMeveUser['permissions'],
    authMethod: partial.authMethod ?? 'manual',
    is_admin: partial.is_admin,
    ...partial,
  } as LMeveUser;
}

describe('normalizeUserRole', () => {
  it('maps common aliases', () => {
    expect(normalizeUserRole('super_admin')).toBe('super_admin');
    expect(normalizeUserRole('admin')).toBe('super_admin');
        expect(normalizeUserRole('corp_admin')).toBe('corp_admin');
    expect(normalizeUserRole('member')).toBe('corp_member');
  });
});

describe('isLocalSiteAdmin', () => {
  it('recognizes bootstrap admin and super_admin', () => {
    expect(
      isLocalSiteAdmin(
        user({ id: 'bootstrap-admin', characterName: 'admin', role: 'super_admin', authMethod: 'manual' })
      )
    ).toBe(true);
    expect(isLocalSiteAdmin(user({ characterName: 'Admin', role: 'super_admin', isAdmin: true }))).toBe(
      true
    );
    expect(isLocalSiteAdmin(user({ characterName: 'Pilot', role: 'corp_member' }))).toBe(false);
  });
});

describe('permissions and tabs', () => {
  it('gives site admin settings free pass via canAccessSettingsTab', () => {
    const admin = user({
      id: 'bootstrap-admin',
      characterName: 'admin',
      role: 'super_admin',
      authMethod: 'manual',
      is_admin: true,
    });
    expect(canAccessSettingsTab(admin, 'database')).toBe(true);
    expect(canAccessSettingsTab(admin, 'esi')).toBe(true);
    expect(canAccessTab(admin, 'settings')).toBe(true);
  });

  it('restricts ordinary members from settings and manufacturing manage tabs', () => {
    const member = user({ characterName: 'Pilot', role: 'corp_member' });
    expect(hasPermission(member, 'canManageSystem')).toBe(false);
    expect(canAccessSettingsTab(member, 'database')).toBe(false);
    expect(canAccessTab(member, 'dashboard')).toBe(true);
  });
});
