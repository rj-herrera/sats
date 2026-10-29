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
  showCancel?: boolean;
  onCancelClick?: () => void;
}

export function RequestDetailsHeader({
  request,
  showBackToMyRequests = true,
  showCancel = false,
  onCancelClick,
}: RequestDetailsHeaderProps) {
  const showTopBar = showBackToMyRequests || showCancel;
  const showRevision =
    request.revisionNumber > 1 ||
    request.revisions.length > 0 ||
    Boolean(request.lastResubmittedAt);

  return (
    <div>
      {showTopBar ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {showBackToMyRequests ? (
            <Link
              to={paths.requests}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900"
            >
              <ArrowLeft size={16} aria-hidden />
              Back to My Requests
            </Link>
          ) : null}

          {showCancel ? (
            <button
              type="button"
              onClick={onCancelClick}
              className="ml-auto rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              Cancel Request
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm text-brand-600">{request.requestNumber}</p>
            <RequestStatusBadge status={request.status} />
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-brand-900">
            {getRequestDisplayTitle(request)}
          </h1>
        </div>

        <dl
          className={`mt-5 grid gap-4 sm:grid-cols-2 ${
            showRevision ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
          }`}
        >
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
              Submitted
            </dt>
            <dd className="mt-1 text-sm text-brand-900">
              {formatDateTime(request.submittedAt)}
            </dd>
          </div>
          {showRevision ? (
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
          ) : null}
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
    </div>
  );
}
