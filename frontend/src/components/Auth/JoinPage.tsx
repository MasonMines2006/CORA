/**
 * /join/:token  accept an admin's invite: choose a name and password.
 * /join         no invite: explain invite-only access, or (while an admin has
 *               open enrollment on) let anyone register as a student.
 * See docs/redesign/DESIGN.md §5.2.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  acceptInvite,
  AuthApiError,
  getAuthConfig,
  getInvite,
  InvitePreview,
  register,
  SessionResponse,
} from '../../API/authApi';
import { useSession } from '../../context/session';
import { AuthError, AuthHeading, AuthLayout } from './AuthLayout';
import PasswordField, { allRulesMet } from './PasswordField';
import { homeFor } from './returnTo';

export const ROLE_NAMES: Record<string, string> = {
  student: 'Student',
  ta: 'Teaching assistant',
  admin: 'Admin',
  test_full: 'Tester',
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

type Load<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'error'; message: string };

const JoinPage: React.FC = () => {
  const { token } = useParams();
  return token ? <InviteJoin token={token} /> : <OpenJoin />;
};

/** Shared "name + password → create account" form. */
const AccountForm: React.FC<{
  email: string;
  emailEditable: boolean;
  onEmailChange?: (email: string) => void;
  submit: (name: string, password: string) => Promise<SessionResponse>;
}> = ({ email, emailEditable, onEmailChange, submit }) => {
  const session = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AuthApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const ready = name.trim() !== '' && email.trim() !== '' && allRulesMet(password, email) && !submitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await submit(name.trim(), password);
      session.startSession(response, false);
      navigate(homeFor(response.user.role), { replace: true });
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught : new AuthApiError(0, 'Something went wrong. Try again.'));
      setSubmitting(false);
    }
  };

  return (
    <>
      {error && (
        <AuthError>
          <p className='font-semibold'>{error.message}</p>
          {error.problems.length > 0 && (
            <ul className='mt-1 list-disc pl-5 text-slate-700'>
              {error.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </AuthError>
      )}
      <form className='mt-6 space-y-4' noValidate onSubmit={handleSubmit}>
        <div>
          <label className='label' htmlFor='join-email'>
            {emailEditable ? 'School email' : 'Email'}
          </label>
          <input
            className='field read-only:bg-slate-50 read-only:text-slate-700'
            id='join-email'
            type='email'
            autoComplete='username'
            value={email}
            readOnly={!emailEditable}
            onChange={(event) => onEmailChange?.(event.target.value)}
            required
          />
        </div>
        <div>
          <label className='label' htmlFor='join-name'>
            Your name
          </label>
          <input
            className='field'
            id='join-name'
            autoComplete='name'
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <PasswordField
          label='Choose a password'
          value={password}
          onChange={setPassword}
          autoComplete='new-password'
          rulesFor={{ email }}
        />
        <button type='submit' className='btn btn-primary btn-lg btn-block' disabled={!ready}>
          {submitting ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </>
  );
};

const InviteJoin: React.FC<{ token: string }> = ({ token }) => {
  const [invite, setInvite] = useState<Load<InvitePreview>>({ state: 'loading' });

  useEffect(() => {
    getInvite(token)
      .then((value) => setInvite({ state: 'ready', value }))
      .catch((error) => setInvite({ state: 'error', message: error.message }));
  }, [token]);

  if (invite.state === 'loading') {
    return (
      <AuthLayout>
        <p className='text-slate-500'>Checking your invite…</p>
      </AuthLayout>
    );
  }
  if (invite.state === 'error') {
    return (
      <AuthLayout>
        <AuthHeading title="This invite doesn't work." />
        <p className='mt-4 text-[15px] text-slate-700'>{invite.message}</p>
        <p className='mt-6 text-[14.5px]'>
          Already have an account?{' '}
          <Link to='/signin' className='font-semibold text-red-700 hover:underline'>
            Sign in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  const { email, role, invited_by: invitedBy, expires_at: expiresAt } = invite.value;
  return (
    <AuthLayout>
      <AuthHeading
        title='Join CORA.'
        subtitle={
          <>
            {invitedBy} invited you as a <strong className='text-slate-900'>{ROLE_NAMES[role] ?? role}</strong>.
          </>
        }
      />
      <AccountForm
        email={email}
        emailEditable={false}
        submit={(name, password) => acceptInvite(token, name, password)}
      />
      <p className='mt-4 text-center text-[13px] text-slate-500'>
        Invite link expires {formatDate(expiresAt)}. One account per invite.
      </p>
    </AuthLayout>
  );
};

const OpenJoin: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    getAuthConfig()
      .then((config) => setIsOpen(config.open_enrollment))
      .catch(() => setIsOpen(false));
  }, []);

  if (isOpen === null) {
    return (
      <AuthLayout>
        <p className='text-slate-500'>Loading…</p>
      </AuthLayout>
    );
  }
  if (!isOpen) {
    return (
      <AuthLayout>
        <AuthHeading title='CORA is invite-only.' />
        <p className='mt-4 text-[15px] leading-relaxed text-slate-700'>
          Accounts are created from invite links. Ask your instructor or TA for one: they can make it from the Users
          page in a few seconds. The link signs you up with the right course and role.
        </p>
        <p className='mt-6 text-[14.5px]'>
          Already have an account?{' '}
          <Link to='/signin' className='font-semibold text-red-700 hover:underline'>
            Sign in
          </Link>
        </p>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout>
      <AuthHeading title='Create your account.' subtitle='Enrollment is open, so you can join as a student.' />
      <AccountForm
        email={email}
        emailEditable
        onEmailChange={setEmail}
        submit={(name, password) => register(email.trim(), name, password)}
      />
    </AuthLayout>
  );
};

export default JoinPage;
