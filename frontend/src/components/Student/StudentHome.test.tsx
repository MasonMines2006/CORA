import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import StudentHome from './StudentHome';

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
  concepts: [],
};

vi.mock('../../API/Index', () => ({
  getLearningDashboard: vi.fn().mockResolvedValue(dashboard),
}));

describe('StudentHome', () => {
  it('shows real progress and opens the recommended concept', async () => {
    const onOpenConcept = vi.fn();
    render(<StudentHome onOpenConcept={onOpenConcept} onOpenExplore={vi.fn()} />);

    expect(await screen.findByText('Criticality')).toBeInTheDocument();
    expect(screen.getByText('43%')).toBeInTheDocument();
    expect(screen.getByText('1 mastered')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue criticality/i }));
    expect(onOpenConcept).toHaveBeenCalledWith('criticality');
  });

  it('offers a retry when dashboard loading fails', async () => {
    const { getLearningDashboard } = await import('../../API/Index');
    vi.mocked(getLearningDashboard).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(dashboard);

    render(<StudentHome onOpenConcept={vi.fn()} onOpenExplore={vi.fn()} />);
    expect(await screen.findByText(/could not load your progress/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByText('Criticality')).toBeInTheDocument());
  });
});
