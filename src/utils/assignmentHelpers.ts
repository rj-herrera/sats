import type {
  ApprovalStepSnapshot,
  ReviewerSnapshot,
  StepStatus,
  SubmittedRequest,
  User,
} from '@/types';

export function reviewerStatus(reviewer: ReviewerSnapshot): StepStatus {
  return reviewer.status ?? 'Pending';
}

export function stepStatus(step: ApprovalStepSnapshot): StepStatus {
  return step.status ?? 'Waiting';
}

export function isCompletedStepStatus(status: StepStatus): boolean {
  return status === 'Approved' || status === 'Rejected' || status === 'Returned';
}

/** User is listed on the request workflow snapshot (any step status). */
export function isUserAssignedToRequest(
  request: SubmittedRequest,
  userId: string,
): boolean {
  if (request.workflowType === 'review_checking') {
    return (request.reviewers ?? []).some((r) => r.userId === userId);
  }
  return (request.approvalSteps ?? []).some((s) => s.userId === userId);
}

/**
 * Whether the user currently has an actionable Pending assignment
 * on a still-Pending request.
 */
export function canUserActOnRequest(
  request: SubmittedRequest,
  userId: string,
): boolean {
  if (request.status !== 'Pending') return false;

  if (request.workflowType === 'review_checking') {
    const assignment = (request.reviewers ?? []).find((r) => r.userId === userId);
    return Boolean(assignment && reviewerStatus(assignment) === 'Pending');
  }

  const step = (request.approvalSteps ?? []).find(
    (s) => s.userId === userId && stepStatus(s) === 'Pending',
  );
  return Boolean(step);
}

export interface UserCompletedDecision {
  decision: StepStatus;
  actionAt: string | null;
  comments: string | null;
  label: string;
  revisionNumber: number;
}

function completedFromReviewers(
  reviewers: ReviewerSnapshot[] | null | undefined,
  userId: string,
  revisionNumber: number,
): UserCompletedDecision | null {
  const assignment = (reviewers ?? []).find((r) => r.userId === userId);
  if (!assignment) return null;
  const status = reviewerStatus(assignment);
  if (!isCompletedStepStatus(status)) return null;
  return {
    decision: status,
    actionAt: assignment.actionAt ?? null,
    comments: assignment.comments ?? null,
    label: status === 'Approved' ? 'Approved / Completed' : status,
    revisionNumber,
  };
}

function completedFromSteps(
  steps: ApprovalStepSnapshot[] | null | undefined,
  userId: string,
  revisionNumber: number,
): UserCompletedDecision | null {
  const completed = (steps ?? [])
    .filter((s) => s.userId === userId && isCompletedStepStatus(stepStatus(s)))
    .sort((a, b) => (b.actionAt ?? '').localeCompare(a.actionAt ?? ''));

  const step = completed[0];
  if (!step) return null;
  const status = stepStatus(step);
  return {
    decision: status,
    actionAt: step.actionAt ?? null,
    comments: step.comments ?? null,
    label: status === 'Approved' ? 'Approved' : status,
    revisionNumber,
  };
}

/** User's completed decision on the current revision, if any. */
export function getUserCompletedDecision(
  request: SubmittedRequest,
  userId: string,
): UserCompletedDecision | null {
  if (request.workflowType === 'review_checking') {
    return completedFromReviewers(
      request.reviewers,
      userId,
      request.revisionNumber,
    );
  }
  return completedFromSteps(
    request.approvalSteps,
    userId,
    request.revisionNumber,
  );
}

/**
 * All completed decisions by this user across closed revisions and the current one.
 * Used by Action Inbox Completed Actions so Revision 1 and Revision 2 both appear.
 */
export function listUserCompletedDecisions(
  request: SubmittedRequest,
  userId: string,
): UserCompletedDecision[] {
  const items: UserCompletedDecision[] = [];

  for (const revision of request.revisions) {
    const fromHist =
      request.workflowType === 'review_checking'
        ? completedFromReviewers(
            revision.reviewers,
            userId,
            revision.revisionNumber,
          )
        : completedFromSteps(
            revision.approvalSteps,
            userId,
            revision.revisionNumber,
          );
    if (fromHist) items.push(fromHist);
  }

  const current = getUserCompletedDecision(request, userId);
  if (current) items.push(current);

  return items.sort((a, b) => (b.actionAt ?? '').localeCompare(a.actionAt ?? ''));
}

export function explainWhyCannotAct(
  request: SubmittedRequest,
  user: User,
): string {
  if (!isUserAssignedToRequest(request, user.id)) {
    return 'You are not assigned to review or approve this request.';
  }
  if (request.status === 'Cancelled') {
    return 'This request was cancelled. No further review or approval actions are allowed.';
  }
  if (request.status === 'Approved') {
    return 'This request has already been fully approved.';
  }
  if (request.status === 'Rejected') {
    return 'This request was rejected. No further actions are allowed.';
  }
  if (request.status === 'Returned') {
    return 'This request was returned for revision. Review actions stay disabled until the requester resubmits.';
  }

  if (request.workflowType === 'hierarchy_approval') {
    const mySteps = (request.approvalSteps ?? []).filter((s) => s.userId === user.id);
    const waiting = mySteps.find((s) => stepStatus(s) === 'Waiting');
    if (waiting) {
      const active = (request.approvalSteps ?? []).find(
        (s) => stepStatus(s) === 'Pending',
      );
      if (active) {
        return `You can view this request now, but action is locked until ${active.name} (${active.roleLabel}) completes their approval.`;
      }
      return `You can view this request now, but action is locked until the previous approver completes their step.`;
    }
    const done = mySteps.find((s) => isCompletedStepStatus(stepStatus(s)));
    if (done) {
      return `You have already recorded a decision on this request (${stepStatus(done)}).`;
    }
  }

  if (request.workflowType === 'review_checking') {
    const assignment = (request.reviewers ?? []).find((r) => r.userId === user.id);
    if (assignment && isCompletedStepStatus(reviewerStatus(assignment))) {
      return `You have already recorded a decision on this request (${reviewerStatus(assignment)}).`;
    }
  }

  return 'You cannot take action on this request at this time.';
}
