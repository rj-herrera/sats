import { MOCK_USERS } from '@/data/mockUsers';
import { getGroupById, listGroups } from '@/services/groupRepository';
import { normalizeUser } from '@/services/userNormalizer';
import type { User } from '@/types';

/**
 * Read-only user directory (localStorage-seeded mock data).
 * Employees will come from the company database in a future backend phase.
 * In-app Group Members Management UI has been removed from scope.
 */

const STORAGE_KEY = 'sats.mock.users';

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

function writeAll(users: User[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function resolveGroupName(groupId: string): string {
  return getGroupById(groupId)?.name ?? 'Unknown group';
}

function ensureSeeded(): User[] {
  // Ensure groups exist before resolving group names
  listGroups();

  const existing = readRaw()
    .map((item) => {
      const partial = item as { groupId?: string };
      return normalizeUser(
        item,
        partial.groupId ? resolveGroupName(partial.groupId) : undefined,
      );
    })
    .filter((u): u is User => u !== null);

  if (existing.length > 0) {
    const seedById = new Map(MOCK_USERS.map((u) => [u.id, u]));
    let changed = false;
    const merged = existing.map((u) => {
      const seed = seedById.get(u.id);
      const groupName = resolveGroupName(u.groupId);
      if (!seed) {
        return { ...u, groupName };
      }
      // Keep stable IDs; refresh display identity from seed (generic names).
      if (
        u.name !== seed.name ||
        u.email !== seed.email ||
        u.employeeId !== seed.employeeId ||
        u.roles.join() !== seed.roles.join() ||
        u.hasApprovalResponsibility !== seed.hasApprovalResponsibility
      ) {
        changed = true;
        return {
          ...u,
          name: seed.name,
          email: seed.email,
          employeeId: seed.employeeId,
          roles: seed.roles,
          hasApprovalResponsibility: seed.hasApprovalResponsibility,
          groupName,
        };
      }
      return { ...u, groupName };
    });
    if (changed) writeAll(merged);
    return merged;
  }

  const seeded = MOCK_USERS.map((u) =>
    normalizeUser(u, resolveGroupName(u.groupId)),
  ).filter((u): u is User => u !== null);
  writeAll(seeded);
  return seeded;
}

function readAll(): User[] {
  return ensureSeeded()
    .map((u) => ({ ...u, groupName: resolveGroupName(u.groupId) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listUsers(): User[] {
  return readAll();
}

export function getUserById(id: string): User | undefined {
  return readAll().find((u) => u.id === id);
}

export function listUsersByGroup(groupId: string): User[] {
  return readAll().filter((u) => u.groupId === groupId);
}

/** Active users in active groups — for mock login. */
export function listLoginUsers(): User[] {
  return readAll().filter((u) => {
    if (u.status !== 'Active') return false;
    const group = getGroupById(u.groupId);
    return group?.status === 'Active';
  });
}

/** Active users eligible for new approval/reviewer assignments. */
export function listAssignableUsers(): User[] {
  return listLoginUsers();
}

/** Compatibility aliases used across Phase 1–6 services. */
export function findMockUserById(id: string): User | undefined {
  return getUserById(id);
}
