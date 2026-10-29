import type {
  FormFieldDefinition,
  FormFieldType,
  FormTemplate,
  HierarchyApprovalStep,
  TemplateStatus,
  TemplateWorkflow,
} from '@/types';
import { FORM_FIELD_TYPES, TEMPLATE_STATUSES } from '@/types';

function isFieldType(value: unknown): value is FormFieldType {
  return typeof value === 'string' && (FORM_FIELD_TYPES as readonly string[]).includes(value);
}

function isTemplateStatus(value: unknown): value is TemplateStatus {
  return typeof value === 'string' && (TEMPLATE_STATUSES as readonly string[]).includes(value);
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeField(raw: unknown, index: number): FormFieldDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Partial<FormFieldDefinition>;
  if (typeof f.label !== 'string' || !isFieldType(f.type)) return null;

  return {
    id:
      typeof f.id === 'string' && f.id.trim()
        ? f.id.trim()
        : `field_${index + 1}`,
    label: f.label.trim() || `Field ${index + 1}`,
    type: f.type,
    required: Boolean(f.required),
    placeholder: f.placeholder,
    helpText: f.helpText,
    defaultValue: f.defaultValue ?? null,
    options: Array.isArray(f.options)
      ? f.options
          .filter(
            (o): o is { value: string; label: string } =>
              Boolean(o) &&
              typeof o === 'object' &&
              typeof (o as { value?: unknown }).value === 'string' &&
              typeof (o as { label?: unknown }).label === 'string',
          )
          .map((o) => ({ value: o.value, label: o.label }))
      : undefined,
    min: typeof f.min === 'number' ? f.min : undefined,
    max: typeof f.max === 'number' ? f.max : undefined,
    maxLength: typeof f.maxLength === 'number' ? f.maxLength : undefined,
    accept: typeof f.accept === 'string' ? f.accept : undefined,
    maxFileSizeMb: typeof f.maxFileSizeMb === 'number' ? f.maxFileSizeMb : undefined,
  };
}

function normalizeWorkflow(raw: unknown): TemplateWorkflow {
  if (!raw || typeof raw !== 'object') {
    return { type: 'review_checking' };
  }
  const w = raw as { type?: string; steps?: unknown[] };
  if (w.type === 'hierarchy_approval') {
    const steps: HierarchyApprovalStep[] = Array.isArray(w.steps)
      ? w.steps
          .map((step, index) => {
            if (!step || typeof step !== 'object') return null;
            const s = step as Partial<HierarchyApprovalStep>;
            if (typeof s.assigneeUserId !== 'string' || !s.assigneeUserId) return null;
            return {
              id:
                typeof s.id === 'string' && s.id.trim()
                  ? s.id
                  : createId(`step-${index + 1}`),
              stepOrder:
                typeof s.stepOrder === 'number' ? s.stepOrder : index + 1,
              roleLabel:
                typeof s.roleLabel === 'string' && s.roleLabel.trim()
                  ? s.roleLabel.trim()
                  : `Step ${index + 1}`,
              assigneeUserId: s.assigneeUserId,
            } satisfies HierarchyApprovalStep;
          })
          .filter((s): s is HierarchyApprovalStep => s !== null)
          .sort((a, b) => a.stepOrder - b.stepOrder)
          .map((s, index) => ({ ...s, stepOrder: index + 1 }))
      : [];
    return { type: 'hierarchy_approval', steps };
  }
  return { type: 'review_checking' };
}

function resolveStatus(raw: Partial<FormTemplate> & { active?: boolean }): TemplateStatus {
  // Legacy Draft records are treated as Inactive until explicitly activated.
  if ((raw.status as string | undefined) === 'Draft') return 'Inactive';
  if (isTemplateStatus(raw.status)) return raw.status;
  // Legacy Phase 2–5: boolean active
  if (typeof raw.active === 'boolean') {
    return raw.active ? 'Active' : 'Inactive';
  }
  return 'Inactive';
}

/**
 * Normalize a stored or seed template for Phase 6 compatibility.
 * Returns null if the record is unusable.
 */
export function normalizeTemplate(raw: unknown): FormTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<FormTemplate> & { active?: boolean };

  if (typeof record.id !== 'string' || !record.id.trim()) return null;
  if (typeof record.name !== 'string' || !record.name.trim()) return null;

  const fields = Array.isArray(record.fields)
    ? record.fields
        .map((f, i) => normalizeField(f, i))
        .filter((f): f is FormFieldDefinition => f !== null)
    : [];

  const now = new Date().toISOString();
  const scope = record.scope === 'group' ? 'group' : 'generic';

  return {
    id: record.id,
    name: record.name.trim(),
    description: typeof record.description === 'string' ? record.description : '',
    scope,
    owningGroupId:
      scope === 'group'
        ? (typeof record.owningGroupId === 'string' ? record.owningGroupId : null)
        : null,
    allowedGroupIds: Array.isArray(record.allowedGroupIds)
      ? record.allowedGroupIds.filter((id): id is string => typeof id === 'string')
      : scope === 'group' && record.owningGroupId
        ? [record.owningGroupId]
        : [],
    status: resolveStatus(record),
    fields,
    workflow: normalizeWorkflow(record.workflow),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
    createdById:
      typeof record.createdById === 'string' ? record.createdById : 'system',
    createdByName:
      typeof record.createdByName === 'string' ? record.createdByName : 'System',
    updatedById:
      typeof record.updatedById === 'string' ? record.updatedById : 'system',
    updatedByName:
      typeof record.updatedByName === 'string' ? record.updatedByName : 'System',
    version:
      typeof record.version === 'number' && record.version > 0
        ? record.version
        : 1,
  };
}

export function createStepId(): string {
  return createId('step');
}

export function createFieldId(existing: string[]): string {
  let n = existing.length + 1;
  let id = `field_${n}`;
  while (existing.includes(id)) {
    n += 1;
    id = `field_${n}`;
  }
  return id;
}

export function createTemplateId(): string {
  return createId('tpl');
}
