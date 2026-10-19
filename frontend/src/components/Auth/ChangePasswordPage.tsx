/**
 * /account/password: change your own password while signed in.
 *
 * Changing it signs you out everywhere else: the server bumps the account's
 * token version, so older sessions stop working. It sends back a fresh
 * session for this browser so you stay signed in here.
 */
import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthApiError, changePassword } from '../../API/authApi';
import { signInPath, useSession } from '../../context/session';
import { AuthError, AuthHeading, AuthLayout } from './AuthLayout';
import PasswordField, { allRulesMet } from './PasswordField';
import { homeFor } from './returnTo';
import { isKeptSession } from './tokenStore';

const ChangePasswordPage: React.FC = () => {
  const session = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<AuthApiError | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const email = session.user?.email ?? '';

  if (session.isLoading) {
    return null;
  }
  if (!session.isAuthenticated) {
    return <Navigate to={signInPath('/account/password')} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!current || !allRulesMet(next, email) || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await changePassword(current, next);
      // Keep the same "keep me signed in" choice the person made at sign-in.
      session.startSession(response, isKeptSession());
      setDone(true);
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught : new AuthApiError(0, 'Something went wrong. Try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <AuthLayout>
        <AuthHeading title='Password changed.' subtitle='You were signed out on your other devices.' />
        <Link to={homeFor(session.user?.role)} className='btn btn-primary btn-lg btn-block mt-6'>
          Back to CORA
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeading title='Change your password.' subtitle={email} />
      {error && (
        <AuthError>
          <p className='font-semibold'>{error.message}</p>
          {error.problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </AuthError>
      )}
      <form className='mt-6 space-y-4' noValidate onSubmit={handleSubmit}>
        <PasswordField label='Current password' value={current} onChange={setCurrent} autoComplete='current-password' />
        <PasswordField
          label='New password'
          value={next}
          onChange={setNext}
          autoComplete='new-password'
          rulesFor={{ email }}
        />
        <button
          type='submit'
          className='btn btn-primary btn-lg btn-block'
          disabled={!current || !allRulesMet(next, email) || submitting}
        >
          Change password
        </button>
      </form>
    </AuthLayout>
  );
};

export default ChangePasswordPage;
