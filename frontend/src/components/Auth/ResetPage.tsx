/**
 * /reset         "Forgot password?": resets are issued by an admin or TA for now.
 * /reset/:token  set a new password from an admin-issued link.
 * See docs/redesign/DESIGN.md §5.2.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthApiError, completeReset, getReset, ResetPreview } from '../../API/authApi';
import { AuthError, AuthHeading, AuthLayout } from './AuthLayout';
import PasswordField, { allRulesMet } from './PasswordField';

const SignInLink: React.FC = () => (
  <Link to='/signin' className='btn btn-primary btn-lg btn-block mt-6'>
    Sign in
  </Link>
);

const ResetPage: React.FC = () => {
  const { token } = useParams();
  return token ? <SetNewPassword token={token} /> : <ForgotPassword />;
};

const ForgotPassword: React.FC = () => (
  <AuthLayout>
    <AuthHeading title='Forgot your password?' />
    <p className='mt-4 text-[15px] leading-relaxed text-slate-700'>
      Ask your instructor or TA for a reset link. They can make one from the Users page, and it works once, for 24
      hours. Email resets are coming later.
    </p>
    <p className='mt-6 text-[14.5px]'>
      Remembered it?{' '}
      <Link to='/signin' className='font-semibold text-red-700 hover:underline'>
        Back to sign in
      </Link>
    </p>
  </AuthLayout>
);

type Phase = 'loading' | 'invalid' | 'form' | 'done';

const SetNewPassword: React.FC<{ token: string }> = ({ token }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [preview, setPreview] = useState<ResetPreview | null>(null);
  const [invalidMessage, setInvalidMessage] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AuthApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getReset(token)
      .then((value) => {
        setPreview(value);
        setPhase('form');
      })
      .catch((caught) => {
        setInvalidMessage(caught.message);
        setPhase('invalid');
      });
  }, [token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preview || !allRulesMet(password, preview.email) || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await completeReset(token, password);
      setPhase('done');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught : new AuthApiError(0, 'Something went wrong. Try again.'));
      setSubmitting(false);
    }
  };

  if (phase === 'loading') {
    return (
      <AuthLayout>
        <p className='text-slate-500'>Checking your reset link…</p>
      </AuthLayout>
    );
  }
  if (phase === 'invalid') {
    return (
      <AuthLayout>
        <AuthHeading title="This reset link doesn't work." />
        <p className='mt-4 text-[15px] text-slate-700'>{invalidMessage}</p>
      </AuthLayout>
    );
  }
  if (phase === 'done') {
    return (
      <AuthLayout>
        <AuthHeading title='Your new password is set.' subtitle='You were signed out everywhere else, for safety.' />
        <SignInLink />
      </AuthLayout>
    );
  }
  return (
    <AuthLayout>
      <AuthHeading
        title='Choose a new password.'
        subtitle={
          <>
            For <strong className='text-slate-900'>{preview?.email}</strong>. Link from {preview?.issued_by}.
          </>
        }
      />
      {error && (
        <AuthError>
          <p className='font-semibold'>{error.message}</p>
          {error.problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </AuthError>
      )}
      <form className='mt-6 space-y-4' noValidate onSubmit={handleSubmit}>
        <PasswordField
          label='New password'
          value={password}
          onChange={setPassword}
          autoComplete='new-password'
          rulesFor={{ email: preview?.email ?? '' }}
        />
        <button
          type='submit'
          className='btn btn-primary btn-lg btn-block'
          disabled={!allRulesMet(password, preview?.email) || submitting}
        >
          Set new password
        </button>
      </form>
    </AuthLayout>
  );
};

export default ResetPage;
