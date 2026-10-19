import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import StudentApp from './StudentApp';

vi.mock('../../context/session', () => ({
  useSession: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: undefined,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../../context/ThemeWrapper', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('../../context/UserCredentials', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../../context/UsersFiles', () => ({
  FileContextProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../../context/UserMessages', () => ({
  MessageContextWrapper: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@neo4j-ndl/react', () => ({ SpotlightProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('../UI/ErrroBoundary', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

vi.mock('./StudentHomeArtboard', () => ({
  default: ({ onOpenConcept, onAsk }: { onOpenConcept: (id: string) => void; onAsk: (prompt: string) => void }) => (
    <div>
      Home screen <button onClick={() => onOpenConcept('Reactivity')}>Open Reactivity</button>
      <button onClick={() => onAsk('What is reactivity?')}>Ask from home</button>
    </div>
  ),
}));
vi.mock('./ConceptHub', () => ({
  default: ({ conceptId, mode }: { conceptId: string; mode: string }) => (
    <div>
      Hub for {conceptId} in {mode}
    </div>
  ),
}));
vi.mock('./StudentExplore', () => ({ default: () => <div>Graph screen</div> }));
vi.mock('./StudentChat', () => ({ default: () => <div>Ask screen</div> }));
vi.mock('./ReviewSession', () => ({ default: () => <div>Review screen</div> }));

const renderAt = (url = '/student') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <StudentApp />
    </MemoryRouter>
  );

const sidebar = () => within(screen.getAllByRole('navigation', { name: 'Primary' })[0]);

describe('StudentApp navigation', () => {
  it('opens on the Path and moves between the four destinations', () => {
    renderAt();
    expect(screen.getByText('Home screen')).toBeInTheDocument();

    fireEvent.click(sidebar().getByRole('button', { name: 'Review' }));
    expect(screen.getByText('Review screen')).toBeInTheDocument();

    fireEvent.click(sidebar().getByRole('button', { name: 'Ask' }));
    expect(screen.getByText('Ask screen')).toBeInTheDocument();
  });

  it('keeps old concept links working', () => {
    renderAt('/student?view=concepts&concept=Reactivity&mode=practice');
    expect(screen.getByText('Hub for Reactivity in practice')).toBeInTheDocument();
  });

  it('opens a concept from the Path', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Open Reactivity' }));
    expect(screen.getByText('Hub for Reactivity in learn')).toBeInTheDocument();
  });

  it('sends a question from the Path to Ask', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Ask from home' }));
    expect(screen.getByText('Ask screen')).toBeInTheDocument();
  });

  it('treats an unknown view in the URL as the Path rather than a blank page', () => {
    renderAt('/student?view=nonsense');
    expect(screen.getByText('Home screen')).toBeInTheDocument();
  });

  it('offers a guest Sign in', () => {
    renderAt();
    expect(screen.getAllByRole('button', { name: 'Sign in' }).length).toBeGreaterThan(0);
  });
});
