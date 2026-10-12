import { listGroups } from '@/services/groupRepository';
import { TEMPLATE_STATUSES } from '@/types';
import type { TemplateListFilters } from '@/utils/templateFilters';

interface TemplateFiltersProps {
  filters: TemplateListFilters;
  onChange: (next: TemplateListFilters) => void;
  onClear: () => void;
  showClear: boolean;
  showGroupFilter?: boolean;
}

export function TemplateFilters({
  filters,
  onChange,
  onClear,
  showClear,
  showGroupFilter = false,
}: TemplateFiltersProps) {
  return (
    <section className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <label className="block sm:col-span-2 xl:col-span-1">
          <span className="mb-1 block text-xs font-medium text-brand-600">Search</span>
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Template name…"
            className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-brand-600">Workflow</span>
          <select
            value={filters.workflowType}
            onChange={(e) =>
              onChange({
                ...filters,
                workflowType: e.target.value as TemplateListFilters['workflowType'],
              })
            }
            className="w-full rounded-md border border-brand-200 py-2 pr-10 pl-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="all">All workflows</option>
            <option value="review_checking">Review / Checking</option>
            <option value="hierarchy_approval">Hierarchy Approval</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-brand-600">Scope</span>
          <select
            value={filters.scope}
            onChange={(e) =>
              onChange({
                ...filters,
                scope: e.target.value as TemplateListFilters['scope'],
              })
            }
            className="w-full rounded-md border border-brand-200 py-2 pr-10 pl-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="all">All scopes</option>
            <option value="group">Group-specific</option>
            <option value="generic">Generic / Shared</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-brand-600">Status</span>
          <select
            value={filters.status}
            onChange={(e) =>
              onChange({
                ...filters,
                status: e.target.value as TemplateListFilters['status'],
              })
            }
            className="w-full rounded-md border border-brand-200 py-2 pr-10 pl-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="all">All statuses</option>
            {TEMPLATE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        {showGroupFilter ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-600">Group</span>
            <select
              value={filters.groupId}
              onChange={(e) => onChange({ ...filters, groupId: e.target.value })}
              className="w-full rounded-md border border-brand-200 py-2 pr-10 pl-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="all">All groups</option>
              {listGroups().map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {showClear ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 text-sm font-medium text-brand-800 hover:underline"
        >
          Clear filters
        </button>
      ) : null}
    </section>
  );
}
