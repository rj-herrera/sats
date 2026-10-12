import { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';

interface CancelRequestDialogProps {
  open: boolean;
  submitting: boolean;
  error: string | null;
  requestNumber: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function CancelRequestDialog({
  open,
  submitting,
  error,
  requestNumber,
  onCancel,
  onConfirm,
}: CancelRequestDialogProps) {
  const titleId = useId();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        disabled={submitting}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-lg border border-brand-100 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-brand-900">
            Cancel request
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="rounded p-1 text-brand-500 hover:bg-brand-50 hover:text-brand-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-sm text-brand-600">
          Cancel <span className="font-mono font-medium">{requestNumber}</span>?
          Cancellation is permanent in this MVP. The request stays visible in My
          Requests as Cancelled, but it cannot be edited, resubmitted, or
          reactivated.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-brand-800">
            Cancellation reason (optional)
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            disabled={submitting}
            className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            placeholder="Why are you cancelling this request?"
          />
        </label>

        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="rounded-md border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50 disabled:opacity-50"
          >
            Keep request
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onConfirm(reason)}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            {submitting ? 'Cancelling…' : 'Confirm cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}
