import { MOCK_GROUPS } from '@/data/mockUsers';
import { directoryGroups, isDirectoryInstalled } from '@/services/directoryCache';
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
  const seeded = MOCK_GROUPS.map((g) => normalizeGroup(g)).filter(
    (g): g is Group => g !== null,
  );
  const existing = readRaw()
    .map((item) => normalizeGroup(item))
    .filter((g): g is Group => g !== null);

  if (existing.length === 0) {
    writeAll(seeded);
    return seeded;
  }

  const seedById = new Map(seeded.map((g) => [g.id, g]));
  const kept = existing.filter((g) => seedById.has(g.id));
  let changed = kept.length !== existing.length;

  const merged = kept.map((g) => {
    const seed = seedById.get(g.id)!;
    if (
      g.name !== seed.name ||
      g.code !== seed.code ||
      g.description !== seed.description ||
      g.status !== seed.status
    ) {
      changed = true;
      return { ...g, ...seed, id: g.id };
    }
    return g;
  });

  const existingIds = new Set(merged.map((g) => g.id));
  for (const seed of seeded) {
    if (existingIds.has(seed.id)) continue;
    changed = true;
    merged.push(seed);
  }

  if (changed) writeAll(merged);
  return merged;
}

function readAll(): Group[] {
  if (isDirectoryInstalled()) {
    return [...directoryGroups()].sort((a, b) => a.name.localeCompare(b.name));
  }
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
