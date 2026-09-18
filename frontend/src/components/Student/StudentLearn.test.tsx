import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLearningConcepts, getLearningDashboard, getLearningMastery } from '../../API/Index';
import StudentLearn from './StudentLearn';

/*
 * The concept list and its mastery bars come from ONE request.
 *
 * This used to call `/learning/concepts` (which caps at 18) and then fire one
 * `/learning/mastery/{id}` per concept -- 19 requests to draw one list, over
 * conference wifi, on a phone. `/learning/dashboard` already returns every
 * concept with its mastery joined, which is what Home renders, so Home offered
 * "Browse all 50 concepts" while this tab could only ever show 18 of them.
 */

const conceptProgress = (id: string, name: string, attempts: number, score: number) => ({
  concept: {
    id,
    name,
    chunk_count: 9,
    document_count: 2,
    connectivity: 30,
    sources: ['NE235.pdf'],
  },
  mastery: {
    concept_id: id,
    attempts,
    correct: Math.round((score / 100) * attempts),
    score,
    difficulty: 'medium' as const,
  },
});

// More concepts than the old /learning/concepts limit of 18, so a regression to
// that endpoint would visibly drop some.
const concepts = Array.from({ length: 22 }, (_, index) =>
  conceptProgress(`concept-${index}`, `Concept ${index}`, index === 0 ? 4 : 0, index === 0 ? 75 : 0)
);

const dashboard = {
  total_concepts: concepts.length,
  started_concepts: 1,
  mastered_concepts: 0,
  average_mastery: 3.4,
  recommended: { ...concepts[0], reason: 'Continue where you left off' },
  concepts,
};

vi.mock('../../API/Index', () => ({
  getLearningDashboard: vi.fn(),
  getLearningConcepts: vi.fn(),
  getLearningMastery: vi.fn(),
  getLearningLesson: vi.fn(),
  getLearningSources: vi.fn(),
  generateLearningQuiz: vi.fn(),
  gradeLearningQuiz: vi.fn(),
}));

describe('StudentLearn concept list', () => {
  beforeEach(() => {
    vi.mocked(getLearningDashboard).mockReset().mockResolvedValue(dashboard);
    vi.mocked(getLearningConcepts).mockReset().mockResolvedValue([]);
    vi.mocked(getLearningMastery).mockReset();
  });

  it('loads every concept from the dashboard in a single request', async () => {
    render(<StudentLearn />);

    // A concept can appear both in the left rail and in the starter cards.
    expect((await screen.findAllByText('Concept 0')).length).toBeGreaterThan(0);

    // The last concept proves nothing was truncated to the old 18-item cap.
    await waitFor(() => {
      expect(screen.getAllByText(`Concept ${concepts.length - 1}`).length).toBeGreaterThan(0);
    });

    expect(vi.mocked(getLearningDashboard)).toHaveBeenCalledTimes(1);
  });

  it('does not fetch mastery one concept at a time', async () => {
    render(<StudentLearn />);

    await screen.findAllByText('Concept 0');

    // Mastery arrives joined to the dashboard rows; a per-concept call here is
    // the N+1 this test exists to prevent.
    expect(vi.mocked(getLearningMastery)).not.toHaveBeenCalled();
    expect(vi.mocked(getLearningConcepts)).not.toHaveBeenCalled();
  });
});
