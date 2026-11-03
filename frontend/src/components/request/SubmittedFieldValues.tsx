import { useState, type ReactNode } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
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
}

function attachmentForField(
  attachments: AttachmentMetadata[],
  fieldId: string,
): AttachmentMetadata | undefined {
  return attachments.find((a) => a.fieldId === fieldId);
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

function fileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') {
    return <FileSpreadsheet size={18} className="text-emerald-600" aria-hidden />;
  }
  return <FileText size={18} className="text-red-500" aria-hidden />;
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
}: SubmittedFieldValuesProps) {
  const [viewerAttachment, setViewerAttachment] =
    useState<AttachmentMetadata | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
    }

    for (const field of fields) {
      const attachment = attachmentForField(request.attachments, field.id);
      const display = formatSubmittedFieldValue(
        field,
        request.fieldValues[field.id],
        attachment,
      );
      if (field.type === 'file') {
        if (attachment) files.push({ id: field.id, attachment });
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
            <ul className="mt-3 flex flex-wrap gap-3">
              {files.map(({ id, attachment }) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setViewerAttachment(attachment)}
                    className="flex min-w-56 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-50">
                      {fileIcon(attachment.fileName)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {attachment.fileName}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {formatFileSize(attachment.fileSize)}
                      </span>
                    </span>
                    <Download size={16} className="ml-2 shrink-0 text-slate-400" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
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
            const attachment = attachmentForField(request.attachments, field.id);
            const display = formatSubmittedFieldValue(
              field,
              request.fieldValues[field.id],
              attachment,
            );
            return (
              <div key={field.id} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-brand-700">{field.label}</dt>
                <dd className="text-sm text-brand-900 sm:col-span-2">
                  {display.kind === 'empty' ? (
                    <span className="italic text-brand-400">{display.text}</span>
                  ) : display.kind === 'attachment' && attachment ? (
                    <button
                      type="button"
                      onClick={() => setViewerAttachment(attachment)}
                      className="break-all text-left text-brand-800 underline hover:text-brand-950"
                    >
                      {display.text}
                    </button>
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
