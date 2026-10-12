/**
 * Template and form-field models for SATS Phase 2+.
 * Extended in Phase 6 for management, draft/active/inactive status, and audit fields.
 */

export type TemplateScope = 'generic' | 'group';

export type TemplateStatus = 'Draft' | 'Active' | 'Inactive';

export const TEMPLATE_STATUSES: readonly TemplateStatus[] = [
  'Draft',
  'Active',
  'Inactive',
] as const;

export type WorkflowType = 'review_checking' | 'hierarchy_approval';

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'url'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'file';

export const FORM_FIELD_TYPES: readonly FormFieldType[] = [
  'text',
  'textarea',
  'number',
  'url',
  'date',
  'select',
  'radio',
  'checkbox',
  'file',
] as const;

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldDefinition {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  /** Default value for text-like / checkbox fields where appropriate */
  defaultValue?: string | number | boolean | null;
  /** Options for select / radio */
  options?: FormFieldOption[];
  /** Number min/max */
  min?: number;
  max?: number;
  /** Text / textarea max length */
  maxLength?: number;
  /** File accept attribute, e.g. ".pdf,.docx,image/*" */
  accept?: string;
  /** Max attachment size in megabytes */
  maxFileSizeMb?: number;
}

/** Requester picks reviewers at submit time (unordered set). */
export interface ReviewCheckingWorkflow {
  type: 'review_checking';
}

/** Fixed ordered approval steps defined on the template. */
export interface HierarchyApprovalStep {
  /** Stable unique id within the template */
  id: string;
  stepOrder: number;
  /** Role / responsibility label shown to the requester */
  roleLabel: string;
  /** Mock user who currently holds this step */
  assigneeUserId: string;
}

export interface HierarchyApprovalWorkflow {
  type: 'hierarchy_approval';
  steps: HierarchyApprovalStep[];
}

export type TemplateWorkflow = ReviewCheckingWorkflow | HierarchyApprovalWorkflow;

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  scope: TemplateScope;
  /** Owning group for group-specific templates; null for generic */
  owningGroupId: string | null;
  /**
   * Groups allowed to submit using this template.
   * For generic templates, an empty array means available to all groups.
   * For group-specific, typically includes the owning group.
   */
  allowedGroupIds: string[];
  /** Lifecycle status — only Active templates appear in New Request */
  status: TemplateStatus;
  fields: FormFieldDefinition[];
  workflow: TemplateWorkflow;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdByName: string;
  updatedById: string;
  updatedByName: string;
  /** Increments on each successful save for auditability */
  version: number;
}

/** Runtime field value stored in the form (files held separately as File | null). */
export type FieldValue = string | number | boolean | null;
