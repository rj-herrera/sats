import { useEffect, useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { RequestFilters } from '@/components/request/RequestFilters';
import { RequestList } from '@/components/request/RequestList';
import { useAuth } from '@/contexts/AuthContext';
import { PageScroll } from '@/layouts/PageScroll';
import { listMyRequests } from '@/services/requestApi';
import type { SubmittedRequest } from '@/types';
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
  const [myRequests, setMyRequests] = useState<SubmittedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    void listMyRequests().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setMyRequests([]);
        setLoadError(result.error);
        setLoading(false);
        return;
      }
      setMyRequests(result.data);
      setLoadError(null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
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
          <h1 className="text-xl font-semibold text-brand-900">My Requests</h1>
          <p className="mt-1 text-sm text-brand-600">
            Showing {filtered.length}
            {filtersActive ? ` of ${myRequests.length}` : ''} request
            {filtered.length === 1 ? '' : 's'}.
          </p>
        </div>

        {loadError ? (
          <p className="text-sm text-red-600" role="alert">
            {loadError}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-brand-600">Loading requests…</p>
        ) : myRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-brand-200 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Inbox size={22} aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-brand-900">No requests yet</h2>
          </div>
        ) : (
          <section className="overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm">
            <RequestFilters
              filters={filters}
              onChange={setFilters}
              onClear={() => setFilters(EMPTY_REQUEST_FILTERS)}
              showClear={filtersActive}
            />

            {filtered.length === 0 ? (
              <div className="border-t border-brand-100 px-6 py-12 text-center">
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
          </section>
        )}
      </div>
    </PageScroll>
  );
}
