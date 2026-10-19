/**
 * Holds the signed-in state for the whole app (mounted once in main.tsx).
 *
 * On page load: if the browser kept a session token, ask the server who it
 * belongs to (GET /auth/me). The server may say no: the token expired, the
 * password changed, or the account was deactivated. In that case, forget it.
 *
 * The axios client (API/Index.ts) can't use React hooks, so we hand it a small
 * function that returns the current token (setAuthTokenGetter).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { setAuthTokenGetter } from '../../API/Index';
import { AuthApiError, getMe, logout, SessionResponse, SessionUser as ApiUser } from '../../API/authApi';
import { Session, SessionContext, SessionUser, signInPath } from '../../context/session';
import { clearStoredSession, readStoredSession, writeStoredSession } from './tokenStore';

type Status = 'loading' | 'signed-in' | 'signed-out';

/** The server sends `name: null` for people without a name; screens expect it to be absent. */
function toSessionUser(user: ApiUser): SessionUser {
  return { id: user.id, email: user.email, role: user.role, name: user.name ?? undefined };
}

function sendTokenWithRequests(token: string | null) {
  setAuthTokenGetter(token ? () => Promise.resolve(token) : null);
}

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>(() => (readStoredSession() ? 'loading' : 'signed-out'));
  const [user, setUser] = useState<SessionUser | undefined>();

  // Check a kept token once, when the app first loads.
  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) {
      return;
    }
    sendTokenWithRequests(stored.token);
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) {
          return;
        }
        setUser(toSessionUser(me));
        setStatus('signed-in');
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        // 401 means the server no longer accepts this token. Any other error
        // (server down) keeps it, so a later reload can try again.
        if (error instanceof AuthApiError && error.status === 401) {
          clearStoredSession();
          sendTokenWithRequests(null);
        }
        setStatus('signed-out');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startSession = useCallback((response: SessionResponse, keepSignedIn: boolean) => {
    writeStoredSession(response, keepSignedIn);
    sendTokenWithRequests(response.token);
    setUser(toSessionUser(response.user));
    setStatus('signed-in');
  }, []);

  const signOut = useCallback(() => {
    // Tell the server (it has nothing to clean up today), but don't wait for it.
    logout().catch(() => undefined);
    clearStoredSession();
    sendTokenWithRequests(null);
    setUser(undefined);
    setStatus('signed-out');
    window.location.assign('/');
  }, []);

  const signIn = useCallback((returnTo?: string) => window.location.assign(signInPath(returnTo)), []);

  const value = useMemo<Session>(
    () => ({
      isAuthenticated: status === 'signed-in',
      isLoading: status === 'loading',
      user,
      signIn,
      signOut,
      startSession,
    }),
    [status, user, signIn, signOut, startSession]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export default SessionProvider;
