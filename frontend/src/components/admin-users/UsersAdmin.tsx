/**
 * /admin/users: who can use CORA (docs/redesign/DESIGN.md §5.9 "Users").
 *
 * - Open enrollment switch: while on, anyone can register as a student.
 * - Invite people: single-use links, copied and sent by hand.
 * - People: change role, issue a password-reset link, deactivate/reactivate.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AdminUser,
  AuthApiError,
  CreatedLink,
  getEnrollment,
  issueResetLink,
  linkUrl,
  listInvites,
  listUsers,
  PendingInvite,
  Role,
  setEnrollment,
  updateUser,
} from '../../API/authApi';
import { useSession } from '../../context/session';
import { ROLE_NAMES } from '../Auth/JoinPage';
import CopyField from './CopyField';
import InvitePanel from './InvitePanel';
import UsersTable from './UsersTable';

type Load = 'loading' | 'ready' | 'error';
const ADMIN_ROLES = ['admin', 'test_full'];

const UsersAdmin: React.FC = () => {
  const session = useSession();
  const [load, setLoad] = useState<Load>('loading');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [openEnrollment, setOpenEnrollment] = useState(false);
  const [resetLink, setResetLink] = useState<CreatedLink | null>(null);
  const [actionError, setActionError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [nextUsers, nextInvites, enrollment] = await Promise.all([listUsers(), listInvites(), getEnrollment()]);
      setUsers(nextUsers);
      setInvites(nextInvites);
      setOpenEnrollment(enrollment);
      setLoad('ready');
    } catch {
      setLoad('error');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Run an admin action; show the server's message if it refuses. */
  const act = async (action: () => Promise<unknown>) => {
    setActionError('');
    try {
      await action();
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof AuthApiError ? caught.message : 'That change failed. Try again.');
    }
  };

  const changeRole = (user: AdminUser, role: Role) => act(() => updateUser(user.id, { role }));
  const changeActive = (user: AdminUser, isActive: boolean) => act(() => updateUser(user.id, { is_active: isActive }));
  const makeResetLink = (user: AdminUser) => act(async () => setResetLink(await issueResetLink(user.id)));
  const toggleEnrollment = () => act(async () => setOpenEnrollment(await setEnrollment(!openEnrollment)));

  // TAs can open the admin area but not this page; the server refuses them too.
  const role = session.user?.role;
  if (role && !ADMIN_ROLES.includes(role)) {
    return (
      <main id='main' className='mx-auto max-w-xl px-6 py-16 font-body text-slate-700'>
        <h1 className='font-display text-[26px] font-bold text-slate-900'>Only admins can manage users.</h1>
        <Link to='/admin' className='btn btn-secondary btn-md mt-6'>
          Back to Materials
        </Link>
      </main>
    );
  }

  return (
    <div className='min-h-screen bg-slate-50 font-body text-slate-900'>
      <header className='border-b border-slate-200 bg-white'>
        <nav
          className='mx-auto flex max-w-5xl items-center gap-6 px-6 py-4 text-[14px] font-semibold'
          aria-label='Admin'
        >
          <span className='font-display text-[19px] font-bold'>cora admin</span>
          <Link to='/admin' className='text-slate-500 hover:text-slate-900'>
            Materials
          </Link>
          <span aria-current='page' className='text-red-700'>
            Users
          </span>
          <Link to='/student' className='ml-auto text-slate-500 hover:text-slate-900'>
            View as student
          </Link>
        </nav>
      </header>
      <main id='main' className='mx-auto max-w-5xl space-y-6 px-6 py-8'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <h1 className='font-display text-[30px] font-bold tracking-tight'>Users</h1>
          <EnrollmentSwitch isOpen={openEnrollment} disabled={load !== 'ready'} onToggle={toggleEnrollment} />
        </div>

        {load === 'loading' && <p className='text-slate-500'>Loading people…</p>}
        {load === 'error' && (
          <div role='alert' className='rounded-[16px] border border-red-200 bg-red-50 p-5 text-red-700'>
            <p className='font-semibold'>Couldn't load people. The server may be down.</p>
            <button
              type='button'
              className='btn btn-secondary btn-sm mt-3'
              onClick={() => {
                setLoad('loading');
                refresh();
              }}
            >
              Try again
            </button>
          </div>
        )}

        {load === 'ready' && (
          <>
            <InvitePanel onCreated={refresh} />
            {actionError && (
              <p role='alert' className='text-[14px] text-red-700'>
                {actionError}
              </p>
            )}
            {resetLink && (
              <section className='rounded-[16px] border border-amber-300 bg-amber-50 p-5'>
                <p className='text-[14px] text-slate-700'>
                  Reset link for <strong>{resetLink.email}</strong>. Send it to them; it works once, for 24 hours.
                </p>
                <div className='mt-2'>
                  <CopyField label={`Reset link for ${resetLink.email}`} value={linkUrl('reset', resetLink.token)} />
                </div>
              </section>
            )}
            <UsersTable
              users={users}
              myId={session.user?.id}
              onRoleChange={changeRole}
              onActiveChange={changeActive}
              onResetLink={makeResetLink}
            />
            {invites.length > 0 && <PendingInvites invites={invites} />}
          </>
        )}
      </main>
    </div>
  );
};

const EnrollmentSwitch: React.FC<{ isOpen: boolean; disabled: boolean; onToggle: () => void }> = ({
  isOpen,
  disabled,
  onToggle,
}) => (
  <div className='flex items-center gap-3'>
    <button
      type='button'
      role='switch'
      aria-checked={isOpen}
      aria-label='Open enrollment'
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-7 w-12 rounded-full transition-colors ${isOpen ? 'bg-emerald-600' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${isOpen ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
    <div className='text-[14px]'>
      <p className='font-semibold'>Open enrollment {isOpen ? 'on' : 'off'}</p>
      <p className='text-slate-500'>{isOpen ? 'Anyone can register as a student.' : 'Only invited people can join.'}</p>
    </div>
  </div>
);

const PendingInvites: React.FC<{ invites: PendingInvite[] }> = ({ invites }) => (
  <section aria-labelledby='pending-heading'>
    <h2 id='pending-heading' className='font-display text-[20px] font-bold'>
      Waiting to join
    </h2>
    <ul className='mt-3 divide-y divide-slate-100 rounded-[16px] border border-slate-200 bg-white text-[14px]'>
      {invites.map((invite) => (
        <li key={`${invite.email}-${invite.expires_at}`} className='flex flex-wrap justify-between gap-2 px-4 py-3'>
          <span>
            {invite.email} · {ROLE_NAMES[invite.role] ?? invite.role}
          </span>
          <span className='text-slate-500'>
            Invited by {invite.invited_by} · expires {new Date(invite.expires_at).toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  </section>
);

export default UsersAdmin;
