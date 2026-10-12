import { Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SubmittedRequest } from '@/types';
import { paths } from '@/routes/paths';
import { formatDateTime } from '@/utils/formatDisplay';
import { getRequestDisplayTitle } from '@/utils/requestTitle';
import { RequestStatusBadge } from './RequestStatusBadge';

interface PendingListProps {
  mode: 'pending';
  items: { request: SubmittedRequest; canAct: boolean }[];
}

interface CompletedListProps {
  mode: 'completed';
  items: {
    request: SubmittedRequest;
    decision: string;
    actionAt: string | null;
    comments: string | null;
    revisionNumber: number;
  }[];
}

type AssignedRequestListProps = PendingListProps | CompletedListProps;

function YourTurnBadge({ canAct }: { canAct: boolean }) {
  if (canAct) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
        Ready for your action
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
      Waiting — not your turn yet
    </span>
  );
}

export function AssignedRequestList(props: AssignedRequestListProps) {
  const rows =
    props.mode === 'pending'
      ? props.items.map((item) => ({
          request: item.request,
          canAct: item.canAct,
          decision: null as string | null,
          actionAt: null as string | null,
          revisionNumber: item.request.revisionNumber,
        }))
      : props.items.map((item) => ({
          request: item.request,
          canAct: true,
          decision: item.decision,
          actionAt: item.actionAt,
          revisionNumber: item.revisionNumber,
        }));

  if (rows.length === 0) {
    return null;
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-100 text-left text-sm">
            <thead className="bg-brand-50/80 text-xs font-semibold uppercase tracking-wide text-brand-600">
              <tr>
                <th className="px-4 py-3">Request #</th>
                <th className="px-4 py-3">Title / Summary</th>
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                {props.mode === 'pending' ? (
                  <th className="px-4 py-3">Your turn</th>
                ) : (
                  <>
                    <th className="px-4 py-3">Rev</th>
                    <th className="px-4 py-3">Your decision</th>
                    <th className="px-4 py-3">Decision date</th>
                  </>
                )}
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {rows.map(({ request, canAct, decision, actionAt, revisionNumber }) => (
                <tr
                  key={
                    props.mode === 'completed'
                      ? `${request.id}-r${revisionNumber}-${actionAt}`
                      : request.id
                  }
                  className="hover:bg-brand-50/40"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-brand-800">
                    {request.requestNumber}
                  </td>
                  <td className="max-w-[14rem] px-4 py-3 font-medium text-brand-900">
                    <span className="line-clamp-2">
                      {getRequestDisplayTitle(request)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-brand-700">{request.requesterName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-brand-700">
                    {formatDateTime(request.submittedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <RequestStatusBadge status={request.status} />
                  </td>
                  {props.mode === 'pending' ? (
                    <td className="px-4 py-3">
                      <YourTurnBadge canAct={canAct} />
                    </td>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-4 py-3 text-brand-700">
                        {revisionNumber}
                      </td>
                      <td className="px-4 py-3 text-brand-800">{decision}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-brand-700">
                        {formatDateTime(actionAt)}
                      </td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    <Link
                      to={paths.requestReview(request.id)}
                      title={canAct ? 'Review / Take action' : 'View request'}
                      aria-label={canAct ? 'Review / Take action' : 'View request'}
                      className="inline-flex rounded-md p-2 text-brand-700 hover:bg-brand-50 hover:text-brand-900"
                    >
                      <Eye size={18} aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map(({ request, canAct, decision, actionAt, revisionNumber }) => (
          <li
            key={
              props.mode === 'completed'
                ? `${request.id}-r${revisionNumber}-${actionAt}`
                : request.id
            }
            className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-brand-600">
                  {request.requestNumber}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-brand-900">
                  {getRequestDisplayTitle(request)}
                </h3>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <RequestStatusBadge status={request.status} />
                <Link
                  to={paths.requestReview(request.id)}
                  title={canAct ? 'Review / Take action' : 'View request'}
                  aria-label={canAct ? 'Review / Take action' : 'View request'}
                  className="inline-flex rounded-md p-2 text-brand-700 hover:bg-brand-50 hover:text-brand-900"
                >
                  <Eye size={18} aria-hidden />
                </Link>
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-xs text-brand-600">
              <div className="flex justify-between gap-2">
                <dt>Requester</dt>
                <dd className="text-right text-brand-800">{request.requesterName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Submitted</dt>
                <dd className="text-right text-brand-800">
                  {formatDateTime(request.submittedAt)}
                </dd>
              </div>
              {props.mode === 'pending' ? (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <dt>Your turn</dt>
                  <dd>
                    <YourTurnBadge canAct={canAct} />
                  </dd>
                </div>
              ) : (
                <>
                  <div className="flex justify-between gap-2">
                    <dt>Revision</dt>
                    <dd className="text-right text-brand-800">{revisionNumber}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Your decision</dt>
                    <dd className="text-right text-brand-800">{decision}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Decision date</dt>
                    <dd className="text-right text-brand-800">
                      {formatDateTime(actionAt)}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
