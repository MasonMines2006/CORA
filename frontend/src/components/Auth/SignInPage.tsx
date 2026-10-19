/**
 * /signin: email + password (docs/redesign/DESIGN.md §5.2).
 *
 * The server answers every failure the same way ("Email or password is
 * incorrect"), so this page never reveals whether an email has an account.
 */
import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthApiError, getAuthConfig, login } from '../../API/authApi';
import { useSession } from '../../context/session';
import { AuthError, AuthHeading, AuthLayout } from './AuthLayout';
import PasswordField from './PasswordField';
import { homeFor, safeReturnTo } from './returnTo';

const SignInPage: React.FC = () => {
  const session = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState<AuthApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openEnrollment, setOpenEnrollment] = useState(false);

  useEffect(() => {
    // Only decides whether to show "Create an account"; failing quietly is fine.
    getAuthConfig()
      .then((config) => setOpenEnrollment(config.open_enrollment))
      .catch(() => setOpenEnrollment(false));
  }, []);

  if (session.isAuthenticated) {
    return <Navigate to={homeFor(session.user?.role)} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await login(email.trim(), password, keepSignedIn);
      session.startSession(response, keepSignedIn);
      const returnTo = params.get('returnTo');
      navigate(returnTo ? safeReturnTo(returnTo) : homeFor(response.user.role), { replace: true });
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught : new AuthApiError(0, 'Something went wrong. Try again.'));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <AuthHeading title='Welcome back.' subtitle='Sign in to pick up where you left off.' />

      {error && <SignInError error={error} />}

      <form className='mt-6 space-y-4' noValidate onSubmit={handleSubmit}>
        <div>
          <label className='label' htmlFor='signin-email'>
            School email
          </label>
          <input
            className='field'
            id='signin-email'
            type='email'
            autoComplete='username'
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={error?.status === 401 || undefined}
            required
          />
        </div>
        <PasswordField
          label='Password'
          value={password}
          onChange={setPassword}
          autoComplete='current-password'
          invalid={error?.status === 401}
          labelAside={
            <Link to='/reset' className='text-[13.5px] font-semibold text-red-700 hover:underline'>
              Forgot password?
            </Link>
          }
        />
        <label className='flex min-h-[44px] items-center gap-3 text-[14px]'>
          <input
            type='checkbox'
            className='h-5 w-5 accent-red-600'
            checked={keepSignedIn}
            onChange={(event) => setKeepSignedIn(event.target.checked)}
          />
          Keep me signed in on this device
        </label>
        <button type='submit' className='btn btn-primary btn-lg btn-block' disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <SsoComingSoon />

      <p className='mt-8 text-center text-[14.5px] text-slate-700'>
        New to CORA?{' '}
        <Link to='/join' className='font-semibold text-red-700 hover:underline'>
          {openEnrollment ? 'Create an account' : 'Join with your invite'}
        </Link>
      </p>
    </AuthLayout>
  );
};

const SignInError: React.FC<{ error: AuthApiError }> = ({ error }) => {
  if (error.status !== 401) {
    return (
      <AuthError>
        <p className='font-semibold'>{error.message}</p>
      </AuthError>
    );
  }
  return (
    <AuthError>
      <p className='font-semibold'>Email or password is incorrect.</p>
      <p className='mt-0.5 text-slate-700'>
        Check for typos, or{' '}
        <Link to='/reset' className='font-semibold text-red-700 underline'>
          reset your password
        </Link>
        . After 5 tries, sign-in pauses for 15 minutes.
      </p>
    </AuthError>
  );
};

/** University single sign-on is planned (SAML, like cssgunc/senate), not built yet. */
const SsoComingSoon: React.FC = () => (
  <>
    <div className='my-6 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-wider text-slate-500'>
      <span className='h-px flex-1 bg-slate-200' />
      or
      <span className='h-px flex-1 bg-slate-200' />
    </div>
    <button type='button' className='btn btn-secondary btn-lg btn-block' disabled aria-describedby='sso-note'>
      Sign in with university SSO
      <span className='ml-2 rounded-[6px] bg-slate-100 px-1.5 py-0.5 font-code text-[11px] font-medium uppercase'>
        Coming soon
      </span>
    </button>
    <p id='sso-note' className='mt-2 text-center text-[13px] text-slate-500'>
      Single sign-on with your university account is on the way.
    </p>
  </>
);

export default SignInPage;
