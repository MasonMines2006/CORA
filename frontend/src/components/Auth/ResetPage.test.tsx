import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPage from './ResetPage';
import { AuthApiError } from '../../API/authApi';

const getReset = vi.fn();
const completeReset = vi.fn();

vi.mock('../../API/authApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../API/authApi')>();
  return {
    ...actual,
    getReset: (...a: unknown[]) => getReset(...a),
    completeReset: (...a: unknown[]) => completeReset(...a),
  };
});

const GOOD = 'xenon builds after a scram';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path='/reset' element={<ResetPage />} />
        <Route path='/reset/:token' element={<ResetPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ResetPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('without a link, explains that an admin or TA issues resets for now', () => {
    renderAt('/reset');

    expect(screen.getByText(/ask your instructor or ta/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });

  it('sets a new password from an admin-issued link', async () => {
    getReset.mockResolvedValue({
      email: 'ada@school.edu',
      issued_by: 'prof@school.edu',
      expires_at: '2026-10-20T12:00:00+00:00',
    });
    completeReset.mockResolvedValue(undefined);
    renderAt('/reset/abc');

    expect(await screen.findByText(/ada@school.edu/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: GOOD } });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    expect(await screen.findByText(/password is set/i)).toBeInTheDocument();
    expect(completeReset).toHaveBeenCalledWith('abc', GOOD);
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/signin');
  });

  it('explains a used or expired link', async () => {
    getReset.mockRejectedValue(new AuthApiError(404, 'This link is invalid, already used, or expired.'));
    renderAt('/reset/old');

    expect(await screen.findByText(/invalid, already used, or expired/i)).toBeInTheDocument();
  });
});
