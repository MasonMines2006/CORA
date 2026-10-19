import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LearningConceptProgress, LearningDashboard } from '../../API/Index';
import ProgressView from './ProgressView';

const item = (id: string, name: string, attempts = 0, score = 0): LearningConceptProgress => ({
  concept: { id, name, chunk_count: 1, document_count: 1, connectivity: 1, sources: ['NE235_L07.pdf'] },
  mastery: { concept_id: id, attempts, correct: Math.round((attempts * score) / 100), score, difficulty: 'medium' },
});

const data = (concepts: LearningConceptProgress[]): LearningDashboard => ({
  total_concepts: concepts.length,
  started_concepts: 0,
  mastered_concepts: 0,
  average_mastery: 0,
  recommended: null,
  concepts,
  review: { due_count: 3, new_count: 0 },
  last_lesson: null,
  course: { documents: 1, passages: 5, concepts: 40 },
});

const account = {
  isAuthenticated: true,
  name: 'Jordan Reyes',
  email: 'jr@university.edu',
  onSignIn: vi.fn(),
  onSignOut: vi.fn(),
};

describe('ProgressView', () => {
  it('shows a skeleton while loading and Retry on failure', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <ProgressView dashboard={{ status: 'loading' }} onRetry={onRetry} account={account} onQuiz={vi.fn()} />
    );
    expect(screen.getByLabelText('Loading your progress')).toBeInTheDocument();
    rerender(<ProgressView dashboard={{ status: 'error' }} onRetry={onRetry} account={account} onQuiz={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows dashes, not zeros, before the first check', () => {
    render(
      <ProgressView
        dashboard={{ status: 'ready', data: data([item('a', 'Keff')]) }}
        onRetry={vi.fn()}
        account={account}
        onQuiz={vi.fn()}
      />
    );
    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getAllByText('–')).toHaveLength(2);
    expect(within(summary).getAllByText('Finish your first check to start')).toHaveLength(2);
  });

  it('says counts cover the most-connected concepts, and lists what needs work with a Quiz button', () => {
    const onQuiz = vi.fn();
    render(
      <ProgressView
        dashboard={{ status: 'ready', data: data([item('a', 'Keff', 4, 90), item('b', 'Reactor period', 5, 60)]) }}
        onRetry={vi.fn()}
        account={account}
        onQuiz={onQuiz}
      />
    );
    expect(screen.getAllByText('of the 2 most-connected concepts')).toHaveLength(2);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quiz me on Reactor period' }));
    expect(onQuiz).toHaveBeenCalledWith('b');
    expect(screen.getByRole('img', { name: '1 of 2 mastered, 1 in progress' })).toBeInTheDocument();
  });

  it('signs out from the account card', () => {
    render(
      <ProgressView
        dashboard={{ status: 'ready', data: data([]) }}
        onRetry={vi.fn()}
        account={account}
        onQuiz={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(account.onSignOut).toHaveBeenCalled();
  });
});
