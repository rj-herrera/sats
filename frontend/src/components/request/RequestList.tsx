import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SubmittedRequest } from '@/types';
import { paths } from '@/routes/paths';
import { formatDateTime } from '@/utils/formatDisplay';
import { getRequestDisplayTitle } from '@/utils/requestTitle';
import { RequestStatusBadge } from './RequestStatusBadge';

const openButtonClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700';

interface RequestListProps {
  requests: SubmittedRequest[];
}

export function RequestList({ requests }: RequestListProps) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-sm font-medium text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3.5 font-medium">Request No.</th>
                <th className="px-5 py-3.5 font-medium">Title</th>
                <th className="px-5 py-3.5 font-medium">Template</th>
                <th className="px-5 py-3.5 font-medium">Submitted</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const isReturned = request.status === 'Returned';
                return (
                  <tr
                    key={request.id}
                    className={
                      isReturned
                        ? 'border-b border-rose-100 bg-rose-50/70 last:border-b-0 hover:bg-rose-50'
                        : 'border-b border-slate-100 last:border-b-0 hover:bg-slate-50'
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
                    <td className="whitespace-nowrap px-5 py-4 text-center">
                      <Link
                        to={paths.requestDetails(request.id)}
                        title="View Details"
                        aria-label="View Details"
                        className={openButtonClass}
                      >
                        <ChevronRight size={18} aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {requests.map((request) => (
          <li
            key={request.id}
            className={[
              'rounded-lg border p-4 shadow-sm',
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
              <div className="flex shrink-0 items-center gap-2">
                <RequestStatusBadge status={request.status} />
                <Link
                  to={paths.requestDetails(request.id)}
                  title="View Details"
                  aria-label="View Details"
                  className={openButtonClass}
                >
                  <ChevronRight size={18} aria-hidden />
                </Link>
              </div>
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
          </li>
        ))}
      </ul>
    </>
  );
}
