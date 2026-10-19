/**
 * Everyone with an account: change role, issue a reset link, deactivate.
 * You can't change your own role or deactivate yourself (the server refuses
 * too), so those controls are disabled or hidden on your own row.
 */
import React from 'react';
import { AdminUser, Role } from '../../API/authApi';
import { ROLE_NAMES } from '../Auth/JoinPage';

interface UsersTableProps {
  users: AdminUser[];
  myId: number | undefined;
  onRoleChange: (user: AdminUser, role: Role) => void;
  onActiveChange: (user: AdminUser, isActive: boolean) => void;
  onResetLink: (user: AdminUser) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return '–';
  }
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export const UsersTable: React.FC<UsersTableProps> = ({ users, myId, onRoleChange, onActiveChange, onResetLink }) => (
  // Admin is desktop-first; on small screens the table scrolls inside its card.
  <div className='overflow-x-auto rounded-[16px] border border-slate-200 bg-white'>
    <table className='w-full min-w-[720px] text-left text-[14px]'>
      <thead className='border-b border-slate-200 text-[12px] uppercase tracking-wider text-slate-500'>
        <tr>
          <th scope='col' className='px-4 py-3 font-semibold'>
            Person
          </th>
          <th scope='col' className='px-4 py-3 font-semibold'>
            Role
          </th>
          <th scope='col' className='px-4 py-3 font-semibold'>
            Status
          </th>
          <th scope='col' className='px-4 py-3 font-semibold'>
            Last sign-in
          </th>
          <th scope='col' className='px-4 py-3 font-semibold'>
            <span className='sr-only'>Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => {
          const isMe = user.id === myId;
          const isActive = user.status === 'active';
          const hasPassword = user.sign_in_method === 'password';
          return (
            <tr key={user.id} className='border-b border-slate-100 last:border-0'>
              <td className='px-4 py-3'>
                <p className='font-semibold text-slate-900'>
                  {user.name || '—'}
                  {isMe && ' (you)'}
                </p>
                <p className='text-slate-500'>{user.email}</p>
              </td>
              <td className='px-4 py-3'>
                <select
                  className='field py-1.5'
                  aria-label={`Role for ${user.email}`}
                  value={user.role}
                  disabled={isMe}
                  onChange={(event) => onRoleChange(user, event.target.value as Role)}
                >
                  {(['student', 'ta', 'admin'] as Role[]).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_NAMES[role]}
                    </option>
                  ))}
                  {user.role === 'test_full' && <option value='test_full'>{ROLE_NAMES.test_full}</option>}
                </select>
              </td>
              <td className='px-4 py-3'>
                <span className={isActive ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-500'}>
                  {isActive ? 'Active' : 'Deactivated'}
                </span>
              </td>
              <td className='px-4 py-3 text-slate-500'>{formatDate(user.last_login)}</td>
              <td className='px-4 py-3'>
                <div className='flex justify-end gap-2'>
                  {hasPassword && (
                    <button type='button' className='btn btn-ghost btn-sm' onClick={() => onResetLink(user)}>
                      Reset link
                    </button>
                  )}
                  {!isMe && (
                    <button
                      type='button'
                      className={isActive ? 'btn btn-ghost btn-sm text-red-700' : 'btn btn-secondary btn-sm'}
                      onClick={() => onActiveChange(user, !isActive)}
                    >
                      {isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default UsersTable;
