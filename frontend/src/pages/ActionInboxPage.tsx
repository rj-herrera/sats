import { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { AssignedRequestList } from '@/components/request/AssignedRequestList';
import { useAuth } from '@/contexts/AuthContext';
import { PageScroll } from '@/layouts/PageScroll';
import { paths } from '@/routes/paths';
import {
  canAccessActionInbox,
  listCompletedInboxItems,
  listPendingInboxItems,
} from '@/services/inboxService';
import { REQUEST_STATUSES, type RequestStatus } from '@/types';
import { getRequestDisplayTitle } from '@/utils/requestTitle';

type InboxTab = 'pending' | 'completed';

export function ActionInboxPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<InboxTab>('pending');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');

  const pending = useMemo(() => {
    if (!user) return [];
    return listPendingInboxItems(user.id);
  }, [user, location.key]);

  const completed = useMemo(() => {
    if (!user) return [];
    return listCompletedInboxItems(user.id);
  }, [user, location.key]);

  if (!user) return null;

  if (!canAccessActionInbox(user)) {
    return <Navigate to={paths.requests} replace />;
  }

  const q = search.trim().toLowerCase();

  const filteredPending = pending.filter(({ request }) => {
    if (statusFilter !== 'all' && request.status !== statusFilter) return false;
    if (!q) return true;
    const haystack = [
      request.requestNumber,
      getRequestDisplayTitle(request),
      request.templateName,
      request.requesterName,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const filteredCompleted = completed.filter((item) => {
    if (statusFilter !== 'all' && item.request.status !== statusFilter) return false;
    if (!q) return true;
    const haystack = [
      item.request.requestNumber,
      getRequestDisplayTitle(item.request),
      item.request.templateName,
      item.request.requesterName,
      item.decision,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const activeItems = tab === 'pending' ? filteredPending : filteredCompleted;
  const sourceCount = tab === 'pending' ? pending.length : completed.length;

  return (
    <PageScroll>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">Action Inbox</h1>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-brand-100">
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={[
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === 'pending'
                ? 'border-brand-800 text-brand-900'
                : 'border-transparent text-brand-500 hover:text-brand-800',
            ].join(' ')}
          >
            Assigned to Me
            <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">
              {pending.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('completed')}
            className={[
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === 'completed'
                ? 'border-brand-800 text-brand-900'
                : 'border-transparent text-brand-500 hover:text-brand-800',
            ].join(' ')}
          >
            Completed Actions
          </button>
        </div>

        <section className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-brand-600">Search</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Number, title, template, or requester…"
                className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-600">Status</span>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as RequestStatus | 'all')
                }
                className="w-full rounded-md border border-brand-200 py-2 pr-10 pl-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="all">All statuses</option>
                {REQUEST_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {sourceCount === 0 ? (
          <div className="rounded-lg border border-dashed border-brand-200 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Inbox size={22} aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-brand-900">
              {tab === 'pending' ? 'No assigned requests' : 'No completed actions yet'}
            </h2>
          </div>
        ) : activeItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-brand-900">No matching results</h2>
            <p className="mt-2 text-sm text-brand-600">
              Try adjusting your search or status filter.
            </p>
            <button
              type="button"
              className="mt-4 text-sm font-medium text-brand-800 hover:underline"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
            >
              Clear filters
            </button>
          </div>
        ) : tab === 'pending' ? (
          <AssignedRequestList mode="pending" items={filteredPending} />
        ) : (
          <AssignedRequestList mode="completed" items={filteredCompleted} />
        )}
      </div>
    </PageScroll>
  );
}
