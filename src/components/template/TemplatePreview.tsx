import { useMemo, useState } from 'react';
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
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
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
      <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <strong>Preview mode</strong> — this does not create or submit a request.
      </div>

      <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-brand-900">{template.name}</h2>
            <p className="mt-1 text-sm text-brand-600">
              {template.description || 'No description'}
            </p>
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
