import { describe, expect, it } from 'vitest';
import { LearningConceptProgress, LearningDashboard } from '../../API/Index';
import { summarise, unitMastery } from './progressModel';

const item = (id: string, source: string, attempts = 0, score = 0): LearningConceptProgress => ({
  concept: { id, name: id, chunk_count: 1, document_count: 1, connectivity: 1, sources: [source] },
  mastery: { concept_id: id, attempts, correct: 0, score, difficulty: 'easy' },
});

const dashboard = (concepts: LearningConceptProgress[], courseConcepts = concepts.length): LearningDashboard => ({
  total_concepts: concepts.length,
  started_concepts: concepts.filter((c) => c.mastery.attempts > 0).length,
  mastered_concepts: concepts.filter((c) => c.mastery.score >= 80).length,
  average_mastery: 0,
  recommended: null,
  concepts,
  review: { due_count: 4, new_count: 1 },
  last_lesson: null,
  course: { documents: 2, passages: 10, concepts: courseConcepts },
});

describe('summarise', () => {
  it('counts from the dashboard and says when it only covers a sample', () => {
    const summary = summarise(dashboard([item('a', 'x', 5, 90), item('b', 'x', 2, 40), item('c', 'x')], 120));
    expect(summary).toMatchObject({
      mastered: 1,
      started: 2,
      due: 4,
      sampleSize: 3,
      courseConcepts: 120,
      isSample: true,
    });
  });

  it('knows a brand-new learner has not started', () => {
    expect(summarise(dashboard([item('a', 'x')])).hasStarted).toBe(false);
  });

  it('lists what needs work: started, unmastered, weakest first, at most five', () => {
    const concepts = [
      item('a', 'x', 3, 70),
      item('b', 'x', 3, 20),
      item('c', 'x', 3, 95),
      item('d', 'x', 3, 50),
      item('e', 'x', 3, 10),
      item('f', 'x', 3, 60),
      item('g', 'x', 3, 30),
    ];
    expect(summarise(dashboard(concepts)).needsWork.map((entry) => entry.concept.id)).toEqual([
      'e',
      'b',
      'g',
      'd',
      'f',
    ]);
  });
});

describe('unitMastery', () => {
  it('gives each unit its mastered and in-progress shares', () => {
    const rows = unitMastery(
      dashboard([item('a', 'One.pdf', 5, 90), item('b', 'One.pdf', 2, 40), item('c', 'One.pdf'), item('d', 'Two.pdf')])
    );
    expect(rows).toEqual([
      { title: 'One', total: 3, mastered: 1, inProgress: 1 },
      { title: 'Two', total: 1, mastered: 0, inProgress: 0 },
    ]);
  });
});
