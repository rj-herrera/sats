import type { SubmittedRequest } from '@/types';

/**
 * Seed request shared across Employee and Approver personas.
 * - Requester: Mock Employee (usr-ana) → visible in My Requests
 * - Reviewer: Mock Approver (usr-edmon) → visible in Action Inbox
 */

const SEED_TS = '2026-03-15T09:30:00.000Z';

export const SEED_REQUEST_ID = 'req-seed-employee-001';

export const MOCK_REQUESTS: SubmittedRequest[] = [
  {
    id: SEED_REQUEST_ID,
    requestNumber: 'SATS-2026-000001',
    templateId: 'tpl-general-review',
    templateName: 'For Review/Checking',
    workflowType: 'review_checking',
    requesterId: 'usr-ana',
    requesterName: 'Mock Employee',
    requesterGroupId: 'grp-analysis',
    requesterGroupName: 'Analysis Group',
    submittedAt: SEED_TS,
    lastResubmittedAt: null,
    fieldValues: {
      request_title: 'Review analysis summary document',
      description:
        'Please review the attached analysis summary for completeness and accuracy before circulation.',
    },
    fieldDefinitions: [
      {
        id: 'request_title',
        label: 'Request Title',
        type: 'text',
        required: true,
        placeholder: 'Short title for this request',
        maxLength: 120,
      },
      {
        id: 'description',
        label: 'Description / Details',
        type: 'textarea',
        required: true,
        placeholder: 'Describe what needs to be reviewed',
        maxLength: 2000,
      },
      {
        id: 'attachment',
        label: 'Attachment',
        type: 'file',
        required: false,
        accept: '.pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls',
        maxFileSizeMb: 5,
      },
    ],
    attachments: [],
    reviewers: [
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
    activity: [
      {
        id: 'evt-seed-submitted',
        type: 'request_submitted',
        timestamp: SEED_TS,
        actorId: 'usr-ana',
        actorName: 'Mock Employee',
        description: 'Request submitted',
        comment: null,
        relatedStepKey: null,
        revisionNumber: 1,
      },
    ],
  },
];
