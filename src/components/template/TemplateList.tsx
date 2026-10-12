import { Copy, Eye, Pencil, Power, PowerOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { FormTemplate } from '@/types';
import { paths } from '@/routes/paths';
import { formatDateTime } from '@/utils/formatDisplay';
import { getGroupName } from '@/utils/groupDisplay';
import { getWorkflowTypeLabel } from '@/utils/requestStatus';
import { TemplateStatusBadge } from './TemplateStatusBadge';

interface TemplateListProps {
  templates: FormTemplate[];
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
  onDuplicate: (id: string) => void;
  onPreview: (id: string) => void;
}

export function TemplateList({
  templates,
  onActivate,
  onDeactivate,
  onDuplicate,
  onPreview,
}: TemplateListProps) {
  if (templates.length === 0) return null;

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-100 text-left text-sm">
            <thead className="bg-brand-50/80 text-xs font-semibold uppercase tracking-wide text-brand-600">
              <tr>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Owning group</th>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-brand-50/40">
                  <td className="max-w-[16rem] px-4 py-3">
                    <p className="font-medium text-brand-900">{template.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-brand-500">
                      {template.description || 'No description'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-brand-700">
                    {template.scope === 'generic' ? 'Generic' : 'Group'}
                  </td>
                  <td className="px-4 py-3 text-brand-700">
                    {getGroupName(template.owningGroupId)}
                  </td>
                  <td className="px-4 py-3 text-brand-700">
                    {getWorkflowTypeLabel(template.workflow.type)}
                  </td>
                  <td className="px-4 py-3">
                    <TemplateStatusBadge status={template.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-brand-700">
                    {formatDateTime(template.updatedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        title="Preview"
                        aria-label="Preview"
                        onClick={() => onPreview(template.id)}
                        className="rounded-md p-2 text-brand-700 hover:bg-brand-50"
                      >
                        <Eye size={16} />
                      </button>
                      <Link
                        to={paths.templateEdit(template.id)}
                        title="Edit"
                        aria-label="Edit"
                        className="rounded-md p-2 text-brand-700 hover:bg-brand-50"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        type="button"
                        title="Duplicate"
                        aria-label="Duplicate"
                        onClick={() => onDuplicate(template.id)}
                        className="rounded-md p-2 text-brand-700 hover:bg-brand-50"
                      >
                        <Copy size={16} />
                      </button>
                      {template.status === 'Active' ? (
                        <button
                          type="button"
                          title="Deactivate"
                          aria-label="Deactivate"
                          onClick={() => onDeactivate(template.id)}
                          className="rounded-md p-2 text-orange-700 hover:bg-orange-50"
                        >
                          <PowerOff size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title="Activate"
                          aria-label="Activate"
                          onClick={() => onActivate(template.id)}
                          className="rounded-md p-2 text-emerald-700 hover:bg-emerald-50"
                        >
                          <Power size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="space-y-3 lg:hidden">
        {templates.map((template) => (
          <li
            key={template.id}
            className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-brand-900">{template.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-brand-500">
                  {template.description || 'No description'}
                </p>
              </div>
              <TemplateStatusBadge status={template.status} />
            </div>
            <dl className="mt-3 space-y-1 text-xs text-brand-600">
              <div className="flex justify-between gap-2">
                <dt>Scope</dt>
                <dd>{template.scope === 'generic' ? 'Generic' : 'Group'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Group</dt>
                <dd>{getGroupName(template.owningGroupId)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Workflow</dt>
                <dd>{getWorkflowTypeLabel(template.workflow.type)}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onPreview(template.id)}
                className="rounded-md border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-800"
              >
                Preview
              </button>
              <Link
                to={paths.templateEdit(template.id)}
                className="rounded-md border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-800"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => onDuplicate(template.id)}
                className="rounded-md border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-800"
              >
                Duplicate
              </button>
              {template.status === 'Active' ? (
                <button
                  type="button"
                  onClick={() => onDeactivate(template.id)}
                  className="rounded-md border border-orange-200 px-3 py-1.5 text-xs font-medium text-orange-800"
                >
                  Deactivate
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onActivate(template.id)}
                  className="rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-800"
                >
                  Activate
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
