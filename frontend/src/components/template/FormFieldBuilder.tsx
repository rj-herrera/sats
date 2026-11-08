import { useEffect, useLayoutEffect, useRef, useState, type DragEvent } from 'react';
import { ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-react';
import { DynamicFormField } from '@/components/request/DynamicFormField';
import type { FieldValue, FormFieldDefinition, FormFieldType } from '@/types';
import { FORM_FIELD_TYPES } from '@/types';
import { createFieldId } from '@/services/templateNormalizer';
import {
  getCurrencyFieldMeta,
  isNumericFieldType,
} from '@/utils/currencyFields';
import { FILE_FIELD_RULES } from '@/utils/fileAttachments';

interface FormFieldBuilderProps {
  fields: FormFieldDefinition[];
  fieldErrors: Record<string, string>;
  onChange: (fields: FormFieldDefinition[]) => void;
}

const inputClass =
  'w-full rounded-md border border-brand-200 px-3 py-2 text-sm text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

function fieldTypeLabel(type: FormFieldType): string {
  const currency = getCurrencyFieldMeta(type);
  if (currency) return currency.label;

  switch (type) {
    case 'textarea':
      return 'Textarea';
    case 'select':
      return 'Select dropdown';
    case 'radio':
      return 'Radio group';
    case 'checkbox':
      return 'Checkbox';
    case 'file':
      return 'File attachment';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

function emptyField(existingIds: string[]): FormFieldDefinition {
  return {
    id: createFieldId(existingIds),
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
    helpText: '',
    options: [],
  };
}

function defaultPreviewValue(type: FormFieldType): FieldValue {
  return type === 'checkbox' ? false : '';
}

function reorderFields(
  fields: FormFieldDefinition[],
  from: number,
  to: number,
): FormFieldDefinition[] {
  if (from === to || from < 0 || to < 0 || from >= fields.length || to >= fields.length) {
    return fields;
  }
  const next = [...fields];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function FieldLivePreview({ field }: { field: FormFieldDefinition }) {
  const [value, setValue] = useState<FieldValue>(() =>
    defaultPreviewValue(field.type),
  );
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    setValue(defaultPreviewValue(field.type));
    setFiles([]);
  }, [field.type, field.id]);

  const previewField: FormFieldDefinition = {
    ...field,
    id: `preview-${field.id}`,
    label: field.label.trim() || 'Untitled field',
  };

  return (
    <div className="mt-4 border-t border-brand-100 pt-4">
      <p className="mb-2 text-xs font-medium text-brand-500">Preview</p>
      <div className="rounded-md border border-dashed border-brand-200 bg-brand-50/40 p-3">
        <DynamicFormField
          field={previewField}
          value={value}
          files={files}
          onChange={setValue}
          onFilesChange={setFiles}
        />
      </div>
    </div>
  );
}

export function FormFieldBuilder({
  fields,
  fieldErrors,
  onChange,
}: FormFieldBuilderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const pendingScrollId = useRef<string | null>(null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const errorKey = Object.keys(fieldErrors).sort().join('|');

  useEffect(() => {
    if (!errorKey) return;
    const errored = fieldsRef.current.find((field) => fieldErrors[field.id]);
    if (errored) setExpandedId(errored.id);
  }, [errorKey, fieldErrors]);

  useLayoutEffect(() => {
    const id = pendingScrollId.current;
    if (!id) return;
    const node = cardRefs.current[id];
    if (!node) return;
    pendingScrollId.current = null;
    const scroller = node.closest('.overflow-y-auto');
    const sticky = scroller?.querySelector('.sticky');
    if (!scroller || !sticky) {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    const stickyBottom = sticky.getBoundingClientRect().bottom + 8;
    const scrollerBottom = scroller.getBoundingClientRect().bottom - 8;
    const top = node.getBoundingClientRect().top;
    if (top < stickyBottom) {
      scroller.scrollTop -= stickyBottom - top;
    }
    const bottom = node.getBoundingClientRect().bottom;
    if (bottom > scrollerBottom) {
      scroller.scrollTop += bottom - scrollerBottom;
    }
  }, [fields, expandedId]);

  const updateField = (index: number, patch: Partial<FormFieldDefinition>) => {
    onChange(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  };

  const addField = () => {
    const field = emptyField(fields.map((item) => item.id));
    pendingScrollId.current = field.id;
    setExpandedId(field.id);
    onChange([...fields, field]);
  };

  const toggle = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <section>
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-white px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-brand-900">Form fields</h2>
          <p className="mt-1 text-sm text-brand-500">
            Configure the fields requesters will complete. Drag a field to reorder.
          </p>
        </div>
        <button
          type="button"
          onClick={addField}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-900 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          <Plus size={16} />
          Add Field
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="mx-5 my-4 rounded-md border border-dashed border-brand-200 px-4 py-8 text-center text-sm text-brand-500">
          No fields yet. Add a field to start building the form.
        </p>
      ) : (
        <ul className="space-y-3 px-5 py-4">
          {fields.map((field, index) => (
            <FieldCard
              key={field.id}
              field={field}
              expanded={expandedId === field.id}
              error={fieldErrors[field.id]}
              dragging={dragIndex === index}
              dropTarget={overIndex === index && dragIndex !== index}
              cardRef={(node) => {
                cardRefs.current[field.id] = node;
              }}
              onToggle={() => toggle(field.id)}
              onDelete={() => {
                if (expandedId === field.id) setExpandedId(null);
                onChange(fields.filter((_, i) => i !== index));
              }}
              onPatch={(patch) => updateField(index, patch)}
              onDragStart={(event) => {
                setDragIndex(index);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', String(index));
                const card = cardRefs.current[field.id];
                if (card) event.dataTransfer.setDragImage(card, 24, 20);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setOverIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = Number(event.dataTransfer.getData('text/plain'));
                setDragIndex(null);
                setOverIndex(null);
                if (!Number.isInteger(from)) return;
                onChange(reorderFields(fields, from, index));
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function FieldCard({
  field,
  expanded,
  error,
  dragging,
  dropTarget,
  cardRef,
  onToggle,
  onDelete,
  onPatch,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  field: FormFieldDefinition;
  expanded: boolean;
  error?: string;
  dragging: boolean;
  dropTarget: boolean;
  cardRef: (node: HTMLLIElement | null) => void;
  onToggle: () => void;
  onDelete: () => void;
  onPatch: (patch: Partial<FormFieldDefinition>) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (event: DragEvent<HTMLLIElement>) => void;
}) {
  const label = field.label.trim() || 'Untitled field';

  return (
    <li
      ref={cardRef}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={[
        'rounded-lg border bg-white shadow-sm',
        dropTarget ? 'border-brand-500' : 'border-brand-100',
        dragging ? 'opacity-60' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          draggable
          title="Drag to reorder"
          aria-label={`Drag to reorder ${label}`}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="cursor-grab rounded p-1 text-brand-400 hover:bg-brand-50 hover:text-brand-700 active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0 truncate text-sm font-medium text-brand-900">{label}</span>
          <span className="shrink-0 text-xs text-brand-500">{fieldTypeLabel(field.type)}</span>
          {field.required ? (
            <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
              Required
            </span>
          ) : null}
        </button>
        <button
          type="button"
          title={expanded ? 'Collapse field' : 'Expand field'}
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expanded}
          onClick={onToggle}
          className="rounded p-1.5 text-brand-500 hover:bg-brand-50 hover:text-brand-800"
        >
          <ChevronDown size={16} className={expanded ? 'rotate-180' : ''} />
        </button>
        <button
          type="button"
          title="Delete field"
          aria-label={`Delete ${label}`}
          onClick={onDelete}
          className="rounded p-1.5 text-brand-500 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {!expanded && error ? (
        <p className="px-3 pb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {expanded ? (
        <div className="border-t border-brand-100 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-600">Label *</span>
              <input
                value={field.label}
                onChange={(event) => onPatch({ label: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-600">Field ID *</span>
              <input
                value={field.id}
                onChange={(event) =>
                  onPatch({ id: event.target.value.replace(/\s+/g, '_').toLowerCase() })
                }
                className={`${inputClass} font-mono`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-600">Type</span>
              <select
                value={field.type}
                onChange={(event) => {
                  const type = event.target.value as FormFieldType;
                  onPatch({
                    type,
                    options:
                      type === 'select' || type === 'radio'
                        ? field.options?.length
                          ? field.options
                          : [{ value: 'option_1', label: 'Option 1' }]
                        : undefined,
                    ...(type === 'file'
                      ? {
                          placeholder: undefined,
                          helpText: undefined,
                          accept: undefined,
                          maxFileSizeMb: undefined,
                        }
                      : {}),
                  });
                }}
                className="w-full rounded-md border border-brand-200 py-2 pr-10 pl-3 text-sm text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {FORM_FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {fieldTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(event) => onPatch({ required: event.target.checked })}
                className="rounded border-brand-300"
              />
              <span className="text-sm text-brand-800">Required</span>
            </label>
            {field.type !== 'file' ? (
              <>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-brand-600">Placeholder</span>
                  <input
                    value={field.placeholder ?? ''}
                    onChange={(event) => onPatch({ placeholder: event.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-brand-600">Help text</span>
                  <input
                    value={field.helpText ?? ''}
                    onChange={(event) => onPatch({ helpText: event.target.value })}
                    className={inputClass}
                  />
                </label>
              </>
            ) : (
              <p className="text-sm text-brand-600 sm:col-span-2">{FILE_FIELD_RULES}</p>
            )}

            {(field.type === 'text' || field.type === 'textarea') && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-brand-600">Max length</span>
                <input
                  type="number"
                  value={field.maxLength ?? ''}
                  onChange={(event) =>
                    onPatch({
                      maxLength: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                  className={inputClass}
                />
              </label>
            )}

            {isNumericFieldType(field.type) && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-brand-600">Minimum</span>
                  <input
                    type="number"
                    value={field.min ?? ''}
                    onChange={(event) =>
                      onPatch({
                        min: event.target.value === '' ? undefined : Number(event.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-brand-600">Maximum</span>
                  <input
                    type="number"
                    value={field.max ?? ''}
                    onChange={(event) =>
                      onPatch({
                        max: event.target.value === '' ? undefined : Number(event.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </label>
              </>
            )}
          </div>

          {(field.type === 'select' || field.type === 'radio') && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-brand-600">Options</p>
                <button
                  type="button"
                  className="text-xs font-medium text-brand-800 hover:underline"
                  onClick={() => {
                    const options = [
                      ...(field.options ?? []),
                      {
                        value: `option_${(field.options?.length ?? 0) + 1}`,
                        label: `Option ${(field.options?.length ?? 0) + 1}`,
                      },
                    ];
                    onPatch({ options });
                  }}
                >
                  Add option
                </button>
              </div>
              <ul className="space-y-2">
                {(field.options ?? []).map((opt, optIndex) => (
                  <li key={`${field.id}-opt-${optIndex}`} className="flex gap-2">
                    <input
                      value={opt.label}
                      onChange={(event) => {
                        const options = [...(field.options ?? [])];
                        options[optIndex] = { ...options[optIndex], label: event.target.value };
                        onPatch({ options });
                      }}
                      placeholder="Label"
                      className="w-full rounded-md border border-brand-200 px-2 py-1.5 text-sm"
                    />
                    <input
                      value={opt.value}
                      onChange={(event) => {
                        const options = [...(field.options ?? [])];
                        options[optIndex] = { ...options[optIndex], value: event.target.value };
                        onPatch({ options });
                      }}
                      placeholder="Value"
                      className="w-full rounded-md border border-brand-200 px-2 py-1.5 font-mono text-sm"
                    />
                    <button
                      type="button"
                      aria-label={`Remove option ${opt.label || optIndex + 1}`}
                      className="rounded p-1.5 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        onPatch({
                          options: (field.options ?? []).filter((_, i) => i !== optIndex),
                        });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <FieldLivePreview field={field} />
        </div>
      ) : null}
    </li>
  );
}
