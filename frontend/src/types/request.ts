/**
 * Submitted request models (Phase 2+ mock persistence).
 * Extended in Phase 3–5 for status, activity, decisions, revisions, cancellation.
 */

import type { Role } from './index';
import type { FormFieldDefinition, FieldValue, WorkflowType } from './template';

/** Overall request lifecycle status */
export const REQUEST_STATUSES = [
  'Pending',
  'Approved',
  'Rejected',
  'Returned',
  'Cancelled',
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/**
 * Per-step / per-reviewer status.
 * Waiting = not yet active (hierarchy only).
 * Pending = assigned person should act.
 */
export const STEP_STATUSES = [
  'Waiting',
  'Pending',
  'Approved',
  'Rejected',
  'Returned',
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

/** Decisions a reviewer/approver may record */
export const DECISION_TYPES = ['approve', 'reject', 'return'] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];

export const ACTIVITY_EVENT_TYPES = [
  'request_submitted',
  'review_completed',
  'review_approved',
  'review_rejected',
  'approval_step_approved',
  'approval_completed',
  'request_approved',
  'request_rejected',
  'request_returned',
  'request_resubmitted',
  'request_cancelled',
  'comment_added',
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export interface AttachmentMetadata {
  fieldId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  /** Optional public/mock URL for open/download in the UI. */
  downloadUrl?: string | null;
}

export interface ReviewerSnapshot {
  userId: string;
  name: string;
  groupName: string;
  role: Role;
  /** Defaults to Pending for new / legacy review assignments */
  status?: StepStatus;
  comments?: string | null;
  actionAt?: string | null;
}

export interface ApprovalStepSnapshot {
  stepOrder: number;
  roleLabel: string;
  userId: string;
  name: string;
  groupName: string;
  /** Defaults applied when normalizing legacy records */
  status?: StepStatus;
  comments?: string | null;
  actionAt?: string | null;
}

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  timestamp: string;
  actorId: string;
  actorName: string;
  description: string;
  comment?: string | null;
  /** e.g. reviewer:usr-x or step:3 */
  relatedStepKey?: string | null;
  /** Revision this event belongs to (defaults to 1 for legacy events) */
  revisionNumber?: number;
}

/**
 * Immutable snapshot of a completed (or superseded) revision.
 * Past revisions must not be overwritten after resubmission.
 */
export interface RequestRevision {
  revisionNumber: number;
  submittedAt: string;
  submittedById: string;
  submittedByName: string;
  submissionType: 'original' | 'resubmitted';
  fieldValues: Record<string, FieldValue>;
  attachments: AttachmentMetadata[];
  /** Workflow decisions as they stood when this revision closed */
  reviewers: ReviewerSnapshot[] | null;
  approvalSteps: ApprovalStepSnapshot[] | null;
  /** Overall outcome when superseded or finalized, if known */
  outcome: RequestStatus | null;
  returnComment?: string | null;
  returnedById?: string | null;
  returnedByName?: string | null;
  returnedByRole?: string | null;
  returnedAt?: string | null;
}

export interface SubmittedRequest {
  id: string;
  /** Human-readable number, e.g. SATS-2026-000001 — stable across revisions */
  requestNumber: string;
  templateId: string;
  templateName: string;
  workflowType: WorkflowType;
  requesterId: string;
  requesterName: string;
  requesterGroupId: string;
  /** Display name captured at submit time (optional on legacy records) */
  requesterGroupName?: string;
  /** Original submission timestamp (never overwritten on resubmit) */
  submittedAt: string;
  /** Latest resubmission timestamp, if any */
  lastResubmittedAt?: string | null;
  fieldValues: Record<string, FieldValue>;
  attachments: AttachmentMetadata[];
  /**
   * Immutable field definitions at submission time.
   * Legacy Phase 2 records may omit this — fall back to live template.
   */
  fieldDefinitions?: FormFieldDefinition[];
  /** Snapshot for review_checking; null for hierarchy */
  reviewers: ReviewerSnapshot[] | null;
  /** Snapshot for hierarchy_approval; null for review */
  approvalSteps: ApprovalStepSnapshot[] | null;
  status: RequestStatus;
  /** Current revision number (legacy records normalize to 1) */
  revisionNumber: number;
  /** Closed historical revisions; current work lives on the request root */
  revisions: RequestRevision[];
  cancelledAt?: string | null;
  cancelledById?: string | null;
  cancelledByName?: string | null;
  cancellationReason?: string | null;
  /** Chronological activity; may be derived for legacy records */
  activity?: ActivityEvent[];
}

export interface CreateRequestInput {
  templateId: string;
  templateName: string;
  workflowType: WorkflowType;
  requesterId: string;
  requesterName: string;
  requesterGroupId: string;
  requesterGroupName: string;
  fieldValues: Record<string, FieldValue>;
  fieldDefinitions: FormFieldDefinition[];
  attachments: AttachmentMetadata[];
  reviewers: ReviewerSnapshot[] | null;
  approvalSteps: ApprovalStepSnapshot[] | null;
}

export interface ResubmitRequestInput {
  requestId: string;
  actorUserId: string;
  fieldValues: Record<string, FieldValue>;
  attachments: AttachmentMetadata[];
  timestamp?: string;
}

export interface CancelRequestInput {
  requestId: string;
  actorUserId: string;
  reason?: string;
  timestamp?: string;
}
