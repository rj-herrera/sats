import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApprovalWorkflowPreview } from '@/components/request/ApprovalWorkflowPreview';
import { DynamicRequestForm } from '@/components/request/DynamicRequestForm';
import { RequestFormActions } from '@/components/request/RequestFormActions';
import { ReviewerSelector } from '@/components/request/ReviewerSelector';
import { TemplateSelector } from '@/components/request/TemplateSelector';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { paths } from '@/routes/paths';
import { createSubmittedRequest } from '@/services/requestApi';
import { listAvailableTemplates } from '@/services/templateApi';
import {
  listSelectableEmployees,
  listSelectableReviewers,
  resolveHierarchyForTemplate,
} from '@/services/workflowService';
import type { FieldValue, FormTemplate } from '@/types';
import { emptyValuesForTemplate, validateRequestForm } from '@/utils/formValidation';

export function RequestFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [availableTemplates, setAvailableTemplates] = useState<FormTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState('');
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<string[]>([]);
  const [reviewerUnfinished, setReviewerUnfinished] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void listAvailableTemplates().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setAvailableTemplates([]);
        setTemplatesError(result.error);
        return;
      }
      setAvailableTemplates(result.data);
      setTemplatesError(null);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const selectedTemplate: FormTemplate | undefined = templateId
    ? availableTemplates.find((template) => template.id === templateId)
    : undefined;

  const hierarchyResult = useMemo(() => {
    if (!selectedTemplate || selectedTemplate.workflow.type !== 'hierarchy_approval') {
      return null;
    }
    return resolveHierarchyForTemplate(selectedTemplate);
  }, [selectedTemplate]);

  const reviewerCandidates = useMemo(() => {
    if (!user || selectedTemplate?.workflow.type !== 'review_checking') return [];
    if (selectedTemplate.scope === 'generic') return listSelectableEmployees(user);
    return listSelectableReviewers(user);
  }, [user, selectedTemplate]);

  const resetForTemplate = (template: FormTemplate | undefined) => {
    setFieldErrors({});
    setFormError(null);
    setSelectedReviewerIds([]);
    setReviewerUnfinished(false);
    setFiles({});
    if (template) {
      setValues(emptyValuesForTemplate(template));
    } else {
      setValues({});
    }
  };

  const handleTemplateChange = (nextId: string) => {
    setTemplateId(nextId);
    const template = nextId
      ? availableTemplates.find((item) => item.id === nextId)
      : undefined;
    resetForTemplate(template);
  };

  const handleReset = () => {
    setTemplateId('');
    resetForTemplate(undefined);
  };

  const handleSubmit = async () => {
    if (!user || !selectedTemplate) {
      setFormError('Select a template before submitting.');
      return;
    }

    const validation = validateRequestForm({
      template: selectedTemplate,
      values,
      files,
      selectedReviewerIds,
    });

    const reviewerError = reviewerUnfinished
      ? 'Choose an employee for each reviewer row, or remove the unfinished row.'
      : validation.formError;

    setFieldErrors(validation.fieldErrors);
    setFormError(reviewerError);

    if (!validation.valid || reviewerError) {
      return;
    }

    if (
      selectedTemplate.workflow.type === 'hierarchy_approval' &&
      (!hierarchyResult || !hierarchyResult.ok)
    ) {
      setFormError(
        hierarchyResult && !hierarchyResult.ok
          ? hierarchyResult.errors.join(' ')
          : 'Approval workflow could not be resolved.',
      );
      return;
    }

    setSubmitting(true);
    const saved = await createSubmittedRequest(
      {
        templateId: selectedTemplate.id,
        fieldValues: values,
        reviewerIds:
          selectedTemplate.workflow.type === 'review_checking' ? selectedReviewerIds : undefined,
      },
      files,
    );
    setSubmitting(false);

    if (!saved.ok) {
      setFormError(saved.error);
      return;
    }

    showToast({
      tone: 'success',
      title: 'Request submitted',
      description: `${saved.data.requestNumber} was submitted.`,
    });
    navigate(paths.requests);
  };

  if (!user) {
    return null;
  }

  const canAttemptSubmit = Boolean(selectedTemplate) && !submitting;
  const hierarchyBlocksSubmit =
    selectedTemplate?.workflow.type === 'hierarchy_approval' &&
    hierarchyResult !== null &&
    !hierarchyResult.ok;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-4 lg:p-6">
        <div className="shrink-0">
          <h1 className="text-xl font-semibold text-brand-900">New Request</h1>
        </div>

        <div className="shrink-0">
          <TemplateSelector
            templates={availableTemplates}
            value={templateId}
            onChange={handleTemplateChange}
            description={selectedTemplate?.description}
          />
          {templatesError ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {templatesError}
            </p>
          ) : null}
        </div>

        {selectedTemplate && (
          <>
            {formError && selectedTemplate.workflow.type === 'hierarchy_approval' ? (
              <p className="shrink-0 text-sm text-red-600" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="grid min-h-0 items-start gap-6 overflow-hidden grid-cols-1 lg:flex-1 lg:grid-cols-3">
              <div className="flex min-h-0 min-w-0 self-stretch flex-col overflow-hidden lg:col-span-2">
                <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm">
                  <h2 className="shrink-0 px-5 pt-5 text-base font-semibold text-brand-900">
                    Request information
                  </h2>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-16">
                    <DynamicRequestForm
                      embedded
                      uploading={submitting}
                      template={selectedTemplate}
                      values={values}
                      files={files}
                      errors={fieldErrors}
                      onChange={(fieldId, value) => {
                        setValues((prev) => ({ ...prev, [fieldId]: value }));
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next[fieldId];
                          return next;
                        });
                      }}
                      onFilesChange={(fieldId, next) => {
                        setFiles((prev) => ({ ...prev, [fieldId]: next }));
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next[fieldId];
                          return next;
                        });
                      }}
                    />
                  </div>
                </section>
              </div>

              <aside className="min-h-0 min-w-0 self-stretch overflow-hidden lg:col-span-1">
                {selectedTemplate.workflow.type === 'review_checking' ? (
                  <ReviewerSelector
                    key={selectedTemplate.id}
                    candidates={reviewerCandidates}
                    audience={selectedTemplate.scope === 'generic' ? 'employee' : 'approver'}
                    initialGroupId={
                      selectedTemplate.scope === 'group'
                        ? (selectedTemplate.owningGroupId ?? '')
                        : ''
                    }
                    error={formError}
                    onChange={(ids, unfinished) => {
                      setSelectedReviewerIds(ids);
                      setReviewerUnfinished(unfinished);
                      setFormError(null);
                    }}
                  />
                ) : (
                  <ApprovalWorkflowPreview
                    steps={hierarchyResult?.ok ? hierarchyResult.steps : []}
                    errors={
                      hierarchyResult && !hierarchyResult.ok ? hierarchyResult.errors : []
                    }
                  />
                )}
              </aside>
            </div>
          </>
        )}
      </div>

      {selectedTemplate ? (
        <div
          data-action-bar
          className="mt-auto shrink-0 border-t border-brand-100 bg-white px-4 py-3 lg:px-6"
        >
          <RequestFormActions
            canSubmit={canAttemptSubmit && !hierarchyBlocksSubmit}
            submitting={submitting}
            onSubmit={handleSubmit}
            onReset={handleReset}
          />
        </div>
      ) : null}
    </div>
  );
}
