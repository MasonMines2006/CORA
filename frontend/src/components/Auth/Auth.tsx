import React, { useEffect, useState } from 'react';
import { AppState, Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router';
import { fetchUserRole } from '../../services/AuthAPI';

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
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
      {children}
    </Auth0Provider>
  );
};

export const AuthenticationGuard: React.FC<{ component: React.ComponentType<object> }> = ({ component }) => {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const Component = component;
  const navigate = useNavigate();
  const [roleResolved, setRoleResolved] = useState(false);

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
    const syncRole = async () => {
      if (!isAuthenticated) {
        return;
      }
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: 'https://api.cora.com',
          },
        });
        const result = await fetchUserRole(token);
        const role = result.role || 'student';
        localStorage.setItem('userRole', role);

        if (role === 'student') {
          navigate('/student', { replace: true });
        } else {
          setRoleResolved(true);
        }
      } catch (error) {
        localStorage.setItem('userRole', 'student');
        navigate('/student', { replace: true });
      }
    };
    syncRole();
  }, [isAuthenticated, getAccessTokenSilently, navigate]);

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
  const { isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();
  const Component = component;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-white px-6 text-center text-sm text-slate-500'>
        Loading…
      </div>
    );
  }
  return <Component />;
};

export default Auth0ProviderWithHistory;
