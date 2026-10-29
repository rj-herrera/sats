import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { DecisionType } from '@/types';

interface DecisionConfirmationDialogProps {
  open: boolean;
  decision: DecisionType | null;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (comment: string) => void;
}

function decisionCopy(decision: DecisionType) {
  switch (decision) {
    case 'approve':
      return {
        title: 'Approve',
        summary:
          'Confirm that you approve this request (or complete your review). An optional comment may be added.',
        commentLabel: 'Comment (optional)',
        confirmLabel: 'Confirm approval',
        requireComment: false,
      };
    case 'reject':
      return {
        title: 'Reject request',
        summary: 'Rejecting ends the workflow. A comment explaining the rejection is required.',
        commentLabel: 'Rejection reason (required)',
        confirmLabel: 'Confirm rejection',
        requireComment: true,
      };
    case 'return':
      return {
        title: 'Return for revision',
        summary: 'Return this request so the requester can revise it.',
        commentLabel: 'Revision notes (required)',
        confirmLabel: 'Confirm return',
        requireComment: true,
      };
  }
}

export function DecisionConfirmationDialog({
  open,
  decision,
  submitting,
  error,
  onCancel,
  onConfirm,
}: DecisionConfirmationDialogProps) {
  const titleId = useId();
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) {
      setComment('');
    }
  }, [open, decision]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, submitting, onCancel]);

  if (!open || !decision) return null;

  const copy = decisionCopy(decision);

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
        className="relative z-10 w-full max-w-md rounded-xl border border-brand-100 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-brand-900">
            {copy.title}
          </h2>
          <button
            type="button"
            className="rounded p-1 text-brand-500 hover:bg-brand-50 hover:text-brand-800"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-2 text-sm text-brand-600">{copy.summary}</p>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-medium text-brand-600">
            {copy.commentLabel}
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            disabled={submitting}
            className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
            placeholder={
              copy.requireComment ? 'Enter your comments…' : 'Optional notes…'
            }
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
            className="rounded-md border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50 disabled:opacity-50"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={[
              'rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50',
              decision === 'approve'
                ? 'bg-emerald-700 hover:bg-emerald-800'
                : decision === 'reject'
                  ? 'bg-red-700 hover:bg-red-800'
                  : 'bg-orange-600 hover:bg-orange-700',
            ].join(' ')}
            disabled={submitting}
            onClick={() => onConfirm(comment)}
          >
            {submitting ? 'Saving…' : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
