import type { FormTemplate } from '@/types';

/**
 * Seed templates for Phase 2–6.
 * Copied into localStorage once by the template repository — IDs are stable.
 */

const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export const MOCK_TEMPLATES: FormTemplate[] = [
  {
    id: 'tpl-general-review',
    name: 'For Review/Checking',
    description:
      'Shared template for simple document or work-item review. Available to all groups. You choose one or more reviewers when submitting.',
    scope: 'generic',
    owningGroupId: null,
    allowedGroupIds: [],
    status: 'Active',
    fields: [
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
    workflow: {
      type: 'review_checking',
    },
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    createdById: 'usr-admin-1',
    createdByName: 'Admin 1',
    updatedById: 'usr-admin-1',
    updatedByName: 'Admin 1',
    version: 1,
  },
  {
    id: 'tpl-website-access',
    name: 'Website Access Request',
    description:
      'Request access to an internal or external website. Available to System Group only. Approval follows a fixed hierarchy; reviewers cannot be changed.',
    scope: 'group',
    owningGroupId: 'grp-system',
    allowedGroupIds: ['grp-system'],
    status: 'Active',
    fields: [
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
    workflow: {
      type: 'hierarchy_approval',
      steps: [
        {
          id: 'step-website-1',
          stepOrder: 1,
          roleLabel: 'Approver',
          assigneeUserId: 'usr-approver-1',
        },
        {
          id: 'step-website-2',
          stepOrder: 2,
          roleLabel: 'Assistant Manager',
          assigneeUserId: 'usr-approver-2',
        },
      ],
    },
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    createdById: 'usr-approver-1',
    createdByName: 'Approver 1',
    updatedById: 'usr-approver-1',
    updatedByName: 'Approver 1',
    version: 1,
  },
];

export function findMockTemplateById(id: string): FormTemplate | undefined {
  return MOCK_TEMPLATES.find((t) => t.id === id);
}
