import { apiGet, apiPatch, apiPost, messageFromApi } from '@/services/apiClient';
import type { ApiResult } from '@/services/requestApi';

export type AccessRoleCode = 'APPROVER' | 'ADMIN' | 'GROUP_MANAGER';

export interface AccessAssignment {
  employeeId: string;
  roleCode: AccessRoleCode;
  groupId: string | null;
  active: boolean;
  assignedBy: string | null;
  assignedAt: string;
  employeeName: string;
  primaryGroupId: string | null;
  primaryGroupName: string;
  designation: string;
}

const ROLE_CODES = new Set<AccessRoleCode>(['APPROVER', 'ADMIN', 'GROUP_MANAGER']);

function parseAssignment(value: unknown): AccessAssignment | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.employeeId !== 'string' || row.employeeId === '') return null;
  if (typeof row.roleCode !== 'string' || !ROLE_CODES.has(row.roleCode as AccessRoleCode)) {
    return null;
  }
  if (typeof row.active !== 'boolean') return null;
  if (typeof row.employeeName !== 'string') return null;
  if (typeof row.primaryGroupName !== 'string') return null;
  if (typeof row.designation !== 'string') return null;
  const groupId = row.groupId === null ? null : row.groupId;
  const primaryGroupId = row.primaryGroupId === null ? null : row.primaryGroupId;
  if (groupId !== null && typeof groupId !== 'string') return null;
  if (primaryGroupId !== null && typeof primaryGroupId !== 'string') return null;
  if (row.assignedBy !== null && typeof row.assignedBy !== 'string') return null;
  if (typeof row.assignedAt !== 'string') return null;

  return {
    employeeId: row.employeeId,
    roleCode: row.roleCode as AccessRoleCode,
    groupId,
    active: row.active,
    assignedBy: row.assignedBy === null ? null : row.assignedBy,
    assignedAt: row.assignedAt,
    employeeName: row.employeeName,
    primaryGroupId,
    primaryGroupName: row.primaryGroupName,
    designation: row.designation,
  };
}

function parseAssignmentList(body: unknown): AccessAssignment[] | null {
  if (!Array.isArray(body)) return null;
  const rows: AccessAssignment[] = [];
  for (const item of body) {
    const row = parseAssignment(item);
    if (!row) return null;
    rows.push(row);
  }
  return rows;
}

async function assignmentList(path: string, fallback: string): Promise<ApiResult<AccessAssignment[]>> {
  const response = await apiGet(path);
  if (response.status !== 200) {
    return { ok: false, error: messageFromApi(response.status, response.body, fallback) };
  }
  const rows = parseAssignmentList(response.body);
  if (!rows) return { ok: false, error: fallback };
  return { ok: true, data: rows };
}

async function assignmentResult(
  response: { status: number; body: unknown },
  fallback: string,
): Promise<ApiResult<AccessAssignment>> {
  if (response.status !== 200 && response.status !== 201) {
    return { ok: false, error: messageFromApi(response.status, response.body, fallback) };
  }
  const row = parseAssignment(response.body);
  if (!row) return { ok: false, error: fallback };
  return { ok: true, data: row };
}

export function listApprovers(): Promise<ApiResult<AccessAssignment[]>> {
  return assignmentList('/admin/approvers', 'Approvers could not be loaded.');
}

export function grantApprover(employeeId: string): Promise<ApiResult<AccessAssignment>> {
  return apiPost('/admin/approvers', { employeeId }).then((response) =>
    assignmentResult(response, 'The approver could not be added.'),
  );
}

export function setApproverActive(
  employeeId: string,
  active: boolean,
): Promise<ApiResult<AccessAssignment>> {
  return apiPatch(`/admin/approvers/${employeeId}`, { active }).then((response) =>
    assignmentResult(response, 'The approver could not be updated.'),
  );
}

export function listAccessAssignments(): Promise<ApiResult<AccessAssignment[]>> {
  return assignmentList('/admin/access', 'Access assignments could not be loaded.');
}

export function grantAccess(
  employeeId: string,
  roleCode: 'ADMIN',
): Promise<ApiResult<AccessAssignment>> {
  return apiPost('/admin/access', { employeeId, roleCode }).then((response) =>
    assignmentResult(response, 'The assignment could not be added.'),
  );
}

export function setAccessActive(
  employeeId: string,
  roleCode: 'ADMIN',
  active: boolean,
): Promise<ApiResult<AccessAssignment>> {
  return apiPatch(`/admin/access/${employeeId}/${roleCode}`, { active }).then((response) =>
    assignmentResult(response, 'The assignment could not be updated.'),
  );
}
