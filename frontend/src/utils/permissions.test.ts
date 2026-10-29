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
    const employee = userById('usr-employee-1');
    const perms = getPermissionsForUser(employee);
    expect(perms).toEqual(
      expect.arrayContaining(['requests:create', 'requests:view_own']),
    );
    expect(perms).not.toContain('templates:manage_group');
    expect(perms).not.toContain('templates:manage_generic');
    expect(canManageTemplates(employee)).toBe(false);
    expect(getPrimaryRoleLabel(employee)).toBe('Employee');
  });

  it('gives Approvers group template and inbox permissions', () => {
    const approver = userById('usr-approver-1');
    expect(hasPermission(approver, 'templates:manage_group')).toBe(true);
    expect(hasPermission(approver, 'inbox:access')).toBe(true);
    expect(hasPermission(approver, 'templates:manage_generic')).toBe(false);
    expect(showTemplatesInSidebar(approver)).toBe(true);
    expect(getPrimaryRoleLabel(approver)).toBe('Approver');
  });

  it('gives Admins generic template rights without inbox by role alone', () => {
    const admin = userById('usr-admin-1');
    expect(hasPermission(admin, 'templates:manage_generic')).toBe(true);
    expect(hasPermission(admin, 'inbox:access')).toBe(false);
    expect(canManageTemplates(admin)).toBe(true);
    expect(getPrimaryRoleLabel(admin)).toBe('Admin');
  });

  it('blocks inactive users from permissions', () => {
    const inactive: User = { ...userById('usr-employee-1'), status: 'Inactive' };
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
    owningGroupId: 'grp-admin',
  } as FormTemplate;

  const genericTemplate = {
    id: 'tpl-3',
    scope: 'generic',
    owningGroupId: null,
  } as FormTemplate;

  it('allows Approvers only their own group templates', () => {
    const approver = userById('usr-approver-1');
    expect(canManageTemplate(approver, groupTemplate)).toBe(true);
    expect(canManageTemplate(approver, otherGroupTemplate)).toBe(false);
    expect(canManageTemplate(approver, genericTemplate)).toBe(false);
  });

  it('allows Admins to manage any template', () => {
    const admin = userById('usr-admin-1');
    expect(canManageTemplate(admin, groupTemplate)).toBe(true);
    expect(canManageTemplate(admin, genericTemplate)).toBe(true);
  });

  it('denies Employees template management', () => {
    const employee = userById('usr-employee-1');
    expect(canManageTemplate(employee, groupTemplate)).toBe(false);
  });
});
