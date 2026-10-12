import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApprovalWorkflowPreview } from '@/components/request/ApprovalWorkflowPreview';
import { DynamicRequestForm } from '@/components/request/DynamicRequestForm';
import { RequestFormActions } from '@/components/request/RequestFormActions';
import { useAuth } from '@/contexts/AuthContext';
import { PageScroll } from '@/layouts/PageScroll';
import { paths } from '@/routes/paths';
import { resubmitRequest } from '@/services/requestLifecycleService';
import { getRequestById } from '@/services/requestRepository';
import type { AttachmentMetadata, FieldValue } from '@/types';
import { getRoleLabel } from '@/utils/permissions';
import { canRequesterEditResubmit } from '@/utils/requestOwnership';
import { getLatestReturnInfo } from '@/utils/returnInfo';
import {
  buildAttachmentMetadata,
  validateRevisionForm,
} from '@/utils/formValidation';
import { formatDateTime } from '@/utils/formatDisplay';

export function EditRequestPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const request = useMemo(() => (id ? getRequestById(id) : undefined), [id]);

  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [removedAttachmentFieldIds, setRemovedAttachmentFieldIds] = useState(
    () => new Set<string>(),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!request) return;
    setValues({ ...request.fieldValues });
    setFiles({});
    setRemovedAttachmentFieldIds(new Set());
    setFieldErrors({});
    setFormError(null);
  }, [request?.id]);

  if (!user) return null;

  if (!request) {
    return (
      <PageScroll>
        <div className="mx-auto max-w-lg rounded-lg border border-brand-100 bg-white px-6 py-12 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-brand-900">Request not found</h1>
          <Link
            to={paths.requests}
            className="mt-6 inline-block rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Back to My Requests
          </Link>
        </div>
      </PageScroll>
    );
  }

  if (!canRequesterEditResubmit(user, request)) {
    return (
      <PageScroll>
        <div className="mx-auto max-w-lg rounded-lg border border-brand-100 bg-white px-6 py-12 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-brand-900">Cannot edit</h1>
          <p className="mt-2 text-sm text-brand-600">
            Only the original requester can edit a request while it is Returned.
          </p>
          <Link
            to={paths.requestDetails(request.id)}
            className="mt-6 inline-block rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Back to request
          </Link>
        </div>
      </PageScroll>
    );
  }

  const fields = request.fieldDefinitions ?? [];
  if (fields.length === 0) {
    return (
      <PageScroll>
        <div className="mx-auto max-w-lg rounded-lg border border-amber-200 bg-amber-50 px-6 py-12 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-amber-950">
            Form snapshot unavailable
          </h1>
          <p className="mt-2 text-sm text-amber-900">
            This request does not include its original field definitions, so it
            cannot be safely revised without risking a mismatched form.
          </p>
          <Link
            to={paths.requestDetails(request.id)}
            className="mt-6 inline-block rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Back to request
          </Link>
        </div>
      </PageScroll>
    );
  }

  const returnInfo = getLatestReturnInfo(request);

  const handleResubmit = async () => {
    const validation = validateRevisionForm({
      fields,
      values,
      files,
      existingAttachments: request.attachments,
      removedAttachmentFieldIds,
    });
    setFieldErrors(validation.fieldErrors);
    setFormError(validation.formError);
    if (!validation.valid) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const attachments: AttachmentMetadata[] = (
        await Promise.all(
          fields.map(async (field) => {
            if (field.type !== 'file') return [];
            const newFile = files[field.id];
            if (newFile) return [await buildAttachmentMetadata(field.id, newFile)];
            if (removedAttachmentFieldIds.has(field.id)) return [];
            const existing = request.attachments.find((a) => a.fieldId === field.id);
            return existing ? [existing] : [];
          }),
        )
      ).flat();

      const result = resubmitRequest({
        requestId: request.id,
        actorUserId: user.id,
        fieldValues: values,
        attachments,
      });

      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      navigate(paths.requestDetails(result.request.id), {
        replace: true,
        state: { resubmitted: true },
      });
    } catch {
      setFormError('Could not prepare the attachment for resubmit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 lg:p-6">
        <div>
          <Link
            to={paths.requestDetails(request.id)}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900"
          >
            <ArrowLeft size={16} aria-hidden />
            Back to request
          </Link>
          <h1 className="text-2xl font-semibold text-brand-900">
            Edit &amp; resubmit
          </h1>
          <p className="mt-1 font-mono text-sm text-brand-600">
            {request.requestNumber} · Revision {request.revisionNumber} →{' '}
            {request.revisionNumber + 1}
          </p>
        </div>

        <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
                Template
              </dt>
              <dd className="mt-1 text-sm text-brand-900">{request.templateName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
                Current revision
              </dt>
              <dd className="mt-1 text-sm text-brand-900">
                Revision {request.revisionNumber}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
                Status
              </dt>
              <dd className="mt-1 text-sm text-brand-900">{request.status}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-brand-500">
            The template and approval assignments cannot be changed during
            revision. The request number stays the same after resubmission.
          </p>
        </section>

        <section className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <h2 className="text-sm font-semibold text-orange-950">
            Latest return comment
          </h2>
          {returnInfo.comment ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-orange-950">
              {returnInfo.comment}
            </p>
          ) : (
            <p className="mt-2 text-sm text-orange-800">
              No return comment was recorded.
            </p>
          )}
          {returnInfo.returnedByName || returnInfo.returnedAt ? (
            <p className="mt-2 text-xs text-orange-800">
              {[returnInfo.returnedByName, returnInfo.returnedByRole]
                .filter(Boolean)
                .join(' — ')}
              {returnInfo.returnedAt
                ? ` · ${formatDateTime(returnInfo.returnedAt)}`
                : ''}
            </p>
          ) : null}
        </section>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <DynamicRequestForm
              fields={fields}
              title="Revise request information"
              values={values}
              files={files}
              errors={fieldErrors}
              existingAttachments={request.attachments}
              removedAttachmentFieldIds={removedAttachmentFieldIds}
              onChange={(fieldId, value) =>
                setValues((prev) => ({ ...prev, [fieldId]: value }))
              }
              onFileChange={(fieldId, file) =>
                setFiles((prev) => ({ ...prev, [fieldId]: file }))
              }
              onRemoveExistingAttachment={(fieldId) => {
                setRemovedAttachmentFieldIds((prev) => {
                  const next = new Set(prev);
                  next.add(fieldId);
                  return next;
                });
                setFiles((prev) => ({ ...prev, [fieldId]: null }));
              }}
            />
          </div>

          <aside className="min-w-0 space-y-4 lg:col-span-1">
            {request.workflowType === 'hierarchy_approval' ? (
              <ApprovalWorkflowPreview steps={request.approvalSteps ?? []} />
            ) : (
              <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-brand-900">
                  Assigned reviewers
                </h2>
                <p className="mt-1 text-xs text-brand-500">
                  Reviewer list is locked for this revision.
                </p>
                <ul className="mt-4 divide-y divide-brand-100 rounded-md border border-brand-100">
                  {(request.reviewers ?? []).map((r) => (
                    <li key={r.userId} className="px-3 py-2.5">
                      <p className="text-sm font-medium text-brand-900">{r.name}</p>
                      <p className="text-xs text-brand-500">
                        {r.groupName} · {getRoleLabel(r.role)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>

        {formError ? (
          <p className="text-sm text-red-600" role="alert">
            {formError}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-brand-100 bg-white px-4 py-3 lg:px-6">
        <RequestFormActions
          canSubmit={!submitting}
          submitting={submitting}
          submitLabel="Resubmit Request"
          resetLabel="Discard Changes"
          onSubmit={handleResubmit}
          onReset={() => navigate(paths.requestDetails(request.id))}
        />
      </div>
    </div>
  );
}
