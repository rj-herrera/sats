/**
 * Calls the SATS API on this machine.
 * The portal cookie is on localhost, so the dev app on port 5173
 * still talks to Apache on port 80 and sends that cookie.
 */

export function apiUrl(path: string): string {
  const configured = import.meta.env.VITE_API_BASE;
  const base =
    typeof configured === 'string' && configured.trim() !== ''
      ? configured.replace(/\/$/, '')
      : `${window.location.protocol}//${window.location.hostname}/sats/api`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function apiPost(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  return apiSend(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function apiGet(path: string): Promise<{ status: number; body: unknown }> {
  return apiSend(path, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
}

async function apiSend(path: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  try {
    const response = await fetch(apiUrl(path), init);
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  } catch {
    return { status: 0, body: null };
  }
}
