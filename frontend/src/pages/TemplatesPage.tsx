import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileStack, Plus, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TemplateFilters } from '@/components/template/TemplateFilters';
import { TemplateList } from '@/components/template/TemplateList';
import { TemplatePreview } from '@/components/template/TemplatePreview';
import {
  TemplateStatusConfirmDialog,
  type TemplateStatusAction,
} from '@/components/template/TemplateStatusConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { PageScroll } from '@/layouts/PageScroll';
import { paths } from '@/routes/paths';
import { setTemplateStatus } from '@/services/templateRepository';
import { getManageableTemplatesForUser, getTemplateById } from '@/services/templateService';
import { canAccessTemplateManagement } from '@/utils/templatePermissions';
import {
  EMPTY_TEMPLATE_FILTERS,
  filterTemplates,
  hasActiveTemplateFilters,
  type TemplateListFilters,
} from '@/utils/templateFilters';
import { userHasRole } from '@/utils/permissions';

function createdTemplateMessage(state: unknown): string | null {
  if (!state || typeof state !== 'object' || !('message' in state)) return null;
  const message = state.message;
  return typeof message === 'string' && message.trim() ? message : null;
}

export function TemplatesPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<TemplateListFilters>(EMPTY_TEMPLATE_FILTERS);
  const [message, setMessage] = useState<string | null>(() =>
    createdTemplateMessage(location.state),
  );
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusAction, setStatusAction] = useState<{
    id: string;
    name: string;
    action: TemplateStatusAction;
  } | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const templates = useMemo(() => {
    void refreshKey;
    void location.key;
    return getManageableTemplatesForUser(user);
  }, [user, location.key, refreshKey]);

  const filtered = useMemo(
    () => filterTemplates(templates, filters),
    [templates, filters],
  );

  useEffect(() => {
    if (!createdTemplateMessage(location.state)) return;
    navigate(paths.templates, { replace: true, state: null });
  }, [location.state, navigate]);

  useEffect(() => {
    if (!previewId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewId(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [previewId]);

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

  const requestStatusChange = (id: string, action: TemplateStatusAction) => {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setError(null);
    setMessage(null);
    setStatusAction({ id, name: template.name, action });
  };

  const closeStatusDialog = () => {
    if (statusSubmitting) return;
    setStatusAction(null);
  };

  const confirmStatusChange = () => {
    if (!statusAction) return;
    setStatusSubmitting(true);
    setError(null);
    setMessage(null);

    const nextStatus =
      statusAction.action === 'activate' ? 'Active' : 'Inactive';
    const result = setTemplateStatus(user, statusAction.id, nextStatus);

    setStatusSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      setStatusAction(null);
      return;
    }

    setMessage(
      statusAction.action === 'activate'
        ? `“${result.template.name}” activated.`
        : `“${result.template.name}” deactivated.`,
    );
    setStatusAction(null);
    refresh();
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
                onActivate={(id) => requestStatusChange(id, 'activate')}
                onDeactivate={(id) => requestStatusChange(id, 'deactivate')}
                onPreview={setPreviewId}
              />
            )}
          </>
        )}

        <TemplateStatusConfirmDialog
          open={statusAction != null}
          action={statusAction?.action ?? null}
          templateName={statusAction?.name ?? ''}
          submitting={statusSubmitting}
          onCancel={closeStatusDialog}
          onConfirm={confirmStatusChange}
        />

        {previewTemplate
          ? createPortal(
              <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4">
                <button
                  type="button"
                  className="absolute inset-0"
                  aria-label="Close preview"
                  onClick={() => setPreviewId(null)}
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Template preview"
                  className="relative z-10 flex h-[90vh] w-[90vw] flex-col overflow-hidden rounded-lg border border-brand-100 bg-brand-50 shadow-xl"
                >
                  <div className="flex shrink-0 items-center gap-3 border-b border-brand-100 bg-white px-4 py-3">
                    <div className="min-w-0 flex-1 text-base font-bold text-brand-900">
                      Preview mode
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewId(null)}
                      className="rounded-md p-2 text-brand-500 hover:bg-brand-50 hover:text-brand-800"
                      aria-label="Close preview"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
                    <TemplatePreview
                      template={previewTemplate}
                      showNotice={false}
                    />
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    </PageScroll>
  );
}
