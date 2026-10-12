import { getGroupById } from '@/services/groupRepository';
import { getUserById } from '@/services/userRepository';
import type {
  FormFieldDefinition,
  FormTemplate,
  HierarchyApprovalStep,
  TemplateWorkflow,
} from '@/types';

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  fieldErrors: Record<string, string>;
  warnings: string[];
}

function validateFields(fields: FormFieldDefinition[]): {
  errors: string[];
  fieldErrors: Record<string, string>;
} {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};
  const ids = new Set<string>();

  if (fields.length === 0) {
    errors.push('Add at least one form field before activating.');
  }

  for (const field of fields) {
    const key = field.id || field.label;
    if (!field.label.trim()) {
      fieldErrors[key] = 'Field label is required.';
      errors.push('Every field must have a label.');
    }
    if (!field.id.trim()) {
      fieldErrors[key] = 'Field ID is required.';
      errors.push('Every field must have an ID.');
    } else if (ids.has(field.id)) {
      fieldErrors[field.id] = 'Field ID must be unique.';
      errors.push(`Duplicate field ID: ${field.id}`);
    } else {
      ids.add(field.id);
    }

    if (field.type === 'select' || field.type === 'radio') {
      const options = field.options ?? [];
      if (options.length === 0) {
        fieldErrors[field.id] = 'Add at least one option.';
        errors.push(`Field "${field.label}" needs options.`);
      } else {
        const values = new Set<string>();
        for (const opt of options) {
          if (!opt.label.trim() || !opt.value.trim()) {
            fieldErrors[field.id] = 'Option labels and values are required.';
            errors.push(`Field "${field.label}" has an incomplete option.`);
            break;
          }
          if (values.has(opt.value)) {
            fieldErrors[field.id] = 'Option values must be unique.';
            errors.push(`Field "${field.label}" has duplicate option values.`);
            break;
          }
          values.add(opt.value);
        }
      }
    }

    if (field.type === 'number') {
      if (
        field.min != null &&
        field.max != null &&
        field.min > field.max
      ) {
        fieldErrors[field.id] = 'Minimum cannot exceed maximum.';
        errors.push(`Field "${field.label}" has an invalid number range.`);
      }
    }

    if (
      (field.type === 'text' || field.type === 'textarea') &&
      field.maxLength != null &&
      field.maxLength <= 0
    ) {
      fieldErrors[field.id] = 'Maximum length must be greater than zero.';
      errors.push(`Field "${field.label}" has an invalid max length.`);
    }

    if (
      field.type === 'file' &&
      field.maxFileSizeMb != null &&
      field.maxFileSizeMb <= 0
    ) {
      fieldErrors[field.id] = 'Max file size must be greater than zero.';
      errors.push(`Field "${field.label}" has an invalid max file size.`);
    }
  }

  return { errors: [...new Set(errors)], fieldErrors };
}

function validateWorkflow(workflow: TemplateWorkflow): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (workflow.type === 'review_checking') {
    return { errors, warnings };
  }

  const steps = [...workflow.steps].sort((a, b) => a.stepOrder - b.stepOrder);
  if (steps.length === 0) {
    errors.push('Hierarchy Approval requires at least one approval step.');
    return { errors, warnings };
  }

  const stepIds = new Set<string>();
  const assigneeCounts = new Map<string, number>();

  steps.forEach((step, index) => {
    if (!step.id || stepIds.has(step.id)) {
      errors.push(`Approval step ${index + 1} must have a unique step ID.`);
    } else {
      stepIds.add(step.id);
    }
    if (!step.roleLabel.trim()) {
      errors.push(`Approval step ${index + 1} needs a role / responsibility label.`);
    }
    if (!step.assigneeUserId) {
      errors.push(`Approval step ${index + 1} needs an assigned approver.`);
    } else {
      const user = getUserById(step.assigneeUserId);
      if (!user) {
        errors.push(
          `Approval step ${index + 1} references an unknown user (${step.assigneeUserId}).`,
        );
      } else if (user.status !== 'Active') {
        errors.push(
          `Approval step ${index + 1}: ${user.name} is inactive.`,
        );
      } else {
        const group = getGroupById(user.groupId);
        if (!group || group.status !== 'Active') {
          errors.push(
            `Approval step ${index + 1}: ${user.name} belongs to an inactive group.`,
          );
        } else {
          assigneeCounts.set(
            step.assigneeUserId,
            (assigneeCounts.get(step.assigneeUserId) ?? 0) + 1,
          );
        }
      }
    }
  });

  for (const [userId, count] of assigneeCounts) {
    if (count > 1) {
      const user = getUserById(userId);
      warnings.push(
        `${user?.name ?? userId} appears in ${count} approval steps. This is allowed but may be unintended.`,
      );
    }
  }

  return { errors, warnings };
}

/** Basic validation used while stepping through the editor (name / owning group). */
export function validateTemplateDraft(
  template: Pick<
    FormTemplate,
    'name' | 'scope' | 'owningGroupId' | 'allowedGroupIds' | 'fields' | 'workflow'
  >,
): TemplateValidationResult {
  const errors: string[] = [];
  if (!template.name.trim()) {
    errors.push('Template name is required.');
  }
  if (template.scope === 'group' && !template.owningGroupId) {
    errors.push('Group-specific templates require an owning group.');
  }
  return {
    valid: errors.length === 0,
    errors,
    fieldErrors: {},
    warnings: [],
  };
}

/** Full validation required before Activate. */
export function validateTemplateForActivation(
  template: Pick<
    FormTemplate,
    | 'name'
    | 'description'
    | 'scope'
    | 'owningGroupId'
    | 'allowedGroupIds'
    | 'fields'
    | 'workflow'
  >,
): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!template.name.trim()) {
    errors.push('Template name is required.');
  }
  if (!template.description.trim()) {
    errors.push('Template description is required before activation.');
  }
  if (template.scope === 'group') {
    if (!template.owningGroupId) {
      errors.push('Group-specific templates require an owning group.');
    } else {
      const owning = getGroupById(template.owningGroupId);
      if (!owning) {
        errors.push('Owning group does not exist.');
      } else if (owning.status !== 'Active') {
        errors.push(
          'Cannot activate a group-specific template while its owning group is inactive.',
        );
      }
    }
    if (
      template.owningGroupId &&
      !template.allowedGroupIds.includes(template.owningGroupId)
    ) {
      errors.push('Owning group must be included in available groups.');
    }
  }

  const fieldResult = validateFields(template.fields);
  errors.push(...fieldResult.errors);

  const workflowResult = validateWorkflow(template.workflow);
  errors.push(...workflowResult.errors);
  warnings.push(...workflowResult.warnings);

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    fieldErrors: fieldResult.fieldErrors,
    warnings,
  };
}

export function reindexSteps(
  steps: HierarchyApprovalStep[],
): HierarchyApprovalStep[] {
  return [...steps]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((step, index) => ({ ...step, stepOrder: index + 1 }));
}
