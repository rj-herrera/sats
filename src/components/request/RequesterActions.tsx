import { Link } from 'react-router-dom';
import type { SubmittedRequest } from '@/types';
import { paths } from '@/routes/paths';
import {
  canRequesterCancel,
  canRequesterEditResubmit,
} from '@/utils/requestOwnership';
import type { User } from '@/types';

interface RequesterActionsProps {
  user: User | null;
  request: SubmittedRequest;
  onCancelClick: () => void;
  /** Footer layout matches Review page sticky action bar */
  variant?: 'card' | 'footer';
}

export function RequesterActions({
  user,
  request,
  onCancelClick,
  variant = 'card',
}: RequesterActionsProps) {
  const canEdit = canRequesterEditResubmit(user, request);
  const canCancel = canRequesterCancel(user, request);

  if (!canEdit && !canCancel) return null;

  const buttons = (
    <>
      {canEdit ? (
        <Link
          to={paths.requestEdit(request.id)}
          className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          Edit &amp; Resubmit
        </Link>
      ) : null}
      {canCancel ? (
        <button
          type="button"
          onClick={onCancelClick}
          className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
        >
          Cancel Request
        </button>
      ) : null}
    </>
  );

  if (variant === 'footer') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">{buttons}</div>
    );
  }

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-900">Requester actions</h2>
      <p className="mt-1 text-sm text-brand-500">
        Only the original requester can edit, resubmit, or cancel this request.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">{buttons}</div>
    </section>
  );
}
