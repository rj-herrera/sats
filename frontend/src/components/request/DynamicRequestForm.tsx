import type { AttachmentMetadata, FieldValue, FormFieldDefinition, FormTemplate } from '@/types';
import { DynamicFormField } from './DynamicFormField';

interface DynamicRequestFormProps {
  /** Prefer fields when revising from a template snapshot without a full FormTemplate. */
  template?: FormTemplate;
  fields?: FormFieldDefinition[];
  title?: string;
  values: Record<string, FieldValue>;
  files: Record<string, File | null>;
  errors: Record<string, string>;
  onChange: (fieldId: string, value: FieldValue) => void;
  onFileChange: (fieldId: string, file: File | null) => void;
  existingAttachments?: AttachmentMetadata[];
  removedAttachmentFieldIds?: Set<string>;
  onRemoveExistingAttachment?: (fieldId: string) => void;
}

export function DynamicRequestForm({
  template,
  fields,
  title = 'Request information',
  values,
  files,
  errors,
  onChange,
  onFileChange,
  existingAttachments = [],
  removedAttachmentFieldIds,
  onRemoveExistingAttachment,
}: DynamicRequestFormProps) {
  const fieldList = fields ?? template?.fields ?? [];

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-900">{title}</h2>
      <div className="mt-5 grid gap-4">
        {fieldList.map((field) => {
          const existing = existingAttachments.find((a) => a.fieldId === field.id);
          const showExisting =
            existing &&
            !files[field.id] &&
            !(removedAttachmentFieldIds?.has(field.id) ?? false);

          return (
            <DynamicFormField
              key={field.id}
              field={field}
              value={values[field.id] ?? null}
              file={files[field.id] ?? null}
              error={errors[field.id]}
              onChange={(value) => onChange(field.id, value)}
              onFileChange={(file) => onFileChange(field.id, file)}
              existingAttachment={showExisting ? existing : null}
              onRemoveExistingAttachment={
                onRemoveExistingAttachment
                  ? () => onRemoveExistingAttachment(field.id)
                  : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
}
