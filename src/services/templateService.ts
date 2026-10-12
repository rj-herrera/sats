import { getGroupById } from '@/services/groupRepository';
import {
  getStoredTemplateById,
  listAllTemplates,
  listManageableTemplates,
} from '@/services/templateRepository';
import type { FormTemplate, User } from '@/types';

/**
 * Template lookup and availability for request submission + management views.
 * Admin role does NOT unlock restricted templates for submitting requests.
 */

export function getAllTemplates(): FormTemplate[] {
  return listAllTemplates();
}

export function getTemplateById(id: string): FormTemplate | undefined {
  return getStoredTemplateById(id);
}

export function getManageableTemplatesForUser(user: User | null): FormTemplate[] {
  return listManageableTemplates(user);
}

/**
 * Active templates the user may use when creating a request.
 * User and their group must be active; group-owned templates require an active owning group.
 */
export function getAvailableTemplatesForUser(user: User | null): FormTemplate[] {
  if (!user) return [];
  if (user.status !== 'Active') return [];

  const userGroup = getGroupById(user.groupId);
  if (!userGroup || userGroup.status !== 'Active') return [];

  return listAllTemplates().filter((template) =>
    isTemplateAvailableToUser(template, user),
  );
}

export function isTemplateAvailableToUser(
  template: FormTemplate,
  user: User,
): boolean {
  if (template.status !== 'Active') {
    return false;
  }

  if (user.status !== 'Active') return false;
  const userGroup = getGroupById(user.groupId);
  if (!userGroup || userGroup.status !== 'Active') return false;

  if (template.scope === 'generic') {
    if (template.allowedGroupIds.length === 0) {
      return true;
    }
    // Only count allowed groups that are still active
    return template.allowedGroupIds.some((groupId) => {
      if (groupId !== user.groupId) return false;
      const group = getGroupById(groupId);
      return group?.status === 'Active';
    });
  }

  if (template.owningGroupId) {
    const owning = getGroupById(template.owningGroupId);
    if (!owning || owning.status !== 'Active') return false;
  }

  return template.allowedGroupIds.includes(user.groupId);
}
