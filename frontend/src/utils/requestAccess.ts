import type { SubmittedRequest, User } from '@/types';
import {
  canUserActOnRequest,
  isUserAssignedToRequest,
} from './assignmentHelpers';
import { getWorkflowParticipants } from './requestProgress';

/**
 * Request-specific authorization.
 * Owner or assigned reviewer/approver only — Admin does not get blanket access.
 */
export function canUserViewRequest(
  user: User | null,
  request: SubmittedRequest | null | undefined,
): boolean {
  if (!user || !request) return false;
  if (request.requesterId === user.id) return true;
  return isUserAssignedToRequest(request, user.id);
}

/** Review route: assigned participants may open; actionability checked separately. */
export function canUserOpenReview(
  user: User | null,
  request: SubmittedRequest | null | undefined,
): boolean {
  if (!user || !request) return false;
  return isUserAssignedToRequest(request, user.id);
}

export function canUserTakeAction(
  user: User | null,
  request: SubmittedRequest | null | undefined,
): boolean {
  if (!user || !request) return false;
  return canUserActOnRequest(request, user.id);
}

export function buildAccessContext(request: SubmittedRequest) {
  return {
    requestId: request.id,
    ownerId: request.requesterId,
    assignedReviewerIds: getWorkflowParticipants(request).map((p) => p.userId),
  };
}
