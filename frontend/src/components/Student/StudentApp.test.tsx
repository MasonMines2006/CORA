import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import StudentApp from './StudentApp';

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ isAuthenticated: false, loginWithRedirect: vi.fn(), logout: vi.fn() }),
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
  default: ({
    onOpenConcept,
    onAsk,
  }: {
    onOpenConcept: (id: string, beat?: number) => void;
    onAsk: (prompt: string) => void;
  }) => (
    <div>
      Home screen <button onClick={() => onOpenConcept('Reactivity')}>Open Reactivity</button>
      <button onClick={() => onOpenConcept('Reactivity', 2)}>Resume Reactivity</button>
      <button onClick={() => onAsk('What is reactivity?')}>Ask from home</button>
    </div>
  ),
}));
vi.mock('./ConceptIndex', () => ({ default: () => <div>Concept list</div> }));
vi.mock('./ConceptHub', () => ({
  default: ({
    conceptId,
    mode,
    initialBeat,
    onModeChange,
    onAsk,
  }: {
    conceptId: string;
    mode: string;
    initialBeat?: number;
    onModeChange: (mode: string) => void;
    onAsk: (prompt: string) => void;
  }) => (
    <div>
      Hub for {conceptId} in {mode}
      {initialBeat !== undefined && <span> at beat {initialBeat}</span>}
      <button onClick={() => onModeChange('graph')}>Switch to graph</button>
      <button onClick={() => onAsk('Why?')}>Ask why</button>
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

describe('StudentApp navigation', () => {
  it('offers the artboard destinations and moves between them', () => {
    renderAt();

    expect(screen.getByText('Guest session')).toBeInTheDocument();
    expect(screen.getByText('Home screen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Concepts' }));
    expect(screen.getByText('Concept list')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Review' })[0]);
    expect(screen.getByText('Review screen')).toBeInTheDocument();
  });

  it('opens a concept page straight from a link, in the mode the link names', () => {
    renderAt('/student?view=concepts&concept=Reactivity&mode=sources');

    expect(screen.getByText('Hub for Reactivity in sources')).toBeInTheDocument();
  });

  it('opens a concept from Home and keeps the mode in the URL as it changes', () => {
    renderAt();

    fireEvent.click(screen.getByRole('button', { name: 'Open Reactivity' }));
    expect(screen.getByText('Hub for Reactivity in learn')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to graph' }));
    expect(screen.getByText('Hub for Reactivity in graph')).toBeInTheDocument();
  });

  it('sends a question from a concept page to Ask, with a way back to the concept', () => {
    renderAt('/student?view=concepts&concept=Reactivity');

    fireEvent.click(screen.getByRole('button', { name: 'Ask why' }));
    expect(screen.getByText('Ask screen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to reactivity/i }));
    expect(screen.getByText('Hub for Reactivity in learn')).toBeInTheDocument();
  });

  it('resumes a lesson from Home at the beat the learner left it', () => {
    renderAt();

    fireEvent.click(screen.getByRole('button', { name: 'Resume Reactivity' }));
    expect(screen.getByText(/hub for reactivity in learn/i)).toBeInTheDocument();
    expect(screen.getByText(/at beat 2/i)).toBeInTheDocument();
  });

  it('sends a question from Home to Ask', () => {
    renderAt();

    fireEvent.click(screen.getByRole('button', { name: 'Ask from home' }));
    expect(screen.getByText('Ask screen')).toBeInTheDocument();
  });

  it('treats an unknown view in the URL as Home rather than a blank page', () => {
    renderAt('/student?view=nonsense');

    expect(screen.getByText('Home screen')).toBeInTheDocument();
  });
});
