import type { RequestStatus, StepStatus } from '@/types';
import { REQUEST_STATUSES, STEP_STATUSES } from '@/types/request';

export { REQUEST_STATUSES, STEP_STATUSES };

export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === 'string' && (REQUEST_STATUSES as readonly string[]).includes(value);
}

export function isStepStatus(value: unknown): value is StepStatus {
  return typeof value === 'string' && (STEP_STATUSES as readonly string[]).includes(value);
}

export function getRequestStatusLabel(status: RequestStatus): string {
  return status;
}

export function getStepStatusLabel(status: StepStatus): string {
  return status;
}

/** Tailwind classes for overall request status badges */
export function getRequestStatusBadgeClasses(status: RequestStatus): string {
  switch (status) {
    case 'Pending':
      return 'border border-amber-200 bg-amber-100 text-amber-800';
    case 'Approved':
      return 'border border-emerald-200 bg-emerald-100 text-emerald-800';
    case 'Rejected':
      return 'border border-red-200 bg-red-100 text-red-800';
    case 'Returned':
      return 'border border-orange-200 bg-orange-100 text-orange-800';
    case 'Cancelled':
      return 'border border-slate-300 bg-slate-200 text-slate-700';
  }
}

/** Tailwind classes for step / reviewer status badges */
export function getStepStatusBadgeClasses(status: StepStatus): string {
  switch (status) {
    case 'Waiting':
      return 'border border-slate-300 bg-slate-200 text-slate-700';
    case 'Pending':
      return 'border border-amber-300 bg-amber-100 text-amber-800';
    case 'Approved':
      return 'border border-emerald-300 bg-emerald-100 text-emerald-800';
    case 'Rejected':
      return 'border border-red-300 bg-red-100 text-red-800';
    case 'Returned':
      return 'border border-orange-300 bg-orange-100 text-orange-800';
  }
}

export function getWorkflowTypeLabel(type: 'review_checking' | 'hierarchy_approval'): string {
  return type === 'review_checking' ? 'Review / Checking' : 'Hierarchy Approval';
}
