import type { KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { SubmittedRequest } from '@/types';
import { paths } from '@/routes/paths';
import { formatDateTime } from '@/utils/formatDisplay';
import { getRequestDisplayTitle } from '@/utils/requestTitle';
import { RequestStatusBadge } from './RequestStatusBadge';

interface RequestListProps {
  requests: SubmittedRequest[];
}

export function RequestList({ requests }: RequestListProps) {
  const navigate = useNavigate();

  const openRequest = (id: string) => {
    navigate(paths.requestDetails(id));
  };

  const openFromRowKey = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openRequest(id);
  };

  return (
    <>
      {/* Desktop table */}
      <div className="hidden border-t border-brand-100 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-sm font-medium text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3.5 font-medium">Request No.</th>
                <th className="px-5 py-3.5 font-medium">Title</th>
                <th className="px-5 py-3.5 font-medium">Template</th>
                <th className="px-5 py-3.5 font-medium">Submitted</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const isReturned = request.status === 'Returned';
                return (
                  <tr
                    key={request.id}
                    tabIndex={0}
                    aria-label={`View details for ${request.requestNumber}`}
                    onClick={() => openRequest(request.id)}
                    onKeyDown={(event) => openFromRowKey(event, request.id)}
                    className={
                      isReturned
                        ? 'cursor-pointer border-b border-rose-100 bg-rose-50/70 last:border-b-0 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40'
                        : 'cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40'
                    }
                  >
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-900">
                      {request.requestNumber}
                    </td>
                    <td className="max-w-[16rem] px-5 py-4 text-slate-600">
                      <span className="line-clamp-2">
                        {getRequestDisplayTitle(request)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{request.templateName}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {formatDateTime(request.submittedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <RequestStatusBadge status={request.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 border-t border-brand-100 p-4 md:hidden">
        {requests.map((request) => (
          <li key={request.id}>
            <Link
              to={paths.requestDetails(request.id)}
              aria-label={`View details for ${request.requestNumber}`}
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
                  <dt>Template</dt>
                  <dd className="text-right text-brand-800">{request.templateName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Submitted</dt>
                  <dd className="text-right text-brand-800">
                    {formatDateTime(request.submittedAt)}
                  </dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
