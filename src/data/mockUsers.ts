import type { Group, Role, User } from '@/types';

/**
 * Seed data — read-only mock directory.
 * Generic names only (no personal names). Stable IDs preserved for existing requests.
 * Role switcher: Employee → usr-employee, Approver → usr-approver, Admin → usr-admin.
 */

const SEED_TS = '2026-01-01T00:00:00.000Z';

export const MOCK_GROUPS: Group[] = [
  {
    id: 'grp-analysis',
    name: 'Analysis Group',
    code: 'ANALYSIS',
    description: 'Analysis and documentation group',
    status: 'Active',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'grp-piping',
    name: 'Piping Group',
    code: 'PIPING',
    description: 'Piping engineering group',
    status: 'Active',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'grp-system',
    name: 'System Group',
    code: 'SYSTEM',
    description: 'System administration and IT support',
    status: 'Active',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
];

/**
 * Dev role switcher → stable mock user IDs.
 * Legacy IDs (usr-ana / usr-edmon / usr-dave) are aliases so old localStorage sessions keep working.
 */
export const ROLE_SWITCHER_USERS: Record<'employee' | 'approver' | 'admin', string> =
  {
    employee: 'usr-ana',
    approver: 'usr-edmon',
    admin: 'usr-dave',
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
    id: 'usr-ana',
    employeeId: 'EMP-001',
    name: 'Mock Employee',
    email: 'employee@example.com',
    groupId: 'grp-analysis',
    groupName: 'Analysis Group',
    roles: ['employee'],
  }),
  user({
    id: 'usr-carlo',
    employeeId: 'EMP-002',
    name: 'Mock Employee 2',
    email: 'employee2@example.com',
    groupId: 'grp-piping',
    groupName: 'Piping Group',
    roles: ['employee'],
  }),
  user({
    id: 'usr-dave',
    employeeId: 'EMP-ADMIN',
    name: 'Mock Admin',
    email: 'admin@example.com',
    groupId: 'grp-system',
    groupName: 'System Group',
    roles: ['employee', 'admin'],
    hasApprovalResponsibility: false,
  }),
  user({
    id: 'usr-edmon',
    employeeId: 'EMP-APPR',
    name: 'Mock Approver',
    email: 'approver@example.com',
    groupId: 'grp-system',
    groupName: 'System Group',
    roles: ['employee', 'approver'],
    hasApprovalResponsibility: true,
  }),
  user({
    id: 'usr-tagi',
    employeeId: 'EMP-APPR2',
    name: 'Mock Approver 2',
    email: 'approver2@example.com',
    groupId: 'grp-system',
    groupName: 'System Group',
    roles: ['employee', 'approver'],
    hasApprovalResponsibility: true,
  }),
  user({
    id: 'usr-julia',
    employeeId: 'EMP-ADMIN2',
    name: 'Mock Admin 2',
    email: 'admin2@example.com',
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
