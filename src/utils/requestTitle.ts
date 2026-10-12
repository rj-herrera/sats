import type { FieldValue, FormFieldDefinition, SubmittedRequest } from '@/types';

const TITLE_FIELD_IDS = [
  'request_title',
  'document_title',
  'software_name',
  'title',
] as const;

const TITLE_LABEL_HINTS = [
  'request title',
  'document title',
  'software name',
  'title',
] as const;

function isUsableTitleValue(value: FieldValue | undefined): value is string | number {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return false;
  const text = String(value).trim();
  return text.length > 0;
}

function formatTitleValue(value: string | number): string {
  return String(value).trim();
}

/**
 * Resolve a human-readable request title / summary.
 * Prefer configured title fields, then primary descriptive text fields, then template name.
 */
export function getRequestDisplayTitle(
  request: Pick<
    SubmittedRequest,
    'fieldValues' | 'templateName' | 'fieldDefinitions' | 'templateId'
  >,
  fieldDefinitions?: FormFieldDefinition[],
): string {
  const fields = fieldDefinitions ?? request.fieldDefinitions ?? [];
  const values = request.fieldValues ?? {};

  for (const id of TITLE_FIELD_IDS) {
    const value = values[id];
    if (isUsableTitleValue(value)) {
      return formatTitleValue(value);
    }
  }

  for (const field of fields) {
    const label = field.label.trim().toLowerCase();
    if (TITLE_LABEL_HINTS.some((hint) => label === hint || label.includes(hint))) {
      const value = values[field.id];
      if (isUsableTitleValue(value)) {
        return formatTitleValue(value);
      }
    }
  }

  const firstText = fields.find(
    (f) =>
      (f.type === 'text' || f.type === 'textarea') &&
      isUsableTitleValue(values[f.id]),
  );
  if (firstText) {
    const value = values[firstText.id];
    if (isUsableTitleValue(value)) {
      return formatTitleValue(value);
    }
  }

  const templateName = request.templateName?.trim();
  return templateName || 'Untitled request';
}
