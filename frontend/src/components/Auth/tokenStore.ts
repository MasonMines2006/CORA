/**
 * Where the browser keeps CORA's session token between page loads.
 *
 * - Normal sign-in: sessionStorage, which is cleared when the browser closes.
 * - "Keep me signed in": localStorage, which survives restarts (the token still
 *   expires after 14 days; the server decides that).
 *
 * Expired or unreadable entries are ignored and removed.
 */
const KEY = 'cora.session';

export interface StoredSession {
  token: string;
  expires_at: string;
}

function parse(raw: string | null): StoredSession | null {
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw);
    if (typeof value?.token !== 'string' || typeof value?.expires_at !== 'string') {
      return null;
    }
    return value as StoredSession;
  } catch {
    return null;
  }
}

function isExpired(session: StoredSession): boolean {
  const expiresAt = Date.parse(session.expires_at);
  return Number.isNaN(expiresAt) || expiresAt <= Date.now();
}

export function readStoredSession(): StoredSession | null {
  for (const storage of [window.sessionStorage, window.localStorage]) {
    const session = parse(storage.getItem(KEY));
    if (session && !isExpired(session)) {
      return session;
    }
    storage.removeItem(KEY);
  }
  return null;
}

export function writeStoredSession(session: StoredSession, keepSignedIn: boolean): void {
  clearStoredSession();
  const storage = keepSignedIn ? window.localStorage : window.sessionStorage;
  storage.setItem(KEY, JSON.stringify({ token: session.token, expires_at: session.expires_at }));
}

export function clearStoredSession(): void {
  window.sessionStorage.removeItem(KEY);
  window.localStorage.removeItem(KEY);
}

/** True if the current session was kept with "Keep me signed in". */
export function isKeptSession(): boolean {
  return window.localStorage.getItem(KEY) !== null;
}
