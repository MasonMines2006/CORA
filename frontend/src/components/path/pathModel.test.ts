import { describe, expect, it } from 'vitest';
import { LearningConceptProgress, LearningDashboard } from '../../API/Index';
import { buildPath, conceptAbbreviation, greetingFor, unitTitle, weakestConcept } from './pathModel';

const progress = (id: string, source: string | null, attempts = 0, score = 0): LearningConceptProgress => ({
  concept: {
    id,
    name: id,
    chunk_count: 5,
    document_count: 1,
    connectivity: 1,
    sources: source ? [source] : [],
  },
  mastery: { concept_id: id, attempts, correct: 0, score, difficulty: 'easy' },
});

const dashboard = (concepts: LearningConceptProgress[], extra: Partial<LearningDashboard> = {}): LearningDashboard => ({
  total_concepts: concepts.length,
  started_concepts: 0,
  mastered_concepts: 0,
  average_mastery: 0,
  recommended: null,
  concepts,
  review: { due_count: 0, new_count: 0 },
  last_lesson: null,
  course: { documents: 2, passages: 10, concepts: concepts.length },
  ...extra,
});

describe('unitTitle', () => {
  it('turns a filename into a readable unit name', () => {
    expect(unitTitle('NE235_L07_Kinetics.pdf')).toBe('NE235 L07 Kinetics');
    expect(unitTitle('reactor-theory-manual.docx')).toBe('reactor theory manual');
    expect(unitTitle('Lab#0 - PULSTAR Systems.pdf')).toBe('Lab#0 - PULSTAR Systems');
  });
});

describe('buildPath', () => {
  it('groups concepts by their primary published source, in ranking order', () => {
    const path = buildPath(
      dashboard([progress('a', 'Kinetics.pdf'), progress('b', 'Lifecycle.pdf'), progress('c', 'Kinetics.pdf')])
    );
    expect(path.units.map((unit) => [unit.source, unit.concepts.map((item) => item.concept.id)])).toEqual([
      ['Kinetics.pdf', ['a', 'c']],
      ['Lifecycle.pdf', ['b']],
    ]);
  });

  it('puts concepts with no source in their own unit, last', () => {
    const path = buildPath(dashboard([progress('x', null), progress('a', 'Kinetics.pdf')]));
    expect(path.units.map((unit) => unit.title)).toEqual(['Kinetics', 'Other material']);
  });

  it('marks a unit complete only when every concept in it is mastered', () => {
    const path = buildPath(
      dashboard([progress('a', 'One.pdf', 5, 90), progress('b', 'One.pdf', 5, 85), progress('c', 'Two.pdf', 2, 50)])
    );
    expect(path.units[0]).toMatchObject({ status: 'complete', masteredCount: 2 });
    expect(path.units[1].status).toBe('current');
  });

  it('makes the last lesson the current concept, then the recommendation, then the first unmastered one', () => {
    const concepts = [progress('a', 'One.pdf', 5, 90), progress('b', 'One.pdf'), progress('c', 'Two.pdf')];
    const lastLesson = { concept_id: 'c', concept_name: 'c', beat_index: 1, beat_count: 4, updated_at: '' };
    expect(buildPath(dashboard(concepts, { last_lesson: lastLesson })).currentId).toBe('c');
    expect(buildPath(dashboard(concepts, { recommended: { ...concepts[1], reason: 'next' } })).currentId).toBe('b');
    expect(buildPath(dashboard(concepts)).currentId).toBe('b');
  });

  it('labels the unit after the current one as up next, and the rest as later', () => {
    const path = buildPath(
      dashboard([progress('a', 'One.pdf'), progress('b', 'Two.pdf'), progress('c', 'Three.pdf')])
    );
    expect(path.units.map((unit) => unit.status)).toEqual(['current', 'upcoming', 'later']);
  });

  it('gives each node its state, with the current concept marked', () => {
    const path = buildPath(dashboard([progress('a', 'One.pdf', 4, 92), progress('b', 'One.pdf', 2, 40), progress('c', 'One.pdf')]));
    expect(path.units[0].concepts.map((item) => item.nodeState)).toEqual(['mastered', 'current', 'notStarted']);
  });

  it('is empty when nothing is published', () => {
    expect(buildPath(dashboard([])).units).toEqual([]);
  });
});

describe('weakestConcept', () => {
  it('picks the started, unmastered concept with the lowest score', () => {
    const concepts = [progress('a', 'x', 4, 70), progress('b', 'x', 3, 33), progress('c', 'x'), progress('d', 'x', 5, 95)];
    expect(weakestConcept(concepts)?.concept.id).toBe('b');
  });

  it('returns nothing when no concept has been practised', () => {
    expect(weakestConcept([progress('a', 'x')])).toBeUndefined();
  });
});

describe('conceptAbbreviation', () => {
  it('uses short ids as they are and initials for long names', () => {
    expect(conceptAbbreviation('SUR')).toBe('SUR');
    expect(conceptAbbreviation('Subcritical multiplication')).toBe('SM');
    expect(conceptAbbreviation('Xenon-135 transients after a trip')).toBe('XTA');
  });
});

describe('greetingFor', () => {
  it('greets by time of day, with the first name when known', () => {
    expect(greetingFor(new Date('2026-10-19T08:00:00'), 'Jordan Reyes')).toBe('Morning, Jordan.');
    expect(greetingFor(new Date('2026-10-19T14:00:00'))).toBe('Good afternoon.');
    expect(greetingFor(new Date('2026-10-19T20:00:00'), 'Mason')).toBe('Evening, Mason.');
  });
});
