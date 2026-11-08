import type { RequestStatus } from '@/types';

/**
 * Centralized overall-status transition rules for the MVP.
 * Decision and lifecycle services remain the mutation entry points;
 * this module documents and validates allowed transitions.
 */

const TERMINAL: ReadonlySet<RequestStatus> = new Set([
  'Approved',
  'Rejected',
  'Cancelled',
]);

export function isTerminalRequestStatus(status: RequestStatus): boolean {
  return TERMINAL.has(status);
}

/** Whether a decision (approve/reject/return) may be recorded. */
export function canRecordDecision(status: RequestStatus): boolean {
  return status === 'Pending';
}

/** Whether the requester may resubmit. */
export function canResubmitFrom(status: RequestStatus): boolean {
  return status === 'Returned';
}

/** Whether the requester may cancel. */
export function canCancelFrom(status: RequestStatus): boolean {
  return status === 'Pending' || status === 'Returned';
}

/**
 * Validate a proposed overall status change.
 * Returns an error message when the transition is not allowed.
 */
export function explainInvalidTransition(
  from: RequestStatus,
  to: RequestStatus,
): string | null {
  if (from === to) return null;

  if (isTerminalRequestStatus(from)) {
    return `Cannot change status from ${from} to ${to}.`;
  }

  switch (to) {
    case 'Pending':
      if (from === 'Returned') return null; // resubmit
      return `Cannot move from ${from} to Pending.`;
    case 'Approved':
    case 'Rejected':
    case 'Returned':
      if (from === 'Pending') return null;
      return `Cannot move from ${from} to ${to}.`;
    case 'Cancelled':
      if (from === 'Pending' || from === 'Returned') return null;
      return `Cannot move from ${from} to Cancelled.`;
    default:
      return `Unsupported status transition ${from} → ${to}.`;
  }
}
