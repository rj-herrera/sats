import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { AssignedApproverSelect } from '@/components/template/AssignedApproverSelect';
import { getGroupById } from '@/services/groupRepository';
import { createStepId } from '@/services/templateNormalizer';
import { getUserById } from '@/services/userRepository';
import type { HierarchyApprovalStep, TemplateWorkflow, WorkflowType } from '@/types';
import { reindexSteps } from '@/utils/templateValidation';

/** Hierarchy steps are approvers. The label is stored, not chosen in the row. */
const HIERARCHY_ROLE_LABEL = 'Approver';
const MAX_BATCH = 20;

function createApprovalStep(stepOrder: number): HierarchyApprovalStep {
  return {
    id: createStepId(),
    stepOrder,
    roleLabel: HIERARCHY_ROLE_LABEL,
    assigneeUserId: '',
  };
}

function approverSummary(assigneeUserId: string): {
  code: string;
  name: string;
  assigned: boolean;
} {
  const user = assigneeUserId ? getUserById(assigneeUserId) : undefined;
  if (!user) return { code: 'Group', name: 'Select a group first', assigned: false };
  const code = getGroupById(user.groupId)?.code.trim().toUpperCase() || 'Group';
  return { code, name: user.name, assigned: true };
}

function scrollRowIntoList(list: HTMLElement, row: HTMLElement) {
  const listRect = list.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  if (rowRect.top < listRect.top) {
    list.scrollTop -= listRect.top - rowRect.top;
  } else if (rowRect.bottom > listRect.bottom) {
    list.scrollTop += rowRect.bottom - listRect.bottom;
  }
}

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [addMultipleOpen, setAddMultipleOpen] = useState(false);
  const [quantity, setQuantity] = useState('2');
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const addMultipleRef = useRef<HTMLDivElement>(null);

  const setType = (type: WorkflowType) => {
    if (type === 'review_checking') {
      setExpandedId(null);
      onChange({ type: 'review_checking' });
      return;
    }
    if (workflow.type === 'hierarchy_approval') {
      onChange(workflow);
      return;
    }
    const first = createApprovalStep(1);
    setExpandedId(first.id);
    setScrollToId(first.id);
    setFocusId(first.id);
    onChange({ type: 'hierarchy_approval', steps: [first] });
  };

  const steps =
    workflow.type === 'hierarchy_approval'
      ? reindexSteps(workflow.steps)
      : [];

  useEffect(() => {
    if (workflow.type !== 'hierarchy_approval') return;
    if (workflow.steps.every((step) => step.roleLabel.trim())) return;
    onChange({
      type: 'hierarchy_approval',
      steps: workflow.steps.map((step) => ({
        ...step,
        roleLabel: step.roleLabel.trim() || HIERARCHY_ROLE_LABEL,
      })),
    });
  }, [workflow, onChange]);

  useLayoutEffect(() => {
    if (!scrollToId) return;
    const list = listRef.current;
    const row = rowRefs.current.get(scrollToId);
    if (list && row) scrollRowIntoList(list, row);
    setScrollToId(null);
  }, [scrollToId, steps]);

  useEffect(() => {
    if (!focusId) return;
    setFocusId(null);
  }, [focusId]);

  useEffect(() => {
    if (!addMultipleOpen) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!addMultipleRef.current?.contains(event.target as Node)) {
        setAddMultipleOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [addMultipleOpen]);

  const commitSteps = (next: HierarchyApprovalStep[]) => {
    onChange({
      type: 'hierarchy_approval',
      steps: next.map((step, index) => ({ ...step, stepOrder: index + 1 })),
    });
  };

  const updateStep = (index: number, patch: Partial<HierarchyApprovalStep>) => {
    commitSteps(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    commitSteps(next);
  };

  const remove = (index: number) => {
    const removed = steps[index];
    if (removed && expandedId === removed.id) setExpandedId(null);
    commitSteps(steps.filter((_, i) => i !== index));
  };

  const addApprovers = (count: number) => {
    const created = Array.from({ length: count }, (_, index) =>
      createApprovalStep(steps.length + index + 1),
    );
    commitSteps([...steps, ...created]);
    setExpandedId(created[0].id);
    setScrollToId(created[0].id);
    setFocusId(created[0].id);
  };

  const confirmAddMultiple = () => {
    const count = Number(quantity);
    if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) {
      setQuantityError(`Enter a whole number from 1 to ${MAX_BATCH}.`);
      return;
    }
    addApprovers(count);
    setQuantity('2');
    setQuantityError(null);
    setAddMultipleOpen(false);
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-brand-900">
          Approval workflow
        </h2>
        <p className="mt-1 text-sm text-brand-500">
          Each template has exactly one workflow type. Hierarchy approvers may
          come from any group.
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
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-brand-900">Approval sequence</h3>

          {steps.length === 0 ? (
            <p className="rounded-md border border-dashed border-brand-200 px-4 py-6 text-center text-sm text-brand-500">
              Add at least one approver before activating.
            </p>
          ) : (
            <div ref={listRef} className="max-h-72 overflow-y-auto pr-1">
              <ol className="space-y-1.5">
                {steps.map((step, index) => {
                  const expanded = expandedId === step.id;
                  const summary = approverSummary(step.assigneeUserId);
                  return (
                    <li
                      key={step.id}
                      ref={(node) => {
                        if (node) rowRefs.current.set(step.id, node);
                        else rowRefs.current.delete(step.id);
                      }}
                      className={[
                        'flex flex-wrap items-center gap-2 rounded-md border bg-white px-2 py-1.5',
                        expanded
                          ? 'border-brand-400'
                          : summary.assigned
                            ? 'border-brand-100'
                            : 'border-amber-300',
                      ].join(' ')}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : step.id)}
                        className="w-[6.5rem] shrink-0 text-left text-sm font-medium text-brand-900"
                        aria-expanded={expanded}
                      >
                        Approver {step.stepOrder}
                      </button>

                      <div className="min-w-[12rem] flex-1">
                        {expanded ? (
                          <AssignedApproverSelect
                            assigneeUserId={step.assigneeUserId}
                            autoFocus={focusId === step.id}
                            onChange={(assigneeUserId) => {
                              updateStep(index, { assigneeUserId });
                              if (assigneeUserId) setExpandedId(null);
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedId(step.id)}
                            className="flex h-10 w-full overflow-hidden rounded-md border border-brand-200 bg-white text-left"
                            aria-label={
                              summary.assigned
                                ? `Edit approver ${step.stepOrder}, ${summary.name}`
                                : `Assign approver ${step.stepOrder}`
                            }
                          >
                            <span
                              className={[
                                'flex shrink-0 items-center border-r border-brand-200 px-2 text-sm',
                                summary.assigned
                                  ? 'font-medium text-brand-900'
                                  : 'text-brand-400',
                              ].join(' ')}
                            >
                              {summary.code}
                            </span>
                            <span
                              className={[
                                'flex min-w-0 flex-1 items-center truncate px-3 text-sm',
                                summary.assigned ? 'text-brand-900' : 'text-brand-400',
                              ].join(' ')}
                            >
                              {summary.assigned ? summary.name : 'Not assigned'}
                            </span>
                          </button>
                        )}
                      </div>

                      <div className="ml-auto flex shrink-0">
                        <button
                          type="button"
                          aria-label={`Move approver ${step.stepOrder} up`}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          className="rounded p-1.5 text-brand-600 hover:bg-brand-50 disabled:opacity-40"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move approver ${step.stepOrder} down`}
                          disabled={index === steps.length - 1}
                          onClick={() => move(index, 1)}
                          className="rounded p-1.5 text-brand-600 hover:bg-brand-50 disabled:opacity-40"
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove approver ${step.stepOrder}`}
                          onClick={() => remove(index)}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <div ref={addMultipleRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setQuantityError(null);
                  setAddMultipleOpen((open) => !open);
                }}
                className="inline-flex items-center rounded-md border border-brand-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-800 hover:bg-brand-50"
                aria-expanded={addMultipleOpen}
              >
                Add multiple
              </button>
              {addMultipleOpen ? (
                <div className="absolute right-0 bottom-full z-30 mb-2 w-60 rounded-md border border-brand-200 bg-white p-3 shadow-lg">
                  <label className="block text-xs font-medium text-brand-700">
                    Number of approvers
                    <input
                      type="number"
                      min={1}
                      max={MAX_BATCH}
                      inputMode="numeric"
                      value={quantity}
                      onChange={(event) => {
                        setQuantity(event.target.value);
                        setQuantityError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          confirmAddMultiple();
                        }
                      }}
                      className="mt-1 w-full rounded-md border border-brand-200 px-3 py-1.5 text-sm text-brand-900"
                    />
                  </label>
                  {quantityError ? (
                    <p className="mt-1 text-xs text-red-600">{quantityError}</p>
                  ) : (
                    <p className="mt-1 text-xs text-brand-500">From 1 to {MAX_BATCH}.</p>
                  )}
                  <button
                    type="button"
                    onClick={confirmAddMultiple}
                    className="mt-2 w-full rounded-md bg-brand-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
                  >
                    Add
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => addApprovers(1)}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
            >
              <Plus size={14} />
              Add approver
            </button>
          </div>
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
