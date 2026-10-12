import type { FormTemplate, User } from '@/types';
import { hasPermission, userHasRole } from '@/utils/permissions';

/** User may open the Templates management area. */
export function canAccessTemplateManagement(user: User | null): boolean {
  if (!user) return false;
  return (
    hasPermission(user, 'templates:manage_group') ||
    hasPermission(user, 'templates:manage_generic')
  );
}

export function canCreateGroupTemplate(user: User | null): boolean {
  if (!user) return false;
  return hasPermission(user, 'templates:manage_group');
}

export function canCreateGenericTemplate(user: User | null): boolean {
  if (!user) return false;
  return hasPermission(user, 'templates:manage_generic');
}

/**
 * Whether the user may edit / activate / deactivate this template.
 * - Admin: any template
 * - Manager: only group-scoped templates owned by their group
 * - Generic templates are Admin-only for management (not editable by group leaders)
 *
 * Demonstrative for localStorage MVP — PHP must enforce server-side.
 */
export function canManageTemplate(
  user: User | null,
  template: FormTemplate | null | undefined,
): boolean {
  if (!user || !template) return false;

  if (userHasRole(user, 'admin') && hasPermission(user, 'templates:manage_generic')) {
    return true;
  }

  if (
    hasPermission(user, 'templates:manage_group') &&
    template.scope === 'group' &&
    template.owningGroupId === user.groupId
  ) {
    return true;
  }

  return false;
}
