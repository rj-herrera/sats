import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApprovalWorkflowBuilder } from '@/components/template/ApprovalWorkflowBuilder';
import { FormFieldBuilder } from '@/components/template/FormFieldBuilder';
import { TemplateBasicInformation } from '@/components/template/TemplateBasicInformation';
import { TemplatePreview } from '@/components/template/TemplatePreview';
import { TemplateStatusBadge } from '@/components/template/TemplateStatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { PageScroll } from '@/layouts/PageScroll';
import { paths } from '@/routes/paths';
import {
  createTemplate,
  updateTemplate,
} from '@/services/templateRepository';
import { getTemplateById } from '@/services/templateService';
import type {
  FormFieldDefinition,
  FormTemplate,
  TemplateWorkflow,
  User,
} from '@/types';
import {
  canAccessTemplateManagement,
  canManageTemplate,
} from '@/utils/templatePermissions';
import {
  validateTemplateDraft,
  validateTemplateForActivation,
} from '@/utils/templateValidation';

type EditorStepId = 'basic' | 'fields' | 'workflow' | 'preview';

const STEPS: { id: EditorStepId; label: string }[] = [
  { id: 'basic', label: 'Basic Information' },
  { id: 'fields', label: 'Form Fields' },
  { id: 'workflow', label: 'Approval Workflow' },
  { id: 'preview', label: 'Preview & Publish' },
];

interface EditorState {
  name: string;
  description: string;
  scope: FormTemplate['scope'];
  owningGroupId: string | null;
  allowedGroupIds: string[];
  fields: FormFieldDefinition[];
  workflow: TemplateWorkflow;
  status: FormTemplate['status'];
}

function buildInitialState(user: User, existing?: FormTemplate): EditorState {
  if (existing) {
    return {
      name: existing.name,
      description: existing.description,
      scope: existing.scope,
      owningGroupId: existing.owningGroupId,
      allowedGroupIds: [...existing.allowedGroupIds],
      fields: existing.fields.map((f) => ({ ...f })),
      workflow:
        existing.workflow.type === 'hierarchy_approval'
          ? {
              type: 'hierarchy_approval',
              steps: existing.workflow.steps.map((s) => ({ ...s })),
            }
          : { type: 'review_checking' },
      status: existing.status,
    };
  }

  return {
    name: '',
    description: '',
    scope: 'group',
    owningGroupId: user.groupId,
    allowedGroupIds: [user.groupId],
    fields: [],
    workflow: { type: 'review_checking' },
    status: 'Active',
  };
}

function toPreviewTemplate(
  id: string,
  state: EditorState,
  user: User,
): FormTemplate {
  const now = new Date().toISOString();
  return {
    id,
    name: state.name || 'Untitled template',
    description: state.description,
    scope: state.scope,
    owningGroupId: state.owningGroupId,
    allowedGroupIds: state.allowedGroupIds,
    status: state.status,
    fields: state.fields,
    workflow: state.workflow,
    createdAt: now,
    updatedAt: now,
    createdById: user.id,
    createdByName: user.name,
    updatedById: user.id,
    updatedByName: user.name,
    version: 1,
  };
}

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const { user } = useAuth();
  const navigate = useNavigate();

  const existing = useMemo(
    () => (id ? getTemplateById(id) : undefined),
    [id],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<EditorState | null>(() =>
    user ? buildInitialState(user, existing) : null,
  );
  const [baseline, setBaseline] = useState(() =>
    user ? JSON.stringify(buildInitialState(user, existing)) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // Re-seed only when the signed-in user or template changes. A refreshed user
  // object with the same id (window focus) must not discard in-progress input.
  const draftKey = `${user?.id ?? ''}:${id ?? 'new'}`;

  useEffect(() => {
    if (!user) return;
    if (!isNew && existing && !canManageTemplate(user, existing)) return;
    const initial = buildInitialState(user, existing);
    setState(initial);
    setBaseline(JSON.stringify(initial));
    setStepIndex(0);
    setError(null);
    setMessage(null);
  }, [draftKey]);

  const dirty = state ? JSON.stringify(state) !== baseline : false;

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty || saving) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, saving]);

  const confirmLeave = () => {
    if (!dirty || saving) return true;
    return window.confirm(
      'You have unsaved changes. Leave this page and discard them?',
    );
  };

  if (!user || !canAccessTemplateManagement(user)) {
    return (
      <PageScroll>
        <Denied message="You do not have permission to manage templates." />
      </PageScroll>
    );
  }

  if (!isNew && !existing) {
    return (
      <PageScroll>
        <Denied message="Template not found." />
      </PageScroll>
    );
  }

  if (!isNew && existing && !canManageTemplate(user, existing)) {
    return (
      <PageScroll>
        <Denied message="You do not have permission to edit this template." />
      </PageScroll>
    );
  }

  if (!state) {
    return (
      <PageScroll>
        <div className="py-12 text-center text-sm text-brand-600">
          Loading editor…
        </div>
      </PageScroll>
    );
  }

  const patch = (partial: Partial<EditorState>) => {
    setState((prev) => (prev ? { ...prev, ...partial } : prev));
    setError(null);
    setMessage(null);
  };

  const persist = (status: FormTemplate['status']) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    setFieldErrors({});

    // Templates are only persisted when activated (or saved as Inactive when editing).
    if (status === 'Active') {
      const activation = validateTemplateForActivation(state);
      setWarnings(activation.warnings);
      setFieldErrors(activation.fieldErrors);
      if (!activation.valid) {
        setSaving(false);
        setError(activation.errors.join(' '));
        if (Object.keys(activation.fieldErrors).length > 0) setStepIndex(1);
        else if (state.workflow.type === 'hierarchy_approval') setStepIndex(2);
        else setStepIndex(0);
        return;
      }
    } else {
      const basics = validateTemplateDraft(state);
      if (!basics.valid) {
        setSaving(false);
        setError(basics.errors.join(' '));
        setStepIndex(0);
        return;
      }
      const soft = validateTemplateForActivation({
        ...state,
        description: state.description || ' ',
      });
      setWarnings(soft.warnings);
    }

    const payload = {
      name: state.name,
      description: state.description,
      scope: state.scope,
      owningGroupId: state.owningGroupId,
      allowedGroupIds: state.allowedGroupIds,
      fields: state.fields,
      workflow: state.workflow,
      status,
    };

    const result = isNew
      ? createTemplate(user, payload)
      : updateTemplate(user, existing!.id, payload);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (status === 'Active') {
      navigate(paths.templates, {
        replace: true,
        state: { message: 'Template saved and activated.' },
      });
      return;
    }

    const nextState = buildInitialState(user, result.template);
    setState(nextState);
    setBaseline(JSON.stringify(nextState));
    setMessage('Template saved as Inactive.');
  };

  const previewTemplate = toPreviewTemplate(
    existing?.id ?? 'preview',
    state,
    user,
  );

  const currentStep = STEPS[stepIndex] ?? STEPS[0];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;
  const needsFields = currentStep.id === 'fields' && state.fields.length === 0;

  const goPrevious = () => {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const goNext = () => {
    setError(null);
    setMessage(null);

    if (currentStep.id === 'basic') {
      const draftCheck = validateTemplateDraft(state);
      if (!draftCheck.valid) {
        setError(draftCheck.errors.join(' '));
        return;
      }
    }

    if (needsFields) return;

    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              to={paths.templates}
              onClick={(e) => {
                if (!confirmLeave()) e.preventDefault();
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900"
            >
              <ArrowLeft size={16} aria-hidden />
              Back to Templates
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-brand-900">
              {isNew ? 'New Template' : 'Edit Template'}
            </h1>
            <p className="mt-1 text-sm text-brand-600">
              Complete each step in order, then review and activate.
            </p>
          </div>
          <TemplateStatusBadge status={state.status} />
        </div>

        {message ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {message}
          </div>
        ) : null}
        {error ? (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <nav aria-label="Template setup steps">
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => {
              const isCurrent = index === stepIndex;
              const isComplete = index < stepIndex;
              return (
                <li
                  key={step.id}
                  className={[
                    'rounded-md border px-3 py-2 text-sm',
                    isCurrent
                      ? 'border-brand-700 bg-brand-900 text-white'
                      : isComplete
                        ? 'border-brand-200 bg-brand-50 text-brand-800'
                        : 'border-brand-100 bg-white text-brand-400',
                  ].join(' ')}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-80">
                    Step {index + 1}
                  </span>
                  <span className="mt-0.5 block font-medium">{step.label}</span>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
          {currentStep.id === 'basic' ? (
            <TemplateBasicInformation
              user={user}
              name={state.name}
              description={state.description}
              scope={state.scope}
              owningGroupId={state.owningGroupId}
              allowedGroupIds={state.allowedGroupIds}
              onChange={(partial) => patch(partial)}
            />
          ) : null}

          {currentStep.id === 'fields' ? (
            <FormFieldBuilder
              fields={state.fields}
              fieldErrors={fieldErrors}
              onChange={(fields) => patch({ fields })}
            />
          ) : null}

          {currentStep.id === 'workflow' ? (
            <ApprovalWorkflowBuilder
              workflow={state.workflow}
              warnings={warnings}
              onChange={(workflow) => patch({ workflow })}
            />
          ) : null}

          {currentStep.id === 'preview' ? (
            <div className="space-y-4">
              <TemplatePreview template={previewTemplate} />
              <div className="rounded-md border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
                Review the configuration above. Activating makes this template
                available for new requests. Existing submitted requests keep their
                original snapshots.
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-brand-100 bg-white px-4 py-3 lg:px-6">
        {isLastStep ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={goPrevious}
              className="rounded-md border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50 disabled:opacity-50"
            >
              Previous
            </button>
            <div className="flex flex-wrap gap-2">
              <Link
                to={paths.templates}
                onClick={(e) => {
                  if (!confirmLeave()) e.preventDefault();
                }}
                className="rounded-md border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50"
              >
                Cancel
              </Link>
              <button
                type="button"
                disabled={saving}
                onClick={() => persist('Active')}
                className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
              >
                {saving ? 'Activating…' : 'Activate Template'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={isFirstStep}
              onClick={goPrevious}
              className="rounded-md border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={needsFields}
              onClick={goNext}
              className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Denied({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-brand-100 bg-white px-6 py-12 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-brand-900">Cannot open editor</h1>
      <p className="mt-2 text-sm text-brand-600">{message}</p>
      <Link
        to={paths.templates}
        className="mt-6 inline-block rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white"
      >
        Back to Templates
      </Link>
    </div>
  );
}
