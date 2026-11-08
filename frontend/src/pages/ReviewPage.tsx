import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ActivityTimeline } from '@/components/request/ActivityTimeline';
import { ApprovalProgress } from '@/components/request/ApprovalProgress';
import { DecisionConfirmationDialog } from '@/components/request/DecisionConfirmationDialog';
import { RequestDetailsHeader } from '@/components/request/RequestDetailsHeader';
import { ReviewActionPanel } from '@/components/request/ReviewActionPanel';
import { ReviewerProgress } from '@/components/request/ReviewerProgress';
import { RevisionHistory } from '@/components/request/RevisionHistory';
import { SubmittedFieldValues } from '@/components/request/SubmittedFieldValues';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { PageScroll } from '@/layouts/PageScroll';
import { paths } from '@/routes/paths';
import { getRequest, submitDecision } from '@/services/requestApi';
import type { DecisionType, SubmittedRequest } from '@/types';
import {
  explainWhyCannotAct,
  getUserCompletedDecision,
  isUserAssignedToRequest,
} from '@/utils/assignmentHelpers';
import { canUserOpenReview, canUserTakeAction } from '@/utils/requestAccess';

export function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [request, setRequest] = useState<SubmittedRequest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decision, setDecision] = useState<DecisionType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  useEffect(() => {
    setDialogOpen(false);
    setDecision(null);
    setDialogError(null);
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

  const fields = useMemo(() => request?.fieldDefinitions ?? [], [request]);

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
          <p className="mt-2 text-sm text-brand-600">
            {loadError ?? 'This request does not exist or is no longer available.'}
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
    return <Navigate to={paths.requests} replace />;
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
    if (!decision || !request.rowVersion) return;
    setSubmitting(true);
    setDialogError(null);

    void submitDecision(request.id, {
      decision,
      comment,
      rowVersion: request.rowVersion,
    }).then((result) => {
      setSubmitting(false);
      if (!result.ok) {
        setDialogError(result.error);
        return;
      }

      setRequest(result.data);
      setDialogOpen(false);
      setDecision(null);
      showToast(
        decision === 'approve'
          ? {
              tone: 'success',
              title: 'Request approved',
              description: 'The request has been approved.',
            }
          : decision === 'reject'
            ? {
                tone: 'error',
                title: 'Request rejected',
                description: 'The request has been rejected.',
              }
            : {
                tone: 'info',
                title: 'Request returned',
                description: 'The request was returned for revision.',
              },
      );
      navigate(paths.inbox);
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 bg-surface px-4 pt-4 pb-6 lg:px-6 lg:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4 lg:px-6 lg:pb-6">
        {!canAct ? (
          <div
            className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="status"
          >
            {explainWhyCannotAct(request, user)}
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
              <RequestDetailsHeader request={request} variant="summary" />
              <SubmittedFieldValues
                request={request}
                fields={fields}
                embedded
                layout="sheet"
                details={{
                  requesterName: request.requesterName,
                  groupName: request.requesterGroupName,
                  submittedAt: request.submittedAt,
                  revisionLabel:
                    request.revisionNumber > 1 || request.lastResubmittedAt
                      ? `Revision ${request.revisionNumber}`
                      : null,
                  revisionDate:
                    request.revisionNumber > 1 ? request.lastResubmittedAt : null,
                }}
              />
            </section>
            <ActivityTimeline events={request.activity ?? []} />
          </div>

          <div className="min-w-0 space-y-6 lg:col-span-1">
            {request.workflowType === 'review_checking' ? (
              <ReviewerProgress reviewers={request.reviewers} />
            ) : (
              <ApprovalProgress steps={request.approvalSteps} />
            )}
            <RevisionHistory request={request} />
          </div>
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
