import type { KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
      <span className="inline-flex w-fit items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
        Ready for your action
      </span>
    );
  }

  return (
    <span className="inline-flex w-fit items-center rounded-full border border-slate-300 bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      Waiting — not your turn yet
    </span>
  );
}

export function AssignedRequestList(props: AssignedRequestListProps) {
  const navigate = useNavigate();
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

  const openRequest = (id: string) => {
    navigate(paths.requestReview(id));
  };

  const openFromRowKey = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openRequest(id);
  };

  const rowClass = (status: SubmittedRequest['status']) =>
    status === 'Returned'
      ? 'cursor-pointer border-b border-rose-100 bg-rose-50/70 last:border-b-0 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40'
      : 'cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40';

  return (
    <>
      <div className="hidden border-t border-brand-100 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-sm font-medium text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3.5 font-medium">Request No.</th>
                <th className="px-5 py-3.5 font-medium">Title</th>
                <th className="px-5 py-3.5 font-medium">Requester</th>
                <th className="px-5 py-3.5 font-medium">Submitted</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                {props.mode === 'pending' ? (
                  <th className="px-5 py-3.5 font-medium">Your turn</th>
                ) : (
                  <>
                    <th className="px-5 py-3.5 font-medium">Rev</th>
                    <th className="px-5 py-3.5 font-medium">Your decision</th>
                    <th className="px-5 py-3.5 font-medium">Decision date</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ request, canAct, decision, actionAt, revisionNumber }) => (
                <tr
                  key={request.id}
                  tabIndex={0}
                  aria-label={`${canAct ? 'Review' : 'View'} ${request.requestNumber}`}
                  onClick={() => openRequest(request.id)}
                  onKeyDown={(event) => openFromRowKey(event, request.id)}
                  className={rowClass(request.status)}
                >
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-900">
                    {request.requestNumber}
                  </td>
                  <td className="max-w-[16rem] px-5 py-4 text-slate-600">
                    <span className="line-clamp-2">
                      {getRequestDisplayTitle(request)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{request.requesterName}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {formatDateTime(request.submittedAt)}
                  </td>
                  <td className="px-5 py-4">
                    <RequestStatusBadge status={request.status} />
                  </td>
                  {props.mode === 'pending' ? (
                    <td className="px-5 py-4">
                      <YourTurnBadge canAct={canAct} />
                    </td>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        {revisionNumber}
                      </td>
                      <td className="px-5 py-4 text-slate-800">{decision}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {formatDateTime(actionAt)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="space-y-3 border-t border-brand-100 p-4 md:hidden">
        {rows.map(({ request, canAct, decision, actionAt, revisionNumber }) => (
          <li key={request.id}>
            <Link
              to={paths.requestReview(request.id)}
              aria-label={`${canAct ? 'Review' : 'View'} ${request.requestNumber}`}
              className={[
                'block rounded-lg border p-4 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                request.status === 'Returned'
                  ? 'border-red-200 bg-red-50'
                  : 'border-brand-100 bg-white',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {request.requestNumber}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-brand-900">
                    {getRequestDisplayTitle(request)}
                  </h3>
                </div>
                <RequestStatusBadge status={request.status} />
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
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
