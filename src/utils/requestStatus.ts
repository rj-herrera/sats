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
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    case 'Approved':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    case 'Rejected':
      return 'bg-red-50 text-red-800 ring-red-200';
    case 'Returned':
      return 'bg-orange-50 text-orange-800 ring-orange-200';
    case 'Cancelled':
      return 'bg-slate-100 text-slate-700 ring-slate-300';
  }
}

/** Tailwind classes for step / reviewer status badges */
export function getStepStatusBadgeClasses(status: StepStatus): string {
  switch (status) {
    case 'Waiting':
      return 'bg-slate-100 text-slate-600 ring-slate-200';
    case 'Pending':
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    case 'Approved':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    case 'Rejected':
      return 'bg-red-50 text-red-800 ring-red-200';
    case 'Returned':
      return 'bg-orange-50 text-orange-800 ring-orange-200';
  }
}

export function getWorkflowTypeLabel(type: 'review_checking' | 'hierarchy_approval'): string {
  return type === 'review_checking' ? 'Review / Checking' : 'Hierarchy Approval';
}
