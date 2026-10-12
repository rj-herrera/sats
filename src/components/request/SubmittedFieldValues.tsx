import type { AttachmentMetadata, FormFieldDefinition, SubmittedRequest } from '@/types';
import { formatSubmittedFieldValue } from '@/utils/formatDisplay';

interface SubmittedFieldValuesProps {
  request: Pick<SubmittedRequest, 'fieldValues' | 'attachments'>;
  fields: FormFieldDefinition[];
  title?: string;
}

function attachmentForField(
  attachments: AttachmentMetadata[],
  fieldId: string,
): AttachmentMetadata | undefined {
  return attachments.find((a) => a.fieldId === fieldId);
}

export function SubmittedFieldValues({
  request,
  fields,
  title = 'Submitted information',
}: SubmittedFieldValuesProps) {
  if (fields.length === 0) {
    return (
      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-900">{title}</h2>
        <p className="mt-3 text-sm text-brand-500">
          Field definitions are not available for this request. Values cannot be labeled
          reliably.
        </p>
        {Object.keys(request.fieldValues).length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-brand-700">
            {Object.entries(request.fieldValues).map(([key, value]) => (
              <li key={key} className="rounded-md border border-brand-100 px-3 py-2">
                <span className="font-medium text-brand-900">{key}</span>
                <span className="mt-0.5 block text-brand-600">
                  {value === null || value === undefined || value === ''
                    ? 'Not provided'
                    : String(value)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-900">{title}</h2>

      <dl className="mt-5 divide-y divide-brand-100">
        {fields.map((field) => {
          const display = formatSubmittedFieldValue(
            field,
            request.fieldValues[field.id],
            attachmentForField(request.attachments, field.id),
          );

          return (
            <div key={field.id} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-brand-700">{field.label}</dt>
              <dd className="text-sm text-brand-900 sm:col-span-2">
                {display.kind === 'empty' ? (
                  <span className="italic text-brand-400">{display.text}</span>
                ) : display.kind === 'url' && display.href ? (
                  <a
                    href={display.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-brand-800 underline hover:text-brand-950"
                  >
                    {display.text}
                  </a>
                ) : (
                  <span className="whitespace-pre-wrap break-word">{display.text}</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
