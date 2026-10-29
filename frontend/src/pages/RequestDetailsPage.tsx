import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { ActivityTimeline } from '@/components/request/ActivityTimeline';
import { ApprovalProgress } from '@/components/request/ApprovalProgress';
import { CancelRequestDialog } from '@/components/request/CancelRequestDialog';
import { RequestDetailsHeader } from '@/components/request/RequestDetailsHeader';
import { RequesterActions } from '@/components/request/RequesterActions';
import { ReviewerProgress } from '@/components/request/ReviewerProgress';
import { RevisionHistory } from '@/components/request/RevisionHistory';
import { SubmittedFieldValues } from '@/components/request/SubmittedFieldValues';
import { useAuth } from '@/contexts/AuthContext';
import { PageScroll } from '@/layouts/PageScroll';
import { paths } from '@/routes/paths';
import { canAccessActionInbox } from '@/services/inboxService';
import { cancelRequest } from '@/services/requestLifecycleService';
import { getRequestById } from '@/services/requestRepository';
import { getTemplateById } from '@/services/templateService';
import type { SubmittedRequest } from '@/types';
import { canUserViewRequest } from '@/utils/requestAccess';
import { canRequesterCancel } from '@/utils/requestOwnership';

export function RequestDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const location = useLocation();
  const locationState = location.state as { resubmitted?: boolean } | null;

  const [request, setRequest] = useState<SubmittedRequest | undefined>(() =>
    id ? getRequestById(id) : undefined,
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(
    locationState?.resubmitted ? 'Request resubmitted successfully.' : null,
  );

  useEffect(() => {
    setRequest(id ? getRequestById(id) : undefined);
    if (locationState?.resubmitted) {
      setFlash('Request resubmitted successfully.');
    }
  }, [id, locationState?.resubmitted]);

  if (!request) {
    return (
      <PageScroll>
        <div className="mx-auto max-w-lg rounded-lg border border-brand-100 bg-white px-6 py-12 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-brand-900">Request not found</h1>
          <p className="mt-2 text-sm text-brand-600">
            This request does not exist or is no longer available.
          </p>
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

  if (user && user.id !== request.requesterId && canAccessActionInbox(user)) {
    return <Navigate to={paths.inbox} replace />;
  }

  if (!canUserViewRequest(user, request)) {
    return <Navigate to={paths.requests} replace />;
  }

  const fields =
    request.fieldDefinitions && request.fieldDefinitions.length > 0
      ? request.fieldDefinitions
      : (getTemplateById(request.templateId)?.fields ?? []);

  const activity = request.activity ?? [];
  const isOwner = user?.id === request.requesterId;
  const isReturned = request.status === 'Returned';
  const showCancel = canRequesterCancel(user, request);
  const showFooterActions = isOwner && isReturned;

  const handleConfirmCancel = (reason: string) => {
    if (!user) return;
    setCancelling(true);
    setCancelError(null);
    const result = cancelRequest({
      requestId: request.id,
      actorUserId: user.id,
      reason,
    });
    setCancelling(false);
    if (!result.ok) {
      setCancelError(result.error);
      return;
    }
    setRequest(result.request);
    setCancelOpen(false);
    setFlash('Request cancelled.');
  };

  const openCancel = () => {
    setCancelError(null);
    setCancelOpen(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 lg:p-6">
        <RequestDetailsHeader
          request={request}
          showBackToMyRequests={isOwner}
          showCancel={showCancel}
          onCancelClick={openCancel}
        />

        {flash ? (
          <div
            className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
            role="status"
          >
            {flash}
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <SubmittedFieldValues request={request} fields={fields} />
            <RevisionHistory request={request} />
            <ActivityTimeline events={activity} />
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

      {showFooterActions ? (
        <div className="shrink-0 border-t border-brand-100 bg-white px-4 py-3 lg:px-6">
          <RequesterActions variant="footer" user={user} request={request} />
        </div>
      ) : null}

      <CancelRequestDialog
        open={cancelOpen}
        submitting={cancelling}
        error={cancelError}
        requestNumber={request.requestNumber}
        onCancel={() => {
          if (!cancelling) {
            setCancelOpen(false);
            setCancelError(null);
          }
        }}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
