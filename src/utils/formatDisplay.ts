import type { AttachmentMetadata, FieldValue, FormFieldDefinition } from '@/types';

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/** Tooltip for completed step statuses, e.g. "Approved on Oct 12, 2026 at 10:35 AM". */
export function formatStepActionTooltip(
  statusLabel: string,
  iso: string | null | undefined,
): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  const datePart = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  return `${statusLabel} on ${datePart} at ${timePart}`;
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isEmptyFieldValue(value: FieldValue | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

export function resolveOptionLabel(
  field: FormFieldDefinition,
  value: string,
): string {
  const option = field.options?.find((o) => o.value === value);
  return option?.label ?? value;
}

export interface DisplayFieldValue {
  kind: 'text' | 'url' | 'boolean' | 'empty' | 'attachment';
  text: string;
  href?: string;
}

export function formatSubmittedFieldValue(
  field: FormFieldDefinition,
  value: FieldValue | undefined,
  attachment?: AttachmentMetadata | null,
): DisplayFieldValue {
  if (field.type === 'file') {
    if (!attachment) {
      return { kind: 'empty', text: 'Not provided' };
    }
    const href = attachment.downloadUrl?.trim() || undefined;
    return {
      kind: 'attachment',
      text: `${attachment.fileName} (${formatFileSize(attachment.fileSize)})`,
      href,
    };
  }

  if (isEmptyFieldValue(value)) {
    return { kind: 'empty', text: 'Not provided' };
  }

  if (field.type === 'checkbox' || typeof value === 'boolean') {
    return { kind: 'boolean', text: value ? 'Yes' : 'No' };
  }

  if (field.type === 'select' || field.type === 'radio') {
    return {
      kind: 'text',
      text: resolveOptionLabel(field, String(value)),
    };
  }

  if (field.type === 'date') {
    const raw = String(value);
    // Prefer ISO date-only formatting without timezone shift when possible
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map(Number);
      const local = new Date(y, m - 1, d);
      return {
        kind: 'text',
        text: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(local),
      };
    }
    return { kind: 'text', text: formatDateOnly(raw) };
  }

  if (field.type === 'url') {
    const text = String(value).trim();
    if (isValidHttpUrl(text)) {
      return { kind: 'url', text, href: text };
    }
    return { kind: 'text', text };
  }

  if (field.type === 'number') {
    return { kind: 'text', text: String(value) };
  }

  return { kind: 'text', text: String(value) };
}
