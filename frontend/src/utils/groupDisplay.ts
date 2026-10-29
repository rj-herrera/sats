import { getGroupById, listGroups } from '@/services/groupRepository';

export function getGroupName(groupId: string | null | undefined): string {
  if (!groupId) return '—';
  return getGroupById(groupId)?.name ?? groupId;
}

export function formatAllowedGroups(groupIds: string[]): string {
  if (groupIds.length === 0) return 'All groups';
  return groupIds.map((id) => getGroupName(id)).join(', ');
}

export function listGroupOptions(): { id: string; name: string; status: string }[] {
  return listGroups().map((g) => ({
    id: g.id,
    name: g.name,
    status: g.status,
  }));
}
