import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LearningConceptProgress, LearningDashboard } from '../../API/Index';
import PathView from './PathView';

const progress = (id: string, name: string, source: string, attempts = 0, score = 0): LearningConceptProgress => ({
  concept: { id, name, chunk_count: 9, document_count: 2, connectivity: 3, sources: [source] },
  mastery: { concept_id: id, attempts, correct: Math.round((attempts * score) / 100), score, difficulty: 'medium' },
});

const data: LearningDashboard = {
  total_concepts: 4,
  started_concepts: 2,
  mastered_concepts: 1,
  average_mastery: 40,
  recommended: null,
  concepts: [
    progress('beta', 'Delayed neutron fraction', 'NE235_L07_Kinetics.pdf', 5, 92),
    progress('period', 'Reactor period', 'NE235_L07_Kinetics.pdf', 5, 60),
    progress('sur', 'SUR', 'NE235_L07_Kinetics.pdf'),
    progress('xenon', 'Xenon-135 transients', 'NE235_L09_Poisons.pdf'),
  ],
  review: { due_count: 7, new_count: 0 },
  last_lesson: { concept_id: 'period', concept_name: 'Reactor period', beat_index: 2, beat_count: 4, updated_at: '' },
  course: { documents: 2, passages: 40, concepts: 4 },
};

const renderPath = (dashboard: React.ComponentProps<typeof PathView>['dashboard'] = { status: 'ready', data }) => {
  const props = {
    dashboard,
    onRetry: vi.fn(),
    userName: 'Jordan Reyes',
    onReview: vi.fn(),
    onGraph: vi.fn(),
    onGuide: vi.fn(),
    onAsk: vi.fn(),
    onQuiz: vi.fn(),
  };
  render(<PathView {...props} />);
  return props;
};

describe('PathView', () => {
  it('shows a skeleton in the shape of the path while loading', () => {
    renderPath({ status: 'loading' });
    expect(screen.getByLabelText('Loading your path')).toHaveAttribute('aria-busy', 'true');
  });

  it('offers Retry instead of fake concepts when the dashboard fails', () => {
    const props = renderPath({ status: 'error' });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your path");
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(props.onRetry).toHaveBeenCalled();
  });

  it('says the path is being built when nothing is published', () => {
    renderPath({ status: 'ready', data: { ...data, concepts: [], course: { documents: 0, passages: 0, concepts: 0 } } });
    expect(screen.getByRole('heading', { name: 'Your path is being built' })).toBeInTheDocument();
  });

  it('resumes the last lesson at the step the learner left it', () => {
    const props = renderPath();
    const card = screen.getByRole('region', { name: 'Reactor period' });
    expect(within(card).getByText('Pick up where you left off')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Continue lesson' }));
    expect(props.onGuide).toHaveBeenCalledWith('period', 2);
    fireEvent.click(within(card).getByRole('button', { name: 'Quiz me on it' }));
    expect(props.onQuiz).toHaveBeenCalledWith('period');
  });

  it('groups concepts into units named after their source document', () => {
    renderPath();
    expect(screen.getByRole('region', { name: 'Unit 1: NE235 L07 Kinetics' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Unit 2: NE235 L09 Poisons' })).toBeInTheDocument();
    expect(screen.getByText('Up next', { exact: false })).toBeInTheDocument();
  });

  it('opens one concept, three ways in, from a path node', () => {
    const props = renderPath();
    const node = screen.getByRole('button', { name: 'Reactor period, suggested next, in progress, 60 percent' });
    fireEvent.click(node);
    const popover = screen.getByRole('group', { name: /reactor period: choose how to learn it/i });

    fireEvent.click(within(popover).getByRole('button', { name: 'Quiz me' }));
    expect(props.onQuiz).toHaveBeenCalledWith('period');
    fireEvent.click(within(popover).getByRole('button', { name: 'Ask' }));
    expect(props.onAsk).toHaveBeenCalledWith(expect.stringContaining('Reactor period'), 'period');
    fireEvent.click(within(popover).getByRole('button', { name: 'Guide me' }));
    expect(props.onGuide).toHaveBeenCalledWith('period');
  });

  it('closes the popover with Escape and returns focus to its node', () => {
    renderPath();
    const node = screen.getByRole('button', { name: /^SUR, not started/ });
    node.focus();
    fireEvent.click(node);
    expect(node).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(node).toHaveFocus();
  });

  it('shows cards due and the weak spot in the Today rail, with no streak or goal', () => {
    const props = renderPath();
    const rail = screen.getByRole('complementary', { name: 'Today' });
    expect(within(rail).getByText('cards due', { exact: false })).toBeInTheDocument();
    expect(within(rail).getByText('Reactor period')).toBeInTheDocument();
    expect(within(rail).queryByText(/streak|daily goal/i)).not.toBeInTheDocument();
    fireEvent.click(within(rail).getByRole('button', { name: 'Review now' }));
    expect(props.onReview).toHaveBeenCalled();
  });
});
