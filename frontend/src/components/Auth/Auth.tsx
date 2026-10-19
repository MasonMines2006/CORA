/**
 * Route guards.
 *
 * AuthenticationGuard  staff-only screens (/app, /admin): signed-out visitors go
 *                      to sign in (and come back after); students go to /student.
 * StudentGuard         the student app: guests are welcome, so it only waits
 *                      while a kept session is being checked.
 *
 * These only decide what the browser shows. The server enforces roles on every
 * request regardless (backend/src/auth.py require_role).
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { signInPath, useSession } from '../../context/session';

const Waiting: React.FC<{ message: string }> = ({ message }) => (
  <div className='flex min-h-screen items-center justify-center bg-white px-6 text-center text-sm text-slate-500'>
    {message}
  </div>
);

export const AuthenticationGuard: React.FC<{ component: React.ComponentType<object> }> = ({ component }) => {
  const session = useSession();
  const location = useLocation();
  const Component = component;

  if (session.isLoading) {
    return <Waiting message='Signing you in…' />;
  }
  if (!session.isAuthenticated) {
    return <Navigate to={signInPath(location.pathname + location.search)} replace />;
  }
  if (session.user?.role === 'student') {
    return <Navigate to='/student' replace />;
  }
  return <Component />;
};

export const StudentGuard: React.FC<{ component: React.ComponentType<object> }> = ({ component }) => {
  const session = useSession();
  const Component = component;

  if (session.isLoading) {
    return <Waiting message='Loading…' />;
  }
  return <Component />;
};
