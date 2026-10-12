import { getUserById } from '@/services/userRepository';
import {
  resetHierarchyForResubmission,
  resetReviewersForResubmission,
} from '@/services/requestNormalizer';
import { getRequestById, saveRequest } from '@/services/requestRepository';
import type {
  ActivityEvent,
  CancelRequestInput,
  RequestRevision,
  ResubmitRequestInput,
  SubmittedRequest,
} from '@/types';
import { validateResubmitPayload } from '@/utils/formValidation';
import { getLatestReturnInfo } from '@/utils/returnInfo';
import { isRequestOwner } from '@/utils/requestOwnership';
import { canCancelFrom, canResubmitFrom } from '@/utils/requestTransitions';

export type LifecycleResult =
  | { ok: true; request: SubmittedRequest }
  | { ok: false; error: string };

function createEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendActivity(
  activity: ActivityEvent[] | undefined,
  event: Omit<ActivityEvent, 'id'>,
): ActivityEvent[] {
  return [...(activity ?? []), { ...event, id: createEventId() }];
}

function snapshotClosedRevision(request: SubmittedRequest): RequestRevision {
  const returnInfo = getLatestReturnInfo(request);

  return {
    revisionNumber: request.revisionNumber,
    submittedAt: request.lastResubmittedAt ?? request.submittedAt,
    submittedById: request.requesterId,
    submittedByName: request.requesterName,
    submissionType: request.revisionNumber <= 1 ? 'original' : 'resubmitted',
    fieldValues: { ...request.fieldValues },
    attachments: [...request.attachments],
    reviewers: request.reviewers
      ? request.reviewers.map((r) => ({ ...r }))
      : null,
    approvalSteps: request.approvalSteps
      ? request.approvalSteps.map((s) => ({ ...s }))
      : null,
    outcome: request.status,
    returnComment: returnInfo.comment,
    returnedById: returnInfo.returnedById,
    returnedByName: returnInfo.returnedByName,
    returnedByRole: returnInfo.returnedByRole,
    returnedAt: returnInfo.returnedAt,
  };
}

/**
 * Resubmit a Returned request: archive the current revision, increment,
 * reset workflow, set Pending. Failed validation must not call this.
 *
 * localStorage is not transactional — the future PHP backend must enforce
 * ownership, Returned status, and revision integrity server-side.
 */
export function resubmitRequest(input: ResubmitRequestInput): LifecycleResult {
  const request = getRequestById(input.requestId);
  if (!request) {
    return { ok: false, error: 'Request not found.' };
  }

  const actor = getUserById(input.actorUserId);
  if (!actor || actor.status !== 'Active') {
    return { ok: false, error: 'Acting user could not be resolved or is inactive.' };
  }

  if (!isRequestOwner(actor, request)) {
    return {
      ok: false,
      error: 'Only the original requester can resubmit this request.',
    };
  }

  if (!canResubmitFrom(request.status)) {
    return {
      ok: false,
      error: `This request is ${request.status} and cannot be resubmitted.`,
    };
  }

  if (!request.fieldDefinitions || request.fieldDefinitions.length === 0) {
    return {
      ok: false,
      error:
        'This request is missing its original form field snapshot and cannot be safely resubmitted.',
    };
  }

  const formCheck = validateResubmitPayload({
    fields: request.fieldDefinitions,
    values: input.fieldValues,
    attachments: input.attachments,
  });
  if (!formCheck.valid) {
    const firstError = Object.values(formCheck.fieldErrors)[0];
    return {
      ok: false,
      error: firstError ?? 'Please correct the form before resubmitting.',
    };
  }

  const timestamp = input.timestamp ?? new Date().toISOString();
  const closed = snapshotClosedRevision(request);
  const nextRevision = request.revisionNumber + 1;

  const next: SubmittedRequest = {
    ...request,
    fieldValues: input.fieldValues,
    attachments: input.attachments,
    reviewers: resetReviewersForResubmission(request.reviewers),
    approvalSteps: resetHierarchyForResubmission(request.approvalSteps),
    status: 'Pending',
    revisionNumber: nextRevision,
    lastResubmittedAt: timestamp,
    revisions: [...request.revisions, closed],
    activity: appendActivity(request.activity, {
      type: 'request_resubmitted',
      timestamp,
      actorId: actor.id,
      actorName: actor.name,
      description: `Request resubmitted as revision ${nextRevision}`,
      comment: null,
      relatedStepKey: null,
      revisionNumber: nextRevision,
    }),
  };

  try {
    return { ok: true, request: saveRequest(next) };
  } catch {
    return {
      ok: false,
      error: 'Could not save the resubmission. Please try again.',
    };
  }
}

/**
 * Cancel a Pending request. Permanent for this MVP.
 */
export function cancelRequest(input: CancelRequestInput): LifecycleResult {
  const request = getRequestById(input.requestId);
  if (!request) {
    return { ok: false, error: 'Request not found.' };
  }

  const actor = getUserById(input.actorUserId);
  if (!actor || actor.status !== 'Active') {
    return { ok: false, error: 'Acting user could not be resolved or is inactive.' };
  }

  if (!isRequestOwner(actor, request)) {
    return {
      ok: false,
      error: 'Only the original requester can cancel this request.',
    };
  }

  if (!canCancelFrom(request.status)) {
    return {
      ok: false,
      error: `This request is ${request.status} and cannot be cancelled.`,
    };
  }

  const timestamp = input.timestamp ?? new Date().toISOString();
  const reason = input.reason?.trim() || null;

  // Freeze the open revision for audit (mirrors resubmit archival).
  const closed = snapshotClosedRevision({
    ...request,
    status: 'Cancelled',
  });

  const next: SubmittedRequest = {
    ...request,
    status: 'Cancelled',
    cancelledAt: timestamp,
    cancelledById: actor.id,
    cancelledByName: actor.name,
    cancellationReason: reason,
    revisions: [...request.revisions, closed],
    activity: appendActivity(request.activity, {
      type: 'request_cancelled',
      timestamp,
      actorId: actor.id,
      actorName: actor.name,
      description: 'Request cancelled by requester',
      comment: reason,
      relatedStepKey: null,
      revisionNumber: request.revisionNumber,
    }),
  };

  try {
    return { ok: true, request: saveRequest(next) };
  } catch {
    return {
      ok: false,
      error: 'Could not save the cancellation. Please try again.',
    };
  }
}
