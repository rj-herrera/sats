import type { ApprovalStepSnapshot } from '@/types';

interface ApprovalWorkflowPreviewProps {
  steps: ApprovalStepSnapshot[];
  errors?: string[];
}

export function ApprovalWorkflowPreview({
  steps,
  errors = [],
}: ApprovalWorkflowPreviewProps) {
  return (
    <section className="flex h-full flex-col rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-900">Approval Workflow</h2>

      {errors.length > 0 ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          <p className="font-medium">Approval workflow cannot be completed</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {steps.map((step) => (
            <li
              key={`${step.stepOrder}-${step.userId}`}
              className="flex gap-3 rounded-md border border-brand-100 bg-brand-50/50 px-3 py-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white">
                {step.stepOrder}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-brand-900">
                  {step.name}
                </span>
                <span className="block text-xs text-brand-500">{step.roleLabel} • {step.groupName}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
