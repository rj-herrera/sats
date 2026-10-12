import { MOCK_REQUESTS, SEED_REQUEST_ID } from '@/data/mockRequests';
import type { CreateRequestInput, SubmittedRequest } from '@/types';
import {
  buildSubmittedActivity,
  normalizeRequest,
  withInitialReviewerStatuses,
  withInitialStepStatuses,
} from './requestNormalizer';

/**
 * Centralized mock request persistence (localStorage).
 * Replace with PHP API calls in a later phase.
 */

const STORAGE_KEY = 'sats.mock.requests';

function readRaw(): unknown[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function ensureSeeded(): SubmittedRequest[] {
  const existing = readRaw()
    .map((item) => normalizeRequest(item))
    .filter((r): r is SubmittedRequest => r !== null);

  if (existing.length > 0) {
    // Keep user-created data; only inject the demo seed if it was never added.
    if (existing.some((r) => r.id === SEED_REQUEST_ID)) {
      return existing;
    }
    const seeded = MOCK_REQUESTS.map((r) => normalizeRequest(r)).filter(
      (r): r is SubmittedRequest => r !== null,
    );
    const next = [...existing, ...seeded];
    writeAll(next);
    return next;
  }

  const seeded = MOCK_REQUESTS.map((r) => normalizeRequest(r)).filter(
    (r): r is SubmittedRequest => r !== null,
  );
  writeAll(seeded);
  return seeded;
}

function readAll(): SubmittedRequest[] {
  return ensureSeeded();
}

function writeAll(requests: SubmittedRequest[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nextRequestNumber(existing: SubmittedRequest[]): string {
  const year = new Date().getFullYear();
  const prefix = `SATS-${year}-`;
  let maxSeq = 0;

  for (const req of existing) {
    if (!req.requestNumber.startsWith(prefix)) continue;
    const seq = Number.parseInt(req.requestNumber.slice(prefix.length), 10);
    if (!Number.isNaN(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }

  const next = maxSeq + 1;
  return `${prefix}${String(next).padStart(6, '0')}`;
}

/** Temporary dev helper — removes all mock requests from localStorage. */
export function clearAllRequests(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function listRequests(): SubmittedRequest[] {
  return readAll().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function listRequestsByRequester(requesterId: string): SubmittedRequest[] {
  return listRequests().filter((r) => r.requesterId === requesterId);
}

export function getRequestById(id: string): SubmittedRequest | undefined {
  return readAll().find((r) => r.id === id);
}

export function createRequest(input: CreateRequestInput): SubmittedRequest {
  const existing = readAll();
  const submittedAt = new Date().toISOString();

  const request: SubmittedRequest = {
    id: createId(),
    requestNumber: nextRequestNumber(existing),
    templateId: input.templateId,
    templateName: input.templateName,
    workflowType: input.workflowType,
    requesterId: input.requesterId,
    requesterName: input.requesterName,
    requesterGroupId: input.requesterGroupId,
    requesterGroupName: input.requesterGroupName,
    submittedAt,
    lastResubmittedAt: null,
    fieldValues: input.fieldValues,
    fieldDefinitions: input.fieldDefinitions,
    attachments: input.attachments,
    reviewers: withInitialReviewerStatuses(input.reviewers),
    approvalSteps: withInitialStepStatuses(input.approvalSteps),
    status: 'Pending',
    revisionNumber: 1,
    revisions: [],
    cancelledAt: null,
    cancelledById: null,
    cancelledByName: null,
    cancellationReason: null,
    activity: [
      buildSubmittedActivity({
        requesterId: input.requesterId,
        requesterName: input.requesterName,
        submittedAt,
        revisionNumber: 1,
      }),
    ],
  };

  writeAll([...existing, request]);
  return request;
}

/**
 * Replace a single request record (read-validate-update-save).
 * Preserves unrelated requests. Does not silently create missing IDs.
 */
export function saveRequest(updated: SubmittedRequest): SubmittedRequest {
  const existing = readAll();
  const index = existing.findIndex((r) => r.id === updated.id);
  if (index < 0) {
    throw new Error(`Request not found: ${updated.id}`);
  }

  const normalized = normalizeRequest(updated);
  if (!normalized) {
    throw new Error('Updated request failed normalization.');
  }

  const next = [...existing];
  next[index] = normalized;
  writeAll(next);
  return normalized;
}
