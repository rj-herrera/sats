import { getUserById } from '@/services/userRepository';
import { getRequestById, saveRequest } from '@/services/requestRepository';
import type {
  ActivityEvent,
  DecisionType,
  SubmittedRequest,
} from '@/types';
import {
  canUserActOnRequest,
  isUserAssignedToRequest,
  reviewerStatus,
  stepStatus,
} from '@/utils/assignmentHelpers';
import { canRecordDecision } from '@/utils/requestTransitions';

export interface ProcessDecisionInput {
  requestId: string;
  actorUserId: string;
  decision: DecisionType;
  comment?: string;
  timestamp?: string;
}

export type ProcessDecisionResult =
  | { ok: true; request: SubmittedRequest }
  | { ok: false; error: string };

function createEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendActivity(
  request: SubmittedRequest,
  event: Omit<ActivityEvent, 'id'>,
): ActivityEvent[] {
  const existing = request.activity ?? [];
  return [
    ...existing,
    {
      ...event,
      id: createEventId(),
      revisionNumber: event.revisionNumber ?? request.revisionNumber,
    },
  ];
}

function requireComment(decision: DecisionType, comment: string): string | null {
  if (decision === 'approve') return null;
  if (!comment.trim()) {
    return decision === 'reject'
      ? 'A comment is required when rejecting a request.'
      : 'A comment is required when returning a request for revision.';
  }
  return null;
}

function processReviewChecking(
  request: SubmittedRequest,
  actorUserId: string,
  actorName: string,
  decision: DecisionType,
  comment: string,
  timestamp: string,
): ProcessDecisionResult {
  const reviewers = request.reviewers ? [...request.reviewers] : [];
  const index = reviewers.findIndex((r) => r.userId === actorUserId);
  if (index < 0) {
    return { ok: false, error: 'You are not assigned as a reviewer on this request.' };
  }

  const current = reviewers[index];
  if (reviewerStatus(current) !== 'Pending') {
    return {
      ok: false,
      error: 'Your review assignment is not currently Pending.',
    };
  }

  const nextStatus =
    decision === 'approve'
      ? ('Approved' as const)
      : decision === 'reject'
        ? ('Rejected' as const)
        : ('Returned' as const);

  reviewers[index] = {
    ...current,
    status: nextStatus,
    comments: comment.trim() || null,
    actionAt: timestamp,
  };

  let activity = request.activity ?? [];
  let overallStatus = request.status;

  if (decision === 'approve') {
    activity = appendActivity(request, {
      type: 'review_completed',
      timestamp,
      actorId: actorUserId,
      actorName,
      description: 'Review completed',
      comment: comment.trim() || null,
      relatedStepKey: `reviewer:${actorUserId}`,
    });

    const allApproved = reviewers.every((r) => reviewerStatus(r) === 'Approved');
    if (allApproved) {
      overallStatus = 'Approved';
      activity = [
        ...activity,
        {
          id: createEventId(),
          type: 'request_approved',
          timestamp,
          actorId: actorUserId,
          actorName,
          description: 'Request approved — all reviewers completed their reviews',
          comment: null,
          relatedStepKey: null,
          revisionNumber: request.revisionNumber,
        },
      ];
    }
  } else if (decision === 'reject') {
    overallStatus = 'Rejected';
    activity = appendActivity(request, {
      type: 'request_rejected',
      timestamp,
      actorId: actorUserId,
      actorName,
      description: 'Request rejected',
      comment: comment.trim(),
      relatedStepKey: `reviewer:${actorUserId}`,
    });
  } else {
    overallStatus = 'Returned';
    activity = appendActivity(request, {
      type: 'request_returned',
      timestamp,
      actorId: actorUserId,
      actorName,
      description: 'Request returned for revision',
      comment: comment.trim(),
      relatedStepKey: `reviewer:${actorUserId}`,
    });
  }

  return {
    ok: true,
    request: {
      ...request,
      reviewers,
      status: overallStatus,
      activity,
    },
  };
}

function processHierarchy(
  request: SubmittedRequest,
  actorUserId: string,
  actorName: string,
  decision: DecisionType,
  comment: string,
  timestamp: string,
): ProcessDecisionResult {
  const steps = request.approvalSteps
    ? [...request.approvalSteps].sort((a, b) => a.stepOrder - b.stepOrder)
    : [];

  const index = steps.findIndex(
    (s) => s.userId === actorUserId && stepStatus(s) === 'Pending',
  );
  if (index < 0) {
    return {
      ok: false,
      error:
        'You do not have an active Pending approval step on this request.',
    };
  }

  const current = steps[index];
  const nextStatus =
    decision === 'approve'
      ? ('Approved' as const)
      : decision === 'reject'
        ? ('Rejected' as const)
        : ('Returned' as const);

  steps[index] = {
    ...current,
    status: nextStatus,
    comments: comment.trim() || null,
    actionAt: timestamp,
  };

  let activity = request.activity ?? [];
  let overallStatus = request.status;

  if (decision === 'approve') {
    activity = appendActivity(
      { ...request, activity },
      {
        type: 'approval_step_approved',
        timestamp,
        actorId: actorUserId,
        actorName,
        description: `Approval step ${current.stepOrder} approved (${current.roleLabel})`,
        comment: comment.trim() || null,
        relatedStepKey: `step:${current.stepOrder}`,
      },
    );

    const nextWaitingIndex = steps.findIndex(
      (s, i) => i > index && stepStatus(s) === 'Waiting',
    );

    if (nextWaitingIndex >= 0) {
      steps[nextWaitingIndex] = {
        ...steps[nextWaitingIndex],
        status: 'Pending',
      };
      overallStatus = 'Pending';
    } else {
      overallStatus = 'Approved';
      activity = [
        ...activity,
        {
          id: createEventId(),
          type: 'request_approved',
          timestamp,
          actorId: actorUserId,
          actorName,
          description: 'Request approved — all approval steps completed',
          comment: null,
          relatedStepKey: null,
          revisionNumber: request.revisionNumber,
        },
      ];
    }
  } else if (decision === 'reject') {
    overallStatus = 'Rejected';
    activity = appendActivity(request, {
      type: 'request_rejected',
      timestamp,
      actorId: actorUserId,
      actorName,
      description: `Request rejected at step ${current.stepOrder} (${current.roleLabel})`,
      comment: comment.trim(),
      relatedStepKey: `step:${current.stepOrder}`,
    });
  } else {
    overallStatus = 'Returned';
    activity = appendActivity(request, {
      type: 'request_returned',
      timestamp,
      actorId: actorUserId,
      actorName,
      description: `Request returned for revision at step ${current.stepOrder} (${current.roleLabel})`,
      comment: comment.trim(),
      relatedStepKey: `step:${current.stepOrder}`,
    });
  }

  return {
    ok: true,
    request: {
      ...request,
      approvalSteps: steps,
      status: overallStatus,
      activity,
    },
  };
}

/**
 * Centralized workflow decision processor.
 * Re-validates authorization and state before persisting.
 * Mock localStorage is not secure against client-side tampering —
 * the future PHP backend must enforce these rules server-side.
 */
export function processRequestDecision(
  input: ProcessDecisionInput,
): ProcessDecisionResult {
  const request = getRequestById(input.requestId);
  if (!request) {
    return { ok: false, error: 'Request not found.' };
  }

  const actor = getUserById(input.actorUserId);
  if (!actor || actor.status !== 'Active') {
    return { ok: false, error: 'Acting user could not be resolved or is inactive.' };
  }

  if (request.status === 'Cancelled') {
    return {
      ok: false,
      error: 'This request was cancelled and no longer accepts review actions.',
    };
  }

  if (request.status === 'Returned') {
    return {
      ok: false,
      error:
        'This request was returned for revision. Review actions are disabled until the requester resubmits.',
    };
  }

  if (!canRecordDecision(request.status)) {
    return {
      ok: false,
      error: `This request is ${request.status} and no longer accepts review actions.`,
    };
  }

  if (!isUserAssignedToRequest(request, actor.id)) {
    return {
      ok: false,
      error: 'You are not assigned to review or approve this request.',
    };
  }

  if (!canUserActOnRequest(request, actor.id)) {
    return {
      ok: false,
      error: 'You do not have an active Pending action on this request.',
    };
  }

  if (request.workflowType === 'review_checking') {
    if (!request.reviewers || request.reviewers.length === 0) {
      return {
        ok: false,
        error: 'This request is missing its reviewer workflow snapshot.',
      };
    }
  } else if (!request.approvalSteps || request.approvalSteps.length === 0) {
    return {
      ok: false,
      error: 'This request is missing its approval workflow snapshot.',
    };
  }

  const comment = input.comment ?? '';
  const commentError = requireComment(input.decision, comment);
  if (commentError) {
    return { ok: false, error: commentError };
  }

  const timestamp = input.timestamp ?? new Date().toISOString();

  const processed =
    request.workflowType === 'review_checking'
      ? processReviewChecking(
          request,
          actor.id,
          actor.name,
          input.decision,
          comment,
          timestamp,
        )
      : processHierarchy(
          request,
          actor.id,
          actor.name,
          input.decision,
          comment,
          timestamp,
        );

  if (!processed.ok) {
    return processed;
  }

  try {
    const saved = saveRequest(processed.request);
    return { ok: true, request: saved };
  } catch {
    return {
      ok: false,
      error: 'Could not save the decision. Please try again.',
    };
  }
}
