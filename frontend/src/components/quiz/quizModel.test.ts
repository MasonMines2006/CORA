import { describe, expect, it } from 'vitest';
import { LearningMastery, QuizGrade } from '../../API/Index';
import {
  difficultyNote,
  initialQuizState,
  keyToAction,
  masteryChange,
  quizReducer,
  QuizState,
  resultsHeadline,
  shouldCelebrate,
} from './quizModel';

const mastery = (attempts: number, correct: number, score: number): LearningMastery => ({
  concept_id: 'period',
  attempts,
  correct,
  score,
  difficulty: score < 40 ? 'easy' : score < 75 ? 'medium' : 'hard',
});

const grade: QuizGrade = {
  quiz_id: 'q1',
  correct: 1,
  total: 2,
  results: [],
  mastery: mastery(4, 3, 75),
};

describe('quizReducer', () => {
  it('needs a choice before moving on, then advances and keeps the answer', () => {
    let state = initialQuizState(2);
    state = quizReducer(state, { type: 'submit' });
    expect(state.index).toBe(0);

    state = quizReducer(state, { type: 'select', option: 2 });
    state = quizReducer(state, { type: 'submit' });
    expect(state).toMatchObject({ phase: 'answering', index: 1, answers: [2, null] });
  });

  it('asks for grading after the last answer, then walks through feedback to results', () => {
    let state = initialQuizState(2);
    state = quizReducer(state, { type: 'select', option: 0 });
    state = quizReducer(state, { type: 'submit' });
    state = quizReducer(state, { type: 'select', option: 1 });
    state = quizReducer(state, { type: 'submit' });
    expect(state.phase).toBe('grading');

    state = quizReducer(state, { type: 'graded', grade });
    expect(state).toMatchObject({ phase: 'feedback', index: 0, grade });
    state = quizReducer(state, { type: 'continue' });
    expect(state).toMatchObject({ phase: 'feedback', index: 1 });
    state = quizReducer(state, { type: 'continue' });
    expect(state.phase).toBe('results');
  });

  it('keeps every answer when grading fails, and can try grading again', () => {
    let state: QuizState = { ...initialQuizState(1), answers: [3], phase: 'grading' };
    state = quizReducer(state, { type: 'gradeFailed', reason: 'signedOut' });
    expect(state).toMatchObject({ phase: 'gradeError', gradeError: 'signedOut', answers: [3] });
    state = quizReducer(state, { type: 'retryGrade' });
    expect(state.phase).toBe('grading');
  });

  it('starts a fresh answer sheet for a new quiz', () => {
    const used = { ...initialQuizState(2), answers: [1, 2], phase: 'results' as const };
    expect(quizReducer(used, { type: 'reset', questionCount: 3 })).toEqual(initialQuizState(3));
  });

  it('ignores choices once the answers are locked in', () => {
    const state = { ...initialQuizState(1), answers: [1], phase: 'feedback' as const };
    expect(quizReducer(state, { type: 'select', option: 3 }).answers).toEqual([1]);
  });
});

describe('keyToAction', () => {
  const answering = initialQuizState(3);

  it('maps 1–4 to the options that exist', () => {
    expect(keyToAction('1', answering, 4)).toEqual({ type: 'select', option: 0 });
    expect(keyToAction('4', answering, 4)).toEqual({ type: 'select', option: 3 });
    expect(keyToAction('4', answering, 3)).toBeNull();
    expect(keyToAction('0', answering, 4)).toBeNull();
  });

  it('maps Enter to check while answering (only with a choice) and to continue on feedback', () => {
    expect(keyToAction('Enter', answering, 4)).toBeNull();
    expect(keyToAction('Enter', { ...answering, answers: [1, null, null] }, 4)).toEqual({ type: 'submit' });
    expect(keyToAction('Enter', { ...answering, phase: 'feedback' }, 4)).toEqual({ type: 'continue' });
  });

  it('does nothing while grading or on results', () => {
    expect(keyToAction('2', { ...answering, phase: 'grading' }, 4)).toBeNull();
    expect(keyToAction('Enter', { ...answering, phase: 'results' }, 4)).toBeNull();
  });
});

describe('mastery change and the celebration rule', () => {
  it('celebrates only when mastery actually rose', () => {
    expect(shouldCelebrate(mastery(6, 3, 50), mastery(8, 5, 62.5))).toBe(true);
    expect(shouldCelebrate(mastery(6, 3, 50), mastery(8, 4, 50))).toBe(false);
    expect(shouldCelebrate(mastery(6, 6, 100), mastery(8, 6, 75))).toBe(false);
  });

  it('celebrates a first quiz with any right answers, but not an all-wrong one', () => {
    expect(shouldCelebrate(mastery(0, 0, 0), mastery(3, 1, 33.3))).toBe(true);
    expect(shouldCelebrate(mastery(0, 0, 0), mastery(3, 0, 0))).toBe(false);
  });

  it('reports whole-number points and whether the concept is now mastered', () => {
    expect(masteryChange(mastery(6, 4, 66.7), mastery(9, 7, 77.8))).toEqual({
      before: 67,
      after: 78,
      delta: 11,
      isMastered: false,
    });
    expect(masteryChange(mastery(8, 6, 75), mastery(10, 8, 80)).isMastered).toBe(true);
  });

  it('writes a headline that says what really happened', () => {
    expect(resultsHeadline('Reactor period', { before: 60, after: 70, delta: 10, isMastered: false })).toBe(
      'Reactor period: up 10 points.'
    );
    expect(resultsHeadline('Reactor period', { before: 60, after: 60, delta: 0, isMastered: false })).toBe(
      'Reactor period: holding at 60%.'
    );
    expect(resultsHeadline('Reactor period', { before: 60, after: 55, delta: -5, isMastered: false })).toBe(
      'Reactor period: down 5 points.'
    );
  });
});

describe('difficultyNote', () => {
  it('explains where the difficulty came from', () => {
    expect(difficultyNote(mastery(5, 3, 60))).toBe('picked from your 60% mastery');
    expect(difficultyNote(mastery(0, 0, 0))).toBe('you’re just starting this concept');
  });
});
