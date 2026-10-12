import { describe, expect, it } from 'vitest';
import { MOCK_USERS } from '@/data/mockUsers';
import {
  canRequesterCancel,
  canRequesterEditResubmit,
  isRequestOwner,
} from '@/utils/requestOwnership';
import type { SubmittedRequest, User } from '@/types';

const employee1 = MOCK_USERS.find((u) => u.id === 'usr-employee-1')!;
const employee2 = MOCK_USERS.find((u) => u.id === 'usr-employee-2')!;

function baseRequest(overrides: Partial<SubmittedRequest> = {}): SubmittedRequest {
  return {
    id: 'req-1',
    requestNumber: 'SATS-2026-000001',
    templateId: 'tpl-1',
    templateName: 'Test',
    workflowType: 'review_checking',
    requesterId: employee1.id,
    requesterName: employee1.name,
    requesterGroupId: employee1.groupId,
    requesterGroupName: employee1.groupName,
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
    expect(isRequestOwner(employee1, request)).toBe(true);
    expect(isRequestOwner(employee2, request)).toBe(false);
  });

  it('allows edit/resubmit only when Returned and owner', () => {
    expect(
      canRequesterEditResubmit(employee1, baseRequest({ status: 'Returned' })),
    ).toBe(true);
    expect(
      canRequesterEditResubmit(employee1, baseRequest({ status: 'Pending' })),
    ).toBe(false);
    expect(
      canRequesterEditResubmit(employee2, baseRequest({ status: 'Returned' })),
    ).toBe(false);
  });

  it('allows cancel for Pending owners only', () => {
    expect(canRequesterCancel(employee1, baseRequest({ status: 'Pending' }))).toBe(
      true,
    );
    expect(canRequesterCancel(employee1, baseRequest({ status: 'Returned' }))).toBe(
      false,
    );
    expect(canRequesterCancel(employee1, baseRequest({ status: 'Approved' }))).toBe(
      false,
    );
    expect(canRequesterCancel(employee2 as User, baseRequest())).toBe(false);
  });
});
