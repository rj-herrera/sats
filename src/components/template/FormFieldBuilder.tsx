import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { FormFieldDefinition, FormFieldType } from '@/types';
import { FORM_FIELD_TYPES } from '@/types';
import { createFieldId } from '@/services/templateNormalizer';

interface FormFieldBuilderProps {
  fields: FormFieldDefinition[];
  fieldErrors: Record<string, string>;
  onChange: (fields: FormFieldDefinition[]) => void;
}

function fieldTypeLabel(type: FormFieldType): string {
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

export function FormFieldBuilder({
  fields,
  fieldErrors,
  onChange,
}: FormFieldBuilderProps) {
  const updateField = (index: number, patch: Partial<FormFieldDefinition>) => {
    const next = fields.map((field, i) =>
      i === index ? { ...field, ...patch } : field,
    );
    onChange(next);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-brand-900">Form fields</h2>
          <p className="mt-1 text-sm text-brand-500">
            Configure the fields requesters will complete. Reorder with Move Up /
            Move Down.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange([...fields, emptyField(fields.map((f) => f.id))])
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-900 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          <Plus size={16} />
          Add field
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed border-brand-200 px-4 py-8 text-center text-sm text-brand-500">
          No fields yet. Add a field to start building the form.
        </p>
      ) : (
        <ul className="space-y-4">
          {fields.map((field, index) => (
            <li
              key={field.id}
              className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-brand-900">
                  Field {index + 1}
                  {field.label ? ` — ${field.label}` : ''}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded p-1.5 text-brand-600 hover:bg-brand-50 disabled:opacity-40"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    title="Move down"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded p-1.5 text-brand-600 hover:bg-brand-50 disabled:opacity-40"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    title="Remove field"
                    onClick={() => onChange(fields.filter((_, i) => i !== index))}
                    className="rounded p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-brand-600">
                    Label *
                  </span>
                  <input
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                    className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-brand-600">
                    Field ID *
                  </span>
                  <input
                    value={field.id}
                    onChange={(e) =>
                      updateField(index, {
                        id: e.target.value.replace(/\s+/g, '_').toLowerCase(),
                      })
                    }
                    className="w-full rounded-md border border-brand-200 px-3 py-2 font-mono text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-brand-600">
                    Type
                  </span>
                  <select
                    value={field.type}
                    onChange={(e) => {
                      const type = e.target.value as FormFieldType;
                      updateField(index, {
                        type,
                        options:
                          type === 'select' || type === 'radio'
                            ? field.options?.length
                              ? field.options
                              : [{ value: 'option_1', label: 'Option 1' }]
                            : undefined,
                      });
                    }}
                    className="w-full rounded-md border border-brand-200 py-2 pr-10 pl-3 text-sm"
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
                    onChange={(e) =>
                      updateField(index, { required: e.target.checked })
                    }
                    className="rounded border-brand-300"
                  />
                  <span className="text-sm text-brand-800">Required</span>
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-brand-600">
                    Placeholder
                  </span>
                  <input
                    value={field.placeholder ?? ''}
                    onChange={(e) =>
                      updateField(index, { placeholder: e.target.value })
                    }
                    className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-brand-600">
                    Help text
                  </span>
                  <input
                    value={field.helpText ?? ''}
                    onChange={(e) =>
                      updateField(index, { helpText: e.target.value })
                    }
                    className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
                  />
                </label>

                {(field.type === 'text' || field.type === 'textarea') && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-brand-600">
                      Max length
                    </span>
                    <input
                      type="number"
                      value={field.maxLength ?? ''}
                      onChange={(e) =>
                        updateField(index, {
                          maxLength:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                      className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
                    />
                  </label>
                )}

                {field.type === 'number' && (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-brand-600">
                        Minimum
                      </span>
                      <input
                        type="number"
                        value={field.min ?? ''}
                        onChange={(e) =>
                          updateField(index, {
                            min:
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                        className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-brand-600">
                        Maximum
                      </span>
                      <input
                        type="number"
                        value={field.max ?? ''}
                        onChange={(e) =>
                          updateField(index, {
                            max:
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                        className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
                      />
                    </label>
                  </>
                )}

                {field.type === 'file' && (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-brand-600">
                        Allowed types
                      </span>
                      <input
                        value={field.accept ?? ''}
                        onChange={(e) =>
                          updateField(index, { accept: e.target.value })
                        }
                        placeholder=".pdf,.docx,image/*"
                        className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-brand-600">
                        Max size (MB)
                      </span>
                      <input
                        type="number"
                        value={field.maxFileSizeMb ?? ''}
                        onChange={(e) =>
                          updateField(index, {
                            maxFileSizeMb:
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                        className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
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
                        updateField(index, { options });
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
                          onChange={(e) => {
                            const options = [...(field.options ?? [])];
                            options[optIndex] = {
                              ...options[optIndex],
                              label: e.target.value,
                            };
                            updateField(index, { options });
                          }}
                          placeholder="Label"
                          className="w-full rounded-md border border-brand-200 px-2 py-1.5 text-sm"
                        />
                        <input
                          value={opt.value}
                          onChange={(e) => {
                            const options = [...(field.options ?? [])];
                            options[optIndex] = {
                              ...options[optIndex],
                              value: e.target.value,
                            };
                            updateField(index, { options });
                          }}
                          placeholder="Value"
                          className="w-full rounded-md border border-brand-200 px-2 py-1.5 font-mono text-sm"
                        />
                        <button
                          type="button"
                          className="rounded p-1.5 text-red-600 hover:bg-red-50"
                          onClick={() => {
                            const options = (field.options ?? []).filter(
                              (_, i) => i !== optIndex,
                            );
                            updateField(index, { options });
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {fieldErrors[field.id] ? (
                <p className="mt-3 text-sm text-red-600" role="alert">
                  {fieldErrors[field.id]}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
