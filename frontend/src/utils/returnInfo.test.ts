import { describe, expect, it } from 'vitest';
import { getLatestReturnInfo } from '@/utils/returnInfo';
import type { SubmittedRequest } from '@/types';

describe('getLatestReturnInfo', () => {
  it('picks the highest-order Returned hierarchy step', () => {
    const request = {
      workflowType: 'hierarchy_approval',
      revisionNumber: 1,
      approvalSteps: [
        {
          stepOrder: 2,
          userId: 'usr-b',
          name: 'Second',
          roleLabel: 'Mgr',
          groupName: 'G',
          status: 'Returned',
          comments: 'Second return',
          actionAt: '2026-01-02T00:00:00.000Z',
        },
        {
          stepOrder: 1,
          userId: 'usr-a',
          name: 'First',
          roleLabel: 'GL',
          groupName: 'G',
          status: 'Returned',
          comments: 'First return',
          actionAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      reviewers: null,
      activity: [],
      revisions: [],
    } as unknown as SubmittedRequest;

    const info = getLatestReturnInfo(request);
    expect(info.found).toBe(true);
    expect(info.returnedByName).toBe('Second');
    expect(info.comment).toBe('Second return');
  });
});
