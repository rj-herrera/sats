import { getGroupById } from '@/services/groupRepository';
import type { Permission, RequestAccessContext, Role, User } from '@/types';
import { APP_ROLES } from '@/types';

/**
 * Centralized permission map.
 * Additional responsibilities can be layered later without rewriting navigation.
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  employee: ['requests:create', 'requests:view_own'],
  approver: [
    'requests:create',
    'requests:view_own',
    'requests:view_assigned',
    'requests:approve',
    'templates:manage_group',
    'inbox:access',
  ],
  admin: [
    'requests:create',
    'requests:view_own',
    'templates:manage_group',
    'templates:manage_generic',
  ],
};

const ROLE_DISPLAY_ORDER: Role[] = [...APP_ROLES];

export function getPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function userHasRole(user: User | null, role: Role): boolean {
  if (!user) return false;
  return user.roles.includes(role);
}

/** Roles for permission checks — always treat as at least employee. */
export function getEffectiveRoles(user: User): Role[] {
  const set = new Set<Role>(user.roles);
  set.add('employee');
  return ROLE_DISPLAY_ORDER.filter((r) => set.has(r));
}

export function getPermissionsForUser(user: User): Permission[] {
  const set = new Set<Permission>();
  for (const role of getEffectiveRoles(user)) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      set.add(permission);
    }
  }
  return [...set];
}

export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false;
  if (user.status !== 'Active') return false;

  if (getPermissionsForUser(user).includes(permission)) {
    return true;
  }

  // Designated Approver responsibility — not Admin alone.
  if (
    (permission === 'inbox:access' ||
      permission === 'requests:view_assigned' ||
      permission === 'requests:approve') &&
    user.hasApprovalResponsibility
  ) {
    return true;
  }

  return false;
}

/**
 * Role/flag-based inbox permission only.
 * Prefer canAccessActionInbox() from inboxService for UI/nav (includes assignments).
 */
export function canAccessInbox(user: User | null): boolean {
  return hasPermission(user, 'inbox:access');
}

export function canManageTemplates(user: User | null): boolean {
  return (
    hasPermission(user, 'templates:manage_group') ||
    hasPermission(user, 'templates:manage_generic')
  );
}

export function canCreateRequest(user: User | null): boolean {
  if (!hasPermission(user, 'requests:create') || !user) return false;
  const group = getGroupById(user.groupId);
  return group?.status === 'Active';
}

/** Designated Approver (not Admin alone). */
export function isApprover(user: User | null): boolean {
  if (!user) return false;
  return user.hasApprovalResponsibility || user.roles.includes('approver');
}

/** @deprecated Prefer isApprover */
export function isGroupLeaderOrApprover(user: User | null): boolean {
  return isApprover(user);
}

/**
 * Sidebar: Management & Approvals (Action Inbox + Templates).
 * Hidden entirely when the user has neither inbox access nor template rights.
 */
export function hasManagementSidebarSection(user: User | null): boolean {
  if (!user) return false;
  return showActionInboxInSidebar(user) || showTemplatesInSidebar(user);
}

/** @deprecated Prefer hasManagementSidebarSection */
export function hasApproverSidebarSection(user: User | null): boolean {
  return hasManagementSidebarSection(user);
}

/** @deprecated Prefer hasManagementSidebarSection */
export function hasAdminSidebarSection(user: User | null): boolean {
  return hasManagementSidebarSection(user);
}

/**
 * Action Inbox nav — designated Approvers.
 * Admin alone never qualifies without Approver responsibility.
 */
export function showActionInboxInSidebar(user: User | null): boolean {
  if (!user || user.status !== 'Active') return false;
  return isApprover(user);
}

/** Templates under Management & Approvals for Approvers and Admins. */
export function showTemplatesInSidebar(user: User | null): boolean {
  return canManageTemplates(user);
}

/** @deprecated Prefer showTemplatesInSidebar */
export function showTemplatesInApproverSidebar(user: User | null): boolean {
  return showTemplatesInSidebar(user) && isApprover(user);
}

/** @deprecated Prefer showTemplatesInSidebar */
export function showTemplatesInAdminSidebar(user: User | null): boolean {
  return showTemplatesInSidebar(user) && Boolean(user?.roles.includes('admin'));
}

/**
 * Request-specific authorization from an access context.
 * Owner or assigned reviewer/approver only — Admin does not get blanket access.
 */
export function canViewRequest(
  user: User | null,
  context: RequestAccessContext,
): boolean {
  if (!user) return false;
  if (context.ownerId === user.id) return true;
  if (context.assignedReviewerIds.includes(user.id)) return true;
  return false;
}

export function canReviewRequest(
  user: User | null,
  context: RequestAccessContext,
): boolean {
  if (!user) return false;
  return context.assignedReviewerIds.includes(user.id);
}

export function getRoleLabel(role: Role | string): string {
  switch (role) {
    case 'employee':
      return 'Employee';
    case 'approver':
    case 'manager': // legacy snapshots
      return 'Approver';
    case 'admin':
      return 'Admin';
    default:
      return String(role);
  }
}

/**
 * Primary role for display (position/role line).
 * Prefer Admin > Approver > Employee.
 */
export function getPrimaryRoleLabel(user: User): string {
  return getRoleLabel(getSnapshotRole(user));
}

/** Display stacked roles, e.g. "Employee / Approver / Admin". */
export function getUserRolesLabel(user: User): string {
  return getEffectiveRoles(user)
    .map((role) => getRoleLabel(role))
    .join(' / ');
}

/**
 * Single role stored on reviewer snapshots (highest privilege).
 * Prefer admin > approver > employee.
 */
export function getSnapshotRole(user: User): Role {
  const roles = getEffectiveRoles(user);
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('approver')) return 'approver';
  return 'employee';
}

/** Which switcher persona matches the current user (if any). */
export function getSwitcherRole(user: User | null): Role | null {
  if (!user) return null;
  if (user.roles.includes('admin') && !user.roles.includes('approver')) {
    return 'admin';
  }
  if (user.roles.includes('approver')) return 'approver';
  return 'employee';
}
