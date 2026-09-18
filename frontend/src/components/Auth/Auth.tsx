import React, { useEffect, useState } from 'react';
import { AppState, Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router';
import { fetchUserRole } from '../../services/AuthAPI';
import { setAuthTokenGetter } from '../../API/Index';

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

// Mounted once, inside Auth0Provider, so it can hand the axios layer (which has
// no access to React/Auth0 hooks) a way to fetch the current access token.
const AuthTokenBridge: React.FC = () => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    if (!isAuthenticated) {
      setAuthTokenGetter(null);
      return;
    }
    setAuthTokenGetter(() => getAccessTokenSilently({ authorizationParams: { audience: 'https://api.cora.com' } }));
    return () => setAuthTokenGetter(null);
  }, [isAuthenticated, getAccessTokenSilently]);

  return null;
};

const Auth0ProviderWithHistory: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  function onRedirectCallback(appState?: AppState) {
    localStorage.removeItem('isReadOnlyMode');
    navigate(appState?.returnTo || '/app', { state: appState, replace: true });
  }

  return (
    <Auth0Provider
      domain={domain as string}
      clientId={clientId as string}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/callback`,
        audience: 'https://api.cora.com',
      }}
      onRedirectCallback={onRedirectCallback}
    >
      <AuthTokenBridge />
      {children}
    </Auth0Provider>
  );
};

export const AuthenticationGuard: React.FC<{ component: React.ComponentType<object> }> = ({ component }) => {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const Component = component;
  const navigate = useNavigate();
  const [roleResolved, setRoleResolved] = useState(false);
  const [syncError, setSyncError] = useState(false);

  useEffect(() => {
    // Skip redirect on callback page - let Auth0 SDK process the authorization code
    if (window.location.pathname === '/callback') {
      return;
    }

    if (!isLoading && !isAuthenticated) {
      localStorage.setItem('isReadOnlyMode', 'true');
      localStorage.removeItem('userRole');
      navigate('/', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    // Wait for Auth0 to finish settling before asking it for a token - calling
    // getAccessTokenSilently while isLoading is still true is a known source of
    // spurious failures unrelated to the user's actual role.
    if (isLoading || !isAuthenticated) {
      return;
    }

    let cancelled = false;

    const syncRole = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: 'https://api.cora.com',
          },
        });
        const result = await fetchUserRole(token);
        if (cancelled) {
          return;
        }

        const role = result.role || 'student';
        localStorage.setItem('userRole', role);

        if (role === 'student') {
          navigate('/student', { replace: true });
        } else {
          setRoleResolved(true);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        // A failed lookup (network blip, transient token error) is NOT the same
        // as "this user has no role" - silently downgrading to student here
        // would mis-route a real admin/TA on a transient failure. Let them retry.
        setSyncError(true);
      }
    };
    syncRole();

    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, getAccessTokenSilently, navigate]);

  if (syncError) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center text-sm text-slate-500'>
        <p>Something went wrong signing you in.</p>
        <button
          onClick={() => window.location.reload()}
          className='rounded-full bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700'
        >
          Try again
        </button>
      </div>
    );
  }

  if (isLoading || !roleResolved) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-white px-6 text-center text-sm text-slate-500'>
        Signing you in…
      </div>
    );
  }
  return <Component />;
};

export const StudentGuard: React.FC<{ component: React.ComponentType<object> }> = ({ component }) => {
  const { isLoading } = useAuth0();
  const Component = component;

  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-white px-6 text-center text-sm text-slate-500'>
        Loading…
      </div>
    );
  }
  return <Component />;
};

export default Auth0ProviderWithHistory;
