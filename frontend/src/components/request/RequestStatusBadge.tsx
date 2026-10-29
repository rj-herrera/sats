import type { RequestStatus, StepStatus } from '@/types';
import { formatStepActionTooltip } from '@/utils/formatDisplay';
import {
  getRequestStatusBadgeClasses,
  getRequestStatusLabel,
  getStepStatusBadgeClasses,
  getStepStatusLabel,
} from '@/utils/requestStatus';

const STEP_STATUSES_WITH_ACTION_TIME: StepStatus[] = [
  'Approved',
  'Rejected',
  'Returned',
];

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getRequestStatusBadgeClasses(status)}`}
    >
      {getRequestStatusLabel(status)}
    </span>
  );
}

export function StepStatusBadge({
  status,
  actionAt,
}: {
  status: StepStatus;
  /** When set, completed statuses show action time in a hover tooltip. */
  actionAt?: string | null;
}) {
  const label = getStepStatusLabel(status);
  const tooltip =
    actionAt && STEP_STATUSES_WITH_ACTION_TIME.includes(status)
      ? formatStepActionTooltip(label, actionAt)
      : undefined;

  return (
    <span
      title={tooltip}
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStepStatusBadgeClasses(status)}`}
    >
      {label}
    </span>
  );
}
