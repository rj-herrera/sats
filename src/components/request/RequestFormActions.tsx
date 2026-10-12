interface RequestFormActionsProps {
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onReset: () => void;
  submitLabel?: string;
  resetLabel?: string;
  submittingLabel?: string;
}

export function RequestFormActions({
  canSubmit,
  submitting,
  onSubmit,
  onReset,
  submitLabel = 'Submit Request',
  resetLabel = 'Clear',
  submittingLabel = 'Submitting…',
}: RequestFormActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <button
        type="button"
        className="rounded-md border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={submitting}
        onClick={onReset}
      >
        {resetLabel}
      </button>
      <button
        type="button"
        className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canSubmit || submitting}
        onClick={onSubmit}
      >
        {submitting ? submittingLabel : submitLabel}
      </button>
    </div>
  );
}
