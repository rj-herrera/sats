import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DynamicRequestForm } from '@/components/request/DynamicRequestForm';
import { RequestFormActions } from '@/components/request/RequestFormActions';
import { RequestStatusBadge } from '@/components/request/RequestStatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { PageScroll } from '@/layouts/PageScroll';
import { paths } from '@/routes/paths';
import { getRequest, resubmitSubmittedRequest } from '@/services/requestApi';
import type { FieldValue, SubmittedRequest } from '@/types';
import { getUserById } from '@/services/userRepository';
import { canRequesterEditResubmit } from '@/utils/requestOwnership';
import { getLatestReturnInfo } from '@/utils/returnInfo';
import { validateRevisionForm } from '@/utils/formValidation';
import { formatDateTime } from '@/utils/formatDisplay';

export function EditRequestPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [request, setRequest] = useState<SubmittedRequest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [removedAttachmentFieldIds, setRemovedAttachmentFieldIds] = useState(
    () => new Set<string>(),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const assigneeListRef = useRef<HTMLUListElement>(null);
  const [assigneeListMaxHeight, setAssigneeListMaxHeight] = useState<number>();

  useEffect(() => {
    if (!id) {
      setRequest(null);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    void getRequest(id).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setRequest(null);
        setLoadError(result.error);
        setLoaded(true);
        return;
      }
      setRequest(result.data);
      setLoadError(null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useLayoutEffect(() => {
    const list = assigneeListRef.current;
    if (!list) return undefined;

    const update = () => {
      const content = list.parentElement?.closest('.overflow-y-auto') ?? null;
      const card = list.closest('section');
      if (!content) return;
      const contentTop = content.getBoundingClientRect().top;
      const listOffset =
        list.getBoundingClientRect().top - contentTop + content.scrollTop;
      const padBottom = card ? parseFloat(getComputedStyle(card).paddingBottom) || 0 : 0;
      const next = Math.max(
        Math.floor(content.clientHeight - listOffset - padBottom - 8),
        120,
      );
      setAssigneeListMaxHeight((current) => (current === next ? current : next));
    };

    update();
    const observer = new ResizeObserver(update);
    const content = list.parentElement?.closest('.overflow-y-auto') ?? null;
    if (content) observer.observe(content);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [request]);

  useEffect(() => {
    if (!request) return;
    setValues({ ...request.fieldValues });
    setFiles({});
    setRemovedAttachmentFieldIds(new Set());
    setFieldErrors({});
    setFormError(null);
  }, [request]);

  if (!user) return null;

  if (!loaded) {
    return (
      <PageScroll>
        <p className="text-sm text-brand-600">Loading request…</p>
      </PageScroll>
    );
  }

  if (!request) {
    return (
      <PageScroll>
        <div className="mx-auto max-w-lg rounded-lg border border-brand-100 bg-white px-6 py-12 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-brand-900">Request not found</h1>
          {loadError ? <p className="mt-2 text-sm text-brand-600">{loadError}</p> : null}
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

    if (!request.rowVersion) {
      setFormError('This request is missing a version. Reload and try again.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const keptAttachmentIds = request.attachments.flatMap((attachment) => {
      if (!attachment.id) return [];
      if (removedAttachmentFieldIds.has(attachment.id)) return [];
      if (removedAttachmentFieldIds.has(attachment.fieldId)) return [];
      return [attachment.id];
    });
    const result = await resubmitSubmittedRequest(
      request.id,
      {
        fieldValues: values,
        rowVersion: request.rowVersion,
        keptAttachmentIds,
      },
      files,
    );
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    navigate(paths.requestDetails(result.data.id), {
      replace: true,
      state: { resubmitted: true },
    });
  };

  const assignees =
    request.workflowType === 'hierarchy_approval'
      ? (request.approvalSteps ?? []).map((step) => ({
          id: `${step.stepOrder}-${step.userId}`,
          name: step.name,
          detail: getUserById(step.userId)?.designation?.trim() || 'Position unavailable',
        }))
      : (request.reviewers ?? []).map((reviewer) => ({
          id: reviewer.userId,
          name: reviewer.name,
          detail: getUserById(reviewer.userId)?.designation?.trim() || 'Position unavailable',
        }));
  const assigneeLabel =
    request.workflowType === 'hierarchy_approval' ? 'Approvers' : 'Reviewers';
  const lockedListMessage = `${
    assigneeLabel === 'Reviewers' ? 'Reviewer' : 'Approver'
  } list is locked for this revision.`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 lg:p-6">
        <div>
          <Link
            to={paths.requestDetails(request.id)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900"
          >
            <ArrowLeft size={16} aria-hidden />
            Back to request
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-brand-900">Edit &amp; Resubmit</h1>
            <RequestStatusBadge status={request.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{request.requestNumber}</p>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
          <section
            className={[
              'rounded-lg border bg-white p-5 shadow-sm',
              formError ? 'border-red-500' : 'border-brand-100',
            ].join(' ')}
          >
            <h2 className="text-base font-semibold text-brand-900">
              Revise Request Details
            </h2>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-950">Latest return feedback</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-amber-950">
                Remarks: {returnInfo.comment || 'No return comment was recorded.'}
              </p>
              {returnInfo.returnedByName || returnInfo.returnedAt ? (
                <p className="mt-2 text-xs text-amber-800">
                  {returnInfo.returnedByName}
                  {returnInfo.returnedAt
                    ? `${returnInfo.returnedByName ? ' · ' : ''}${formatDateTime(returnInfo.returnedAt)}`
                    : ''}
                </p>
              ) : null}
            </div>

            <div className="mt-5">
              <DynamicRequestForm
                embedded
                uploading={submitting}
                fields={fields}
                values={values}
                files={files}
                errors={fieldErrors}
                existingAttachments={request.attachments}
                removedAttachmentFieldIds={removedAttachmentFieldIds}
                onChange={(fieldId, value) =>
                  setValues((prev) => ({ ...prev, [fieldId]: value }))
                }
                onFilesChange={(fieldId, next) =>
                  setFiles((prev) => ({ ...prev, [fieldId]: next }))
                }
                onRemoveExistingAttachment={(attachmentId) => {
                  setRemovedAttachmentFieldIds((prev) => {
                    const next = new Set(prev);
                    next.add(attachmentId);
                    return next;
                  });
                }}
              />
            </div>
          </section>
          {formError ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {formError}
            </p>
          ) : null}
          </div>

          <section className="min-w-0 rounded-lg border border-brand-100 bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="text-base font-semibold text-brand-900">Revision Information</h2>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="text-xs font-medium text-slate-500">Template</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {request.templateName}
                </dd>
              </div>
              <div className="border-b border-slate-100 pb-4">
                <dt className="text-xs font-medium text-slate-500">Current revision</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  Revision {request.revisionNumber}
                </dd>
              </div>
            </dl>

            <div className="relative mt-4 flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-brand-900">
                Assigned {assigneeLabel}
              </h3>
              <button
                type="button"
                aria-label={lockedListMessage}
                className="peer inline-flex text-slate-400 hover:text-slate-600"
              >
                <Info size={15} aria-hidden />
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute top-full right-0 left-0 z-10 mt-1.5 hidden rounded-md bg-slate-800 px-2.5 py-1.5 text-xs leading-4 text-white peer-hover:block peer-focus:block"
              >
                {lockedListMessage}
              </span>
            </div>

            <ul
              ref={assigneeListRef}
              className="mt-3 overflow-y-auto"
              style={
                assigneeListMaxHeight ? { maxHeight: assigneeListMaxHeight } : undefined
              }
            >
              {assignees.map((person) => (
                <li key={person.id} className="mt-3 first:mt-0">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {person.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {person.detail}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="shrink-0 border-t border-brand-100 bg-white px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
            <Info size={16} className="shrink-0" aria-hidden />
            Resubmitting creates Revision {request.revisionNumber + 1} and restarts the
            approval process.
          </p>
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
    </div>
  );
}
