import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLearningDashboard, getLearningLesson, getLearningSources } from '../../API/Index';
import StudentReview from './StudentReview';

/*
 * Review is opened two ways, and both must name the concept correctly.
 *
 * It used to skip the dashboard fetch entirely whenever a conceptId was passed,
 * which left the name unresolved -- so opening Review on a concept you had just
 * been studying titled the screen "Course review".
 */

const concept = (id: string, name: string) => ({
  concept: { id, name, chunk_count: 6, document_count: 2, connectivity: 12, sources: ['NE235.pdf'] },
  mastery: { concept_id: id, attempts: 2, correct: 1, score: 50, difficulty: 'medium' as const },
});

const dashboard = {
  total_concepts: 2,
  started_concepts: 1,
  mastered_concepts: 0,
  average_mastery: 25,
  recommended: { ...concept('reactivity', 'Reactivity'), reason: 'Continue where you left off' },
  concepts: [concept('reactivity', 'Reactivity'), concept('control-rods', 'Control Rods')],
};

vi.mock('../../API/Index', () => ({
  getLearningDashboard: vi.fn(),
  getLearningLesson: vi.fn(),
  getLearningSources: vi.fn(),
}));

describe('StudentReview', () => {
  beforeEach(() => {
    vi.mocked(getLearningDashboard).mockReset().mockResolvedValue(dashboard);
    vi.mocked(getLearningLesson)
      .mockReset()
      .mockResolvedValue({
        concept: concept('control-rods', 'Control Rods').concept,
        beats: [{ key: 'core_idea', title: 'What it is', content: 'Control rods absorb neutrons.' }],
        quick_check: { question: 'What do control rods absorb?', options: ['Neutrons'], answer_index: 0 },
        sources: ['NE235.pdf'],
        cached: false,
      } as never);
    vi.mocked(getLearningSources)
      .mockReset()
      .mockResolvedValue({
        concept: concept('control-rods', 'Control Rods').concept,
        passages: [{ id: 'p1', source: 'NE235.pdf', text: 'Control rods absorb neutrons.' }],
      } as never);
  });

  it('names the concept it was opened on', async () => {
    render(<StudentReview conceptId='control-rods' />);

    expect(await screen.findByText(/control rods review/i)).toBeInTheDocument();
    expect(screen.queryByText(/course review/i)).not.toBeInTheDocument();
  });

  it('falls back to the recommended concept when opened with no concept', async () => {
    render(<StudentReview />);

    expect(await screen.findByText(/reactivity review/i)).toBeInTheDocument();
  });
});
