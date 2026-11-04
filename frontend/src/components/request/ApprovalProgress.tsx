import { Check, Undo2, X } from 'lucide-react';
import type { ApprovalStepSnapshot, StepStatus } from '@/types';
import { formatDateTime } from '@/utils/formatDisplay';

interface ApprovalProgressProps {
  steps: ApprovalStepSnapshot[] | null;
}

export interface ProgressTimelineItem {
  key: string;
  name: string;
  position: string;
  status: StepStatus;
  actionAt?: string | null;
  comments?: string | null;
}

function statusOf(step: ApprovalStepSnapshot): StepStatus {
  return step.status ?? 'Waiting';
}

function TimelineMark({ status }: { status: StepStatus }) {
  const circle =
    status === 'Approved' ? (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
        <Check size={12} strokeWidth={3} aria-hidden />
      </span>
    ) : status === 'Rejected' ? (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
        <X size={12} strokeWidth={3} aria-hidden />
      </span>
    ) : status === 'Returned' ? (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white">
        <Undo2 size={11} strokeWidth={2.5} aria-hidden />
      </span>
    ) : status === 'Pending' ? (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-blue-500 bg-white">
        <span className="h-3 w-3 rounded-full bg-blue-500" />
      </span>
    ) : (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-200 bg-white">
        <span className="h-3 w-3 rounded-full bg-slate-300" />
      </span>
    );

  return (
    <span className="relative z-10 flex h-5 w-5 items-center justify-center">
      {status === 'Pending' ? (
        <span className="absolute -inset-1 rounded-full bg-blue-50" aria-hidden />
      ) : null}
      <span className="relative">{circle}</span>
    </span>
  );
}

function thirdLine(item: ProgressTimelineItem) {
  if (item.actionAt) return null;
  if (item.status === 'Pending') {
    return (
      <span className="mt-1 inline-flex w-fit rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        In progress
      </span>
    );
  }
  return (
    <p className="text-sm text-slate-400">
      {item.status === 'Waiting' ? 'Pending' : item.status}
    </p>
  );
}

export function ProgressTimeline({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: ProgressTimelineItem[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-900">{title}</h2>
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {emptyMessage}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-900">{title}</h2>
      <ol className="mt-4">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.key} className="group relative flex gap-3 pb-5 last:pb-0">
              {isLast ? null : (
                <span
                  className="absolute top-5 bottom-0 left-[9px] w-px bg-slate-200"
                  aria-hidden
                />
              )}
              {item.actionAt ? (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute top-0 right-full z-20 mr-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                >
                  {formatDateTime(item.actionAt)}
                </span>
              ) : null}
              <span className="flex h-5 shrink-0 items-center">
                <TimelineMark status={item.status} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5 text-slate-900">{item.name}</p>
                <p className="text-sm text-slate-500">
                  {item.position || 'Position unavailable'}
                </p>
                {thirdLine(item)}
                {item.comments ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                    {item.comments}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function ApprovalProgress({ steps }: ApprovalProgressProps) {
  const ordered = steps ? [...steps].sort((a, b) => a.stepOrder - b.stepOrder) : [];

  return (
    <ProgressTimeline
      title="Approval Progress"
      emptyMessage="Approval sequence data is missing for this request. The path cannot be reconstructed from the current template."
      items={ordered.map((step) => ({
        key: `${step.stepOrder}-${step.userId}`,
        name: step.name,
        position: step.roleLabel,
        status: statusOf(step),
        actionAt: step.actionAt,
        comments: step.comments,
      }))}
    />
  );
}
