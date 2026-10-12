import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SubmittedRequest } from '@/types';
import { paths } from '@/routes/paths';
import { formatDateTime } from '@/utils/formatDisplay';
import { getRequestDisplayTitle } from '@/utils/requestTitle';
import { RequestStatusBadge } from './RequestStatusBadge';

interface RequestDetailsHeaderProps {
  request: SubmittedRequest;
  showBackToMyRequests?: boolean;
}

export function RequestDetailsHeader({
  request,
  showBackToMyRequests = true,
}: RequestDetailsHeaderProps) {

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      {showBackToMyRequests ? (
        <Link
          to={paths.requests}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to My Requests
        </Link>
      ) : null}

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm text-brand-600">{request.requestNumber}</p>
          <h1 className="mt-1 text-2xl font-semibold text-brand-900">
            {getRequestDisplayTitle(request)}
          </h1>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
            Submitted
          </dt>
          <dd className="mt-1 text-sm text-brand-900">
            {formatDateTime(request.submittedAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
            Revision
          </dt>
          <dd className="mt-1 text-sm text-brand-900">
            Revision {request.revisionNumber}
            {request.lastResubmittedAt
              ? ` · last resubmitted ${formatDateTime(request.lastResubmittedAt)}`
              : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
            Requester
          </dt>
          <dd className="mt-1 text-sm text-brand-900">{request.requesterName}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
            Group
          </dt>
          <dd className="mt-1 text-sm text-brand-900">
            {request.requesterGroupName ?? '—'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
