import { beforeEach, describe, expect, it } from 'vitest';
import { MOCK_GROUPS, MOCK_USERS } from '@/data/mockUsers';
import {
  cancelRequest,
  resubmitRequest,
} from '@/services/requestLifecycleService';
import type { SubmittedRequest } from '@/types';

const REQUESTS_KEY = 'sats.mock.requests';
const USERS_KEY = 'sats.mock.users';
const GROUPS_KEY = 'sats.mock.groups';

function seedDirectory(): void {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(MOCK_GROUPS));
  localStorage.setItem(USERS_KEY, JSON.stringify(MOCK_USERS));
}

function returnedRequest(): SubmittedRequest {
  return {
    id: 'req-life-1',
    requestNumber: 'SATS-2026-000020',
    templateId: 'tpl-1',
    templateName: 'Form',
    workflowType: 'hierarchy_approval',
    requesterId: 'usr-ana',
    requesterName: 'Mock Employee',
    requesterGroupId: 'grp-analysis',
    requesterGroupName: 'Analysis Group',
    submittedAt: '2026-03-01T00:00:00.000Z',
    lastResubmittedAt: null,
    fieldValues: { title: 'Original' },
    fieldDefinitions: [
      {
        id: 'title',
        label: 'Title',
        type: 'text',
        required: true,
      },
    ],
    attachments: [],
    reviewers: null,
    approvalSteps: [
      {
        stepOrder: 1,
        userId: 'usr-edmon',
        name: 'Mock Approver',
        roleLabel: 'Approver',
        groupName: 'System Group',
        status: 'Returned',
        comments: 'Please revise',
        actionAt: '2026-03-02T00:00:00.000Z',
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
    status: 'Returned',
    revisionNumber: 1,
    revisions: [],
    cancelledAt: null,
    cancelledById: null,
    cancelledByName: null,
    cancellationReason: null,
    activity: [
      {
        id: 'evt-1',
        type: 'request_returned',
        timestamp: '2026-03-02T00:00:00.000Z',
        actorId: 'usr-edmon',
        actorName: 'Mock Approver',
        description: 'Returned',
        comment: 'Please revise',
        relatedStepKey: 'step:1',
        revisionNumber: 1,
      },
    ],
  };
}

describe('requestLifecycleService', () => {
  beforeEach(() => {
    seedDirectory();
  });

  it('resubmits Returned requests, archives revision, and restarts hierarchy', () => {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify([returnedRequest()]));

    const result = resubmitRequest({
      requestId: 'req-life-1',
      actorUserId: 'usr-ana',
      fieldValues: { title: 'Revised title' },
      attachments: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.status).toBe('Pending');
    expect(result.request.revisionNumber).toBe(2);
    expect(result.request.revisions).toHaveLength(1);
    expect(result.request.revisions[0].outcome).toBe('Returned');
    expect(result.request.approvalSteps?.[0].status).toBe('Pending');
    expect(result.request.approvalSteps?.[1].status).toBe('Waiting');
    expect(result.request.requestNumber).toBe('SATS-2026-000020');
  });

  it('rejects resubmit with missing required fields', () => {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify([returnedRequest()]));
    const result = resubmitRequest({
      requestId: 'req-life-1',
      actorUserId: 'usr-ana',
      fieldValues: { title: '' },
      attachments: [],
    });
    expect(result.ok).toBe(false);
  });

  it('cancels Pending/Returned and archives the open revision', () => {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify([returnedRequest()]));
    const result = cancelRequest({
      requestId: 'req-life-1',
      actorUserId: 'usr-ana',
      reason: 'No longer needed',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.status).toBe('Cancelled');
    expect(result.request.revisions).toHaveLength(1);
    expect(result.request.revisions[0].outcome).toBe('Cancelled');
    expect(result.request.cancellationReason).toBe('No longer needed');
  });

  it('blocks non-owners from cancelling', () => {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify([returnedRequest()]));
    const result = cancelRequest({
      requestId: 'req-life-1',
      actorUserId: 'usr-carlo',
    });
    expect(result.ok).toBe(false);
  });
});
