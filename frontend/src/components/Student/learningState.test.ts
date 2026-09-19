import { describe, expect, it } from 'vitest';
import { LearningMastery } from '../../API/Index';
import { MASTERED_AT, STATE_STYLE, masteryPercent, masteryState } from './learningState';

const mastery = (attempts: number, score: number): LearningMastery => ({
  concept_id: 'reactivity',
  attempts,
  correct: Math.round((score / 100) * attempts),
  score,
  difficulty: 'medium',
});

describe('masteryState', () => {
  it('treats a concept with no attempts as not started, whatever its score', () => {
    expect(masteryState(null)).toBe('notStarted');
    expect(masteryState(undefined)).toBe('notStarted');
    expect(masteryState(mastery(0, 0))).toBe('notStarted');
  });

  it('calls a concept mastered at the threshold, and in progress just below it', () => {
    expect(masteryState(mastery(5, MASTERED_AT))).toBe('mastered');
    expect(masteryState(mastery(5, MASTERED_AT - 1))).toBe('inProgress');
  });

  it('counts an attempted concept with a score of zero as in progress, not unstarted', () => {
    // The student has tried and got everything wrong: that is progress to show, not an empty state.
    expect(masteryState(mastery(3, 0))).toBe('inProgress');
  });
});

describe('masteryPercent', () => {
  it('rounds and clamps to 0-100 so a bad score can never draw outside its bar', () => {
    expect(masteryPercent(mastery(3, 66.6))).toBe(67);
    expect(masteryPercent(mastery(3, 140))).toBe(100);
    expect(masteryPercent(mastery(3, -5))).toBe(0);
    expect(masteryPercent(null)).toBe(0);
  });
});

describe('STATE_STYLE', () => {
  it('follows docs/STUDENT_UI.md section 4: emerald, amber, slate', () => {
    expect(STATE_STYLE.mastered.color).toBe('#059669');
    expect(STATE_STYLE.inProgress.color).toBe('#b45309');
    expect(STATE_STYLE.notStarted.color).toBe('#94a3b8');
  });

  it('never uses teal for a learning state, because teal means graph structure', () => {
    const teal = '#0f766e';
    for (const style of Object.values(STATE_STYLE)) {
      expect(style.color).not.toBe(teal);
    }
  });

  it('gives every state a label a student can read', () => {
    expect(STATE_STYLE.mastered.label).toBe('Mastered');
    expect(STATE_STYLE.inProgress.label).toBe('In progress');
    expect(STATE_STYLE.notStarted.label).toBe('Not started');
  });
});
