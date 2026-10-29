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
        <p className="mt-4 text-sm text-brand-500">No activity recorded yet.</p>
      ) : (
        <ol className="mt-5 space-y-4">
          {ordered.map((event, index) => (
            <li key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-700" />
                {index < ordered.length - 1 ? (
                  <span className="mt-1 w-px flex-1 bg-brand-200" />
                ) : null}
              </div>
              <div className="min-w-0 pb-1">
                <p className="text-sm font-medium text-brand-900">{event.description}</p>
                <p className="mt-0.5 text-xs text-brand-600">
                  {event.actorName}
                  <span className="mx-1.5 text-brand-300">·</span>
                  {formatDateTime(event.timestamp)}
                  {event.revisionNumber != null && event.revisionNumber > 1 ? (
                    <>
                      <span className="mx-1.5 text-brand-300">·</span>
                      Rev {event.revisionNumber}
                    </>
                  ) : null}
                </p>
                {event.comment ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-brand-700">
                    “{event.comment}”
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
