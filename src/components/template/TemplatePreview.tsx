import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { ApprovalWorkflowPreview } from '@/components/request/ApprovalWorkflowPreview';
import { DynamicRequestForm } from '@/components/request/DynamicRequestForm';
import { resolveHierarchyWorkflow } from '@/services/workflowService';
import type { FieldValue, FormTemplate } from '@/types';
import { emptyValuesForTemplate } from '@/utils/formValidation';
import { formatAllowedGroups, getGroupName } from '@/utils/groupDisplay';
import { getWorkflowTypeLabel } from '@/utils/requestStatus';
import { TemplateStatusBadge } from './TemplateStatusBadge';

interface TemplatePreviewProps {
  template: FormTemplate;
  /** When false, the preview notice is omitted (e.g. shown in a modal header instead). */
  showNotice?: boolean;
}

export function TemplatePreview({
  template,
  showNotice = true,
}: TemplatePreviewProps) {
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    emptyValuesForTemplate(template),
  );
  const [files, setFiles] = useState<Record<string, File | null>>({});

  const hierarchy = useMemo(() => {
    if (template.workflow.type !== 'hierarchy_approval') return null;
    return resolveHierarchyWorkflow(template.workflow);
  }, [template.workflow]);

  return (
    <section className="space-y-4">
      {showNotice ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-950">
          Preview mode
        </div>
      ) : null}

      <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-brand-900">
                {template.name}
              </h2>
              {template.description.trim() ? (
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-brand-500 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
                    aria-label="Template description"
                  >
                    <Info size={18} aria-hidden />
                  </button>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute top-full left-1/2 z-20 mt-2 w-72 -translate-x-1/2 rounded-md border border-brand-200 bg-white px-3 py-2 text-left text-xs leading-relaxed text-brand-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:w-80"
                  >
                    {template.description}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
          <TemplateStatusBadge status={template.status} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
              Scope
            </dt>
            <dd className="mt-1 text-brand-900">
              {template.scope === 'generic' ? 'Generic / Shared' : 'Group-specific'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
              Owning group
            </dt>
            <dd className="mt-1 text-brand-900">
              {getGroupName(template.owningGroupId)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
              Available to
            </dt>
            <dd className="mt-1 text-brand-900">
              {formatAllowedGroups(template.allowedGroupIds)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">
              Workflow
            </dt>
            <dd className="mt-1 text-brand-900">
              {getWorkflowTypeLabel(template.workflow.type)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DynamicRequestForm
            template={template}
            values={values}
            files={files}
            errors={{}}
            onChange={(fieldId, value) =>
              setValues((prev) => ({ ...prev, [fieldId]: value }))
            }
            onFileChange={(fieldId, file) =>
              setFiles((prev) => ({ ...prev, [fieldId]: file }))
            }
          />
        </div>
        <aside className="lg:col-span-1">
          {template.workflow.type === 'review_checking' ? (
            <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-brand-900">
                Reviewers / Approvers
              </h3>
              <p className="mt-2 text-sm text-brand-600">
                Requesters will select one or more reviewers when submitting this
                template. Reviews are handled independently without a fixed
                approval order.
              </p>
            </section>
          ) : hierarchy ? (
            <ApprovalWorkflowPreview
              steps={hierarchy.ok ? hierarchy.steps : []}
              errors={hierarchy.ok ? [] : hierarchy.errors}
            />
          ) : null}
        </aside>
      </div>
    </section>
  );
}
