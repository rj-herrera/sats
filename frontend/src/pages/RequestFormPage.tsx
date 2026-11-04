import { useEffect, useMemo, useState } from 'react';
import { ApprovalWorkflowPreview } from '@/components/request/ApprovalWorkflowPreview';
import { DynamicRequestForm } from '@/components/request/DynamicRequestForm';
import { RequestFormActions } from '@/components/request/RequestFormActions';
import { ReviewerSelector } from '@/components/request/ReviewerSelector';
import { SubmissionConfirmation } from '@/components/request/SubmissionConfirmation';
import { TemplateSelector } from '@/components/request/TemplateSelector';
import { useAuth } from '@/contexts/AuthContext';
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

  const [availableTemplates, setAvailableTemplates] = useState<FormTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState('');
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<string[]>([]);
  const [reviewerUnfinished, setReviewerUnfinished] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedNumber, setSubmittedNumber] = useState<string | null>(null);

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
    setSubmittedNumber(null);
  };

  const handleCreateAnother = () => {
    setSubmittedNumber(null);
    handleReset();
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

    if (Object.values(files).some((file) => file !== null)) {
      setFormError('File uploads are not available yet.');
      return;
    }

    setSubmitting(true);
    const saved = await createSubmittedRequest({
      templateId: selectedTemplate.id,
      fieldValues: values,
      reviewerIds:
        selectedTemplate.workflow.type === 'review_checking' ? selectedReviewerIds : undefined,
    });
    setSubmitting(false);

    if (!saved.ok) {
      setFormError(saved.error);
      return;
    }

    setSubmittedNumber(saved.data.requestNumber);
  };

  if (!user) {
    return null;
  }

  if (submittedNumber) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <SubmissionConfirmation
          requestNumber={submittedNumber}
          onCreateAnother={handleCreateAnother}
        />
      </div>
    );
  }

  const canAttemptSubmit = Boolean(selectedTemplate) && !submitting;
  const hierarchyBlocksSubmit =
    selectedTemplate?.workflow.type === 'hierarchy_approval' &&
    hierarchyResult !== null &&
    !hierarchyResult.ok;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 lg:p-6">
        <div>
          <h1 className="text-xl font-semibold text-brand-900">New Request</h1>
        </div>

        <TemplateSelector
          templates={availableTemplates}
          value={templateId}
          onChange={handleTemplateChange}
          description={selectedTemplate?.description}
        />
        {templatesError ? (
          <p className="text-sm text-red-600" role="alert">
            {templatesError}
          </p>
        ) : null}

        {selectedTemplate && (
          <>
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
              <div className="min-w-0 lg:col-span-2">
                <DynamicRequestForm
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
                  onFileChange={(fieldId, file) => {
                    setFiles((prev) => ({ ...prev, [fieldId]: file }));
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next[fieldId];
                      return next;
                    });
                  }}
                />
              </div>

              <aside className="min-w-0 lg:col-span-1">
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

            {formError && selectedTemplate.workflow.type === 'hierarchy_approval' ? (
              <p className="text-sm text-red-600" role="alert">
                {formError}
              </p>
            ) : null}
          </>
        )}
      </div>

      {selectedTemplate ? (
        <div className="shrink-0 border-t border-brand-100 bg-white px-4 py-3 lg:px-6">
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
