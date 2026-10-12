import type { RequestStatus } from '@/types';
import { REQUEST_STATUSES } from '@/types';
import type { RequestListFilters } from '@/utils/requestFilters';

interface RequestFiltersProps {
  filters: RequestListFilters;
  onChange: (next: RequestListFilters) => void;
  onClear: () => void;
  showClear: boolean;
}

export function RequestFilters({
  filters,
  onChange,
  onClear,
  showClear,
}: RequestFiltersProps) {
  const patch = (partial: Partial<RequestListFilters>) => {
    onChange({ ...filters, ...partial });
  };

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-sm font-semibold text-brand-900">Search & filters</h2>
        {showClear ? (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-brand-700 hover:text-brand-900"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-brand-600">Search</span>
          <input
            type="search"
            value={filters.search}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder="Number, title, or template…"
            className="w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 placeholder:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-brand-600">Status</span>
          <select
            value={filters.status}
            onChange={(e) =>
              patch({ status: e.target.value as RequestStatus | 'all' })
            }
            className="w-full rounded-md border border-brand-200 bg-white py-2 pr-10 pl-3 text-sm text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="all">All statuses</option>
            {REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
