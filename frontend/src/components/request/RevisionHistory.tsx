import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type {
  ApprovalStepSnapshot,
  RequestRevision,
  ReviewerSnapshot,
  SubmittedRequest,
} from '@/types';
import { formatDateTime } from '@/utils/formatDisplay';
import { getRoleLabel } from '@/utils/permissions';
import { SubmittedFieldValues } from './SubmittedFieldValues';

interface RevisionHistoryProps {
  request: SubmittedRequest;
}

function HistoricalRevisionCard({
  revision,
  workflowType,
  fieldDefinitions,
}: {
  revision: RequestRevision;
  workflowType: SubmittedRequest['workflowType'];
  fieldDefinitions: SubmittedRequest['fieldDefinitions'];
}) {
  const [open, setOpen] = useState(false);
  const submissionType =
    revision.submissionType === 'resubmitted' ? 'Resubmitted' : 'Original';

  return (
    <div className="rounded-md border border-brand-100">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-brand-100"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="min-w-0 flex-1 font-medium text-brand-900">
          Revision {revision.revisionNumber}
        </span>
        <span className="text-xs text-brand-600">
          {submissionType} · {formatDateTime(revision.submittedAt)}
          {revision.outcome ? ` · ${revision.outcome}` : ''}
        </span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-brand-100 px-4 py-4">
          <p className="text-xs text-brand-500">
            Read-only snapshot of values and decisions for this revision.
          </p>
          {fieldDefinitions && fieldDefinitions.length > 0 ? (
            <SubmittedFieldValues
              request={{
                fieldValues: revision.fieldValues,
                attachments: revision.attachments,
              }}
              fields={fieldDefinitions}
              title={`Revision ${revision.revisionNumber} values`}
            />
          ) : (
            <p className="text-sm text-brand-500">
              Field definitions are unavailable for this historical revision.
            </p>
          )}
          {workflowType === 'review_checking' ? (
            <HistoricalReviewers reviewers={revision.reviewers} />
          ) : (
            <HistoricalSteps steps={revision.approvalSteps} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function HistoricalReviewers({
  reviewers,
}: {
  reviewers: ReviewerSnapshot[] | null;
}) {
  if (!reviewers || reviewers.length === 0) {
    return <p className="text-sm text-brand-500">No reviewer decisions saved.</p>;
  }
  return (
    <ul className="space-y-2">
      {reviewers.map((r) => (
        <li
          key={r.userId}
          className="rounded-md border border-brand-100 px-3 py-2 text-sm"
        >
          <p className="font-medium text-brand-900">{r.name}</p>
          <p className="text-xs text-brand-600">
            {r.groupName} · {getRoleLabel(r.role)} · {r.status ?? '—'}
          </p>
          {r.comments ? (
            <p className="mt-1 whitespace-pre-wrap text-xs text-brand-700">
              {r.comments}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function HistoricalSteps({
  steps,
}: {
  steps: ApprovalStepSnapshot[] | null;
}) {
  if (!steps || steps.length === 0) {
    return <p className="text-sm text-brand-500">No approval decisions saved.</p>;
  }
  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  return (
    <ol className="space-y-2">
      {ordered.map((s) => (
        <li
          key={`${s.stepOrder}-${s.userId}`}
          className="rounded-md border border-brand-100 px-3 py-2 text-sm"
        >
          <p className="font-medium text-brand-900">
            Step {s.stepOrder}: {s.name}
          </p>
          <p className="text-xs text-brand-600">
            {s.roleLabel} · {s.status ?? '—'}
          </p>
          {s.comments ? (
            <p className="mt-1 whitespace-pre-wrap text-xs text-brand-700">
              {s.comments}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function RevisionHistory({ request }: RevisionHistoryProps) {
  const closed = [...request.revisions].sort(
    (a, b) => a.revisionNumber - b.revisionNumber,
  );

  if (closed.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-900">Revision history</h2>
      <p className="mt-1 text-sm text-brand-500">
        Earlier revisions are read-only. Current submitted values and review
        progress are shown above.
      </p>

      <div className="mt-4 space-y-3">
        {closed.map((revision) => (
          <HistoricalRevisionCard
            key={revision.revisionNumber}
            revision={revision}
            workflowType={request.workflowType}
            fieldDefinitions={request.fieldDefinitions}
          />
        ))}
      </div>
    </section>
  );
}
