import { useMemo, useState } from 'react';
import { FileStack, Plus } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TemplateFilters } from '@/components/template/TemplateFilters';
import { TemplateList } from '@/components/template/TemplateList';
import { TemplatePreview } from '@/components/template/TemplatePreview';
import { useAuth } from '@/contexts/AuthContext';
import { PageScroll } from '@/layouts/PageScroll';
import { paths } from '@/routes/paths';
import {
  duplicateTemplate,
  setTemplateStatus,
} from '@/services/templateRepository';
import { getManageableTemplatesForUser, getTemplateById } from '@/services/templateService';
import { canAccessTemplateManagement } from '@/utils/templatePermissions';
import {
  EMPTY_TEMPLATE_FILTERS,
  filterTemplates,
  hasActiveTemplateFilters,
  type TemplateListFilters,
} from '@/utils/templateFilters';
import { userHasRole } from '@/utils/permissions';

export function TemplatesPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<TemplateListFilters>(EMPTY_TEMPLATE_FILTERS);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const templates = useMemo(() => {
    void refreshKey;
    void location.key;
    return getManageableTemplatesForUser(user);
  }, [user, location.key, refreshKey]);

  const filtered = useMemo(
    () => filterTemplates(templates, filters),
    [templates, filters],
  );

  if (!user || !canAccessTemplateManagement(user)) {
    return (
      <PageScroll>
        <div className="mx-auto max-w-lg rounded-lg border border-brand-100 bg-white px-6 py-12 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-brand-900">Access denied</h1>
          <p className="mt-2 text-sm text-brand-600">
            You do not have permission to manage templates.
          </p>
          <Link
            to={paths.requests}
            className="mt-6 inline-block rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white"
          >
            Back to My Requests
          </Link>
        </div>
      </PageScroll>
    );
  }

  const showGroupFilter = userHasRole(user, 'admin');
  const filtersActive = hasActiveTemplateFilters(filters);
  const previewTemplate = previewId ? getTemplateById(previewId) : null;

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleActivate = (id: string) => {
    setError(null);
    setMessage(null);
    const result = setTemplateStatus(user, id, 'Active');
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(`“${result.template.name}” activated.`);
    refresh();
  };

  const handleDeactivate = (id: string) => {
    setError(null);
    setMessage(null);
    const result = setTemplateStatus(user, id, 'Inactive');
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(`“${result.template.name}” deactivated.`);
    refresh();
  };

  const handleDuplicate = (id: string) => {
    setError(null);
    setMessage(null);
    const result = duplicateTemplate(user, id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(`Duplicated as “${result.template.name}” (Draft).`);
    refresh();
    navigate(paths.templateEdit(result.template.id));
  };

  return (
    <PageScroll>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-brand-900">
              Template Management
            </h1>
            <p className="mt-1 text-sm text-brand-600">
              Create and configure form templates and their approval workflows.
              Showing {filtered.length}
              {filtersActive ? ` of ${templates.length}` : ''} template
              {filtered.length === 1 ? '' : 's'}.
            </p>
          </div>
          <Link
            to={paths.templateNew}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            <Plus size={16} />
            Create Template
          </Link>
        </div>

        {message ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        {templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-brand-200 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <FileStack size={22} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-brand-900">
              No manageable templates
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-600">
              Create a template to define request fields and approval workflow.
            </p>
          </div>
        ) : (
          <>
            <TemplateFilters
              filters={filters}
              onChange={setFilters}
              onClear={() => setFilters(EMPTY_TEMPLATE_FILTERS)}
              showClear={filtersActive}
              showGroupFilter={showGroupFilter}
            />

            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
                <h2 className="text-lg font-semibold text-brand-900">
                  No matching templates
                </h2>
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_TEMPLATE_FILTERS)}
                  className="mt-4 text-sm font-medium text-brand-800 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <TemplateList
                templates={filtered}
                onActivate={handleActivate}
                onDeactivate={handleDeactivate}
                onDuplicate={handleDuplicate}
                onPreview={setPreviewId}
              />
            )}
          </>
        )}

        {previewTemplate ? (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
            <div className="mx-auto max-w-5xl rounded-lg bg-brand-50 p-4 shadow-xl lg:p-6">
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewId(null)}
                  className="rounded-md border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800"
                >
                  Close preview
                </button>
              </div>
              <TemplatePreview template={previewTemplate} />
            </div>
          </div>
        ) : null}
      </div>
    </PageScroll>
  );
}
