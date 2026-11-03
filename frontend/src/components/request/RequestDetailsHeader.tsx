import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SubmittedRequest } from '@/types';
import { paths } from '@/routes/paths';
import { getRequestDisplayTitle } from '@/utils/requestTitle';
import { RequestStatusBadge } from './RequestStatusBadge';

interface RequestDetailsHeaderProps {
  request: SubmittedRequest;
  showBackToMyRequests?: boolean;
  showCancel?: boolean;
  onCancelClick?: () => void;
  /** toolbar: back and cancel only. summary: request identity for a parent card. */
  variant?: 'full' | 'toolbar' | 'summary';
}

export function RequestDetailsHeader({
  request,
  showBackToMyRequests = true,
  showCancel = false,
  onCancelClick,
  variant = 'full',
}: RequestDetailsHeaderProps) {
  const showTopBar = showBackToMyRequests || showCancel;
  const toolbar = showTopBar ? (
    <div className={variant === 'full' ? 'mb-3 flex flex-wrap items-center justify-between gap-3' : 'flex flex-wrap items-center justify-between gap-3'}>
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
  ) : null;

  const summary = (
    <>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-900">{request.requestNumber}</p>
          <RequestStatusBadge status={request.status} />
        </div>
        <h1 className="mt-1 text-xl font-semibold text-brand-900">
          {getRequestDisplayTitle(request)}
        </h1>
      </div>
    </>
  );

  if (variant === 'toolbar') return toolbar;
  if (variant === 'summary') return summary;

  return (
    <div>
      {toolbar}
      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        {summary}
      </section>
    </div>
  );
}
