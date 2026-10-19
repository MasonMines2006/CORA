import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignInPage from './SignInPage';
import { AuthApiError } from '../../API/authApi';

const login = vi.fn();
const getAuthConfig = vi.fn();
const startSession = vi.fn();

vi.mock('../../API/authApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../API/authApi')>();
  return { ...actual, login: (...args: unknown[]) => login(...args), getAuthConfig: () => getAuthConfig() };
});
vi.mock('../../context/session', () => ({
  useSession: () => ({ isAuthenticated: false, isLoading: false, user: undefined, startSession }),
}));

// A fixed expiry, so two sessions built in the same test compare equal.
const EXPIRES = '2030-01-01T00:00:00+00:00';
const session = (role: string) => ({
  token: 'tok',
  expires_at: EXPIRES,
  user: { id: 1, email: 'ada@school.edu', name: 'Ada', role },
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path='/signin' element={<SignInPage />} />
        <Route path='/student' element={<p>student home</p>} />
        <Route path='/admin' element={<p>admin home</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function fillAndSubmit(email = 'ada@school.edu', password = 'decay heat never stops') {
  fireEvent.change(screen.getByLabelText(/school email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
}

describe('SignInPage', () => {
  beforeEach(() => {
    login.mockReset();
    startSession.mockReset();
    getAuthConfig.mockResolvedValue({ open_enrollment: false, sso_enabled: false });
  });

  it('signs a student in and takes them to their path', async () => {
    login.mockResolvedValue(session('student'));
    renderAt('/signin');

    fireEvent.click(screen.getByLabelText(/keep me signed in/i));
    fillAndSubmit();

    await screen.findByText('student home');
    expect(login).toHaveBeenCalledWith('ada@school.edu', 'decay heat never stops', true);
    expect(startSession).toHaveBeenCalledWith(session('student'), true);
  });

  it('sends staff to the admin area', async () => {
    login.mockResolvedValue(session('admin'));
    renderAt('/signin');

    fillAndSubmit();

    await screen.findByText('admin home');
  });

  it('returns to the page that asked for sign-in, if it is inside CORA', async () => {
    login.mockResolvedValue(session('student'));
    renderAt('/signin?returnTo=%2Fadmin');

    fillAndSubmit();

    await screen.findByText('admin home');
  });

  it('shows one non-revealing error and the lockout rule on a failed sign-in', async () => {
    login.mockRejectedValue(new AuthApiError(401, 'Email or password is incorrect'));
    renderAt('/signin');

    fillAndSubmit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email or password is incorrect');
    expect(alert).toHaveTextContent(/5 tries/i);
    expect(startSession).not.toHaveBeenCalled();
  });

  it('explains when there have been too many attempts', async () => {
    login.mockRejectedValue(new AuthApiError(429, 'Too many attempts. Wait a few minutes and try again.'));
    renderAt('/signin');

    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i);
  });

  it('shows university SSO as coming soon, and disabled', () => {
    renderAt('/signin');

    const sso = screen.getByRole('button', { name: /university sso/i });
    expect(sso).toBeDisabled();
    expect(sso).toHaveTextContent(/coming soon/i);
  });

  it('offers account creation only while open enrollment is on', async () => {
    getAuthConfig.mockResolvedValue({ open_enrollment: true, sso_enabled: false });
    renderAt('/signin');

    expect(await screen.findByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/join');
  });

  it('can show the password while typing it', () => {
    renderAt('/signin');
    const field = screen.getByLabelText(/^password$/i);

    fireEvent.click(screen.getByRole('button', { name: /show password/i }));

    expect(field).toHaveAttribute('type', 'text');
  });

  it('does not submit until both fields are filled', async () => {
    renderAt('/signin');

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(login).not.toHaveBeenCalled());
  });
});
