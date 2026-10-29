import type { FormTemplate } from '@/types';

interface TemplateSelectorProps {
  templates: FormTemplate[];
  value: string;
  onChange: (templateId: string) => void;
  description?: string;
}

export function TemplateSelector({
  templates,
  value,
  onChange,
  description,
}: TemplateSelectorProps) {
  const trimmedDescription = description?.trim();

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <label htmlFor="template-select" className="block text-sm font-medium text-brand-800">
        Form template <span className="text-red-600">*</span>
      </label>
      <select
        id="template-select"
        className="mt-1.5 w-full rounded-md border border-brand-200 bg-white py-2 pr-10 pl-3 text-sm text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a template…</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
            {template.scope === 'group' ? ' (Group)' : ' (Shared)'}
          </option>
        ))}
      </select>
      {trimmedDescription ? (
        <p className="mt-2 text-sm leading-relaxed text-brand-600">{trimmedDescription}</p>
      ) : null}
    </section>
  );
}
