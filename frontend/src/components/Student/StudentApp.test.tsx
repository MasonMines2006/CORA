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

vi.mock('../UI/ErrroBoundary', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

vi.mock('../path/useDashboard', () => ({
  useDashboard: () => ({ dashboard: { status: 'loading' }, reload: vi.fn() }),
}));
vi.mock('../path/PathView', () => ({
  default: ({
    onGuide,
    onAsk,
  }: {
    onGuide: (id: string) => void;
    onAsk: (prompt: string, conceptId?: string) => void;
  }) => (
    <div>
      Home screen <button onClick={() => onGuide('Reactivity')}>Open Reactivity</button>
      <button onClick={() => onAsk('What is reactivity?')}>Ask from home</button>
    </div>
  ),
}));
vi.mock('../lesson/LessonPlayer', () => ({
  default: ({ conceptId, initialBeat, onClose }: { conceptId: string; initialBeat?: number; onClose: () => void }) => (
    <div>
      Lesson for {conceptId}
      {initialBeat !== undefined && <span> at step {initialBeat}</span>}
      <button onClick={onClose}>Close lesson</button>
    </div>
  ),
}));
vi.mock('../quiz/QuizPlayer', () => ({
  default: ({ conceptId }: { conceptId: string }) => <div>Quiz for {conceptId}</div>,
}));
vi.mock('./StudentExplore', () => ({ default: () => <div>Graph screen</div> }));
vi.mock('../ask/AskView', () => ({
  default: ({ initialPrompt, scopeConcept }: { initialPrompt?: string; scopeConcept?: { id: string } }) => (
    <div>
      Ask screen {initialPrompt && <span>asking: {initialPrompt}</span>}
      {scopeConcept && <span>about {scopeConcept.id}</span>}
    </div>
  ),
}));
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
    expect(screen.getByText('Quiz for Reactivity')).toBeInTheDocument();
  });

  it('opens a lesson in focus mode from the Path, and its X goes back there', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Open Reactivity' }));
    expect(screen.getByText('Lesson for Reactivity')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close lesson' }));
    expect(screen.getByText('Home screen')).toBeInTheDocument();
  });

  it('opens a lesson at the step in the link', () => {
    renderAt('/student?view=lesson&concept=Keff&beat=2');
    expect(screen.getByText('at step 2', { exact: false })).toBeInTheDocument();
  });

  it('explains instead of going blank when results are opened after a refresh', () => {
    renderAt('/student?view=results&concept=Keff');
    expect(screen.getByRole('heading', { name: 'These results are no longer on screen' })).toBeInTheDocument();
  });

  it('sends a question from the Path to Ask', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Ask from home' }));
    expect(screen.getByText('asking: What is reactivity?')).toBeInTheDocument();
  });

  it('opens Ask about a concept from a link', () => {
    renderAt('/student?view=ask&concept=Keff');
    expect(screen.getByText('about Keff')).toBeInTheDocument();
  });

  it('reopens a lesson from the sessions list', () => {
    window.localStorage.setItem(
      'cora.sessions.v1.guest',
      JSON.stringify([{ id: 'guide-Keff', mode: 'guide', title: 'Keff', conceptId: 'Keff', updatedAt: Date.now() }])
    );
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: /guide keff/i })[0]);
    expect(screen.getByText('Lesson for Keff')).toBeInTheDocument();
    window.localStorage.clear();
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
