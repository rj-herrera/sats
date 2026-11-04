import type { ActivityEvent } from '@/types';
import { formatDateTime } from '@/utils/formatDisplay';

interface ActivityTimelineProps {
  events: ActivityEvent[];
}

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  const ordered = [...events].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-900">Activity history</h2>

      {ordered.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No activity recorded yet.</p>
      ) : (
        <ol className="mt-4">
          {ordered.map((event, index) => {
            const isLast = index === ordered.length - 1;
            return (
              <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                {isLast ? null : (
                  <span
                    className="absolute top-5 bottom-0 left-[9px] w-px bg-slate-200"
                    aria-hidden
                  />
                )}
                <span className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-white">
                  <span className="h-3 w-3 rounded-full bg-blue-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold leading-5 text-slate-900">
                      {event.description}
                    </p>
                    <p className="shrink-0 text-xs leading-5 text-slate-500">
                      {formatDateTime(event.timestamp)}
                      {event.revisionNumber != null && event.revisionNumber > 1
                        ? ` · Rev ${event.revisionNumber}`
                        : ''}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">{event.actorName}</p>
                  {event.comment ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                      “{event.comment}”
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
