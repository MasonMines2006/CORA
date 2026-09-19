import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConceptSuggestion, getConceptSuggestions, getLearningDashboard, LearningDashboard } from '../../API/Index';
import StudentHome from './StudentHomeArtboard';

const concept = (id: string, name: string) => ({
  id,
  name,
  chunk_count: 12,
  document_count: 3,
  connectivity: 42,
  sources: ['NE235.pdf'],
});

const dashboard: LearningDashboard = {
  total_concepts: 3,
  started_concepts: 2,
  mastered_concepts: 1,
  average_mastery: 43.3,
  recommended: {
    reason: 'Continue learning',
    concept: concept('criticality', 'Criticality'),
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
      concept: concept('criticality', 'Criticality'),
      mastery: {
        concept_id: 'criticality',
        attempts: 4,
        correct: 2,
        score: 50,
        difficulty: 'medium' as const,
      },
    },
    {
      concept: { ...concept('keff', 'Keff'), chunk_count: 8, document_count: 2, connectivity: 18 },
      mastery: {
        concept_id: 'keff',
        attempts: 5,
        correct: 5,
        score: 100,
        difficulty: 'easy' as const,
      },
    },
  ],
  review: { due_count: 0, new_count: 0 },
  last_lesson: null,
};

const suggestion = (id: string, name: string, reason: string): ConceptSuggestion => ({
  concept: concept(id, name),
  because_of: { id: 'criticality', name: 'Criticality' },
  relationship: 'RELATED_TO',
  shared_passages: 4,
  reason,
});

vi.mock('../../API/Index', () => ({
  getLearningDashboard: vi.fn(),
  getConceptSuggestions: vi.fn(),
}));

const renderHome = (props: Partial<React.ComponentProps<typeof StudentHome>> = {}) =>
  render(
    <StudentHome onOpenConcept={vi.fn()} onOpenExplore={vi.fn()} onOpenReview={vi.fn()} onAsk={vi.fn()} {...props} />
  );

describe('StudentHome', () => {
  beforeEach(() => {
    vi.mocked(getLearningDashboard).mockReset().mockResolvedValue(dashboard);
    vi.mocked(getConceptSuggestions).mockReset().mockResolvedValue([]);
  });

  it('renders the artboard home experience and opens the recommended concept', async () => {
    const onOpenConcept = vi.fn();
    const onOpenExplore = vi.fn();
    const onOpenReview = vi.fn();
    renderHome({ onOpenConcept, onOpenExplore, onOpenReview });

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

    renderHome();
    expect(await screen.findByText(/could not load your progress/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getAllByText('Criticality').length).toBeGreaterThan(0));
  });

  it('colours a mastered concept emerald, not the graph teal', async () => {
    renderHome();

    // docs/STUDENT_UI.md section 4: teal belongs to graph structure, emerald to
    // learning state. Home drew mastered concepts teal until learningState.ts.
    expect(await screen.findByText('100%')).toHaveStyle({ color: '#059669' });
  });

  describe('pick up where you left off', () => {
    const lastLesson = {
      concept_id: 'reactivity',
      concept_name: 'Reactivity',
      beat_index: 2,
      beat_count: 4,
      updated_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    };

    it('resumes the lesson the learner last opened, at the beat they left', async () => {
      const onOpenConcept = vi.fn();
      vi.mocked(getLearningDashboard).mockResolvedValue({ ...dashboard, last_lesson: lastLesson });
      renderHome({ onOpenConcept });

      expect(await screen.findByRole('heading', { name: 'Reactivity' })).toBeInTheDocument();
      expect(screen.getByText(/beat 3 of 4/i)).toBeInTheDocument();
      expect(screen.getByText(/12 min ago/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /resume reactivity/i }));
      expect(onOpenConcept).toHaveBeenCalledWith('reactivity', 2);
    });

    it('offers the recommended concept when no lesson has been opened yet', async () => {
      renderHome();

      expect(await screen.findByRole('heading', { name: 'Criticality' })).toBeInTheDocument();
      expect(screen.queryByText(/beat \d of \d/i)).not.toBeInTheDocument();
    });
  });

  describe('cards due', () => {
    it('shows the real number of cards waiting', async () => {
      vi.mocked(getLearningDashboard).mockResolvedValue({
        ...dashboard,
        review: { due_count: 7, new_count: 2 },
      });
      renderHome();

      expect(await screen.findByText(/7 cards due for review/i)).toBeInTheDocument();
    });

    it('counts unseen cards separately from ones that came back around', async () => {
      vi.mocked(getLearningDashboard).mockResolvedValue({
        ...dashboard,
        review: { due_count: 0, new_count: 5 },
      });
      renderHome();

      expect(await screen.findByText(/5 new cards ready/i)).toBeInTheDocument();
    });

    it('says nothing is due rather than inventing a count', async () => {
      renderHome();

      expect(await screen.findByText(/nothing due right now/i)).toBeInTheDocument();
      expect(screen.queryByText(/cards due for review/i)).not.toBeInTheDocument();
    });
  });

  describe('suggested next', () => {
    it('lists graph-connected concepts with the reason they were suggested', async () => {
      const onOpenConcept = vi.fn();
      vi.mocked(getConceptSuggestions).mockResolvedValue([
        suggestion('reactor-period', 'Reactor Period', 'prerequisite for 1-over-M'),
        suggestion('xenon', 'Xenon', 'appears with Reactivity in 4 passages'),
      ]);
      renderHome({ onOpenConcept });

      expect(await screen.findByText('Reactor Period')).toBeInTheDocument();
      expect(screen.getByText('prerequisite for 1-over-M')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /reactor period/i }));
      expect(onOpenConcept).toHaveBeenCalledWith('reactor-period');
    });

    it('stays quiet when the graph has nothing to suggest', async () => {
      renderHome();

      await screen.findByText('Course graph');
      expect(screen.queryByText(/suggested next/i)).not.toBeInTheDocument();
    });

    it('hides itself rather than breaking Home when suggestions fail', async () => {
      vi.mocked(getConceptSuggestions).mockRejectedValue(new Error('offline'));
      renderHome();

      expect(await screen.findByText('Course graph')).toBeInTheDocument();
      expect(screen.queryByText(/suggested next/i)).not.toBeInTheDocument();
    });
  });

  it('asks CORA a question from the home sidebar', async () => {
    const onAsk = vi.fn();
    renderHome({ onAsk });

    const box = await screen.findByLabelText(/ask a question/i);
    fireEvent.change(box, { target: { value: 'What is reactivity?' } });
    fireEvent.submit(box);

    expect(onAsk).toHaveBeenCalledWith('What is reactivity?');
  });

  it('will not send an empty question', async () => {
    const onAsk = vi.fn();
    renderHome({ onAsk });

    const box = await screen.findByLabelText(/ask a question/i);
    fireEvent.change(box, { target: { value: '   ' } });
    fireEvent.submit(box);

    expect(onAsk).not.toHaveBeenCalled();
  });
});
