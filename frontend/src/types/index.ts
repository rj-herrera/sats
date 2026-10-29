/**
 * Core domain types for SATS.
 * Designed so mock data can later be replaced by API responses.
 */

/**
 * Application roles (generic MVP set).
 * Users may hold multiple roles; Employee capabilities are always retained.
 * - employee: create/view own requests
 * - approver: Action Inbox + group template management when responsible
 * - admin: generic/shared templates and cross-group template management
 */
export type Role = 'employee' | 'approver' | 'admin';

/** Canonical roles usable in the dev role switcher */
export const APP_ROLES = ['employee', 'approver', 'admin'] as const;

export type {
  TemplateScope,
  TemplateStatus,
  WorkflowType,
  FormFieldType,
  FormFieldOption,
  FormFieldDefinition,
  ReviewCheckingWorkflow,
  HierarchyApprovalStep,
  HierarchyApprovalWorkflow,
  TemplateWorkflow,
  FormTemplate,
  FieldValue,
} from './template';

export { TEMPLATE_STATUSES, FORM_FIELD_TYPES } from './template';

export type {
  RequestStatus,
  StepStatus,
  DecisionType,
  ActivityEventType,
  AttachmentMetadata,
  ReviewerSnapshot,
  ApprovalStepSnapshot,
  ActivityEvent,
  RequestRevision,
  SubmittedRequest,
  CreateRequestInput,
  ResubmitRequestInput,
  CancelRequestInput,
} from './request';

export {
  REQUEST_STATUSES,
  STEP_STATUSES,
  DECISION_TYPES,
  ACTIVITY_EVENT_TYPES,
} from './request';

export type Permission =
  | 'requests:create'
  | 'requests:view_own'
  | 'requests:view_assigned'
  | 'requests:approve'
  | 'templates:manage_group'
  | 'templates:manage_generic'
  | 'inbox:access';

export type AccountStatus = 'Active' | 'Inactive';
export type GroupStatus = 'Active' | 'Inactive';

export const ACCOUNT_STATUSES = ['Active', 'Inactive'] as const;
export const GROUP_STATUSES = ['Active', 'Inactive'] as const;

export interface Group {
  id: string;
  name: string;
  /** Unique short code, e.g. ANALYSIS */
  code: string;
  description: string;
  status: GroupStatus;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  /** Human-readable employee number; unique */
  employeeId: string;
  name: string;
  email: string;
  groupId: string;
  /** Denormalized display name from the group directory */
  groupName: string;
  /**
   * Stacked roles. Always includes `employee`.
   * Approvers include `approver`. Admins include `admin`.
   */
  roles: Role[];
  /**
   * Designated Approver responsibility for Action Inbox.
   * Typically aligned with the approver role. Admin alone does not grant this.
   */
  hasApprovalResponsibility: boolean;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  userId: string;
}

/** Placeholder for future request ownership / assignment checks */
export interface RequestAccessContext {
  requestId: string;
  ownerId: string;
  assignedReviewerIds: string[];
}
