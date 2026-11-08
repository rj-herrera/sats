import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import type {
  ApprovalStepSnapshot,
  AttachmentMetadata,
  FormFieldDefinition,
  RequestRevision,
  ReviewerSnapshot,
  SubmittedRequest,
} from '@/types';
import { getUserById } from '@/services/userRepository';
import { formatDateTime, formatSubmittedFieldValue } from '@/utils/formatDisplay';

interface RevisionHistoryProps {
  request: SubmittedRequest;
}

function jobPosition(userId: string): string {
  return getUserById(userId)?.designation?.trim() || 'Position unavailable';
}

function hasRecordedDecision(status?: string | null): boolean {
  return status === 'Approved' || status === 'Rejected' || status === 'Returned';
}

function decisionAccent(status?: string | null): string {
  if (status === 'Approved') return 'border-emerald-500';
  if (status === 'Rejected' || status === 'Returned') return 'border-red-500';
  return 'border-slate-300';
}

function HistoricalRevisionCard({
  revision,
  workflowType,
  fieldDefinitions,
  defaultOpen,
}: {
  revision: RequestRevision;
  workflowType: SubmittedRequest['workflowType'];
  fieldDefinitions: SubmittedRequest['fieldDefinitions'];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">
            Revision {revision.revisionNumber}
          </span>
          <span className="mt-0.5 block text-xs leading-4 text-slate-500">
            {formatDateTime(revision.submittedAt)}
          </span>
        </span>
        {open ? (
          <ChevronDown size={16} className="shrink-0 text-slate-500" />
        ) : (
          <ChevronRight size={16} className="shrink-0 text-slate-500" />
        )}
      </button>
      {open ? (
        <div className="px-3 py-2">
          {fieldDefinitions && fieldDefinitions.length > 0 ? (
            <RevisionDetailRows
              fields={fieldDefinitions}
              revision={revision}
            />
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Field definitions are unavailable for this historical revision.
            </p>
          )}
          {workflowType === 'review_checking' ? (
            <ReviewDecisions
              title="Review decisions"
              people={(revision.reviewers ?? []).map((reviewer) => ({
                id: reviewer.userId,
                name: reviewer.name,
                meta: jobPosition(reviewer.userId),
                status: reviewer.status,
                comment: reviewer.comments,
              }))}
              undecidedLabel="Other reviewers had no recorded decision."
              emptyLabel="No review decisions were recorded."
            />
          ) : (
            <ReviewDecisions
              title="Approval decisions"
              people={[...(revision.approvalSteps ?? [])]
                .sort((a, b) => a.stepOrder - b.stepOrder)
                .map((step) => ({
                  id: `${step.stepOrder}-${step.userId}`,
                  name: step.name,
                  meta: jobPosition(step.userId),
                  status: step.status,
                  comment: step.comments,
                }))}
              undecidedLabel="Other approvers had no recorded decision."
              emptyLabel="No approval decisions were recorded."
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function RevisionDetailRows({
  fields,
  revision,
}: {
  fields: FormFieldDefinition[];
  revision: RequestRevision;
}) {
  return (
    <dl>
      {fields.map((field) => {
        const display = fieldDisplay(field, revision);
        return (
          <div
            key={field.id}
            className="grid grid-cols-2 gap-x-3 py-1"
          >
            <dt className="text-xs text-slate-500">{field.label}</dt>
            <dd
              className={
                display.empty
                  ? 'text-xs italic text-slate-400'
                  : 'whitespace-pre-wrap break-words text-xs text-slate-900'
              }
            >
              {display.text}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function fieldDisplay(
  field: FormFieldDefinition,
  revision: RequestRevision,
): { text: string; empty: boolean } {
  if (field.type === 'file') {
    const names = attachmentsForField(revision.attachments, field.id).map(
      (attachment) => attachment.fileName,
    );
    if (names.length === 0) return { text: 'Not provided', empty: true };
    return { text: names.join(', '), empty: false };
  }

  const display = formatSubmittedFieldValue(
    field,
    revision.fieldValues[field.id],
  );
  return { text: display.text, empty: display.kind === 'empty' };
}

function attachmentsForField(
  attachments: AttachmentMetadata[],
  fieldId: string,
): AttachmentMetadata[] {
  return attachments.filter((attachment) => attachment.fieldId === fieldId);
}

function ReviewDecisions({
  title,
  people,
  undecidedLabel,
  emptyLabel,
}: {
  title: string;
  people: {
    id: string;
    name: string;
    meta: string;
    status?: ReviewerSnapshot['status'] | ApprovalStepSnapshot['status'];
    comment?: string | null;
  }[];
  undecidedLabel: string;
  emptyLabel: string;
}) {
  const decided = people.filter((person) => hasRecordedDecision(person.status));
  const undecidedCount = people.length - decided.length;

  return (
    <div className="mt-4">
      <div className="relative flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {undecidedCount > 0 ? (
          <>
            <button
              type="button"
              aria-label={undecidedLabel}
              className="peer inline-flex text-slate-400 hover:text-slate-600"
            >
              <Info size={14} aria-hidden />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute top-full right-0 left-0 z-10 mt-1.5 hidden rounded-md bg-slate-800 px-2.5 py-1.5 text-xs leading-4 text-white peer-hover:block peer-focus:block"
            >
              {undecidedLabel}
            </span>
          </>
        ) : null}
      </div>
      {decided.length > 0 ? (
        <div className="mt-2 space-y-3">
          {decided.map((person) => (
            <div
              key={person.id}
              className={`border-l-4 py-0.5 pl-3 ${decisionAccent(person.status)}`}
            >
              <p className="text-sm font-semibold text-slate-900">{person.name}</p>
              <p className="text-xs text-slate-500">{person.meta}</p>
              {person.comment ? (
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                  “{person.comment}”
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">{emptyLabel}</p>
      )}
    </div>
  );
}

export function RevisionHistory({ request }: RevisionHistoryProps) {
  const closed = [...request.revisions].sort(
    (a, b) => a.revisionNumber - b.revisionNumber,
  );

  if (closed.length === 0) {
    return null;
  }

  const newest = closed[closed.length - 1]?.revisionNumber;

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Revision history</h2>
      <p className="mt-1 text-sm text-slate-500">
        View previous submitted details for earlier revisions.
      </p>

      <div className="mt-4 space-y-3">
        {closed.map((revision) => (
          <HistoricalRevisionCard
            key={revision.revisionNumber}
            revision={revision}
            workflowType={request.workflowType}
            fieldDefinitions={request.fieldDefinitions}
            defaultOpen={revision.revisionNumber === newest}
          />
        ))}
      </div>
    </section>
  );
}
