import type { AccountStatus, Role, User } from '@/types';
import { ACCOUNT_STATUSES, APP_ROLES } from '@/types';

function coerceRole(value: unknown): Role | null {
  if (value === 'manager') return 'approver'; // Phase 1–7 legacy
  if (typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value)) {
    return value as Role;
  }
  return null;
}

function isAccountStatus(value: unknown): value is AccountStatus {
  return (
    typeof value === 'string' &&
    (ACCOUNT_STATUSES as readonly string[]).includes(value)
  );
}

export function normalizeUser(
  raw: unknown,
  groupNameFallback?: string,
): User | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Partial<User> & { active?: boolean };
  if (typeof u.id !== 'string' || !u.id.trim()) return null;
  if (typeof u.name !== 'string' || !u.name.trim()) return null;
  if (typeof u.groupId !== 'string' || !u.groupId.trim()) return null;

  const now = new Date().toISOString();
  const roleSet = new Set<Role>(['employee']);
  if (Array.isArray(u.roles)) {
    for (const rawRole of u.roles) {
      const role = coerceRole(rawRole);
      if (role) roleSet.add(role);
    }
  }
  const roles = (APP_ROLES as readonly Role[]).filter((r) => roleSet.has(r));

  let status: AccountStatus = 'Active';
  if (isAccountStatus(u.status)) status = u.status;
  else if (typeof u.active === 'boolean') status = u.active ? 'Active' : 'Inactive';

  const hasApprover = roles.includes('approver');

  return {
    id: u.id,
    employeeId:
      typeof u.employeeId === 'string' && u.employeeId.trim()
        ? u.employeeId.trim()
        : u.id.replace(/^usr-/, 'EMP-').toUpperCase(),
    name: u.name.trim(),
    email:
      typeof u.email === 'string' && u.email.trim()
        ? u.email.trim()
        : `${u.id}@example.com`,
    groupId: u.groupId,
    groupName:
      typeof u.groupName === 'string' && u.groupName.trim()
        ? u.groupName
        : (groupNameFallback ?? 'Unknown group'),
    roles,
    hasApprovalResponsibility:
      typeof u.hasApprovalResponsibility === 'boolean'
        ? u.hasApprovalResponsibility
        : hasApprover,
    status,
    createdAt: typeof u.createdAt === 'string' ? u.createdAt : now,
    updatedAt: typeof u.updatedAt === 'string' ? u.updatedAt : now,
  };
}

/** Normalize roles stored on historical request snapshots. */
export function normalizeSnapshotRole(value: unknown): Role {
  return coerceRole(value) ?? 'employee';
}

export function createUserId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `usr-${crypto.randomUUID()}`;
  }
  return `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
