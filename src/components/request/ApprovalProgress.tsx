import type { ApprovalStepSnapshot, StepStatus } from '@/types';
import { StepStatusBadge } from './RequestStatusBadge';

interface ApprovalProgressProps {
  steps: ApprovalStepSnapshot[] | null;
}

function statusOf(step: ApprovalStepSnapshot): StepStatus {
  return step.status ?? 'Waiting';
}

function stepContainerClasses(status: StepStatus): string {
  switch (status) {
    case 'Pending':
      return 'border-amber-300 bg-amber-50/60 ring-1 ring-amber-200';
    case 'Approved':
      return 'border-emerald-200 bg-emerald-50/40';
    case 'Rejected':
      return 'border-red-200 bg-red-50/50';
    case 'Returned':
      return 'border-orange-200 bg-orange-50/50';
    case 'Waiting':
    default:
      return 'border-brand-100 bg-brand-50/40';
  }
}

function stepNumberClasses(status: StepStatus): string {
  switch (status) {
    case 'Pending':
      return 'bg-amber-600 text-white';
    case 'Approved':
      return 'bg-emerald-700 text-white';
    case 'Rejected':
      return 'bg-red-700 text-white';
    case 'Returned':
      return 'bg-orange-600 text-white';
    case 'Waiting':
    default:
      return 'bg-brand-300 text-white';
  }
}

export function ApprovalProgress({ steps }: ApprovalProgressProps) {
  if (!steps || steps.length === 0) {
    return (
      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-900">Approval progress</h2>
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Approval sequence data is missing for this request. The path cannot be reconstructed
          from the current template.
        </p>
      </section>
    );
  }

  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-900">Approval Progress</h2>

      <ol className="mt-3 space-y-3">
        {ordered.map((step) => {
          const status = statusOf(step);
          return (
            <li
              key={`${step.stepOrder}-${step.userId}`}
              className={`rounded-lg border px-4 py-3 ${stepContainerClasses(status)}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${stepNumberClasses(status)}`}
                  >
                    {step.stepOrder}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-900">{step.name}</p>
                    <p className="text-xs text-brand-600">
                    {step.roleLabel} • {step.groupName || 'Group unavailable'}
                    </p>
                  </div>
                </div>
                <StepStatusBadge status={status} actionAt={step.actionAt} />
              </div>

              {step.comments ? (
                <div className="mt-3 border-t border-black/5 pt-2 text-xs text-brand-700">
                  <p className="whitespace-pre-wrap">Comments: {step.comments}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
