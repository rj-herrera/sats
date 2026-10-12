import { describe, expect, it } from 'vitest';
import { MOCK_USERS } from '@/data/mockUsers';
import {
  canManageTemplates,
  getPermissionsForUser,
  getPrimaryRoleLabel,
  hasPermission,
  showTemplatesInSidebar,
} from '@/utils/permissions';
import { canManageTemplate } from '@/utils/templatePermissions';
import type { FormTemplate, User } from '@/types';

function userById(id: string): User {
  const found = MOCK_USERS.find((u) => u.id === id);
  if (!found) throw new Error(`Missing mock user ${id}`);
  return found;
}

describe('permissions', () => {
  it('gives employees create/view-own only', () => {
    const ana = userById('usr-ana');
    const perms = getPermissionsForUser(ana);
    expect(perms).toEqual(
      expect.arrayContaining(['requests:create', 'requests:view_own']),
    );
    expect(perms).not.toContain('templates:manage_group');
    expect(perms).not.toContain('templates:manage_generic');
    expect(canManageTemplates(ana)).toBe(false);
    expect(getPrimaryRoleLabel(ana)).toBe('Employee');
  });

  it('gives Approvers group template and inbox permissions', () => {
    const edmon = userById('usr-edmon');
    expect(hasPermission(edmon, 'templates:manage_group')).toBe(true);
    expect(hasPermission(edmon, 'inbox:access')).toBe(true);
    expect(hasPermission(edmon, 'templates:manage_generic')).toBe(false);
    expect(showTemplatesInSidebar(edmon)).toBe(true);
    expect(getPrimaryRoleLabel(edmon)).toBe('Approver');
  });

  it('gives Admins generic template rights without inbox by role alone', () => {
    const dave = userById('usr-dave');
    expect(hasPermission(dave, 'templates:manage_generic')).toBe(true);
    expect(hasPermission(dave, 'inbox:access')).toBe(false);
    expect(canManageTemplates(dave)).toBe(true);
    expect(getPrimaryRoleLabel(dave)).toBe('Admin');
  });

  it('blocks inactive users from permissions', () => {
    const inactive: User = { ...userById('usr-ana'), status: 'Inactive' };
    expect(hasPermission(inactive, 'requests:create')).toBe(false);
  });
});

describe('templatePermissions', () => {
  const groupTemplate = {
    id: 'tpl-1',
    scope: 'group',
    owningGroupId: 'grp-system',
  } as FormTemplate;

  const otherGroupTemplate = {
    id: 'tpl-2',
    scope: 'group',
    owningGroupId: 'grp-analysis',
  } as FormTemplate;

  const genericTemplate = {
    id: 'tpl-3',
    scope: 'generic',
    owningGroupId: null,
  } as FormTemplate;

  it('allows Approvers only their own group templates', () => {
    const edmon = userById('usr-edmon');
    expect(canManageTemplate(edmon, groupTemplate)).toBe(true);
    expect(canManageTemplate(edmon, otherGroupTemplate)).toBe(false);
    expect(canManageTemplate(edmon, genericTemplate)).toBe(false);
  });

  it('allows Admins to manage any template', () => {
    const dave = userById('usr-dave');
    expect(canManageTemplate(dave, groupTemplate)).toBe(true);
    expect(canManageTemplate(dave, genericTemplate)).toBe(true);
  });

  it('denies Employees template management', () => {
    const ana = userById('usr-ana');
    expect(canManageTemplate(ana, groupTemplate)).toBe(false);
  });
});
