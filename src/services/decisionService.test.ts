import { beforeEach, describe, expect, it } from 'vitest';
import { MOCK_GROUPS, MOCK_USERS } from '@/data/mockUsers';
import { processRequestDecision } from '@/services/decisionService';
import type { SubmittedRequest } from '@/types';

const REQUESTS_KEY = 'sats.mock.requests';
const USERS_KEY = 'sats.mock.users';
const GROUPS_KEY = 'sats.mock.groups';

function seedDirectory(): void {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(MOCK_GROUPS));
  localStorage.setItem(USERS_KEY, JSON.stringify(MOCK_USERS));
}

function saveRequest(request: SubmittedRequest): void {
  localStorage.setItem(REQUESTS_KEY, JSON.stringify([request]));
}

function reviewRequest(): SubmittedRequest {
  return {
    id: 'req-review-1',
    requestNumber: 'SATS-2026-000010',
    templateId: 'tpl-review',
    templateName: 'Review Form',
    workflowType: 'review_checking',
    requesterId: 'usr-ana',
    requesterName: 'Mock Employee',
    requesterGroupId: 'grp-analysis',
    requesterGroupName: 'Analysis Group',
    submittedAt: '2026-03-01T00:00:00.000Z',
    lastResubmittedAt: null,
    fieldValues: { title: 'Need review' },
    fieldDefinitions: [
      {
        id: 'title',
        label: 'Title',
        type: 'text',
        required: true,
      },
    ],
    attachments: [],
    reviewers: [
      {
        userId: 'usr-carlo',
        name: 'Mock Employee 2',
        role: 'employee',
        groupName: 'Piping Group',
        status: 'Pending',
        comments: null,
        actionAt: null,
      },
      {
        userId: 'usr-edmon',
        name: 'Mock Approver',
        role: 'approver',
        groupName: 'System Group',
        status: 'Pending',
        comments: null,
        actionAt: null,
      },
    ],
    approvalSteps: null,
    status: 'Pending',
    revisionNumber: 1,
    revisions: [],
    cancelledAt: null,
    cancelledById: null,
    cancelledByName: null,
    cancellationReason: null,
    activity: [],
  };
}

function hierarchyRequest(): SubmittedRequest {
  return {
    ...reviewRequest(),
    id: 'req-hier-1',
    requestNumber: 'SATS-2026-000011',
    workflowType: 'hierarchy_approval',
    reviewers: null,
    approvalSteps: [
      {
        stepOrder: 1,
        userId: 'usr-edmon',
        name: 'Mock Approver',
        roleLabel: 'Approver',
        groupName: 'System Group',
        status: 'Pending',
        comments: null,
        actionAt: null,
      },
      {
        stepOrder: 2,
        userId: 'usr-tagi',
        name: 'Mock Approver 2',
        roleLabel: 'Approver',
        groupName: 'System Group',
        status: 'Waiting',
        comments: null,
        actionAt: null,
      },
    ],
  };
}

describe('processRequestDecision — review_checking', () => {
  beforeEach(() => {
    seedDirectory();
  });

  it('keeps Pending until all reviewers approve', () => {
    saveRequest(reviewRequest());
    const first = processRequestDecision({
      requestId: 'req-review-1',
      actorUserId: 'usr-carlo',
      decision: 'approve',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.request.status).toBe('Pending');

    const second = processRequestDecision({
      requestId: 'req-review-1',
      actorUserId: 'usr-edmon',
      decision: 'approve',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.request.status).toBe('Approved');
  });

  it('rejects the whole request on any rejection', () => {
    saveRequest(reviewRequest());
    const result = processRequestDecision({
      requestId: 'req-review-1',
      actorUserId: 'usr-carlo',
      decision: 'reject',
      comment: 'Incomplete',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.status).toBe('Rejected');
  });

  it('returns the request and blocks further actions', () => {
    saveRequest(reviewRequest());
    const returned = processRequestDecision({
      requestId: 'req-review-1',
      actorUserId: 'usr-carlo',
      decision: 'return',
      comment: 'Please revise',
    });
    expect(returned.ok).toBe(true);
    if (!returned.ok) return;
    expect(returned.request.status).toBe('Returned');

    const blocked = processRequestDecision({
      requestId: 'req-review-1',
      actorUserId: 'usr-edmon',
      decision: 'approve',
    });
    expect(blocked.ok).toBe(false);
  });

  it('requires a comment for reject/return', () => {
    saveRequest(reviewRequest());
    const result = processRequestDecision({
      requestId: 'req-review-1',
      actorUserId: 'usr-carlo',
      decision: 'reject',
      comment: '',
    });
    expect(result.ok).toBe(false);
  });
});

describe('processRequestDecision — hierarchy_approval', () => {
  beforeEach(() => {
    seedDirectory();
  });

  it('blocks later steps until the current Pending step acts', () => {
    saveRequest(hierarchyRequest());
    const blocked = processRequestDecision({
      requestId: 'req-hier-1',
      actorUserId: 'usr-tagi',
      decision: 'approve',
    });
    expect(blocked.ok).toBe(false);

    const step1 = processRequestDecision({
      requestId: 'req-hier-1',
      actorUserId: 'usr-edmon',
      decision: 'approve',
    });
    expect(step1.ok).toBe(true);
    if (!step1.ok) return;
    expect(step1.request.status).toBe('Pending');
    expect(step1.request.approvalSteps?.[1].status).toBe('Pending');

    const step2 = processRequestDecision({
      requestId: 'req-hier-1',
      actorUserId: 'usr-tagi',
      decision: 'approve',
    });
    expect(step2.ok).toBe(true);
    if (!step2.ok) return;
    expect(step2.request.status).toBe('Approved');
  });

  it('stops the chain on return', () => {
    saveRequest(hierarchyRequest());
    const result = processRequestDecision({
      requestId: 'req-hier-1',
      actorUserId: 'usr-edmon',
      decision: 'return',
      comment: 'Fix amounts',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.status).toBe('Returned');

    const blocked = processRequestDecision({
      requestId: 'req-hier-1',
      actorUserId: 'usr-tagi',
      decision: 'approve',
    });
    expect(blocked.ok).toBe(false);
  });
});
