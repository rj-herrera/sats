import { useMemo, useState } from 'react';
import { ApprovalWorkflowPreview } from '@/components/request/ApprovalWorkflowPreview';
import { DynamicRequestForm } from '@/components/request/DynamicRequestForm';
import { RequestFormActions } from '@/components/request/RequestFormActions';
import { ReviewerSelector } from '@/components/request/ReviewerSelector';
import { SubmissionConfirmation } from '@/components/request/SubmissionConfirmation';
import { TemplateSelector } from '@/components/request/TemplateSelector';
import { useAuth } from '@/contexts/AuthContext';
import { createRequest } from '@/services/requestRepository';
import {
  getAvailableTemplatesForUser,
  getTemplateById,
} from '@/services/templateService';
import {
  buildReviewerSnapshots,
  listSelectableReviewers,
  resolveHierarchyForTemplate,
} from '@/services/workflowService';
import type { FieldValue, FormTemplate } from '@/types';
import {
  buildAttachmentMetadata,
  emptyValuesForTemplate,
  validateRequestForm,
} from '@/utils/formValidation';

export function RequestFormPage() {
  const { user } = useAuth();

  const availableTemplates = useMemo(
    () => getAvailableTemplatesForUser(user),
    [user],
  );

  const [templateId, setTemplateId] = useState('');
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedNumber, setSubmittedNumber] = useState<string | null>(null);

  const selectedTemplate: FormTemplate | undefined = templateId
    ? getTemplateById(templateId)
    : undefined;

  const hierarchyResult = useMemo(() => {
    if (!selectedTemplate || selectedTemplate.workflow.type !== 'hierarchy_approval') {
      return null;
    }
    return resolveHierarchyForTemplate(selectedTemplate);
  }, [selectedTemplate]);

  const reviewerCandidates = useMemo(() => {
    if (!user) return [];
    return listSelectableReviewers(user);
  }, [user]);

  const resetForTemplate = (template: FormTemplate | undefined) => {
    setFieldErrors({});
    setFormError(null);
    setSelectedReviewerIds([]);
    setFiles({});
    if (template) {
      setValues(emptyValuesForTemplate(template));
    } else {
      setValues({});
    }
  };

  const handleTemplateChange = (nextId: string) => {
    setTemplateId(nextId);
    const template = nextId ? getTemplateById(nextId) : undefined;
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

    setFieldErrors(validation.fieldErrors);
    setFormError(validation.formError);

    if (!validation.valid) {
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
    try {
      const attachmentMeta = (
        await Promise.all(
          selectedTemplate.fields.map(async (field) => {
            if (field.type !== 'file') return [];
            const file = files[field.id];
            return file ? [await buildAttachmentMetadata(field.id, file)] : [];
          }),
        )
      ).flat();

      const reviewers =
        selectedTemplate.workflow.type === 'review_checking'
          ? buildReviewerSnapshots(selectedReviewerIds)
          : null;

      const approvalSteps =
        selectedTemplate.workflow.type === 'hierarchy_approval' && hierarchyResult?.ok
          ? hierarchyResult.steps
          : null;

      const saved = createRequest({
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        workflowType: selectedTemplate.workflow.type,
        requesterId: user.id,
        requesterName: user.name,
        requesterGroupId: user.groupId,
        requesterGroupName: user.groupName,
        fieldValues: values,
        fieldDefinitions: selectedTemplate.fields,
        attachments: attachmentMeta,
        reviewers,
        approvalSteps,
      });

      setSubmittedNumber(saved.requestNumber);
    } catch {
      setFormError('Could not save the request to local storage. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
          <h1 className="text-2xl font-semibold text-brand-900">New Request</h1>
        </div>

        <TemplateSelector
          templates={availableTemplates}
          value={templateId}
          onChange={handleTemplateChange}
          description={selectedTemplate?.description}
        />

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
                    candidates={reviewerCandidates}
                    selectedIds={selectedReviewerIds}
                    error={formError}
                    onChange={(ids) => {
                      setSelectedReviewerIds(ids);
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
