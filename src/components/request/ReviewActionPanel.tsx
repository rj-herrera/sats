import type { DecisionType } from '@/types';

interface ReviewActionPanelProps {
  disabled: boolean;
  onSelect: (decision: DecisionType) => void;
  /** Footer layout matches New Request sticky action bar */
  variant?: 'card' | 'footer';
}

export function ReviewActionPanel({
  disabled,
  onSelect,
  variant = 'card',
}: ReviewActionPanelProps) {
  const buttons = (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect('reject')}
        className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Reject
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect('approve')}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Approve
      </button>
    </>
  );

  if (variant === 'footer') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">{buttons}</div>
    );
  }

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-900">Your action</h2>
      <p className="mt-1 text-sm text-brand-500">
        Choose an action. You will confirm before the decision is recorded.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect('return')}
          className="rounded-md border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-900 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Return for Revision
        </button>
        {buttons}
      </div>
    </section>
  );
}
