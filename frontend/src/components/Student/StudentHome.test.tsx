import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLearningDashboard } from '../../API/Index';
import StudentHome from './StudentHomeArtboard';

const dashboard = {
  total_concepts: 3,
  started_concepts: 2,
  mastered_concepts: 1,
  average_mastery: 43.3,
  recommended: {
    reason: 'Continue learning',
    concept: {
      id: 'criticality',
      name: 'Criticality',
      chunk_count: 12,
      document_count: 3,
      connectivity: 42,
      sources: ['NE235.pdf'],
    },
    mastery: {
      concept_id: 'criticality',
      attempts: 4,
      correct: 2,
      score: 50,
      difficulty: 'medium' as const,
    },
  },
  concepts: [
    {
      concept: {
        id: 'criticality',
        name: 'Criticality',
        chunk_count: 12,
        document_count: 3,
        connectivity: 42,
        sources: ['NE235.pdf'],
      },
      mastery: {
        concept_id: 'criticality',
        attempts: 4,
        correct: 2,
        score: 50,
        difficulty: 'medium' as const,
      },
    },
    {
      concept: {
        id: 'keff',
        name: 'Keff',
        chunk_count: 8,
        document_count: 2,
        connectivity: 18,
        sources: ['NE235.pdf', 'Lab 2.pdf'],
      },
      mastery: {
        concept_id: 'keff',
        attempts: 5,
        correct: 5,
        score: 100,
        difficulty: 'easy' as const,
      },
    },
  ],
};

vi.mock('../../API/Index', () => ({
  getLearningDashboard: vi.fn(),
}));

describe('StudentHome', () => {
  beforeEach(() => {
    vi.mocked(getLearningDashboard).mockReset().mockResolvedValue(dashboard);
  });

  it('renders the artboard home experience and opens the recommended concept', async () => {
    const onOpenConcept = vi.fn();
    const onOpenExplore = vi.fn();
    const onOpenReview = vi.fn();
    render(<StudentHome onOpenConcept={onOpenConcept} onOpenExplore={onOpenExplore} onOpenReview={onOpenReview} />);

    expect(await screen.findByText(/pick up where you left off/i)).toBeInTheDocument();
    expect(screen.getByText('Course graph')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('Criticality').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Keff').length).toBeGreaterThan(0);
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /resume criticality/i }));
    expect(onOpenConcept).toHaveBeenCalledWith('criticality');

    fireEvent.click(screen.getByRole('button', { name: /open the graph/i }));
    expect(onOpenExplore).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /start review/i }));
    expect(onOpenReview).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when dashboard loading fails', async () => {
    vi.mocked(getLearningDashboard).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(dashboard);

    render(<StudentHome onOpenConcept={vi.fn()} onOpenExplore={vi.fn()} onOpenReview={vi.fn()} />);
    expect(await screen.findByText(/could not load your progress/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getAllByText('Criticality').length).toBeGreaterThan(0));
  });
});
