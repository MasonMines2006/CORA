import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppShell from './AppShell';

const account = { isAuthenticated: true, name: 'Jordan Reyes', onSignIn: vi.fn(), onSignOut: vi.fn() };

const renderShell = (overrides: Partial<React.ComponentProps<typeof AppShell>> = {}) => {
  const props = {
    active: 'path' as const,
    onNavigate: vi.fn(),
    dueCount: 7,
    sessions: [{ id: 's-1', mode: 'ask' as const, title: 'Why decay heat matters', updatedAt: Date.now() }],
    onOpenSession: vi.fn(),
    onNewSession: vi.fn(),
    account,
    ...overrides,
  };
  render(
    <AppShell {...props}>
      <p>Page body</p>
    </AppShell>
  );
  return props;
};

describe('AppShell', () => {
  it('marks the current destination and shows cards due on Review', () => {
    renderShell();
    const [sidebarNav] = screen.getAllByRole('navigation', { name: 'Primary' });
    expect(within(sidebarNav).getByRole('button', { name: 'Path' })).toHaveAttribute('aria-current', 'page');
    expect(within(sidebarNav).getByRole('button', { name: /review 7 due/i })).toBeInTheDocument();
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });

  it('navigates from the sidebar and opens recent sessions', () => {
    const props = renderShell();
    fireEvent.click(screen.getAllByRole('button', { name: 'Course graph' })[0]);
    expect(props.onNavigate).toHaveBeenCalledWith('graph');
    fireEvent.click(screen.getAllByRole('button', { name: /why decay heat matters/i })[0]);
    expect(props.onOpenSession).toHaveBeenCalledWith(expect.objectContaining({ id: 's-1' }));
  });

  it('offers Sign in to a guest instead of a name', () => {
    const onSignIn = vi.fn();
    renderShell({ account: { isAuthenticated: false, onSignIn, onSignOut: vi.fn() } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' })[0]);
    expect(onSignIn).toHaveBeenCalled();
  });

  it('opens the mobile menu, closes it with Escape, and hands focus back', () => {
    renderShell();
    const menuButton = screen.getByRole('button', { name: 'Open menu' });
    menuButton.focus();
    fireEvent.click(menuButton);

    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(dialog).getByRole('button', { name: 'Close menu' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });

  it('closes the mobile menu after picking a destination', () => {
    const props = renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Progress' }));
    expect(props.onNavigate).toHaveBeenCalledWith('progress');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
