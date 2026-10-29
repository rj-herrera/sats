import type { SubmittedRequest } from '@/types';

export interface LatestReturnInfo {
  returnedById: string | null;
  returnedByName: string | null;
  returnedByRole: string | null;
  returnedAt: string | null;
  comment: string | null;
  revisionNumber: number;
  found: boolean;
}

/**
 * Resolve the latest return details from genuine decision/activity data.
 * Never invents missing actor names or comments.
 */
export function getLatestReturnInfo(request: SubmittedRequest): LatestReturnInfo {
  const revisionNumber = request.revisionNumber;

  if (request.workflowType === 'hierarchy_approval') {
    const returnedSteps = [...(request.approvalSteps ?? [])]
      .filter((s) => s.status === 'Returned')
      .sort((a, b) => a.stepOrder - b.stepOrder);
    const step = returnedSteps[returnedSteps.length - 1];
    if (step) {
      return {
        returnedById: step.userId,
        returnedByName: step.name,
        returnedByRole: step.roleLabel,
        returnedAt: step.actionAt ?? null,
        comment: step.comments ?? null,
        revisionNumber,
        found: true,
      };
    }
  } else {
    const returnedReviewers = (request.reviewers ?? []).filter(
      (r) => r.status === 'Returned',
    );
    const reviewer = returnedReviewers[returnedReviewers.length - 1];
    if (reviewer) {
      return {
        returnedById: reviewer.userId,
        returnedByName: reviewer.name,
        returnedByRole: reviewer.role,
        returnedAt: reviewer.actionAt ?? null,
        comment: reviewer.comments ?? null,
        revisionNumber,
        found: true,
      };
    }
  }

  const event = [...(request.activity ?? [])]
    .filter((e) => e.type === 'request_returned')
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  if (event) {
    return {
      returnedById: event.actorId,
      returnedByName: event.actorName,
      returnedByRole: null,
      returnedAt: event.timestamp,
      comment: event.comment ?? null,
      revisionNumber: event.revisionNumber ?? revisionNumber,
      found: true,
    };
  }

  const hist = [...request.revisions]
    .reverse()
    .find((r) => r.outcome === 'Returned' || r.returnComment || r.returnedByName);

  if (hist) {
    return {
      returnedById: hist.returnedById ?? null,
      returnedByName: hist.returnedByName ?? null,
      returnedByRole: hist.returnedByRole ?? null,
      returnedAt: hist.returnedAt ?? null,
      comment: hist.returnComment ?? null,
      revisionNumber: hist.revisionNumber,
      found: Boolean(
        hist.returnedByName || hist.returnComment || hist.returnedAt,
      ),
    };
  }

  return {
    returnedById: null,
    returnedByName: null,
    returnedByRole: null,
    returnedAt: null,
    comment: null,
    revisionNumber,
    found: false,
  };
}
