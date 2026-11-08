import { useState } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';
import type { AttachmentMetadata, FieldValue, FormFieldDefinition } from '@/types';
import {
  getCurrencyFieldMeta,
  isNumericFieldType,
} from '@/utils/currencyFields';
import {
  FILE_ACCEPT,
  FILE_FIELD_RULES,
  addPickedFiles,
} from '@/utils/fileAttachments';

interface DynamicFormFieldProps {
  field: FormFieldDefinition;
  value: FieldValue;
  files?: File[];
  error?: string;
  onChange: (value: FieldValue) => void;
  onFilesChange?: (files: File[]) => void;
  /** Previously saved metadata (revision edit). Contents are not stored. */
  existingAttachments?: AttachmentMetadata[];
  onRemoveExistingAttachment?: (attachmentId: string) => void;
  /** Newly chosen files are being sent with the request. */
  uploading?: boolean;
}

function FilePill({
  name,
  onRemove,
  uploading = false,
}: {
  name: string;
  onRemove?: () => void;
  uploading?: boolean;
}) {
  return (
    <li className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-50">
      <span
        className={`inline-flex min-w-0 items-center gap-1.5 py-1 pl-2.5 ${onRemove || uploading ? 'pr-2' : 'pr-2.5'}`}
      >
        <Paperclip size={14} className="shrink-0 text-slate-500" aria-hidden />
        <span className="max-w-52 truncate text-sm text-slate-800">{name}</span>
      </span>
      {uploading ? (
        <span
          className="mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center text-slate-500"
          role="status"
          aria-label={`Uploading ${name}`}
        >
          <Loader2 size={14} className="animate-spin" aria-hidden />
        </span>
      ) : onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
        >
          <X size={14} aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

export function DynamicFormField({
  field,
  value,
  files = [],
  error,
  onChange,
  onFilesChange,
  existingAttachments = [],
  onRemoveExistingAttachment,
  uploading = false,
}: DynamicFormFieldProps) {
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const inputId = `field-${field.id}`;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;

  const label = (
    <label htmlFor={inputId} className="block text-sm font-medium text-brand-800">
      {field.label}
      {field.required ? <span className="text-red-600"> *</span> : null}
    </label>
  );

  const help = field.helpText ? (
    <p id={helpId} className="mt-1 text-xs text-brand-500">
      {field.helpText}
    </p>
  ) : null;

  const errorMsg = error ? (
    <p id={errorId} className="mt-1 text-xs text-red-600" role="alert">
      {error}
    </p>
  ) : null;

  const describedBy = [field.helpText ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  const controlClass =
    'mt-1.5 w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 placeholder:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

  if (field.type === 'textarea') {
    return (
      <div>
        {label}
        <textarea
          id={inputId}
          className={`${controlClass} min-h-20 resize-y`}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          required={field.required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
        {help}
        {errorMsg}
      </div>
    );
  }

  if (field.type === 'select') {
    const selected = typeof value === 'string' ? value : '';
    const prompt = field.placeholder?.trim() || 'Select…';
    const selectClass = `${controlClass
      .replace('px-3', 'pl-3 pr-10')
      .replace(
        'text-brand-900',
        selected === '' ? 'text-brand-400' : 'text-brand-900',
      )} [&>option]:text-brand-900`;

    return (
      <div>
        {label}
        <select
          id={inputId}
          className={selectClass}
          value={selected}
          required={field.required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{prompt}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {help}
        {errorMsg}
      </div>
    );
  }

  if (field.type === 'radio') {
    return (
      <fieldset>
        <legend className="text-sm font-medium text-brand-800">
          {field.label}
          {field.required ? <span className="text-red-600"> *</span> : null}
        </legend>
        <div className="mt-2 flex flex-col gap-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-brand-800">
              <input
                type="radio"
                name={field.id}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        {help}
        {errorMsg}
      </fieldset>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div>
        <label className="flex items-start gap-2 text-sm text-brand-800">
          <input
            id={inputId}
            type="checkbox"
            className="mt-0.5"
            checked={value === true}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>
            {field.label}
            {field.required ? <span className="text-red-600"> *</span> : null}
          </span>
        </label>
        {help}
        {errorMsg}
      </div>
    );
  }

  if (field.type === 'file') {
    const reserved = existingAttachments.length;
    const shownError = selectionError || error;
    return (
      <div>
        {label}
        <p id={helpId} className="mt-1 text-xs text-brand-500">
          {FILE_FIELD_RULES}
        </p>
        <input
          id={inputId}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          className="mt-1.5 block w-full text-sm text-brand-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-800 hover:file:bg-brand-200"
          aria-invalid={Boolean(shownError)}
          aria-describedby={helpId}
          disabled={uploading}
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (picked.length === 0) return;
            const result = addPickedFiles(
              files,
              picked,
              reserved,
              existingAttachments.map((attachment) => attachment.fileName),
            );
            onFilesChange?.(result.files);
            onChange(result.files.length > 0 ? result.files.map((item) => item.name).join(', ') : null);
            setSelectionError(result.error);
          }}
        />
        {files.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {files.map((item, index) => (
              <FilePill
                key={`${item.name}-${item.size}-${item.lastModified}`}
                name={item.name}
                uploading={uploading}
                onRemove={uploading ? undefined : () => {
                  const next = files.filter((_, itemIndex) => itemIndex !== index);
                  onFilesChange?.(next);
                  onChange(next.length > 0 ? next.map((entry) => entry.name).join(', ') : null);
                  setSelectionError(null);
                }}
              />
            ))}
          </ul>
        ) : null}
        {existingAttachments.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {existingAttachments.map((attachment) => (
              <FilePill
                key={attachment.id ?? `${attachment.fileName}-${attachment.fileSize}`}
                name={attachment.fileName}
                onRemove={
                  onRemoveExistingAttachment
                    ? () => onRemoveExistingAttachment(attachment.id ?? attachment.fieldId)
                    : undefined
                }
              />
            ))}
          </ul>
        ) : null}
        {shownError ? (
          <p id={errorId} className="mt-1 text-xs text-red-600" role="alert">
            {shownError}
          </p>
        ) : null}
      </div>
    );
  }

  const currency = getCurrencyFieldMeta(field.type);

  if (currency) {
    const step = currency.fractionDigits === 0 ? '1' : '0.01';
    return (
      <div>
        {label}
        <div className="relative mt-1.5">
          <span
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium text-brand-600"
            aria-hidden="true"
          >
            {currency.symbol}
          </span>
          <input
            id={inputId}
            type="number"
            inputMode="decimal"
            step={step}
            className={`${controlClass} mt-0 pl-8`}
            value={value === null || value === undefined ? '' : String(value)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            required={field.required}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(e) => {
              const raw = e.target.value;
              onChange(raw === '' ? null : Number(raw));
            }}
          />
        </div>
        {help}
        {errorMsg}
      </div>
    );
  }

  const inputType =
    field.type === 'number'
      ? 'number'
      : field.type === 'url'
        ? 'url'
        : field.type === 'date'
          ? 'date'
          : 'text';

  return (
    <div>
      {label}
      <input
        id={inputId}
        type={inputType}
        className={controlClass}
        value={value === null || value === undefined ? '' : String(value)}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        min={field.min}
        max={field.max}
        required={field.required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        onChange={(e) => {
          if (isNumericFieldType(field.type)) {
            const raw = e.target.value;
            onChange(raw === '' ? null : Number(raw));
            return;
          }
          onChange(e.target.value);
        }}
      />
      {help}
      {errorMsg}
    </div>
  );
}
