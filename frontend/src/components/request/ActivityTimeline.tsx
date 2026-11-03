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
                    className="absolute top-6 bottom-0 left-[11px] w-px bg-slate-200"
                    aria-hidden
                  />
                )}
                <span className="relative z-10 h-6 w-6 shrink-0 rounded-full border-2 border-slate-300 bg-white" />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-slate-900">
                    {event.description}
                  </p>
                  <p className="text-sm text-slate-500">{event.actorName}</p>
                  <p className="text-sm text-slate-500">
                    {formatDateTime(event.timestamp)}
                    {event.revisionNumber != null && event.revisionNumber > 1
                      ? ` · Rev ${event.revisionNumber}`
                      : ''}
                  </p>
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
