import { MOCK_TEMPLATES } from '@/data/mockTemplates';
import { resolveMockUserId } from '@/data/mockUsers';
import { createTemplateId, normalizeTemplate } from '@/services/templateNormalizer';
import type { FormTemplate, TemplateStatus, User } from '@/types';
import {
  canCreateGenericTemplate,
  canCreateGroupTemplate,
  canManageTemplate,
} from '@/utils/templatePermissions';
import {
  validateTemplateDraft,
  validateTemplateForActivation,
} from '@/utils/templateValidation';

/**
 * Centralized template persistence (localStorage).
 * Seeded once from MOCK_TEMPLATES. Demonstrative only — PHP must enforce auth.
 */

const STORAGE_KEY = 'sats.mock.templates';

export type TemplateMutationResult =
  | { ok: true; template: FormTemplate }
  | { ok: false; error: string };

function readRaw(): unknown[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(templates: FormTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function remapTemplateUserIds(template: FormTemplate): FormTemplate {
  let changed = false;
  const createdById = resolveMockUserId(template.createdById);
  const updatedById = resolveMockUserId(template.updatedById);
  if (createdById !== template.createdById || updatedById !== template.updatedById) {
    changed = true;
  }

  let workflow = template.workflow;
  if (workflow.type === 'hierarchy_approval') {
    const steps = workflow.steps.map((step) => {
      const assigneeUserId = resolveMockUserId(step.assigneeUserId);
      if (assigneeUserId === step.assigneeUserId) return step;
      changed = true;
      return { ...step, assigneeUserId };
    });
    if (changed) workflow = { ...workflow, steps };
  }

  if (!changed) return template;
  return { ...template, createdById, updatedById, workflow };
}

function hydrateSeedTemplate(
  template: FormTemplate,
  seedsById: Map<string, FormTemplate>,
): FormTemplate {
  const seed = seedsById.get(template.id);
  if (!seed) return template;

  let next = template;
  if (
    template.createdById !== seed.createdById ||
    template.createdByName !== seed.createdByName ||
    template.updatedById !== seed.updatedById ||
    template.updatedByName !== seed.updatedByName
  ) {
    next = {
      ...next,
      createdById: seed.createdById,
      createdByName: seed.createdByName,
      updatedById: seed.updatedById,
      updatedByName: seed.updatedByName,
    };
  }

  if (
    seed.workflow.type === 'hierarchy_approval' &&
    next.workflow.type === 'hierarchy_approval'
  ) {
    const currentWorkflow = next.workflow;
    const seedStepsById = new Map(seed.workflow.steps.map((s) => [s.id, s]));
    const steps = currentWorkflow.steps.map((step) => {
      const seedStep = seedStepsById.get(step.id);
      if (!seedStep || step.assigneeUserId === seedStep.assigneeUserId) return step;
      return { ...step, assigneeUserId: seedStep.assigneeUserId };
    });
    if (steps.some((s, i) => s !== currentWorkflow.steps[i])) {
      next = {
        ...next,
        workflow: { ...currentWorkflow, steps },
      };
    }
  }

  return next;
}

function ensureSeeded(): FormTemplate[] {
  const seeds = MOCK_TEMPLATES.map((t) => normalizeTemplate(t)).filter(
    (t): t is FormTemplate => t !== null,
  );
  const seedsById = new Map(seeds.map((t) => [t.id, t]));

  const existing = readRaw()
    .map((item) => normalizeTemplate(item))
    .filter((t): t is FormTemplate => t !== null);

  if (existing.length > 0) {
    const remapped = existing.map((t) => remapTemplateUserIds(t));
    const hydrated = remapped.map((t) => hydrateSeedTemplate(t, seedsById));
    const changed = hydrated.some((t, i) => t !== existing[i]);
    if (changed) writeAll(hydrated);
    return hydrated;
  }

  writeAll(seeds);
  return seeds;
}

function readAll(): FormTemplate[] {
  return ensureSeeded().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listAllTemplates(): FormTemplate[] {
  return readAll();
}

export function getStoredTemplateById(id: string): FormTemplate | undefined {
  return readAll().find((t) => t.id === id);
}

export function listManageableTemplates(user: User | null): FormTemplate[] {
  if (!user) return [];
  return readAll().filter((t) => canManageTemplate(user, t));
}

export interface CreateTemplateInput {
  name: string;
  description: string;
  scope: FormTemplate['scope'];
  owningGroupId: string | null;
  allowedGroupIds: string[];
  workflow: FormTemplate['workflow'];
  fields: FormTemplate['fields'];
  status?: TemplateStatus;
}

export function createTemplate(
  actor: User,
  input: CreateTemplateInput,
): TemplateMutationResult {
  if (input.scope === 'generic' && !canCreateGenericTemplate(actor)) {
    return {
      ok: false,
      error: 'Only Admin can create generic / shared templates.',
    };
  }
  if (input.scope === 'group' && !canCreateGroupTemplate(actor)) {
    return {
      ok: false,
      error: 'You do not have permission to create group templates.',
    };
  }

  let owningGroupId = input.owningGroupId;
  let allowedGroupIds = [...input.allowedGroupIds];
  let scope = input.scope;

  if (!canCreateGenericTemplate(actor)) {
    scope = 'group';
    owningGroupId = actor.groupId;
    allowedGroupIds = [actor.groupId];
  }

  if (scope === 'group') {
    if (!owningGroupId) {
      return { ok: false, error: 'Owning group is required.' };
    }
    if (!allowedGroupIds.includes(owningGroupId)) {
      allowedGroupIds = [...allowedGroupIds, owningGroupId];
    }
  } else {
    owningGroupId = null;
  }

  const now = new Date().toISOString();
  const status = input.status ?? 'Active';

  if (status === 'Active') {
    const activation = validateTemplateForActivation({
      name: input.name,
      description: input.description,
      scope,
      owningGroupId,
      allowedGroupIds,
      fields: input.fields,
      workflow: input.workflow,
    });
    if (!activation.valid) {
      return { ok: false, error: activation.errors.join(' ') };
    }
  } else {
    const basics = validateTemplateDraft({
      name: input.name,
      scope,
      owningGroupId,
      allowedGroupIds,
      fields: input.fields,
      workflow: input.workflow,
    });
    if (!basics.valid) {
      return { ok: false, error: basics.errors.join(' ') };
    }
  }

  const template: FormTemplate = {
    id: createTemplateId(),
    name: input.name.trim(),
    description: input.description.trim(),
    scope,
    owningGroupId,
    allowedGroupIds,
    status,
    fields: input.fields,
    workflow: input.workflow,
    createdAt: now,
    updatedAt: now,
    createdById: actor.id,
    createdByName: actor.name,
    updatedById: actor.id,
    updatedByName: actor.name,
    version: 1,
  };

  const all = readAll();
  writeAll([template, ...all]);
  return { ok: true, template };
}

export function updateTemplate(
  actor: User,
  templateId: string,
  patch: Partial<
    Pick<
      FormTemplate,
      | 'name'
      | 'description'
      | 'scope'
      | 'owningGroupId'
      | 'allowedGroupIds'
      | 'fields'
      | 'workflow'
      | 'status'
    >
  >,
): TemplateMutationResult {
  const all = readAll();
  const index = all.findIndex((t) => t.id === templateId);
  if (index < 0) {
    return { ok: false, error: 'Template not found.' };
  }

  const current = all[index];
  if (!canManageTemplate(actor, current)) {
    return {
      ok: false,
      error: 'You do not have permission to edit this template.',
    };
  }

  let next: FormTemplate = {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    createdById: current.createdById,
    createdByName: current.createdByName,
  };

  // Managers cannot promote to generic or change ownership away from their group
  if (!canCreateGenericTemplate(actor)) {
    next.scope = 'group';
    next.owningGroupId = actor.groupId;
    next.allowedGroupIds = [actor.groupId];
  }

  if (next.scope === 'group') {
    if (!next.owningGroupId) {
      return { ok: false, error: 'Owning group is required.' };
    }
    if (!next.allowedGroupIds.includes(next.owningGroupId)) {
      next.allowedGroupIds = [...next.allowedGroupIds, next.owningGroupId];
    }
  } else {
    next.owningGroupId = null;
  }

  const status = next.status;
  if (status === 'Active') {
    const activation = validateTemplateForActivation(next);
    if (!activation.valid) {
      return { ok: false, error: activation.errors.join(' ') };
    }
  } else {
    const draftCheck = validateTemplateDraft(next);
    if (!draftCheck.valid) {
      return { ok: false, error: draftCheck.errors.join(' ') };
    }
  }

  const now = new Date().toISOString();
  next = {
    ...next,
    updatedAt: now,
    updatedById: actor.id,
    updatedByName: actor.name,
    version: current.version + 1,
  };

  const normalized = normalizeTemplate(next);
  if (!normalized) {
    return { ok: false, error: 'Updated template failed normalization.' };
  }

  const copy = [...all];
  copy[index] = normalized;
  writeAll(copy);
  return { ok: true, template: normalized };
}

export function setTemplateStatus(
  actor: User,
  templateId: string,
  status: TemplateStatus,
): TemplateMutationResult {
  return updateTemplate(actor, templateId, { status });
}

/** Dev helper — prefer resetAllMockData() for a full seed restore. */
export function clearAllTemplates(): void {
  localStorage.removeItem(STORAGE_KEY);
}
