import { fireEvent, render, screen } from '@testing-library/react';
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
  default: ({ onOpenReview }: { onOpenReview: () => void }) => (
    <div>
      Home screen <button onClick={onOpenReview}>Review from home</button>
    </div>
  ),
}));
vi.mock('./StudentLearn', () => ({ default: () => <div>Concept screen</div> }));
vi.mock('./StudentExplore', () => ({ default: () => <div>Graph screen</div> }));
vi.mock('./StudentChat', () => ({ default: () => <div>Ask screen</div> }));
vi.mock('./StudentReview', () => ({ default: () => <div>Review screen</div> }));

describe('StudentApp navigation', () => {
  it('matches the artboard destinations and opens review as its own experience', () => {
    render(<StudentApp />);

    expect(screen.getByText('Guest session')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Home' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Concepts' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Graph' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Review' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Ask' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Concepts' }));
    expect(screen.getByText('Concept screen')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Home' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Review from home' }));
    expect(screen.getByText('Review screen')).toBeInTheDocument();
  });
});
