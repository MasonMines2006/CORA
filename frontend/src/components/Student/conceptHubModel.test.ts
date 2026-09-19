import { describe, expect, it } from 'vitest';
import { LearningConcept, LearningMastery } from '../../API/Index';
import {
  HUB_MODES,
  formatInterval,
  isHubMode,
  masteryDetail,
  provenanceLine,
  radialLayout,
  scopedPrompt,
  suggestedQuestions,
} from './conceptHubModel';

const concept = (overrides: Partial<LearningConcept> = {}): LearningConcept => ({
  id: 'Reactivity',
  name: 'Reactivity',
  chunk_count: 16,
  document_count: 3,
  connectivity: 54,
  sources: [],
  ...overrides,
});

describe('provenanceLine', () => {
  it('states the graph as fact, the way the artboard header does', () => {
    expect(provenanceLine(concept(), 8)).toBe('Appears in 16 passages across 3 documents · linked to 8 other concepts');
  });

  it('uses singulars for one of anything', () => {
    expect(provenanceLine(concept({ chunk_count: 1, document_count: 1 }), 1)).toBe(
      'Appears in 1 passage in 1 document · linked to 1 other concept'
    );
  });

  it('leaves the link clause out while the neighbourhood is unknown', () => {
    expect(provenanceLine(concept(), null)).toBe('Appears in 16 passages across 3 documents');
  });
});

describe('masteryDetail', () => {
  const mastery = (attempts: number, correct: number): LearningMastery => ({
    concept_id: 'Reactivity',
    attempts,
    correct,
    score: attempts ? (correct / attempts) * 100 : 0,
    difficulty: 'medium',
  });

  it('shows the score behind the percentage and the difficulty the quiz will pick', () => {
    expect(masteryDetail(mastery(5, 3))).toBe('3 of 5 correct · medium');
  });

  it('says plainly when the student has not practised yet', () => {
    expect(masteryDetail(mastery(0, 0))).toBe('Not practised yet');
    expect(masteryDetail(null)).toBe('Not practised yet');
  });
});

describe('radialLayout', () => {
  it('spaces neighbours evenly on a circle, starting at twelve o’clock', () => {
    const points = radialLayout(4, { cx: 100, cy: 100, radius: 50 });
    expect(points).toHaveLength(4);
    expect(points[0].x).toBeCloseTo(100);
    expect(points[0].y).toBeCloseTo(50);
    expect(points[1].x).toBeCloseTo(150);
    expect(points[1].y).toBeCloseTo(100);
    expect(points[2].y).toBeCloseTo(150);
    expect(points[3].x).toBeCloseTo(50);
  });

  it('returns nothing for a concept with no neighbours', () => {
    expect(radialLayout(0, { cx: 0, cy: 0, radius: 10 })).toEqual([]);
  });
});

describe('hub modes', () => {
  it('offers the five artboard modes in order', () => {
    expect(HUB_MODES.map((mode) => mode.label)).toEqual(['Learn', 'Practice', 'Cards', 'Graph', 'Sources']);
  });

  it('recognises a mode from a URL and rejects anything else', () => {
    expect(isHubMode('graph')).toBe(true);
    expect(isHubMode('admin')).toBe(false);
    expect(isHubMode(null)).toBe(false);
  });
});

describe('formatInterval', () => {
  it('prints the scheduling intervals the way the review buttons show them', () => {
    expect(formatInterval(30)).toBe('< 1 min');
    expect(formatInterval(60)).toBe('< 1 min');
    expect(formatInterval(600)).toBe('10 min');
    expect(formatInterval(3 * 3600)).toBe('3 hours');
    expect(formatInterval(86400)).toBe('1 day');
    expect(formatInterval(5 * 86400)).toBe('5 days');
    expect(formatInterval(45 * 86400)).toBe('1.5 months');
  });
});

describe('scopedPrompt', () => {
  it('names the concept when the student’s question does not', () => {
    expect(scopedPrompt('Reactivity', ' why is it negative when subcritical? ')).toBe(
      'About Reactivity: why is it negative when subcritical?'
    );
  });

  it('leaves a question alone when it already names the concept', () => {
    expect(scopedPrompt('Reactivity', 'How is reactivity measured?')).toBe('How is reactivity measured?');
  });
});

describe('suggestedQuestions', () => {
  it('writes two starter questions about the concept', () => {
    const questions = suggestedQuestions('Reactivity');
    expect(questions).toHaveLength(2);
    for (const question of questions) {
      expect(question).toContain('Reactivity');
    }
  });
});
