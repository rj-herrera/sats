import { getGroupById } from '@/services/groupRepository';
import {
  getUserById,
  listAssignableUsers,
} from '@/services/userRepository';
import type {
  ApprovalStepSnapshot,
  FormTemplate,
  HierarchyApprovalWorkflow,
  ReviewerSnapshot,
  User,
} from '@/types';
import {
  getSnapshotRole,
  getUserRolesLabel,
  isApprover,
} from '@/utils/permissions';

export interface ResolvedHierarchyResult {
  ok: true;
  steps: ApprovalStepSnapshot[];
}

export interface UnresolvedHierarchyResult {
  ok: false;
  errors: string[];
}

export type HierarchyResolveResult =
  | ResolvedHierarchyResult
  | UnresolvedHierarchyResult;

/**
 * Resolve hierarchy steps to concrete users.
 * For new submissions / activation, assignees must be active in active groups.
 */
export function resolveHierarchyWorkflow(
  workflow: HierarchyApprovalWorkflow,
  options?: { requireActiveAssignees?: boolean },
): HierarchyResolveResult {
  const requireActive = options?.requireActiveAssignees ?? true;
  const errors: string[] = [];
  const steps: ApprovalStepSnapshot[] = [];

  const ordered = [...workflow.steps].sort((a, b) => a.stepOrder - b.stepOrder);

  for (const step of ordered) {
    const user = getUserById(step.assigneeUserId);
    if (!user) {
      errors.push(
        `Step ${step.stepOrder} (${step.roleLabel}): assigned user could not be resolved.`,
      );
      continue;
    }

    if (requireActive) {
      if (user.status !== 'Active') {
        errors.push(
          `Step ${step.stepOrder} (${step.roleLabel}): ${user.name} is inactive and cannot be assigned.`,
        );
        continue;
      }
      const group = getGroupById(user.groupId);
      if (!group || group.status !== 'Active') {
        errors.push(
          `Step ${step.stepOrder} (${step.roleLabel}): ${user.name} belongs to an inactive group.`,
        );
        continue;
      }
    }

    steps.push({
      stepOrder: step.stepOrder,
      roleLabel: step.roleLabel,
      userId: user.id,
      name: user.name,
      groupName: user.groupName,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (steps.length === 0) {
    return {
      ok: false,
      errors: ['This template has no approval steps configured.'],
    };
  }

  return { ok: true, steps };
}

export function resolveHierarchyForTemplate(
  template: FormTemplate,
): HierarchyResolveResult {
  if (template.workflow.type !== 'hierarchy_approval') {
    return {
      ok: false,
      errors: ['Template is not configured for hierarchy approval.'],
    };
  }
  return resolveHierarchyWorkflow(template.workflow, {
    requireActiveAssignees: true,
  });
}

/** Active Approvers available as reviewers (excludes requester). */
export function listSelectableReviewers(requester: User): User[] {
  return listAssignableUsers().filter(
    (u) => u.id !== requester.id && isApprover(u),
  );
}

export function buildReviewerSnapshots(userIds: string[]): ReviewerSnapshot[] {
  const unique = [...new Set(userIds)];
  const snapshots: ReviewerSnapshot[] = [];

  for (const id of unique) {
    const user = getUserById(id);
    if (!user) continue;
    snapshots.push({
      userId: user.id,
      name: user.name,
      groupName: user.groupName,
      role: getSnapshotRole(user),
    });
  }

  return snapshots;
}

export function formatReviewerRole(user: User): string {
  return getUserRolesLabel(user);
}
