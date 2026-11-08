import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface RemoveApproverDialogProps {
  employeeName: string | null;
  submitting: boolean;
  error: string | null;
  title?: string;
  message?: ReactNode;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RemoveApproverDialog({
  employeeName,
  submitting,
  error,
  title = 'Remove Approver?',
  message,
  confirmLabel = 'Remove',
  onCancel,
  onConfirm,
}: RemoveApproverDialogProps) {
  const titleId = useId();
  const open = employeeName !== null;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onCancel]);

  if (!employeeName) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
            {title}
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
          {message ?? (
            <>
              Are you sure you want to remove{' '}
              <span className="font-semibold">{employeeName}</span> as a designated approver?
            </>
          )}
        </p>
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
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Removing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
