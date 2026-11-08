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
import { usePermissions } from '@/hooks/usePermissions';
import {
  cancelSubmittedRequest,
  getRequest,
  removeRequestAttachment,
} from '@/services/requestApi';
import type { SubmittedRequest } from '@/types';
import { canUserViewRequest } from '@/utils/requestAccess';
import { canRequesterCancel, canRequesterEditResubmit } from '@/utils/requestOwnership';

export function RequestDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { canAccessInbox, inboxReady } = usePermissions();
  const location = useLocation();
  const locationState = location.state as { resubmitted?: boolean } | null;

  const [request, setRequest] = useState<SubmittedRequest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(
    locationState?.resubmitted ? 'Request resubmitted successfully.' : null,
  );

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
    if (locationState?.resubmitted) {
      setFlash('Request resubmitted successfully.');
    }
    return () => {
      cancelled = true;
    };
  }, [id, locationState?.resubmitted]);

  if (!loaded || !inboxReady) {
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
            to={paths.requests}
            className="mt-6 inline-block rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Back to My Requests
          </Link>
        </div>
      </PageScroll>
    );
  }

  if (user && user.id !== request.requesterId && canAccessInbox) {
    return <Navigate to={paths.inbox} replace />;
  }

  if (!canUserViewRequest(user, request)) {
    return <Navigate to={paths.requests} replace />;
  }

  const fields = request.fieldDefinitions ?? [];

  const activity = request.activity ?? [];
  const isOwner = user?.id === request.requesterId;
  const showCancel = canRequesterCancel(user, request);

  const handleConfirmCancel = (reason: string) => {
    if (!user || !request.rowVersion) return;
    setCancelling(true);
    setCancelError(null);
    void cancelSubmittedRequest(request.id, {
      reason: reason.trim() === '' ? null : reason,
      rowVersion: request.rowVersion,
    }).then((result) => {
      setCancelling(false);
      if (!result.ok) {
        setCancelError(result.error);
        return;
      }
      setRequest(result.data);
      setCancelOpen(false);
      setFlash('Request cancelled.');
    });
  };

  const openCancel = () => {
    setCancelError(null);
    setCancelOpen(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 bg-surface px-4 pt-4 pb-6 lg:px-6 lg:pt-6">
        <RequestDetailsHeader
          request={request}
          showBackToMyRequests={isOwner}
          showCancel={showCancel}
          onCancelClick={openCancel}
          variant="toolbar"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4 lg:px-6 lg:pb-6">
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
            <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <RequestDetailsHeader request={request} variant="summary" />
                <RequesterActions variant="inline" user={user} request={request} />
              </div>
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
                onRemoveAttachment={
                  canRequesterEditResubmit(user, request)
                    ? async (attachmentId) => {
                        if (!request.rowVersion) {
                          throw new Error('The file could not be removed.');
                        }
                        const result = await removeRequestAttachment(
                          request.id,
                          attachmentId,
                          request.rowVersion,
                        );
                        if (!result.ok) throw new Error(result.error);
                        setRequest(result.data);
                      }
                    : undefined
                }
              />
            </section>
            <ActivityTimeline events={activity} />
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
