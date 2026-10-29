/**
 * Dev-only helpers for restoring the browser mock environment.
 * These keys hold demonstration data only — not production/permanent records.
 */

/** Sample requests and templates. People and groups come from the directory API. */
export const MOCK_DATA_STORAGE_KEYS = [
  'sats.mock.requests',
  'sats.mock.templates',
] as const;

/**
 * Clears all development/mock domain data from localStorage.
 * Seed data is re-created automatically the next time each repository is read
 * (typically after a page reload).
 */
export function resetAllMockData(): void {
  for (const key of MOCK_DATA_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}
