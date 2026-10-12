import { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { RequestFilters } from '@/components/request/RequestFilters';
import { RequestList } from '@/components/request/RequestList';
import { useAuth } from '@/contexts/AuthContext';
import { PageScroll } from '@/layouts/PageScroll';
import { listRequestsByRequester } from '@/services/requestRepository';
import {
  EMPTY_REQUEST_FILTERS,
  filterRequests,
  hasActiveFilters,
  type RequestListFilters,
} from '@/utils/requestFilters';

export function MyRequestsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [filters, setFilters] = useState<RequestListFilters>(EMPTY_REQUEST_FILTERS);

  // Re-read localStorage when navigating back to this page
  const myRequests = useMemo(() => {
    if (!user) return [];
    return listRequestsByRequester(user.id);
  }, [user, location.key]);

  const filtered = useMemo(
    () => filterRequests(myRequests, filters),
    [myRequests, filters],
  );

  const filtersActive = hasActiveFilters(filters);

  if (!user) return null;

  return (
    <PageScroll>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">My Requests</h1>
          <p className="mt-1 text-sm text-brand-600">
            Requests you have submitted. Showing {filtered.length}
            {filtersActive ? ` of ${myRequests.length}` : ''} request
            {filtered.length === 1 ? '' : 's'}.
          </p>
        </div>

        {myRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-brand-200 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Inbox size={22} aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-brand-900">No requests yet</h2>
          </div>
        ) : (
          <>
            <RequestFilters
              filters={filters}
              onChange={setFilters}
              onClear={() => setFilters(EMPTY_REQUEST_FILTERS)}
              showClear={filtersActive}
            />

            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
                <h2 className="text-lg font-semibold text-brand-900">No matching results</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-brand-600">
                  No requests match your current search or filters. Try adjusting your
                  criteria.
                </p>
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_REQUEST_FILTERS)}
                  className="mt-5 rounded-md border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <RequestList requests={filtered} />
            )}
          </>
        )}
      </div>
    </PageScroll>
  );
}
