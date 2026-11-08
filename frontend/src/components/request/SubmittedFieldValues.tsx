import { useState, type ReactNode } from 'react';
import { Paperclip, X } from 'lucide-react';
import type { AttachmentMetadata, FormFieldDefinition, SubmittedRequest } from '@/types';
import {
  formatDateTime,
  formatFileSize,
  formatSubmittedFieldValue,
} from '@/utils/formatDisplay';
import { FileViewerDialog } from './FileViewerDialog';

interface SheetDetails {
  requesterName: string;
  groupName?: string | null;
  submittedAt: string;
  revisionLabel?: string | null;
  /** Timestamp of the current revision, once a resubmission exists. */
  revisionDate?: string | null;
}

interface SubmittedFieldValuesProps {
  request: Pick<SubmittedRequest, 'fieldValues' | 'attachments'>;
  fields: FormFieldDefinition[];
  title?: string;
  /** Render inside a parent card instead of a bordered section. */
  embedded?: boolean;
  /** Two-column details sheet used on the request details card. */
  layout?: 'list' | 'sheet';
  details?: SheetDetails;
  /** When set, a returned request's owner can drop a file from the sheet. */
  onRemoveAttachment?: (attachmentId: string) => Promise<void>;
}

function attachmentsForField(
  attachments: AttachmentMetadata[],
  fieldId: string,
): AttachmentMetadata[] {
  return attachments.filter((attachment) => attachment.fieldId === fieldId);
}

function isDescriptionField(field: FormFieldDefinition): boolean {
  const label = field.label.trim().toLowerCase();
  const id = field.id.trim().toLowerCase();
  return (
    field.type === 'textarea' ||
    label.includes('description') ||
    label.includes('justification') ||
    id.includes('description') ||
    id.includes('justification')
  );
}

function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-baseline gap-x-2">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export function SubmittedFieldValues({
  request,
  fields,
  title = 'Submitted information',
  embedded = false,
  layout = 'list',
  details,
  onRemoveAttachment,
}: SubmittedFieldValuesProps) {
  const [viewerAttachment, setViewerAttachment] =
    useState<AttachmentMetadata | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const sectionClass = embedded
    ? ''
    : 'rounded-lg border border-brand-100 bg-white p-5 shadow-sm';

  const viewer = (
    <FileViewerDialog
      open={viewerAttachment != null}
      attachment={viewerAttachment}
      onClose={() => setViewerAttachment(null)}
    />
  );

  if (layout === 'sheet') {
    const requester: { id: string; label: string; node: ReactNode }[] = [];
    const filled: { id: string; label: string; node: ReactNode }[] = [];
    const long: { id: string; label: string; text: string }[] = [];
    const files: { id: string; attachment: AttachmentMetadata }[] = [];

    if (details) {
      requester.push(
        { id: 'requested-by', label: 'Requested by', node: details.requesterName },
        { id: 'group', label: 'Group', node: details.groupName || '—' },
        {
          id: 'request-date',
          label: 'Request date',
          node: formatDateTime(details.submittedAt),
        },
      );
      if (details.revisionLabel) {
        requester.push({
          id: 'revision',
          label: 'Revision',
          node: details.revisionLabel,
        });
      }
      if (details.revisionDate) {
        requester.push({
          id: 'revision-date',
          label: 'Revision date',
          node: formatDateTime(details.revisionDate),
        });
      }
    }

    for (const field of fields) {
      const fieldAttachments = attachmentsForField(request.attachments, field.id);
      const display = formatSubmittedFieldValue(
        field,
        request.fieldValues[field.id],
        fieldAttachments[0],
      );
      if (field.type === 'file') {
        for (const attachment of fieldAttachments) {
          files.push({
            id: attachment.id ?? `${field.id}-${attachment.fileName}-${attachment.fileSize}`,
            attachment,
          });
        }
        continue;
      }
      if (isDescriptionField(field)) {
        long.push({
          id: field.id,
          label: field.label,
          text: display.kind === 'empty' ? '' : display.text,
        });
        continue;
      }
      filled.push({
        id: field.id,
        label: field.label,
        node:
          display.kind === 'empty' ? (
            <span className="text-slate-400">—</span>
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
            display.text
          ),
      });
    }

    const described = long.filter((item) => item.text.trim() !== '');

    return (
      <section className={sectionClass}>
        <h2 className="mt-4 border-t border-slate-200 pt-3 text-sm font-semibold text-slate-900">
          Request Details
        </h2>
        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 lg:grid-cols-2">
          <div>
            {requester.length > 0 ? (
              <dl className="space-y-1.5">
                {requester.map((item) => (
                  <Pair key={item.id} label={item.label}>
                    {item.node}
                  </Pair>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No requester details.</p>
            )}
          </div>
          <div>
            {fields.length === 0 ? (
              <p className="text-sm text-brand-500">
                Field definitions are not available for this request. Values cannot be
                labeled reliably.
              </p>
            ) : filled.length > 0 ? (
              <dl className="space-y-1.5">
                {filled.map((item) => (
                  <Pair key={item.id} label={item.label}>
                    {item.node}
                  </Pair>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">No form fields.</p>
            )}
          </div>
        </div>
        {described.map((item) => {
          const open = expanded[item.id] === true;
          const canClamp = item.text.length > 180;
          return (
            <div key={item.id} className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
              <p
                className={[
                  'mt-2 whitespace-pre-wrap text-sm text-slate-700',
                  canClamp && !open ? 'line-clamp-3' : '',
                ].join(' ')}
              >
                {item.text}
              </p>
              {canClamp ? (
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((current) => ({ ...current, [item.id]: !open }))
                  }
                  className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  {open ? 'Show less' : 'Read more'}
                </button>
              ) : null}
            </div>
          );
        })}
        {files.length > 0 ? (
          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="text-sm font-semibold text-slate-900">Attachments</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {files.map(({ id, attachment }) => {
                const canRemove = Boolean(onRemoveAttachment && attachment.id);
                return (
                  <li
                    key={id}
                    className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => setViewerAttachment(attachment)}
                      className="inline-flex min-w-0 items-center gap-1.5 py-1 pl-2.5 pr-2 text-left"
                    >
                      <Paperclip size={14} className="shrink-0 text-slate-500" aria-hidden />
                      <span className="max-w-52 truncate text-sm text-slate-800">
                        {attachment.fileName}
                      </span>
                    </button>
                    {canRemove ? (
                      <button
                        type="button"
                        aria-label={`Remove ${attachment.fileName}`}
                        disabled={removingId === attachment.id}
                        onClick={() => {
                          if (!attachment.id || !onRemoveAttachment) return;
                          setRemoveError(null);
                          setRemovingId(attachment.id);
                          void onRemoveAttachment(attachment.id)
                            .then(() => {
                              setViewerAttachment((current) =>
                                current?.id === attachment.id ? null : current,
                              );
                            })
                            .catch((error: unknown) => {
                              setRemoveError(
                                error instanceof Error
                                  ? error.message
                                  : 'The file could not be removed.',
                              );
                            })
                            .finally(() => setRemovingId(null));
                        }}
                        className="mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
                      >
                        <X size={14} aria-hidden />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {removeError ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {removeError}
              </p>
            ) : null}
          </div>
        ) : null}
        {viewer}
      </section>
    );
  }

  if (fields.length === 0) {
    return (
      <section className={sectionClass || undefined}>
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
    <>
      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-brand-900">{title}</h2>
        <dl className="mt-5 divide-y divide-brand-100">
          {fields.map((field) => {
            const fieldAttachments = attachmentsForField(request.attachments, field.id);
            const display = formatSubmittedFieldValue(
              field,
              request.fieldValues[field.id],
              field.type === 'file' ? null : fieldAttachments[0],
            );
            return (
              <div key={field.id} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-brand-700">{field.label}</dt>
                <dd className="text-sm text-brand-900 sm:col-span-2">
                  {field.type === 'file' ? (
                    fieldAttachments.length === 0 ? (
                      <span className="italic text-brand-400">Not provided</span>
                    ) : (
                      <span className="flex flex-col items-start gap-1">
                        {fieldAttachments.map((attachment) => (
                          <button
                            key={attachment.id ?? `${attachment.fileName}-${attachment.fileSize}`}
                            type="button"
                            onClick={() => setViewerAttachment(attachment)}
                            className="break-all text-left text-brand-800 underline hover:text-brand-950"
                          >
                            {attachment.fileName} ({formatFileSize(attachment.fileSize)})
                          </button>
                        ))}
                      </span>
                    )
                  ) : display.kind === 'empty' ? (
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
                    <span className="whitespace-pre-wrap">{display.text}</span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>
      {viewer}
    </>
  );
}
