import { listRequests } from '@/services/requestRepository';
import type { SubmittedRequest, User } from '@/types';
import {
  canUserActOnRequest,
  getUserCompletedDecision,
  isUserAssignedToRequest,
  listUserCompletedDecisions,
} from '@/utils/assignmentHelpers';
import { isApprover } from '@/utils/permissions';

export interface InboxPendingItem {
  request: SubmittedRequest;
  /** True when this user's hierarchy/review step is currently actionable. */
  canAct: boolean;
}

export interface InboxCompletedItem {
  request: SubmittedRequest;
  decision: string;
  actionAt: string | null;
  comments: string | null;
  revisionNumber: number;
}

/**
 * Active inbox items for an assignee:
 * - Only overall Pending requests (Returned / Cancelled excluded)
 * - Hierarchy: all assigned approvers see the request while Pending,
 *   even if their step is Waiting (action locked until prior steps finish).
 * - Review/checking: assigned reviewers with unfinished Pending assignments.
 * Excludes requests where the user already recorded a decision on the current revision.
 */
export function listPendingInboxItems(userId: string): InboxPendingItem[] {
  return listRequests()
    .filter((request) => {
      if (request.status !== 'Pending') return false;
      if (!isUserAssignedToRequest(request, userId)) return false;
      if (getUserCompletedDecision(request, userId)) return false;
      return true;
    })
    .map((request) => ({
      request,
      canAct: canUserActOnRequest(request, userId),
    }))
    .sort((a, b) => {
      if (a.canAct !== b.canAct) return a.canAct ? -1 : 1;
      const aAt = a.request.lastResubmittedAt ?? a.request.submittedAt;
      const bAt = b.request.lastResubmittedAt ?? b.request.submittedAt;
      return bAt.localeCompare(aAt);
    });
}

/** Count used for sidebar badge — only items that need the user's action now. */
export function countActionableInboxItems(userId: string): number {
  return listPendingInboxItems(userId).filter((item) => item.canAct).length;
}

/**
 * Completed Actions — one row per request (latest decision by this user).
 * Older revisions stay in Revision History on the request details page,
 * matching My Requests (one list row per request number).
 * Requests still awaiting action stay under Assigned to Me only.
 */
export function listCompletedInboxItems(userId: string): InboxCompletedItem[] {
  const pendingIds = new Set(
    listPendingInboxItems(userId).map((item) => item.request.id),
  );
  const items: InboxCompletedItem[] = [];

  for (const request of listRequests()) {
    if (pendingIds.has(request.id)) continue;
    const [latest] = listUserCompletedDecisions(request, userId);
    if (!latest) continue;
    items.push({
      request,
      decision: latest.label,
      actionAt: latest.actionAt,
      comments: latest.comments,
      revisionNumber: latest.revisionNumber,
    });
  }

  return items.sort((a, b) =>
    (b.actionAt ?? '').localeCompare(a.actionAt ?? ''),
  );
}

/**
 * Action Inbox access:
 * - Designated Approvers always (even with an empty inbox)
 * - Any active user who currently has pending or completed assigned work
 * Admin role alone does not grant access.
 */
export function canAccessActionInbox(user: User | null): boolean {
  if (!user || user.status !== 'Active') return false;
  if (isApprover(user)) return true;
  return (
    listPendingInboxItems(user.id).length > 0 ||
    listCompletedInboxItems(user.id).length > 0
  );
}
