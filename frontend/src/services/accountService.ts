import { apiGet, apiPost } from '@/services/apiClient';
import { installDirectory, upsertDirectoryUser } from '@/services/directoryCache';
import { normalizeGroup } from '@/services/groupNormalizer';
import { normalizeUser } from '@/services/userNormalizer';
import type { User } from '@/types';

const LOGIN_URL = 'http://localhost/KDTPortalLogin/';

export type AccountResult =
  | { status: 'ready'; user: User }
  | { status: 'signedOut'; loginUrl: string }
  | { status: 'error'; message: string };

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error: unknown }).error;
    if (typeof error === 'string' && error.trim() !== '') return error;
  }
  return fallback;
}

function loginUrlFrom(body: unknown): string {
  if (body && typeof body === 'object' && 'loginUrl' in body) {
    const loginUrl = (body as { loginUrl: unknown }).loginUrl;
    if (typeof loginUrl === 'string' && loginUrl.trim() !== '') return loginUrl;
  }
  return LOGIN_URL;
}

/** Who the portal cookie belongs to. Does not trust an id from the page. */
export async function loadCurrentUser(): Promise<AccountResult> {
  const response = await apiGet('/me');
  if (response.status === 0) {
    return { status: 'error', message: 'The directory API could not be reached.' };
  }
  if (response.status === 401) {
    return { status: 'signedOut', loginUrl: loginUrlFrom(response.body) };
  }
  if (response.status !== 200) {
    return { status: 'error', message: errorMessage(response.body, 'Your account could not be loaded.') };
  }

  const user = normalizeUser(response.body);
  if (!user) {
    return { status: 'error', message: 'Your employee record could not be read.' };
  }
  if (user.status !== 'Active') {
    return { status: 'error', message: 'This employee is inactive.' };
  }

  upsertDirectoryUser(user);
  return { status: 'ready', user };
}

async function loadDirectory(): Promise<AccountResult | null> {
  const [groupsResponse, employeesResponse] = await Promise.all([
    apiGet('/groups'),
    apiGet('/employees'),
  ]);

  if (groupsResponse.status !== 200 || !Array.isArray(groupsResponse.body)) {
    return {
      status: 'error',
      message: errorMessage(groupsResponse.body, 'Groups could not be loaded.'),
    };
  }
  if (employeesResponse.status !== 200 || !Array.isArray(employeesResponse.body)) {
    return {
      status: 'error',
      message: errorMessage(employeesResponse.body, 'Employees could not be loaded.'),
    };
  }

  const groups = groupsResponse.body
    .map((item) => normalizeGroup(item))
    .filter((group): group is NonNullable<typeof group> => group !== null);
  const users = employeesResponse.body
    .map((item) => normalizeUser(item))
    .filter((user): user is User => user !== null);

  installDirectory(groups, users);
  return null;
}

/** Sign-in plus the group and employee lists the screens read. */
export async function loadAccount(): Promise<AccountResult> {
  const current = await loadCurrentUser();
  if (current.status !== 'ready') return current;

  const directoryError = await loadDirectory();
  if (directoryError) return directoryError;

  upsertDirectoryUser(current.user);
  return current;
}

/**
 * TESTING ONLY. Remove with backend/DevLogin.php.
 * Returns an error message, or null when the cookie was set.
 */
export async function devSignIn(employeeId: string): Promise<string | null> {
  const response = await apiPost('/dev/sign-in', { employeeId: employeeId.trim() });
  if (response.status === 200) return null;
  return errorMessage(response.body, 'Sign-in failed.');
}

/** TESTING ONLY. Remove with backend/DevLogin.php. */
export async function devSignOut(): Promise<string | null> {
  const response = await apiPost('/dev/sign-out', {});
  if (response.status === 200) return null;
  return errorMessage(response.body, 'Sign-out failed.');
}
