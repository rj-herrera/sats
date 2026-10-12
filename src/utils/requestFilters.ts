import type { RequestStatus, SubmittedRequest } from '@/types';
import { getRequestDisplayTitle } from './requestTitle';

export interface RequestListFilters {
  search: string;
  status: RequestStatus | 'all';
}

export const EMPTY_REQUEST_FILTERS: RequestListFilters = {
  search: '',
  status: 'all',
};

export function hasActiveFilters(filters: RequestListFilters): boolean {
  return filters.search.trim() !== '' || filters.status !== 'all';
}

export function filterRequests(
  requests: SubmittedRequest[],
  filters: RequestListFilters,
): SubmittedRequest[] {
  const q = filters.search.trim().toLowerCase();

  return requests.filter((request) => {
    if (filters.status !== 'all' && request.status !== filters.status) {
      return false;
    }

    if (!q) return true;

    const title = getRequestDisplayTitle(request).toLowerCase();
    const haystack = [request.requestNumber, title, request.templateName]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}
