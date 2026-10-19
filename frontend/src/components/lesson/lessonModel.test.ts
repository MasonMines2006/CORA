import { describe, expect, it } from 'vitest';
import { beatLabel, clampBeat, stepQuestions } from './lessonModel';

describe('clampBeat', () => {
  it('keeps a saved step inside a lesson that may have been rebuilt shorter', () => {
    expect(clampBeat(undefined, 4)).toBe(0);
    expect(clampBeat(2, 4)).toBe(2);
    expect(clampBeat(7, 4)).toBe(3);
    expect(clampBeat(-1, 4)).toBe(0);
  });
});

describe('beatLabel', () => {
  it('names the four beats in plain words', () => {
    expect(beatLabel('core_idea')).toBe('The core idea');
    expect(beatLabel('quick_check')).toBe('Quick check');
  });
});

describe('stepQuestions', () => {
  it('builds three follow-ups from the concept and the step, with no invented facts', () => {
    const questions = stepQuestions('Reactor period', 'How it works');
    expect(questions).toHaveLength(3);
    expect(questions.every((question) => question.includes('Reactor period'))).toBe(true);
  });
});
