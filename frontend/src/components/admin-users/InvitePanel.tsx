/**
 * Invite people: paste emails (one per line, or separated by commas), pick a
 * role, get one single-use link per person to copy and send. There's no email
 * service yet, so the admin sends the links themselves.
 */
import React, { useState } from 'react';
import { AuthApiError, createInvites, CreatedLink, linkUrl, Role } from '../../API/authApi';
import { ROLE_NAMES } from '../Auth/JoinPage';
import CopyField from './CopyField';

const ROLE_HELP: Record<string, string> = {
  student: 'Learns: path, Ask, lessons, quizzes.',
  ta: 'Student app plus Materials and Analytics.',
  admin: 'Everything, including Users and enrollment.',
};

export function parseEmails(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

export const InvitePanel: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const [text, setText] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [created, setCreated] = useState<CreatedLink[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const emails = parseEmails(text);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (emails.length === 0 || busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await createInvites(emails, role);
      setCreated(result.invites);
      setSkipped(result.skipped);
      setText('');
      onCreated();
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : "Couldn't create invites.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className='rounded-[16px] border border-red-100 bg-white p-6' aria-labelledby='invite-heading'>
      <h2 id='invite-heading' className='font-display text-[20px] font-bold'>
        Invite people
      </h2>
      <form className='mt-4 grid gap-4 md:grid-cols-[1fr_220px]' onSubmit={handleSubmit}>
        <div>
          <label className='label' htmlFor='invite-emails'>
            Emails to invite
          </label>
          <textarea
            id='invite-emails'
            className='field min-h-[96px]'
            placeholder={'one@school.edu\ntwo@school.edu'}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div>
          <label className='label' htmlFor='invite-role'>
            Invite as
          </label>
          <select
            id='invite-role'
            className='field'
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {(['student', 'ta', 'admin'] as Role[]).map((value) => (
              <option key={value} value={value}>
                {ROLE_NAMES[value]}
              </option>
            ))}
          </select>
          <p className='mt-1 text-[13px] text-slate-500'>{ROLE_HELP[role]}</p>
          <button type='submit' className='btn btn-primary btn-md mt-3 w-full' disabled={emails.length === 0 || busy}>
            {emails.length > 1 ? `Create invite links (${emails.length})` : 'Create invite links'}
          </button>
        </div>
      </form>
      {error && (
        <p role='alert' className='mt-3 text-[14px] text-red-700'>
          {error}
        </p>
      )}
      {created.length > 0 && (
        <div className='mt-5 space-y-2'>
          <p className='text-[14px] text-slate-700'>
            Copy each link and send it to that person. Each works once, for 7 days.
          </p>
          {created.map((invite) => (
            <CopyField
              key={invite.token}
              label={`Invite link for ${invite.email}`}
              value={linkUrl('join', invite.token)}
            />
          ))}
        </div>
      )}
      {skipped.length > 0 && (
        <p className='mt-3 text-[13.5px] text-amber-700'>Already have an account: {skipped.join(', ')}</p>
      )}
    </section>
  );
};

export default InvitePanel;
