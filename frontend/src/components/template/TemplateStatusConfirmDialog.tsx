import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type TemplateStatusAction = 'activate' | 'deactivate';

interface TemplateStatusConfirmDialogProps {
  open: boolean;
  action: TemplateStatusAction | null;
  templateName: string;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function TemplateStatusConfirmDialog({
  open,
  action,
  templateName,
  submitting = false,
  onCancel,
  onConfirm,
}: TemplateStatusConfirmDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onCancel]);

  if (!open || !action) return null;

  const isActivate = action === 'activate';
  const title = isActivate ? 'Activate template' : 'Deactivate template';
  const summary = isActivate
    ? `Activate “${templateName}”? It will become available for new requests.`
    : `Deactivate “${templateName}”? It will no longer be available for new requests.`;
  const confirmLabel = isActivate ? 'Activate' : 'Deactivate';

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

        <p className="mt-3 text-sm text-brand-600">{summary}</p>

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
            className={[
              'rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
              isActivate
                ? 'bg-emerald-700 hover:bg-emerald-800'
                : 'bg-orange-600 hover:bg-orange-700',
            ].join(' ')}
          >
            {submitting ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
