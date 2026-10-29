import { MOCK_REQUESTS } from '@/data/mockRequests';
import { resolveMockUserId } from '@/data/mockUsers';
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

function remapRequestUserIds(request: SubmittedRequest): SubmittedRequest {
  let changed = false;
  const requesterId = resolveMockUserId(request.requesterId);
  if (requesterId !== request.requesterId) changed = true;

  const cancelledById = request.cancelledById
    ? resolveMockUserId(request.cancelledById)
    : request.cancelledById;
  if (cancelledById !== request.cancelledById) changed = true;

  const reviewers = request.reviewers?.map((r) => {
    const userId = resolveMockUserId(r.userId);
    if (userId === r.userId) return r;
    changed = true;
    return { ...r, userId };
  }) ?? request.reviewers;

  const approvalSteps = request.approvalSteps?.map((s) => {
    const userId = resolveMockUserId(s.userId);
    if (userId === s.userId) return s;
    changed = true;
    return { ...s, userId };
  }) ?? request.approvalSteps;

  const activity = request.activity?.map((e) => {
    const actorId = resolveMockUserId(e.actorId);
    if (actorId === e.actorId) return e;
    changed = true;
    return { ...e, actorId };
  });

  const revisions = request.revisions?.map((rev) => {
    let revChanged = false;
    const submittedById = resolveMockUserId(rev.submittedById);
    if (submittedById !== rev.submittedById) revChanged = true;
    const returnedById = rev.returnedById
      ? resolveMockUserId(rev.returnedById)
      : rev.returnedById;
    if (returnedById !== rev.returnedById) revChanged = true;
    const reviewersSnap = rev.reviewers?.map((r) => {
      const userId = resolveMockUserId(r.userId);
      if (userId === r.userId) return r;
      revChanged = true;
      return { ...r, userId };
    }) ?? rev.reviewers;
    const stepsSnap = rev.approvalSteps?.map((s) => {
      const userId = resolveMockUserId(s.userId);
      if (userId === s.userId) return s;
      revChanged = true;
      return { ...s, userId };
    }) ?? rev.approvalSteps;
    if (!revChanged) return rev;
    changed = true;
    return {
      ...rev,
      submittedById,
      returnedById,
      reviewers: reviewersSnap,
      approvalSteps: stepsSnap,
    };
  });

  if (!changed) return request;
  return {
    ...request,
    requesterId,
    cancelledById,
    reviewers: reviewers ?? null,
    approvalSteps: approvalSteps ?? null,
    activity,
    revisions,
  };
}

function normalizedSeeds(): SubmittedRequest[] {
  return MOCK_REQUESTS.map((r) => normalizeRequest(r)).filter(
    (r): r is SubmittedRequest => r !== null,
  );
}

/** Hydrate demo seed fields without wiping user workflow progress. */
function hydrateSeedRequest(
  request: SubmittedRequest,
  seedsById: Map<string, SubmittedRequest>,
): SubmittedRequest {
  const seed = seedsById.get(request.id);
  if (!seed) return request;

  let next: SubmittedRequest = request;

  // Refresh identity / group labels from current seed definitions.
  if (
    request.requesterId !== seed.requesterId ||
    request.requesterName !== seed.requesterName ||
    request.requesterGroupId !== seed.requesterGroupId ||
    request.requesterGroupName !== seed.requesterGroupName
  ) {
    next = {
      ...next,
      requesterId: seed.requesterId,
      requesterName: seed.requesterName,
      requesterGroupId: seed.requesterGroupId,
      requesterGroupName: seed.requesterGroupName,
    };
  }

  if (seed.reviewers && next.reviewers) {
    const seedReviewersById = new Map(seed.reviewers.map((r) => [r.userId, r]));
    const reviewers = next.reviewers.map((r) => {
      const seedReviewer = seedReviewersById.get(r.userId);
      if (
        !seedReviewer ||
        (r.name === seedReviewer.name && r.groupName === seedReviewer.groupName)
      ) {
        return r;
      }
      return {
        ...r,
        name: seedReviewer.name,
        groupName: seedReviewer.groupName,
      };
    });
    if (reviewers.some((r, i) => r !== next.reviewers![i])) {
      next = { ...next, reviewers };
    }
  }

  if (seed.approvalSteps && next.approvalSteps) {
    const seedStepsByKey = new Map(
      seed.approvalSteps.map((s) => [`${s.stepOrder}:${s.userId}`, s]),
    );
    const approvalSteps = next.approvalSteps.map((s) => {
      const seedStep = seedStepsByKey.get(`${s.stepOrder}:${s.userId}`);
      if (
        !seedStep ||
        (s.name === seedStep.name && s.groupName === seedStep.groupName)
      ) {
        return s;
      }
      return { ...s, name: seedStep.name, groupName: seedStep.groupName };
    });
    if (approvalSteps.some((s, i) => s !== next.approvalSteps![i])) {
      next = { ...next, approvalSteps };
    }
  }

  if (request.attachments.length === 0 && seed.attachments.length > 0) {
    next = { ...next, attachments: seed.attachments };
  }

  return next;
}

function ensureSeeded(): SubmittedRequest[] {
  const seeds = normalizedSeeds();
  const seedsById = new Map(seeds.map((r) => [r.id, r]));
  const existing = readRaw()
    .map((item) => normalizeRequest(item))
    .filter((r): r is SubmittedRequest => r !== null);

  if (existing.length > 0) {
    const remapped = existing.map((r) => remapRequestUserIds(r));
    const existingIds = new Set(remapped.map((r) => r.id));
    const missingSeeds = seeds.filter((r) => !existingIds.has(r.id));
    const hydrated = remapped.map((r) => hydrateSeedRequest(r, seedsById));
    const next = missingSeeds.length > 0 ? [...hydrated, ...missingSeeds] : hydrated;
    const changed =
      missingSeeds.length > 0 ||
      hydrated.some((req, index) => req !== existing[index]);
    if (changed) writeAll(next);
    return next;
  }

  writeAll(seeds);
  return seeds;
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

/** Temporary dev helper — removes mock requests from localStorage. Prefer resetAllMockData(). */
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
