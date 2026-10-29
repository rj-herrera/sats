import type { Group, GroupStatus } from '@/types';
import { GROUP_STATUSES } from '@/types';

function isGroupStatus(value: unknown): value is GroupStatus {
  return typeof value === 'string' && (GROUP_STATUSES as readonly string[]).includes(value);
}

function slugCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32) || 'GROUP';
}

export function normalizeGroup(raw: unknown): Group | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Partial<Group> & { active?: boolean };
  if (typeof g.id !== 'string' || !g.id.trim()) return null;
  if (typeof g.name !== 'string' || !g.name.trim()) return null;

  const now = new Date().toISOString();
  let status: GroupStatus = 'Active';
  if (isGroupStatus(g.status)) status = g.status;
  else if (typeof g.active === 'boolean') status = g.active ? 'Active' : 'Inactive';

  return {
    id: g.id,
    name: g.name.trim(),
    code:
      typeof g.code === 'string' && g.code.trim()
        ? g.code.trim().toUpperCase()
        : slugCode(g.name),
    description: typeof g.description === 'string' ? g.description : '',
    status,
    createdAt: typeof g.createdAt === 'string' ? g.createdAt : now,
    updatedAt: typeof g.updatedAt === 'string' ? g.updatedAt : now,
  };
}

export function createGroupId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `grp-${crypto.randomUUID()}`;
  }
  return `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
