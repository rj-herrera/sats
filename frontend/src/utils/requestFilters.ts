import type { RequestStatus, SubmittedRequest } from '@/types';
import { getRequestDisplayTitle } from './requestTitle';

export interface RequestListFilters {
  search: string;
  status: RequestStatus | 'all';
  templateId: string;
}

export interface TemplateFilterOption {
  id: string;
  name: string;
}

export const EMPTY_REQUEST_FILTERS: RequestListFilters = {
  search: '',
  status: 'all',
  templateId: 'all',
};

export function hasActiveFilters(filters: RequestListFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.templateId !== 'all'
  );
}

export function templateFilterOptions(
  requests: Array<Pick<SubmittedRequest, 'templateId' | 'templateName'>>,
): TemplateFilterOption[] {
  const byId = new Map<string, string>();
  for (const request of requests) {
    if (!request.templateId || byId.has(request.templateId)) continue;
    byId.set(request.templateId, request.templateName.trim() || 'Unknown template');
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
    if (filters.templateId !== 'all' && request.templateId !== filters.templateId) {
      return false;
    }

    if (!q) return true;

    const title = getRequestDisplayTitle(request, undefined, {
      includeTemplateFallback: false,
    }).toLowerCase();
    const haystack = [request.requestNumber, title].join(' ').toLowerCase();

    return haystack.includes(q);
  });
}
