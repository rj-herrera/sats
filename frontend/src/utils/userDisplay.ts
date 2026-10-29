/**
 * Display helpers for user chrome (avatar initials, etc.).
 */

/** First letter of first name + first letter of last name (e.g. "Juan Dela Cruz" → "JD"). */
export function getUserInitials(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  const first = parts[0]?.charAt(0) ?? '';
  const last =
    parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';

  return `${first}${last}`.toUpperCase() || '?';
}
