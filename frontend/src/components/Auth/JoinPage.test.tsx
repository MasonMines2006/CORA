import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JoinPage from './JoinPage';
import { AuthApiError } from '../../API/authApi';

const getInvite = vi.fn();
const acceptInvite = vi.fn();
const register = vi.fn();
const getAuthConfig = vi.fn();
const startSession = vi.fn();

vi.mock('../../API/authApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../API/authApi')>();
  return {
    ...actual,
    getInvite: (...a: unknown[]) => getInvite(...a),
    acceptInvite: (...a: unknown[]) => acceptInvite(...a),
    register: (...a: unknown[]) => register(...a),
    getAuthConfig: () => getAuthConfig(),
  };
});
vi.mock('../../context/session', () => ({
  useSession: () => ({ isAuthenticated: false, isLoading: false, user: undefined, startSession }),
}));

const GOOD = 'decay heat never stops';
const session = {
  token: 'tok',
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  user: { id: 2, email: 'cy@school.edu', name: 'Cy', role: 'ta' },
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path='/join' element={<JoinPage />} />
        <Route path='/join/:token' element={<JoinPage />} />
        <Route path='/student' element={<p>student home</p>} />
        <Route path='/admin' element={<p>admin home</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('JoinPage with an invite link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthConfig.mockResolvedValue({ open_enrollment: false, sso_enabled: false });
    getInvite.mockResolvedValue({
      email: 'cy@school.edu',
      role: 'ta',
      invited_by: 'prof@school.edu',
      expires_at: '2026-10-26T12:00:00+00:00',
    });
  });

  it('shows who is invited, with which role, and the email cannot be changed', async () => {
    renderAt('/join/abc');

    const email = await screen.findByLabelText(/email/i);
    expect(email).toHaveValue('cy@school.edu');
    expect(email).toHaveAttribute('readonly');
    expect(screen.getByText(/prof@school.edu/)).toBeInTheDocument();
    expect(screen.getByText(/teaching assistant/i)).toBeInTheDocument();
  });

  it('creates the account and signs the person in', async () => {
    acceptInvite.mockResolvedValue(session);
    renderAt('/join/abc');

    fireEvent.change(await screen.findByLabelText(/your name/i), { target: { value: 'Cy' } });
    fireEvent.change(screen.getByLabelText(/^choose a password$/i), { target: { value: GOOD } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await screen.findByText('admin home');
    expect(acceptInvite).toHaveBeenCalledWith('abc', 'Cy', GOOD);
    expect(startSession).toHaveBeenCalledWith(session, false);
  });

  it('shows the password rules live and blocks a short password', async () => {
    renderAt('/join/abc');

    fireEvent.change(await screen.findByLabelText(/your name/i), { target: { value: 'Cy' } });
    fireEvent.change(screen.getByLabelText(/^choose a password$/i), { target: { value: 'short' } });

    expect(screen.getByText(/at least 12 characters/i)).toHaveAttribute('data-met', 'false');
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
  });

  it('shows the server password problems if it refuses one', async () => {
    acceptInvite.mockRejectedValue(
      new AuthApiError(422, 'Choose a stronger password.', [
        'That password is too common. Pick something less guessable.',
      ])
    );
    renderAt('/join/abc');

    fireEvent.change(await screen.findByLabelText(/your name/i), { target: { value: 'Cy' } });
    fireEvent.change(screen.getByLabelText(/^choose a password$/i), { target: { value: 'password1234' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/too common/i);
  });

  it('explains a used or expired link instead of showing a dead form', async () => {
    getInvite.mockRejectedValue(new AuthApiError(404, 'This link is invalid, already used, or expired.'));
    renderAt('/join/used');

    expect(await screen.findByText(/invalid, already used, or expired/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
  });
});

describe('JoinPage without an invite link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains invite-only access while enrollment is closed', async () => {
    getAuthConfig.mockResolvedValue({ open_enrollment: false, sso_enabled: false });
    renderAt('/join');

    expect(await screen.findByText(/invite-only/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/your name/i)).not.toBeInTheDocument();
  });

  it('lets anyone register as a student while enrollment is open', async () => {
    getAuthConfig.mockResolvedValue({ open_enrollment: true, sso_enabled: false });
    register.mockResolvedValue({ ...session, user: { ...session.user, role: 'student' } });
    renderAt('/join');

    fireEvent.change(await screen.findByLabelText(/school email/i), { target: { value: 'new@school.edu' } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText(/^choose a password$/i), { target: { value: GOOD } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await screen.findByText('student home');
    expect(register).toHaveBeenCalledWith('new@school.edu', 'New', GOOD);
  });
});
