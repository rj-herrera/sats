import type { ReviewerSnapshot, StepStatus } from '@/types';
import { formatDateTime } from '@/utils/formatDisplay';
import { getRoleLabel } from '@/utils/permissions';
import { StepStatusBadge } from './RequestStatusBadge';

interface ReviewerProgressProps {
  reviewers: ReviewerSnapshot[] | null;
}

function statusOf(reviewer: ReviewerSnapshot): StepStatus {
  return reviewer.status ?? 'Pending';
}

export function ReviewerProgress({ reviewers }: ReviewerProgressProps) {
  if (!reviewers || reviewers.length === 0) {
    return (
      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-900">Review progress</h2>
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Reviewer assignment data is missing for this request.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-900">Review progress</h2>

      <ul className="mt-3 space-y-3">
        {reviewers.map((reviewer) => {
          const status = statusOf(reviewer);
          return (
            <li
              key={reviewer.userId}
              className="rounded-lg border border-brand-100 bg-brand-50/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-900">{reviewer.name}</p>
                  <p className="text-xs text-brand-600">
                    {reviewer.groupName} · {getRoleLabel(reviewer.role)}
                  </p>
                </div>
                <StepStatusBadge status={status} />
              </div>

              {(reviewer.actionAt || reviewer.comments) && (
                <div className="mt-3 border-t border-brand-100 pt-2 text-xs text-brand-700">
                  {reviewer.actionAt ? (
                    <p>Action date: {formatDateTime(reviewer.actionAt)}</p>
                  ) : null}
                  {reviewer.comments ? (
                    <p className="mt-1 whitespace-pre-wrap">
                      Comments: {reviewer.comments}
                    </p>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
