import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UsersAdmin from './UsersAdmin';

// vi.mock is hoisted above everything else in the file, so the fakes it uses
// must be created with vi.hoisted (otherwise they don't exist yet).
const api = vi.hoisted(() => ({
  listUsers: vi.fn(),
  listInvites: vi.fn(),
  createInvites: vi.fn(),
  updateUser: vi.fn(),
  issueResetLink: vi.fn(),
  getEnrollment: vi.fn(),
  setEnrollment: vi.fn(),
}));

vi.mock('../../API/authApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../API/authApi')>();
  const wrapped = Object.fromEntries(
    Object.entries(api).map(([name, fn]) => [name, (...args: unknown[]) => fn(...args)])
  );
  return { ...actual, ...wrapped };
});
vi.mock('../../context/session', () => ({
  useSession: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 1, email: 'me@school.edu', role: 'admin' },
  }),
}));

const ADA = {
  id: 7,
  email: 'ada@school.edu',
  name: 'Ada',
  role: 'student',
  status: 'active',
  sign_in_method: 'password',
  last_login: null,
  created_at: '2026-10-19T00:00:00+00:00',
};
const ME = { ...ADA, id: 1, email: 'me@school.edu', name: 'Me', role: 'admin' };

function renderPage() {
  return render(
    <MemoryRouter>
      <UsersAdmin />
    </MemoryRouter>
  );
}

describe('UsersAdmin', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.listUsers.mockResolvedValue([ME, ADA]);
    api.listInvites.mockResolvedValue([]);
    api.getEnrollment.mockResolvedValue(false);
  });

  it('lists people with their role and status', async () => {
    renderPage();

    const row = (await screen.findByText('ada@school.edu')).closest('tr') as HTMLElement;
    expect(within(row).getByRole('combobox', { name: /role for ada@school.edu/i })).toHaveValue('student');
    expect(within(row).getByText(/active/i)).toBeInTheDocument();
  });

  it('creates invite links for pasted emails and shows them to copy', async () => {
    api.createInvites.mockResolvedValue({
      invites: [{ email: 'cy@school.edu', role: 'ta', token: 'tok-cy', expires_at: '2026-10-26T00:00:00+00:00' }],
      skipped: ['ada@school.edu'],
    });
    renderPage();

    fireEvent.change(await screen.findByLabelText(/emails to invite/i), {
      target: { value: 'cy@school.edu\nada@school.edu' },
    });
    fireEvent.change(screen.getByLabelText(/invite as/i), { target: { value: 'ta' } });
    fireEvent.click(screen.getByRole('button', { name: /create invite links/i }));

    expect(await screen.findByDisplayValue(`${window.location.origin}/join/tok-cy`)).toBeInTheDocument();
    expect(api.createInvites).toHaveBeenCalledWith(['cy@school.edu', 'ada@school.edu'], 'ta');
    expect(screen.getByText(/already have an account: ada@school.edu/i)).toBeInTheDocument();
  });

  it('issues a password reset link for someone', async () => {
    api.issueResetLink.mockResolvedValue({
      email: 'ada@school.edu',
      token: 'reset-1',
      expires_at: '2026-10-20T00:00:00+00:00',
    });
    renderPage();

    const row = (await screen.findByText('ada@school.edu')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /reset link/i }));

    expect(await screen.findByDisplayValue(`${window.location.origin}/reset/reset-1`)).toBeInTheDocument();
  });

  it('changes a role', async () => {
    api.updateUser.mockResolvedValue({ ...ADA, role: 'ta' });
    renderPage();

    fireEvent.change(await screen.findByRole('combobox', { name: /role for ada@school.edu/i }), {
      target: { value: 'ta' },
    });

    await vi.waitFor(() => expect(api.updateUser).toHaveBeenCalledWith(7, { role: 'ta' }));
  });

  it('deactivates someone', async () => {
    api.updateUser.mockResolvedValue({ ...ADA, status: 'deactivated' });
    renderPage();

    const row = (await screen.findByText('ada@school.edu')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /deactivate/i }));

    await vi.waitFor(() => expect(api.updateUser).toHaveBeenCalledWith(7, { is_active: false }));
  });

  it('does not let you change your own role or deactivate yourself', async () => {
    renderPage();

    const row = (await screen.findByText('me@school.edu')).closest('tr') as HTMLElement;
    expect(within(row).getByRole('combobox')).toBeDisabled();
    expect(within(row).queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument();
  });

  it('turns open enrollment on', async () => {
    api.setEnrollment.mockResolvedValue(true);
    renderPage();

    fireEvent.click(await screen.findByRole('switch', { name: /open enrollment/i }));

    await vi.waitFor(() => expect(api.setEnrollment).toHaveBeenCalledWith(true));
  });

  it('shows an error panel with retry instead of an empty table when loading fails', async () => {
    api.listUsers.mockRejectedValue(new Error('down'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
