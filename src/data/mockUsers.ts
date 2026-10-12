import type { Group, Role, User } from '@/types';

/**
 * Seed data — read-only mock directory.
 * Numbered generic users only. Groups: System Group, Admin Group.
 */

const SEED_TS = '2026-01-01T00:00:00.000Z';

export const MOCK_GROUPS: Group[] = [
  {
    id: 'grp-system',
    name: 'System Group',
    code: 'SYSTEM',
    description: 'System administration and general operations',
    status: 'Active',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'grp-admin',
    name: 'Admin Group',
    code: 'ADMIN',
    description: 'Administration group for elevated management tasks',
    status: 'Active',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
];

/** Previous mock user IDs → current generic IDs (localStorage migration). */
export const LEGACY_USER_ID_MAP: Readonly<Record<string, string>> = {
  'usr-ana': 'usr-employee-1',
  'usr-carlo': 'usr-employee-2',
  'usr-edmon': 'usr-approver-1',
  'usr-tagi': 'usr-approver-2',
  'usr-dave': 'usr-admin-1',
};

export function resolveMockUserId(id: string): string {
  return LEGACY_USER_ID_MAP[id] ?? id;
}

/**
 * Dev identity switcher — users available per persona role.
 */
export const SWITCHER_USERS_BY_ROLE: Record<
  'employee' | 'approver' | 'admin',
  readonly string[]
> = {
  employee: ['usr-employee-1', 'usr-employee-2'],
  approver: ['usr-approver-1', 'usr-approver-2'],
  admin: ['usr-admin-1'],
};

/** Default user for each role (first in the switcher list). */
export const ROLE_SWITCHER_USERS: Record<'employee' | 'approver' | 'admin', string> =
  {
    employee: SWITCHER_USERS_BY_ROLE.employee[0],
    approver: SWITCHER_USERS_BY_ROLE.approver[0],
    admin: SWITCHER_USERS_BY_ROLE.admin[0],
  };

function user(
  partial: Omit<
    User,
    | 'roles'
    | 'hasApprovalResponsibility'
    | 'status'
    | 'createdAt'
    | 'updatedAt'
    | 'employeeId'
  > & {
    roles: Role[];
    employeeId?: string;
    hasApprovalResponsibility?: boolean;
    status?: User['status'];
  },
): User {
  const roles = [...new Set<Role>(['employee', ...partial.roles])];
  return {
    ...partial,
    employeeId:
      partial.employeeId ?? partial.id.replace(/^usr-/, 'EMP-').toUpperCase(),
    roles,
    hasApprovalResponsibility: partial.hasApprovalResponsibility ?? false,
    status: partial.status ?? 'Active',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  };
}

export const MOCK_USERS: User[] = [
  user({
    id: 'usr-employee-1',
    employeeId: 'EMP-001',
    name: 'Employee 1',
    email: 'employee1@example.com',
    groupId: 'grp-system',
    groupName: 'System Group',
    roles: ['employee'],
  }),
  user({
    id: 'usr-employee-2',
    employeeId: 'EMP-002',
    name: 'Employee 2',
    email: 'employee2@example.com',
    groupId: 'grp-admin',
    groupName: 'Admin Group',
    roles: ['employee'],
  }),
  user({
    id: 'usr-approver-1',
    employeeId: 'EMP-APPR-001',
    name: 'Approver 1',
    email: 'approver1@example.com',
    groupId: 'grp-system',
    groupName: 'System Group',
    roles: ['employee', 'approver'],
    hasApprovalResponsibility: true,
  }),
  user({
    id: 'usr-approver-2',
    employeeId: 'EMP-APPR-002',
    name: 'Approver 2',
    email: 'approver2@example.com',
    groupId: 'grp-admin',
    groupName: 'Admin Group',
    roles: ['employee', 'approver'],
    hasApprovalResponsibility: true,
  }),
  user({
    id: 'usr-admin-1',
    employeeId: 'EMP-ADMIN-001',
    name: 'Admin 1',
    email: 'admin1@example.com',
    groupId: 'grp-system',
    groupName: 'System Group',
    roles: ['employee', 'admin'],
    hasApprovalResponsibility: false,
  }),
];

/** @deprecated Prefer getUserById from userRepository */
export function findMockUserById(id: string): User | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}

/** @deprecated Prefer listLoginUsers from userRepository */
export function getMockLoginUsers(): User[] {
  return MOCK_USERS.filter((u) => u.status === 'Active');
}
