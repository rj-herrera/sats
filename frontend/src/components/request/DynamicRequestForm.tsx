import type { AttachmentMetadata, FieldValue, FormFieldDefinition, FormTemplate } from '@/types';
import { DynamicFormField } from './DynamicFormField';

interface DynamicRequestFormProps {
  /** Prefer fields when revising from a template snapshot without a full FormTemplate. */
  template?: FormTemplate;
  fields?: FormFieldDefinition[];
  title?: string;
  values: Record<string, FieldValue>;
  files: Record<string, File[]>;
  errors: Record<string, string>;
  onChange: (fieldId: string, value: FieldValue) => void;
  onFilesChange: (fieldId: string, files: File[]) => void;
  existingAttachments?: AttachmentMetadata[];
  removedAttachmentFieldIds?: Set<string>;
  onRemoveExistingAttachment?: (fieldId: string) => void;
  /** Newly chosen files are being sent with the request. */
  uploading?: boolean;
  /** Fields only, for a parent card that already supplies the heading and border. */
  embedded?: boolean;
}

export function DynamicRequestForm({
  template,
  fields,
  title = 'Request information',
  values,
  files,
  errors,
  onChange,
  onFilesChange,
  existingAttachments = [],
  removedAttachmentFieldIds,
  onRemoveExistingAttachment,
  uploading = false,
  embedded = false,
}: DynamicRequestFormProps) {
  const fieldList = fields ?? template?.fields ?? [];

  const fieldsGrid = (
    <div className={embedded ? 'grid gap-4' : 'mt-5 grid gap-4'}>
        {fieldList.map((field) => {
          const selected = files[field.id] ?? [];
          const kept = existingAttachments.filter((attachment) => {
            if (attachment.fieldId !== field.id) return false;
            if (removedAttachmentFieldIds?.has(field.id)) return false;
            if (attachment.id && removedAttachmentFieldIds?.has(attachment.id)) return false;
            return true;
          });

          return (
            <DynamicFormField
              key={field.id}
              field={field}
              value={values[field.id] ?? null}
              files={selected}
              error={errors[field.id]}
              onChange={(value) => onChange(field.id, value)}
              onFilesChange={(next) => onFilesChange(field.id, next)}
              existingAttachments={kept}
              onRemoveExistingAttachment={
                onRemoveExistingAttachment
                  ? (attachmentId) => onRemoveExistingAttachment(attachmentId)
                  : undefined
              }
              uploading={uploading}
            />
          );
        })}
    </div>
  );

  if (embedded) return fieldsGrid;

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-900">{title}</h2>
      {fieldsGrid}
    </section>
  );
}
