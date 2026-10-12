import { MOCK_GROUPS } from '@/data/mockUsers';
import { normalizeGroup } from '@/services/groupNormalizer';
import type { Group } from '@/types';

/**
 * Read-only group directory (localStorage-seeded mock data).
 * Groups will come from the company database in a future backend phase.
 * In-app Groups Management UI has been removed from scope.
 */

const STORAGE_KEY = 'sats.mock.groups';

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

function writeAll(groups: Group[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

function ensureSeeded(): Group[] {
  const existing = readRaw()
    .map((item) => normalizeGroup(item))
    .filter((g): g is Group => g !== null);

  if (existing.length > 0) return existing;

  const seeded = MOCK_GROUPS.map((g) => normalizeGroup(g)).filter(
    (g): g is Group => g !== null,
  );
  writeAll(seeded);
  return seeded;
}

function readAll(): Group[] {
  return ensureSeeded().sort((a, b) => a.name.localeCompare(b.name));
}

export function listGroups(): Group[] {
  return readAll();
}

export function getGroupById(id: string): Group | undefined {
  return readAll().find((g) => g.id === id);
}

export function listActiveGroups(): Group[] {
  return readAll().filter((g) => g.status === 'Active');
}
