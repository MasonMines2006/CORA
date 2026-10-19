import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Landing from './Landing';

const session = { isAuthenticated: false, isLoading: false, user: undefined, signIn: vi.fn(), signOut: vi.fn() };
vi.mock('../../context/session', () => ({ useSession: () => session }));
vi.mock('../../utils/Constants', () => ({ SKIP_AUTH: false }));

const renderLanding = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path='/' element={<Landing />} />
        <Route path='/student' element={<p>Student app</p>} />
      </Routes>
    </MemoryRouter>
  );

describe('Landing', () => {
  beforeEach(() => {
    session.isAuthenticated = false;
    session.signIn.mockReset();
  });

  it('names the subject and avoids generated-landing clichés', () => {
    renderLanding();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Study reactor theory with a tutor that shows its work.' })
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/AI-powered|supercharge/i);
  });

  it('signs in through the session seam, back to the student app', () => {
    renderLanding();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' })[0]);
    expect(session.signIn).toHaveBeenCalledWith('/student');
  });

  it('offers Open CORA instead of Sign in once signed in', () => {
    session.isAuthenticated = true;
    renderLanding();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open CORA' })[0]);
    expect(screen.getByText('Student app')).toBeInTheDocument();
  });
});
