/**
 * The one place student and landing screens find out who is signed in.
 *
 * Why this file exists: CORA is moving off Auth0 to its own email + password
 * login (branch feat/in-house-auth) while the UI is being redesigned on another
 * branch at the same time. If every screen called Auth0's `useAuth0()` directly,
 * both pieces of work would have to edit the same screens. Instead, screens call
 * `useSession()` from here, and only the auth work changes what is inside it.
 *
 * Today it simply wraps Auth0.
 */
import { useAuth0 } from '@auth0/auth0-react';

export interface SessionUser {
  name?: string;
  email?: string;
}

export interface Session {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: SessionUser | undefined;
  /** Send the visitor to sign in, then bring them back to `returnTo` (a path like "/student"). */
  signIn: (returnTo?: string) => void;
  /** Sign out and go back to the public landing page. */
  signOut: () => void;
}

export function useSession(): Session {
  const auth0 = useAuth0();
  return {
    isAuthenticated: auth0.isAuthenticated,
    isLoading: auth0.isLoading,
    user: auth0.user ? { name: auth0.user.name, email: auth0.user.email } : undefined,
    signIn: (returnTo = '/student') => {
      void auth0.loginWithRedirect({ appState: { returnTo } });
    },
    signOut: () => {
      void auth0.logout({ logoutParams: { returnTo: window.location.origin } });
    },
  };
}
