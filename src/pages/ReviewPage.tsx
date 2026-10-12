import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ActivityTimeline } from '@/components/request/ActivityTimeline';
import { ApprovalProgress } from '@/components/request/ApprovalProgress';
import { DecisionConfirmationDialog } from '@/components/request/DecisionConfirmationDialog';
import { RequestStatusBadge } from '@/components/request/RequestStatusBadge';
import { ReviewActionPanel } from '@/components/request/ReviewActionPanel';
import { ReviewerProgress } from '@/components/request/ReviewerProgress';
import { SubmittedFieldValues } from '@/components/request/SubmittedFieldValues';
import { useAuth } from '@/contexts/AuthContext';
import { PageScroll } from '@/layouts/PageScroll';
import { paths } from '@/routes/paths';
import { processRequestDecision } from '@/services/decisionService';
import { getRequestById } from '@/services/requestRepository';
import { getTemplateById } from '@/services/templateService';
import type { DecisionType, SubmittedRequest } from '@/types';
import {
  explainWhyCannotAct,
  getUserCompletedDecision,
  isUserAssignedToRequest,
} from '@/utils/assignmentHelpers';
import { formatDateTime } from '@/utils/formatDisplay';
import {
  canUserOpenReview,
  canUserTakeAction,
} from '@/utils/requestAccess';
import { getRequestDisplayTitle } from '@/utils/requestTitle';

export function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [request, setRequest] = useState<SubmittedRequest | undefined>();
  const [decision, setDecision] = useState<DecisionType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setRequest(id ? getRequestById(id) : undefined);
    setSuccessMessage(null);
    setDialogOpen(false);
    setDecision(null);
    setDialogError(null);
  }, [id]);

  const fields = useMemo(() => {
    if (!request) return [];
    if (request.fieldDefinitions && request.fieldDefinitions.length > 0) {
      return request.fieldDefinitions;
    }
    return getTemplateById(request.templateId)?.fields ?? [];
  }, [request]);

  if (!user) return null;

  if (!request) {
    return (
      <PageScroll>
        <div className="mx-auto max-w-lg rounded-lg border border-brand-100 bg-white px-6 py-12 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-brand-900">Request not found</h1>
          <p className="mt-2 text-sm text-brand-600">
            This request does not exist or is no longer available.
          </p>
          <Link
            to={paths.inbox}
            className="mt-6 inline-block rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Back to Action Inbox
          </Link>
        </div>
      </PageScroll>
    );
  }

  if (!canUserOpenReview(user, request)) {
    return (
      <PageScroll>
        <div className="mx-auto max-w-lg rounded-lg border border-brand-100 bg-white px-6 py-12 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-brand-900">Access denied</h1>
          <p className="mt-2 text-sm text-brand-600">
            You are not assigned to review or approve this request.
          </p>
          <Link
            to={paths.inbox}
            className="mt-6 inline-block rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Back to Action Inbox
          </Link>
        </div>
      </PageScroll>
    );
  }

  const canAct = canUserTakeAction(user, request);
  const awaitingTurn =
    request.status === 'Pending' &&
    isUserAssignedToRequest(request, user.id) &&
    !getUserCompletedDecision(request, user.id) &&
    !canAct;
  const showActionBar = canAct || awaitingTurn;

  const openDialog = (next: DecisionType) => {
    setDecision(next);
    setDialogError(null);
    setDialogOpen(true);
  };

  const handleConfirm = (comment: string) => {
    if (!decision) return;
    setSubmitting(true);
    setDialogError(null);

    const result = processRequestDecision({
      requestId: request.id,
      actorUserId: user.id,
      decision,
      comment,
    });

    setSubmitting(false);

    if (!result.ok) {
      setDialogError(result.error);
      return;
    }

    setRequest(result.request);
    setDialogOpen(false);
    setDecision(null);
    setSuccessMessage(
      decision === 'approve'
        ? 'Decision recorded successfully.'
        : decision === 'reject'
          ? 'Request rejected.'
          : 'Request returned for revision.',
    );

    window.setTimeout(() => {
      navigate(paths.inbox);
    }, 900);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 lg:p-6">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Link
              to={paths.inbox}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900"
            >
              <ArrowLeft size={16} aria-hidden />
              Back to Action Inbox
            </Link>

            {showActionBar ? (
              <button
                type="button"
                disabled={!canAct || submitting}
                onClick={() => openDialog('return')}
                title={canAct ? undefined : explainWhyCannotAct(request, user)}
                className="rounded-md border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-900 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Return for Revision
              </button>
            ) : null}
          </div>

          <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm text-brand-600">
                  {request.requestNumber}
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-brand-900">
                  {getRequestDisplayTitle(request)}
                </h1>
              </div>
              <RequestStatusBadge status={request.status} />
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
                  Requester
                </dt>
                <dd className="mt-1 text-sm text-brand-900">{request.requesterName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
                  Group
                </dt>
                <dd className="mt-1 text-sm text-brand-900">
                  {request.requesterGroupName ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
                  Submitted
                </dt>
                <dd className="mt-1 text-sm text-brand-900">
                  {formatDateTime(request.submittedAt)}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {successMessage ? (
          <div
            className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
            role="status"
          >
            {successMessage}
          </div>
        ) : null}

        {!canAct && !successMessage ? (
          <div
            className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="status"
          >
            {explainWhyCannotAct(request, user)}
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <SubmittedFieldValues request={request} fields={fields} />
            <ActivityTimeline events={request.activity ?? []} />
          </div>

          <aside className="min-w-0 lg:col-span-1 lg:sticky lg:top-4">
            {request.workflowType === 'review_checking' ? (
              <ReviewerProgress reviewers={request.reviewers} />
            ) : (
              <ApprovalProgress steps={request.approvalSteps} />
            )}
          </aside>
        </div>
      </div>

      {showActionBar ? (
        <div className="shrink-0 border-t border-brand-100 bg-white px-4 py-3 lg:px-6">
          <ReviewActionPanel
            variant="footer"
            disabled={!canAct || submitting}
            onSelect={openDialog}
          />
        </div>
      ) : null}

      <DecisionConfirmationDialog
        open={dialogOpen}
        decision={decision}
        submitting={submitting}
        error={dialogError}
        onCancel={() => {
          if (!submitting) {
            setDialogOpen(false);
            setDecision(null);
            setDialogError(null);
          }
        }}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
