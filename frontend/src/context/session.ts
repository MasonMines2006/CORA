/**
 * The one place screens find out who is signed in.
 *
 * Why this file exists: screens call `useSession()` instead of talking to the
 * sign-in system directly, so the sign-in system can change without touching
 * every screen. (It replaced Auth0 this way: only this file and
 * components/Auth/SessionProvider.tsx had to change.)
 *
 * The actual state lives in <SessionProvider>, mounted once in main.tsx.
 */
import { createContext, useContext } from 'react';
import type { SessionResponse } from '../API/authApi';

export interface SessionUser {
  id?: number;
  name?: string | null;
  email?: string;
  role?: string;
}

export interface Session {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: SessionUser | undefined;
  /** Go to the sign-in page, then come back to `returnTo` (a path like "/student"). */
  signIn: (returnTo?: string) => void;
  /** Forget the session and go back to the public landing page. */
  signOut: () => void;
  /** Called by the sign-in, join and reset screens after the server says yes. */
  startSession: (response: SessionResponse, keepSignedIn: boolean) => void;
}

export const signInPath = (returnTo = '/student') => `/signin?returnTo=${encodeURIComponent(returnTo)}`;

// Used when there is no <SessionProvider> above (some tests render screens
// on their own): behave like a signed-out visitor instead of crashing.
const SIGNED_OUT: Session = {
  isAuthenticated: false,
  isLoading: false,
  user: undefined,
  signIn: (returnTo) => window.location.assign(signInPath(returnTo)),
  signOut: () => window.location.assign('/'),
  startSession: () => undefined,
};

export const SessionContext = createContext<Session>(SIGNED_OUT);

export function useSession(): Session {
  return useContext(SessionContext);
}
