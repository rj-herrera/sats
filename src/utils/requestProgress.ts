import type {
  ApprovalStepSnapshot,
  RequestStatus,
  ReviewerSnapshot,
  StepStatus,
  SubmittedRequest,
  WorkflowType,
} from '@/types';

export interface CurrentStageInfo {
  label: string;
  detail: string | null;
}

function stepStatus(step: ApprovalStepSnapshot): StepStatus {
  return step.status ?? 'Waiting';
}

function reviewerStatus(reviewer: ReviewerSnapshot): StepStatus {
  return reviewer.status ?? 'Pending';
}

function completedReviewCount(reviewers: ReviewerSnapshot[]): number {
  return reviewers.filter((r) => {
    const status = reviewerStatus(r);
    return status === 'Approved' || status === 'Rejected' || status === 'Returned';
  }).length;
}

/**
 * Human-readable current stage for list + details views.
 * Does not mutate request status.
 */
export function getCurrentStage(request: SubmittedRequest): CurrentStageInfo {
  const status = request.status;

  if (status === 'Approved') {
    return { label: 'Completed', detail: 'Request approved' };
  }
  if (status === 'Rejected') {
    return { label: 'Rejected', detail: null };
  }
  if (status === 'Returned') {
    return { label: 'Returned', detail: 'Awaiting requester revision' };
  }
  if (status === 'Cancelled') {
    return { label: 'Cancelled', detail: 'No further approval required' };
  }

  if (request.workflowType === 'hierarchy_approval') {
    return getHierarchyStage(request.approvalSteps, status);
  }

  return getReviewCheckingStage(request.reviewers);
}

function getHierarchyStage(
  steps: ApprovalStepSnapshot[] | null,
  overallStatus: RequestStatus,
): CurrentStageInfo {
  if (!steps || steps.length === 0) {
    return {
      label: 'Unavailable',
      detail: 'Approval sequence was not saved with this request',
    };
  }

  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const total = ordered.length;

  const pending = ordered.find((s) => stepStatus(s) === 'Pending');
  if (pending) {
    return {
      label: `Step ${pending.stepOrder} of ${total} — ${pending.roleLabel}`,
      detail: pending.name,
    };
  }

  const returned = ordered.find((s) => stepStatus(s) === 'Returned');
  if (returned) {
    return {
      label: `Returned at step ${returned.stepOrder}`,
      detail: returned.roleLabel,
    };
  }

  const rejected = ordered.find((s) => stepStatus(s) === 'Rejected');
  if (rejected) {
    return {
      label: `Rejected at step ${rejected.stepOrder}`,
      detail: rejected.roleLabel,
    };
  }

  const allApproved = ordered.every((s) => stepStatus(s) === 'Approved');
  if (allApproved || overallStatus === 'Approved') {
    return { label: 'Completed', detail: 'All approval steps finished' };
  }

  return {
    label: 'Unavailable',
    detail: 'No active approval step found',
  };
}

function getReviewCheckingStage(
  reviewers: ReviewerSnapshot[] | null,
): CurrentStageInfo {
  if (!reviewers || reviewers.length === 0) {
    return {
      label: 'Unavailable',
      detail: 'No reviewers were saved with this request',
    };
  }

  const total = reviewers.length;
  const completed = completedReviewCount(reviewers);
  const pending = reviewers.filter((r) => reviewerStatus(r) === 'Pending').length;

  return {
    label: `${completed} of ${total} reviews completed`,
    detail: pending > 0 ? `${pending} still pending` : null,
  };
}

export function getWorkflowParticipants(
  request: SubmittedRequest,
): { userId: string }[] {
  if (request.workflowType === 'review_checking') {
    return (request.reviewers ?? []).map((r) => ({ userId: r.userId }));
  }
  return (request.approvalSteps ?? []).map((s) => ({ userId: s.userId }));
}

export function workflowTypeOf(request: SubmittedRequest): WorkflowType {
  return request.workflowType;
}
