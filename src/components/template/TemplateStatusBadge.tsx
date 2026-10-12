import type { TemplateStatus } from '@/types';

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  const classes =
    status === 'Active'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : 'bg-slate-100 text-slate-700 ring-slate-300';

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${classes}`}
    >
      {status}
    </span>
  );
}
