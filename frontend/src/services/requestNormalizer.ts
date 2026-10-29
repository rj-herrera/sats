import { getGroupById } from '@/services/groupRepository';
import { getTemplateById } from '@/services/templateService';
import { normalizeSnapshotRole } from '@/services/userNormalizer';
import type {
  ActivityEvent,
  ApprovalStepSnapshot,
  FormFieldDefinition,
  RequestRevision,
  RequestStatus,
  ReviewerSnapshot,
  StepStatus,
  SubmittedRequest,
} from '@/types';
import { isRequestStatus, isStepStatus } from '@/utils/requestStatus';

function createEventId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildSubmittedActivity(request: {
  requesterId: string;
  requesterName: string;
  submittedAt: string;
  revisionNumber?: number;
}): ActivityEvent {
  return {
    id: createEventId('evt'),
    type: 'request_submitted',
    timestamp: request.submittedAt,
    actorId: request.requesterId,
    actorName: request.requesterName,
    description: 'Request submitted',
    revisionNumber: request.revisionNumber ?? 1,
  };
}

function normalizeReviewers(
  reviewers: ReviewerSnapshot[] | null | undefined,
): ReviewerSnapshot[] | null {
  if (!reviewers) return null;
  return reviewers.map((r) => ({
    ...r,
    role: normalizeSnapshotRole(r.role),
    status: isStepStatus(r.status) ? r.status : ('Pending' as StepStatus),
    comments: r.comments ?? null,
    actionAt: r.actionAt ?? null,
  }));
}

function normalizeApprovalSteps(
  steps: ApprovalStepSnapshot[] | null | undefined,
): ApprovalStepSnapshot[] | null {
  if (!steps) return null;

  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const hasAnyStatus = ordered.some((s) => isStepStatus(s.status));

  return ordered.map((step, index) => {
    let status: StepStatus;
    if (isStepStatus(step.status)) {
      status = step.status;
    } else if (hasAnyStatus) {
      status = 'Waiting';
    } else {
      // Legacy Phase 2: treat first step as active Pending, rest Waiting
      status = index === 0 ? 'Pending' : 'Waiting';
    }

    return {
      ...step,
      status,
      comments: step.comments ?? null,
      actionAt: step.actionAt ?? null,
    };
  });
}

function resolveFieldDefinitions(
  raw: SubmittedRequest,
): FormFieldDefinition[] | undefined {
  if (Array.isArray(raw.fieldDefinitions) && raw.fieldDefinitions.length > 0) {
    return raw.fieldDefinitions;
  }
  const template = getTemplateById(raw.templateId);
  return template?.fields;
}

function resolveGroupName(raw: SubmittedRequest): string {
  if (raw.requesterGroupName?.trim()) return raw.requesterGroupName;
  return getGroupById(raw.requesterGroupId)?.name ?? 'Unknown group';
}

function normalizeStatus(value: unknown): RequestStatus {
  if (isRequestStatus(value)) return value;
  // Unknown/corrupt statuses must not reopen as Pending (actionable).
  console.warn('SATS: unrecognized request status; treating as Cancelled.', value);
  return 'Cancelled';
}

function normalizeActivity(
  raw: SubmittedRequest,
  revisionNumber: number,
): ActivityEvent[] {
  if (Array.isArray(raw.activity) && raw.activity.length > 0) {
    return raw.activity.map((event) => ({
      ...event,
      revisionNumber:
        typeof event.revisionNumber === 'number' && event.revisionNumber > 0
          ? event.revisionNumber
          : revisionNumber,
    }));
  }
  return [
    buildSubmittedActivity({
      requesterId: raw.requesterId,
      requesterName: raw.requesterName,
      submittedAt: raw.submittedAt || new Date().toISOString(),
      revisionNumber,
    }),
  ];
}

function normalizeRevision(raw: unknown): RequestRevision | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<RequestRevision>;
  if (typeof r.revisionNumber !== 'number' || r.revisionNumber < 1) return null;
  if (typeof r.submittedAt !== 'string') return null;

  return {
    revisionNumber: r.revisionNumber,
    submittedAt: r.submittedAt,
    submittedById: typeof r.submittedById === 'string' ? r.submittedById : '',
    submittedByName:
      typeof r.submittedByName === 'string' ? r.submittedByName : 'Unknown',
    submissionType: r.submissionType === 'resubmitted' ? 'resubmitted' : 'original',
    fieldValues: r.fieldValues ?? {},
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    reviewers: normalizeReviewers(r.reviewers),
    approvalSteps: normalizeApprovalSteps(r.approvalSteps),
    outcome: isRequestStatus(r.outcome) ? r.outcome : null,
    returnComment: r.returnComment ?? null,
    returnedById: r.returnedById ?? null,
    returnedByName: r.returnedByName ?? null,
    returnedByRole: r.returnedByRole ?? null,
    returnedAt: r.returnedAt ?? null,
  };
}

/**
 * Closed historical revisions only. Current work lives on the request root.
 * Legacy Phase 2–4 records without a revisions array keep an empty list —
 * do not invent historical revisions.
 */
function normalizeRevisions(base: SubmittedRequest): RequestRevision[] {
  if (!Array.isArray(base.revisions) || base.revisions.length === 0) {
    return [];
  }

  return base.revisions
    .map((r) => normalizeRevision(r))
    .filter((r): r is RequestRevision => r !== null)
    .sort((a, b) => a.revisionNumber - b.revisionNumber);
}

/**
 * Safely normalize a stored request (including Phase 2–4 legacy shape).
 * Returns null if the record is unusable.
 */
export function normalizeRequest(raw: unknown): SubmittedRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<SubmittedRequest>;

  if (
    typeof record.id !== 'string' ||
    typeof record.requestNumber !== 'string' ||
    typeof record.requesterId !== 'string'
  ) {
    return null;
  }

  const base = record as SubmittedRequest;
  const revisionNumber =
    typeof base.revisionNumber === 'number' && base.revisionNumber > 0
      ? base.revisionNumber
      : 1;

  return {
    ...base,
    templateId: base.templateId ?? '',
    templateName: base.templateName ?? 'Unknown template',
    workflowType:
      base.workflowType === 'hierarchy_approval'
        ? 'hierarchy_approval'
        : 'review_checking',
    requesterName: base.requesterName ?? 'Unknown',
    requesterGroupId: base.requesterGroupId ?? '',
    requesterGroupName: resolveGroupName(base),
    submittedAt: base.submittedAt ?? new Date().toISOString(),
    lastResubmittedAt: base.lastResubmittedAt ?? null,
    fieldValues: base.fieldValues ?? {},
    attachments: Array.isArray(base.attachments) ? base.attachments : [],
    fieldDefinitions: resolveFieldDefinitions(base),
    reviewers: normalizeReviewers(base.reviewers),
    approvalSteps: normalizeApprovalSteps(base.approvalSteps),
    status: normalizeStatus(base.status),
    revisionNumber,
    revisions: normalizeRevisions(base),
    cancelledAt: base.cancelledAt ?? null,
    cancelledById: base.cancelledById ?? null,
    cancelledByName: base.cancelledByName ?? null,
    cancellationReason: base.cancellationReason ?? null,
    activity: normalizeActivity(base, revisionNumber),
  };
}

export function withInitialStepStatuses(
  steps: ApprovalStepSnapshot[] | null,
): ApprovalStepSnapshot[] | null {
  return normalizeApprovalSteps(steps);
}

export function withInitialReviewerStatuses(
  reviewers: ReviewerSnapshot[] | null,
): ReviewerSnapshot[] | null {
  return normalizeReviewers(reviewers);
}

/** Reset hierarchy for a new revision: step 1 Pending, others Waiting. */
export function resetHierarchyForResubmission(
  steps: ApprovalStepSnapshot[] | null,
): ApprovalStepSnapshot[] | null {
  if (!steps) return null;
  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  return ordered.map((step, index) => ({
    ...step,
    status: index === 0 ? ('Pending' as const) : ('Waiting' as const),
    comments: null,
    actionAt: null,
  }));
}

/** Reset all reviewers to Pending for a new revision. */
export function resetReviewersForResubmission(
  reviewers: ReviewerSnapshot[] | null,
): ReviewerSnapshot[] | null {
  if (!reviewers) return null;
  return reviewers.map((r) => ({
    ...r,
    status: 'Pending' as const,
    comments: null,
    actionAt: null,
  }));
}
