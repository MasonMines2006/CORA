import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticationGuard } from './Auth';
import type { Session } from '../../context/session';

let session: Partial<Session> = {};
vi.mock('../../context/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../context/session')>();
  return { ...actual, useSession: () => session };
});

const Where = () => {
  const location = useLocation();
  return <p>at {location.pathname + location.search}</p>;
};
const AdminScreen = () => <p>admin screen</p>;

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path='/admin' element={<AuthenticationGuard component={AdminScreen} />} />
        <Route path='*' element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AuthenticationGuard', () => {
  it('waits while the session is being checked', () => {
    session = { isLoading: true, isAuthenticated: false };
    renderAdmin();

    expect(screen.getByText(/signing you in/i)).toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign in, remembering where they were going', async () => {
    session = { isLoading: false, isAuthenticated: false };
    renderAdmin();

    expect(await screen.findByText('at /signin?returnTo=%2Fadmin')).toBeInTheDocument();
  });

  it('sends a student to the student app', async () => {
    session = { isLoading: false, isAuthenticated: true, user: { role: 'student' } };
    renderAdmin();

    expect(await screen.findByText('at /student')).toBeInTheDocument();
  });

  it('lets a TA or admin through', () => {
    session = { isLoading: false, isAuthenticated: true, user: { role: 'ta' } };
    renderAdmin();

    expect(screen.getByText('admin screen')).toBeInTheDocument();
  });
});
