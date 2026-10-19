import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLearningDashboard, LearningDashboard } from '../../API/Index';
import ConceptIndex from './ConceptIndex';

vi.mock('../../API/Index', () => ({
  getLearningDashboard: vi.fn(),
}));

const item = (id: string) => ({
  concept: { id, name: id, chunk_count: 3, document_count: 1, connectivity: 5, sources: ['Doc.pdf'] },
  mastery: { concept_id: id, attempts: 0, correct: 0, score: 0, difficulty: 'easy' as const },
});

const dashboardWith = (listed: number, total: number): LearningDashboard => ({
  total_concepts: total,
  started_concepts: 0,
  mastered_concepts: 0,
  average_mastery: 0,
  recommended: null,
  concepts: Array.from({ length: listed }, (_, index) => item(`Concept ${index}`)),
  review: { due_count: 0, new_count: 0 },
  last_lesson: null,
  course: { documents: 17, passages: 282, concepts: total },
});

describe('ConceptIndex', () => {
  beforeEach(() => {
    vi.mocked(getLearningDashboard).mockReset();
  });

  it('says it shows the most-connected few when the course has more', async () => {
    // The index lists the dashboard's top 50. Calling that "50 concepts" for a
    // 1,231-concept course told students the course was 25 times smaller.
    vi.mocked(getLearningDashboard).mockResolvedValue(dashboardWith(50, 1231));

    render(<ConceptIndex onOpenConcept={vi.fn()} />);

    expect(await screen.findByText(/showing the 50 most-connected of 1,231 concepts/i)).toBeInTheDocument();
  });

  it('keeps the plain count when every concept is listed', async () => {
    vi.mocked(getLearningDashboard).mockResolvedValue(dashboardWith(3, 3));

    render(<ConceptIndex onOpenConcept={vi.fn()} />);

    expect(await screen.findByText(/^3 concepts from your course materials/i)).toBeInTheDocument();
  });
});
