import { apiGet, apiPost, apiPostForm, messageFromApi } from '@/services/apiClient';
import type { InboxCompletedItem, InboxPendingItem } from '@/services/inboxService';
import type { FieldValue, SubmittedRequest } from '@/types';

const REQUEST_STATUSES = new Set([
  'Pending',
  'Approved',
  'Rejected',
  'Returned',
  'Cancelled',
]);

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: string };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export interface CreateRequestBody {
  templateId: string;
  fieldValues: Record<string, FieldValue>;
  reviewerIds?: string[];
}

function parseRequest(value: unknown): SubmittedRequest | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || row.id === '') return null;
  if (typeof row.requestNumber !== 'string' || row.requestNumber === '') return null;
  if (typeof row.status !== 'string' || !REQUEST_STATUSES.has(row.status)) return null;
  if (typeof row.rowVersion !== 'number' || row.rowVersion < 1) return null;
  return value as SubmittedRequest;
}

function parseRequestList(body: unknown): SubmittedRequest[] | null {
  if (!Array.isArray(body)) return null;
  const requests: SubmittedRequest[] = [];
  for (const item of body) {
    const request = parseRequest(item);
    if (!request) return null;
    requests.push(request);
  }
  return requests;
}

async function requestList(path: string, fallback: string): Promise<ApiResult<SubmittedRequest[]>> {
  const response = await apiGet(path);
  if (response.status !== 200) {
    return { ok: false, error: messageFromApi(response.status, response.body, fallback) };
  }
  const requests = parseRequestList(response.body);
  if (!requests) return { ok: false, error: fallback };
  return { ok: true, data: requests };
}

export function listMyRequests(): Promise<ApiResult<SubmittedRequest[]>> {
  return requestList('/requests?view=mine', 'Your requests could not be loaded.');
}

export async function listInbox(): Promise<ApiResult<InboxPendingItem[]>> {
  const response = await apiGet('/requests?view=inbox');
  if (response.status !== 200) {
    return {
      ok: false,
      error: messageFromApi(response.status, response.body, 'The inbox could not be loaded.'),
    };
  }
  if (!Array.isArray(response.body)) {
    return { ok: false, error: 'The inbox could not be loaded.' };
  }
  const items: InboxPendingItem[] = [];
  for (const item of response.body) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'The inbox could not be loaded.' };
    }
    const row = item as { request?: unknown; canAct?: unknown };
    const request = parseRequest(row.request);
    if (!request || typeof row.canAct !== 'boolean') {
      return { ok: false, error: 'The inbox could not be loaded.' };
    }
    items.push({ request, canAct: row.canAct });
  }
  return { ok: true, data: items };
}

export async function listCompletedInbox(): Promise<ApiResult<InboxCompletedItem[]>> {
  const response = await apiGet('/requests?view=completed');
  if (response.status !== 200) {
    return {
      ok: false,
      error: messageFromApi(response.status, response.body, 'Completed actions could not be loaded.'),
    };
  }
  if (!Array.isArray(response.body)) {
    return { ok: false, error: 'Completed actions could not be loaded.' };
  }
  const items: InboxCompletedItem[] = [];
  for (const item of response.body) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Completed actions could not be loaded.' };
    }
    const row = item as {
      request?: unknown;
      decision?: unknown;
      actionAt?: unknown;
      comments?: unknown;
      revisionNumber?: unknown;
    };
    const request = parseRequest(row.request);
    if (!request || typeof row.decision !== 'string' || typeof row.revisionNumber !== 'number') {
      return { ok: false, error: 'Completed actions could not be loaded.' };
    }
    items.push({
      request,
      decision: row.decision,
      actionAt: typeof row.actionAt === 'string' ? row.actionAt : null,
      comments: typeof row.comments === 'string' ? row.comments : null,
      revisionNumber: row.revisionNumber,
    });
  }
  return { ok: true, data: items };
}

export async function getRequest(id: string): Promise<ApiResult<SubmittedRequest | null>> {
  if (!/^\d+$/.test(id)) return { ok: true, data: null };
  const response = await apiGet(`/requests/${id}`);
  if (response.status === 404) return { ok: true, data: null };
  if (response.status !== 200) {
    return { ok: false, error: messageFromApi(response.status, response.body, 'The request could not be loaded.') };
  }
  const request = parseRequest(response.body);
  if (!request) return { ok: false, error: 'The request could not be loaded.' };
  return { ok: true, data: request };
}

async function mutate(
  path: string,
  body: unknown,
  fallback: string,
): Promise<ApiResult<SubmittedRequest>> {
  const response = await apiPost(path, body);
  if (response.status !== 200 && response.status !== 201) {
    return { ok: false, error: messageFromApi(response.status, response.body, fallback) };
  }
  const request = parseRequest(response.body);
  if (!request) return { ok: false, error: fallback };
  return { ok: true, data: request };
}

function hasSelectedFiles(files: Record<string, File[]>): boolean {
  return Object.values(files).some((selected) => selected.length > 0);
}

function formDataFor(payload: unknown, files: Record<string, File[]>): FormData {
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  for (const [fieldId, selected] of Object.entries(files)) {
    for (const file of selected) {
      form.append(`files[${fieldId}][]`, file, file.name);
    }
  }
  return form;
}

async function mutateForm(
  path: string,
  payload: unknown,
  files: Record<string, File[]>,
  fallback: string,
): Promise<ApiResult<SubmittedRequest>> {
  const response = await apiPostForm(path, formDataFor(payload, files));
  if (response.status !== 200 && response.status !== 201) {
    return { ok: false, error: messageFromApi(response.status, response.body, fallback) };
  }
  const request = parseRequest(response.body);
  if (!request) return { ok: false, error: fallback };
  return { ok: true, data: request };
}

export function createSubmittedRequest(
  body: CreateRequestBody,
  files: Record<string, File[]> = {},
): Promise<ApiResult<SubmittedRequest>> {
  if (!hasSelectedFiles(files)) {
    return mutate('/requests', body, 'The request could not be submitted.');
  }
  return mutateForm('/requests', body, files, 'The request could not be submitted.');
}

export function submitDecision(
  id: string,
  body: { decision: string; comment: string; rowVersion: number },
): Promise<ApiResult<SubmittedRequest>> {
  return mutate(`/requests/${id}/decisions`, body, 'The decision could not be saved.');
}

export function resubmitSubmittedRequest(
  id: string,
  body: {
    fieldValues: Record<string, FieldValue>;
    rowVersion: number;
    keptAttachmentIds?: string[];
  },
  files: Record<string, File[]> = {},
): Promise<ApiResult<SubmittedRequest>> {
  if (!hasSelectedFiles(files)) {
    return mutate(`/requests/${id}/resubmit`, body, 'The request could not be resubmitted.');
  }
  return mutateForm(
    `/requests/${id}/resubmit`,
    body,
    files,
    'The request could not be resubmitted.',
  );
}

export function cancelSubmittedRequest(
  id: string,
  body: { reason: string | null; rowVersion: number },
): Promise<ApiResult<SubmittedRequest>> {
  return mutate(`/requests/${id}/cancel`, body, 'The request could not be cancelled.');
}
