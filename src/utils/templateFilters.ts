import type { FormTemplate, TemplateScope, TemplateStatus, WorkflowType } from '@/types';

export interface TemplateListFilters {
  search: string;
  workflowType: WorkflowType | 'all';
  scope: TemplateScope | 'all';
  status: TemplateStatus | 'all';
  groupId: string | 'all';
}

export const EMPTY_TEMPLATE_FILTERS: TemplateListFilters = {
  search: '',
  workflowType: 'all',
  scope: 'all',
  status: 'all',
  groupId: 'all',
};

export function filterTemplates(
  templates: FormTemplate[],
  filters: TemplateListFilters,
): FormTemplate[] {
  const q = filters.search.trim().toLowerCase();

  return templates.filter((template) => {
    if (filters.workflowType !== 'all' && template.workflow.type !== filters.workflowType) {
      return false;
    }
    if (filters.scope !== 'all' && template.scope !== filters.scope) {
      return false;
    }
    if (filters.status !== 'all' && template.status !== filters.status) {
      return false;
    }
    if (filters.groupId !== 'all') {
      const matchesOwner = template.owningGroupId === filters.groupId;
      const matchesAllowed = template.allowedGroupIds.includes(filters.groupId);
      const isGlobalGeneric =
        template.scope === 'generic' && template.allowedGroupIds.length === 0;
      if (!matchesOwner && !matchesAllowed && !isGlobalGeneric) {
        return false;
      }
    }
    if (!q) return true;
    const haystack = [template.name, template.description].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

export function hasActiveTemplateFilters(filters: TemplateListFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.workflowType !== 'all' ||
    filters.scope !== 'all' ||
    filters.status !== 'all' ||
    filters.groupId !== 'all'
  );
}
