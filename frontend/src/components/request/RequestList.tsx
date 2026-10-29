import { Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SubmittedRequest } from '@/types';
import { paths } from '@/routes/paths';
import { formatDateTime } from '@/utils/formatDisplay';
import { getRequestDisplayTitle } from '@/utils/requestTitle';
import { RequestStatusBadge } from './RequestStatusBadge';

interface RequestListProps {
  requests: SubmittedRequest[];
}

export function RequestList({ requests }: RequestListProps) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-100 text-left text-sm">
            <thead className="bg-brand-50/80 text-xs font-semibold uppercase tracking-wide text-brand-600">
              <tr>
                <th className="px-4 py-3">Request #</th>
                <th className="px-4 py-3">Title / Summary</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {requests.map((request) => {
                const isReturned = request.status === 'Returned';
                return (
                  <tr
                    key={request.id}
                    className={
                      isReturned
                        ? 'bg-red-50 hover:bg-red-100/80'
                        : 'hover:bg-brand-100'
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-brand-800">
                      {request.requestNumber}
                    </td>
                    <td className="max-w-[16rem] px-4 py-3 font-medium text-brand-900">
                      <span className="line-clamp-2">
                        {getRequestDisplayTitle(request)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-700">{request.templateName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-brand-700">
                      {formatDateTime(request.submittedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <RequestStatusBadge status={request.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <Link
                        to={paths.requestDetails(request.id)}
                        title="View Details"
                        aria-label="View Details"
                        className="inline-flex rounded-md p-2 text-brand-700 hover:bg-brand-50 hover:text-brand-900"
                      >
                        <Eye size={18} aria-hidden />
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
                  to={paths.requestDetails(request.id)}
                  title="View Details"
                  aria-label="View Details"
                  className="inline-flex rounded-md p-2 text-brand-700 hover:bg-brand-50 hover:text-brand-900"
                >
                  <Eye size={18} aria-hidden />
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
