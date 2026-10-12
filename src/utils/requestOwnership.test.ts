import { describe, expect, it } from 'vitest';
import { MOCK_USERS } from '@/data/mockUsers';
import {
  canRequesterCancel,
  canRequesterEditResubmit,
  isRequestOwner,
} from '@/utils/requestOwnership';
import type { SubmittedRequest, User } from '@/types';

const ana = MOCK_USERS.find((u) => u.id === 'usr-ana')!;
const carlo = MOCK_USERS.find((u) => u.id === 'usr-carlo')!;

function baseRequest(overrides: Partial<SubmittedRequest> = {}): SubmittedRequest {
  return {
    id: 'req-1',
    requestNumber: 'SATS-2026-000001',
    templateId: 'tpl-1',
    templateName: 'Test',
    workflowType: 'review_checking',
    requesterId: ana.id,
    requesterName: ana.name,
    requesterGroupId: ana.groupId,
    requesterGroupName: ana.groupName,
    submittedAt: '2026-01-02T00:00:00.000Z',
    lastResubmittedAt: null,
    fieldValues: {},
    fieldDefinitions: [],
    attachments: [],
    reviewers: null,
    approvalSteps: null,
    status: 'Pending',
    revisionNumber: 1,
    revisions: [],
    cancelledAt: null,
    cancelledById: null,
    cancelledByName: null,
    cancellationReason: null,
    activity: [],
    ...overrides,
  };
}

describe('requestOwnership', () => {
  it('identifies the requester', () => {
    const request = baseRequest();
    expect(isRequestOwner(ana, request)).toBe(true);
    expect(isRequestOwner(carlo, request)).toBe(false);
  });

  it('allows edit/resubmit only when Returned and owner', () => {
    expect(canRequesterEditResubmit(ana, baseRequest({ status: 'Returned' }))).toBe(
      true,
    );
    expect(canRequesterEditResubmit(ana, baseRequest({ status: 'Pending' }))).toBe(
      false,
    );
    expect(
      canRequesterEditResubmit(carlo, baseRequest({ status: 'Returned' })),
    ).toBe(false);
  });

  it('allows cancel for Pending owners only', () => {
    expect(canRequesterCancel(ana, baseRequest({ status: 'Pending' }))).toBe(true);
    expect(canRequesterCancel(ana, baseRequest({ status: 'Returned' }))).toBe(false);
    expect(canRequesterCancel(ana, baseRequest({ status: 'Approved' }))).toBe(false);
    expect(canRequesterCancel(carlo as User, baseRequest())).toBe(false);
  });
});
