import { ROLE_SWITCHER_USERS } from '@/data/mockUsers';
import { getGroupById } from '@/services/groupRepository';
import { getUserById } from '@/services/userRepository';
import type { AuthSession, Role, User } from '@/types';

/**
 * Development mock authentication.
 * Production will use token-based identity — no login/logout UI.
 * Session stores userId only; permissions resolve from the user repository.
 */

const STORAGE_KEY = 'sats.mock.session';
const DEFAULT_USER_ID = ROLE_SWITCHER_USERS.employee;

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Resolve the current user from the directory.
 * Inactive users or users in inactive groups lose their session.
 */
export function getUserFromSession(session: AuthSession | null): User | null {
  if (!session) return null;
  const user = getUserById(session.userId);
  if (!user || user.status !== 'Active') {
    clearSession();
    return null;
  }
  const group = getGroupById(user.groupId);
  if (!group || group.status !== 'Active') {
    clearSession();
    return null;
  }
  return user;
}

export function loginAsMockUser(userId: string): User {
  const user = getUserById(userId);
  if (!user || user.status !== 'Active') {
    throw new Error(`Unknown or inactive mock user: ${userId}`);
  }
  const group = getGroupById(user.groupId);
  if (!group || group.status !== 'Active') {
    throw new Error('User belongs to an inactive group.');
  }
  saveSession({ userId: user.id });
  return user;
}

/**
 * Ensure a mock session exists (token-style default identity for the MVP).
 * Used instead of a login screen.
 */
export function ensureMockSession(): User {
  const existing = getUserFromSession(loadSession());
  if (existing) return existing;
  return loginAsMockUser(DEFAULT_USER_ID);
}

/** Switch the active mock persona by generic role (dev/testing). */
export function switchMockRole(role: Role): User {
  const userId = ROLE_SWITCHER_USERS[role];
  return loginAsMockUser(userId);
}

export function logoutMockUser(): void {
  clearSession();
}

/** Re-read the current session user after directory changes. */
export function refreshSessionUser(): User {
  return getUserFromSession(loadSession()) ?? ensureMockSession();
}
