import { Link } from 'react-router-dom';
import type { SubmittedRequest, User } from '@/types';
import { paths } from '@/routes/paths';
import { canRequesterEditResubmit } from '@/utils/requestOwnership';

interface RequesterActionsProps {
  user: User | null;
  request: SubmittedRequest;
  /** Footer layout matches Review page sticky action bar */
  variant?: 'card' | 'footer';
}

export function RequesterActions({
  user,
  request,
  variant = 'card',
}: RequesterActionsProps) {
  const canEdit = canRequesterEditResubmit(user, request);

  if (!canEdit) return null;

  const editLink = (
    <Link
      to={paths.requestEdit(request.id)}
      className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
    >
      Edit &amp; Resubmit
    </Link>
  );

  if (variant === 'footer') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">{editLink}</div>
    );
  }

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-900">Requester actions</h2>
      <p className="mt-1 text-sm text-brand-500">
        Only the original requester can edit or resubmit this request.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">{editLink}</div>
    </section>
  );
}
