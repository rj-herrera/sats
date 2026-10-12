import type {
  AttachmentMetadata,
  FieldValue,
  FormFieldDefinition,
  FormTemplate,
} from '@/types';
import { resolveHierarchyForTemplate } from '@/services/workflowService';
import { isNumericFieldType } from '@/utils/currencyFields';

export type FieldErrors = Record<string, string>;

export interface ValidationResult {
  valid: boolean;
  fieldErrors: FieldErrors;
  formError: string | null;
}

function isBlank(value: FieldValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateField(
  field: FormFieldDefinition,
  value: FieldValue,
  file: File | null,
): string | null {
  if (field.type === 'file') {
    if (field.required && !file) {
      return `${field.label} is required.`;
    }
    if (file) {
      if (field.maxFileSizeMb != null) {
        const maxBytes = field.maxFileSizeMb * 1024 * 1024;
        if (file.size > maxBytes) {
          return `${field.label} must be ${field.maxFileSizeMb} MB or smaller.`;
        }
      }
      if (field.accept) {
        const tokens = field.accept.split(',').map((t) => t.trim().toLowerCase());
        const name = file.name.toLowerCase();
        const type = file.type.toLowerCase();
        const ok = tokens.some((token) => {
          if (token.startsWith('.')) {
            return name.endsWith(token);
          }
          if (token.endsWith('/*')) {
            const prefix = token.slice(0, -1);
            return type.startsWith(prefix);
          }
          return type === token;
        });
        if (!ok) {
          return `${field.label} file type is not allowed.`;
        }
      }
    }
    return null;
  }

  if (field.type === 'checkbox') {
    if (field.required && value !== true) {
      return `${field.label} must be checked.`;
    }
    return null;
  }

  if (field.required && isBlank(value)) {
    return `${field.label} is required.`;
  }

  if (isBlank(value)) {
    return null;
  }

  if (field.type === 'url' && typeof value === 'string' && !isValidUrl(value.trim())) {
    return 'Enter a valid URL starting with http:// or https://.';
  }

  if (isNumericFieldType(field.type)) {
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(num)) {
      return `${field.label} must be a number.`;
    }
    if (field.min != null && num < field.min) {
      return `${field.label} must be at least ${field.min}.`;
    }
    if (field.max != null && num > field.max) {
      return `${field.label} must be at most ${field.max}.`;
    }
  }

  if (
    (field.type === 'text' || field.type === 'textarea') &&
    typeof value === 'string' &&
    field.maxLength != null &&
    value.length > field.maxLength
  ) {
    return `${field.label} must be at most ${field.maxLength} characters.`;
  }

  if (
    (field.type === 'select' || field.type === 'radio') &&
    typeof value === 'string' &&
    field.options
  ) {
    const allowed = field.options.map((o) => o.value);
    if (!allowed.includes(value)) {
      return `Select a valid option for ${field.label}.`;
    }
  }

  return null;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () =>
      reject(reader.error ?? new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

/** Builds attachment metadata and embeds file bytes as a data URL for mock preview/download. */
export async function buildAttachmentMetadata(
  fieldId: string,
  file: File,
): Promise<AttachmentMetadata> {
  const downloadUrl = await readFileAsDataUrl(file);
  return {
    fieldId,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream',
    downloadUrl,
  };
}

export function validateRequestForm(params: {
  template: FormTemplate;
  values: Record<string, FieldValue>;
  files: Record<string, File | null>;
  selectedReviewerIds: string[];
}): ValidationResult {
  const { template, values, files, selectedReviewerIds } = params;
  const fieldErrors: FieldErrors = {};

  for (const field of template.fields) {
    const error = validateField(
      field,
      values[field.id] ?? null,
      files[field.id] ?? null,
    );
    if (error) {
      fieldErrors[field.id] = error;
    }
  }

  let formError: string | null = null;

  if (template.workflow.type === 'review_checking') {
    if (selectedReviewerIds.length === 0) {
      formError = 'Select at least one reviewer / approver.';
    }
  } else {
    const resolved = resolveHierarchyForTemplate(template);
    if (!resolved.ok) {
      formError = resolved.errors.join(' ');
    }
  }

  return {
    valid: Object.keys(fieldErrors).length === 0 && formError === null,
    fieldErrors,
    formError,
  };
}

/**
 * Validate a Returned-request revision edit.
 * Existing attachment metadata can satisfy required file fields when no new file is chosen.
 * Does not re-validate reviewer selection or hierarchy (locked during Phase 5).
 */
export function validateRevisionForm(params: {
  fields: FormFieldDefinition[];
  values: Record<string, FieldValue>;
  files: Record<string, File | null>;
  existingAttachments: AttachmentMetadata[];
  removedAttachmentFieldIds: Set<string>;
}): ValidationResult {
  const { fields, values, files, existingAttachments, removedAttachmentFieldIds } =
    params;
  const fieldErrors: FieldErrors = {};

  for (const field of fields) {
    if (field.type === 'file') {
      const newFile = files[field.id] ?? null;
      const existing = existingAttachments.find((a) => a.fieldId === field.id);
      const keptExisting =
        existing && !removedAttachmentFieldIds.has(field.id) ? existing : null;

      if (newFile) {
        const error = validateField(field, null, newFile);
        if (error) fieldErrors[field.id] = error;
      } else if (field.required && !keptExisting) {
        fieldErrors[field.id] = `${field.label} is required.`;
      }
      continue;
    }

    const error = validateField(field, values[field.id] ?? null, null);
    if (error) {
      fieldErrors[field.id] = error;
    }
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    formError: null,
  };
}

/**
 * Service-layer resubmit validation using stored attachment metadata
 * (no File objects). Keeps UI and lifecycle service aligned.
 */
export function validateResubmitPayload(params: {
  fields: FormFieldDefinition[];
  values: Record<string, FieldValue>;
  attachments: AttachmentMetadata[];
}): ValidationResult {
  return validateRevisionForm({
    fields: params.fields,
    values: params.values,
    files: {},
    existingAttachments: params.attachments,
    removedAttachmentFieldIds: new Set(),
  });
}

export function emptyValuesForTemplate(
  template: FormTemplate,
): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const field of template.fields) {
    if (field.defaultValue !== undefined && field.defaultValue !== null) {
      if (field.type === 'checkbox') {
        values[field.id] = Boolean(field.defaultValue);
      } else if (isNumericFieldType(field.type)) {
        values[field.id] =
          typeof field.defaultValue === 'number'
            ? field.defaultValue
            : Number(field.defaultValue);
      } else if (field.type !== 'file') {
        values[field.id] = String(field.defaultValue);
      } else {
        values[field.id] = null;
      }
      continue;
    }
    if (field.type === 'checkbox') {
      values[field.id] = false;
    } else if (field.type === 'file') {
      values[field.id] = null;
    } else if (isNumericFieldType(field.type)) {
      values[field.id] = null;
    } else {
      values[field.id] = '';
    }
  }
  return values;
}
