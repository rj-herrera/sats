import type { SubmittedRequest } from '@/types';

/**
 * Seed requests shared across Employee and Approver personas.
 * - Requester: Employee 1 (usr-employee-1) → visible in My Requests
 * - Review / step-1 approver: Approver 1 (usr-approver-1) → Action Inbox
 * - Hierarchy step 2: Approver 2 (usr-approver-2) → Waiting until step 1 completes
 */

const SEED_TS = '2026-03-15T09:30:00.000Z';
const SEED_TS_IMAGE = '2026-03-16T10:15:00.000Z';
const SEED_TS_HIERARCHY = '2026-03-17T08:45:00.000Z';

export const SEED_REQUEST_ID = 'req-seed-employee-001';
export const SEED_REQUEST_IMAGE_ID = 'req-seed-employee-002';
export const SEED_REQUEST_HIERARCHY_ID = 'req-seed-employee-003';

const SHARED_FIELD_DEFINITIONS: SubmittedRequest['fieldDefinitions'] = [
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
];

export const MOCK_REQUESTS: SubmittedRequest[] = [
  {
    id: SEED_REQUEST_ID,
    requestNumber: 'SATS-2026-000001',
    templateId: 'tpl-general-review',
    templateName: 'For Review/Checking',
    workflowType: 'review_checking',
    requesterId: 'usr-employee-1',
    requesterName: 'Employee 1',
    requesterGroupId: 'grp-system',
    requesterGroupName: 'System Group',
    submittedAt: SEED_TS,
    lastResubmittedAt: null,
    fieldValues: {
      request_title: 'Review analysis summary document',
      description:
        'Please review the attached analysis summary for completeness and accuracy before circulation.',
    },
    fieldDefinitions: SHARED_FIELD_DEFINITIONS,
    attachments: [
      {
        fieldId: 'attachment',
        fileName: 'analysis-summary.pdf',
        fileSize: 586,
        fileType: 'application/pdf',
        downloadUrl: '/samples/analysis-summary.pdf',
      },
    ],
    reviewers: [
      {
        userId: 'usr-approver-1',
        name: 'Approver 1',
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
        actorId: 'usr-employee-1',
        actorName: 'Employee 1',
        description: 'Request submitted',
        comment: null,
        relatedStepKey: null,
        revisionNumber: 1,
      },
    ],
  },
  {
    id: SEED_REQUEST_IMAGE_ID,
    requestNumber: 'SATS-2026-000002',
    templateId: 'tpl-general-review',
    templateName: 'For Review/Checking',
    workflowType: 'review_checking',
    requesterId: 'usr-employee-1',
    requesterName: 'Employee 1',
    requesterGroupId: 'grp-system',
    requesterGroupName: 'System Group',
    submittedAt: SEED_TS_IMAGE,
    lastResubmittedAt: null,
    fieldValues: {
      request_title: 'Review site inspection photo',
      description:
        'Please review the attached site photo and confirm whether the condition is acceptable for the report.',
    },
    fieldDefinitions: SHARED_FIELD_DEFINITIONS,
    attachments: [
      {
        fieldId: 'attachment',
        fileName: 'site-photo.png',
        fileSize: 721,
        fileType: 'image/png',
        downloadUrl: '/samples/site-photo.png',
      },
    ],
    reviewers: [
      {
        userId: 'usr-approver-1',
        name: 'Approver 1',
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
        id: 'evt-seed-image-submitted',
        type: 'request_submitted',
        timestamp: SEED_TS_IMAGE,
        actorId: 'usr-employee-1',
        actorName: 'Employee 1',
        description: 'Request submitted',
        comment: null,
        relatedStepKey: null,
        revisionNumber: 1,
      },
    ],
  },
  {
    id: SEED_REQUEST_HIERARCHY_ID,
    requestNumber: 'SATS-2026-000003',
    templateId: 'tpl-website-access',
    templateName: 'Website Access Request',
    workflowType: 'hierarchy_approval',
    requesterId: 'usr-employee-1',
    requesterName: 'Employee 1',
    requesterGroupId: 'grp-system',
    requesterGroupName: 'System Group',
    submittedAt: SEED_TS_HIERARCHY,
    lastResubmittedAt: null,
    fieldValues: {
      website_name: 'Vendor Portal',
      website_url: 'https://vendor.example.com',
      access_type: 'Browse / Read-only',
      business_purpose:
        'Need read-only access to the vendor portal to check delivery schedules and invoice status for System Group.',
    },
    fieldDefinitions: [
      {
        id: 'website_name',
        label: 'Website / Service Name',
        type: 'text',
        required: true,
        placeholder: 'e.g. Vendor Portal',
        maxLength: 120,
      },
      {
        id: 'website_url',
        label: 'Website URL',
        type: 'url',
        required: true,
        placeholder: 'https://example.com',
      },
      {
        id: 'access_type',
        label: 'Access Type',
        type: 'text',
        required: true,
        placeholder: 'e.g. Browse / Read-only, User Account, Admin',
        maxLength: 120,
      },
      {
        id: 'business_purpose',
        label: 'Business Purpose',
        type: 'textarea',
        required: true,
        placeholder: 'Why is access needed?',
        maxLength: 2000,
      },
    ],
    attachments: [],
    reviewers: null,
    approvalSteps: [
      {
        stepOrder: 1,
        userId: 'usr-approver-1',
        name: 'Approver 1',
        roleLabel: 'Approver',
        groupName: 'System Group',
        status: 'Pending',
        comments: null,
        actionAt: null,
      },
      {
        stepOrder: 2,
        userId: 'usr-approver-2',
        name: 'Approver 2',
        roleLabel: 'Assistant Manager',
        groupName: 'Admin Group',
        status: 'Waiting',
        comments: null,
        actionAt: null,
      },
    ],
    status: 'Pending',
    revisionNumber: 1,
    revisions: [],
    cancelledAt: null,
    cancelledById: null,
    cancelledByName: null,
    cancellationReason: null,
    activity: [
      {
        id: 'evt-seed-hierarchy-submitted',
        type: 'request_submitted',
        timestamp: SEED_TS_HIERARCHY,
        actorId: 'usr-employee-1',
        actorName: 'Employee 1',
        description: 'Request submitted',
        comment: null,
        relatedStepKey: null,
        revisionNumber: 1,
      },
    ],
  },
];
