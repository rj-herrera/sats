import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { createStepId } from '@/services/templateNormalizer';
import { getUserById, listAssignableUsers } from '@/services/userRepository';
import type { HierarchyApprovalStep, TemplateWorkflow, WorkflowType } from '@/types';
import { getUserRolesLabel } from '@/utils/permissions';
import { reindexSteps } from '@/utils/templateValidation';

interface ApprovalWorkflowBuilderProps {
  workflow: TemplateWorkflow;
  onChange: (workflow: TemplateWorkflow) => void;
  warnings?: string[];
}

export function ApprovalWorkflowBuilder({
  workflow,
  onChange,
  warnings = [],
}: ApprovalWorkflowBuilderProps) {
  const setType = (type: WorkflowType) => {
    if (type === 'review_checking') {
      onChange({ type: 'review_checking' });
      return;
    }
    if (workflow.type === 'hierarchy_approval') {
      onChange(workflow);
      return;
    }
    onChange({
      type: 'hierarchy_approval',
      steps: [
        {
          id: createStepId(),
          stepOrder: 1,
          roleLabel: '',
          assigneeUserId: '',
        },
      ],
    });
  };

  const assignableUsers = listAssignableUsers();

  const steps =
    workflow.type === 'hierarchy_approval'
      ? reindexSteps(workflow.steps)
      : [];

  const updateStep = (index: number, patch: Partial<HierarchyApprovalStep>) => {
    const next = steps.map((step, i) =>
      i === index ? { ...step, ...patch } : step,
    );
    onChange({ type: 'hierarchy_approval', steps: reindexSteps(next) });
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange({ type: 'hierarchy_approval', steps: reindexSteps(next) });
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-brand-900">
          Approval workflow
        </h2>
        <p className="mt-1 text-sm text-brand-500">
          Each template has exactly one workflow type. Hierarchy steps may include
          approvers from any group.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer gap-3 rounded-lg border border-brand-100 p-4 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
          <input
            type="radio"
            name="workflow-type"
            checked={workflow.type === 'review_checking'}
            onChange={() => setType('review_checking')}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium text-brand-900">
              Review / Checking
            </span>
            <span className="mt-1 block text-xs text-brand-500">
              Requester selects one or more reviewers at submit time. Reviews are
              unordered.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-brand-100 p-4 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
          <input
            type="radio"
            name="workflow-type"
            checked={workflow.type === 'hierarchy_approval'}
            onChange={() => setType('hierarchy_approval')}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium text-brand-900">
              Hierarchy Approval
            </span>
            <span className="mt-1 block text-xs text-brand-500">
              Fixed ordered approval sequence defined on this template.
            </span>
          </span>
        </label>
      </div>

      {workflow.type === 'review_checking' ? (
        <div className="rounded-md border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm text-brand-700">
          Requesters will select one or more reviewers when submitting this
          template. Reviews are handled independently without a fixed approval
          order.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-brand-900">Approval steps</h3>
            <button
              type="button"
              onClick={() =>
                onChange({
                  type: 'hierarchy_approval',
                  steps: [
                    ...steps,
                    {
                      id: createStepId(),
                      stepOrder: steps.length + 1,
                      roleLabel: '',
                      assigneeUserId: '',
                    },
                  ],
                })
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
            >
              <Plus size={14} />
              Add step
            </button>
          </div>

          {steps.length === 0 ? (
            <p className="rounded-md border border-dashed border-brand-200 px-4 py-6 text-center text-sm text-brand-500">
              Add at least one approval step before activating.
            </p>
          ) : (
            <ol className="space-y-3">
              {steps.map((step, index) => {
                const assignee = getUserById(step.assigneeUserId);
                return (
                  <li
                    key={step.id}
                    className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-brand-900">
                        Step {step.stepOrder}
                      </p>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          className="rounded p-1.5 text-brand-600 hover:bg-brand-50 disabled:opacity-40"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={index === steps.length - 1}
                          onClick={() => move(index, 1)}
                          className="rounded p-1.5 text-brand-600 hover:bg-brand-50 disabled:opacity-40"
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onChange({
                              type: 'hierarchy_approval',
                              steps: reindexSteps(
                                steps.filter((_, i) => i !== index),
                              ),
                            })
                          }
                          className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-xs font-medium text-brand-600">
                          Role / responsibility *
                        </span>
                        <input
                          value={step.roleLabel}
                          onChange={(e) =>
                            updateStep(index, { roleLabel: e.target.value })
                          }
                          placeholder="e.g. Approver"
                          className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-xs font-medium text-brand-600">
                          Assigned approver *
                        </span>
                        <select
                          value={step.assigneeUserId}
                          onChange={(e) =>
                            updateStep(index, {
                              assigneeUserId: e.target.value,
                            })
                          }
                          className="w-full rounded-md border border-brand-200 py-2 pr-10 pl-3 text-sm"
                        >
                          <option value="">Select approver…</option>
                          {assignableUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} — {user.groupName} (
                              {getUserRolesLabel(user)})
                            </option>
                          ))}
                          {assignee &&
                          !assignableUsers.some((u) => u.id === assignee.id) ? (
                            <option value={assignee.id}>
                              {assignee.name} — unavailable (inactive)
                            </option>
                          ) : null}
                        </select>
                      </label>
                    </div>
                    {assignee ? (
                      <p className="mt-2 text-xs text-brand-500">
                        {assignee.name} · {assignee.groupName} ·{' '}
                        {getUserRolesLabel(assignee)}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {warnings.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">Warnings</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
