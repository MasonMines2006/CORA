import { LearningMastery, QuizGrade } from '../../API/Index';
import { MASTERED_AT } from '../Student/learningState';

/*
 * The quiz as a small state machine (DESIGN.md 5.6).
 *
 * The backend grades a quiz once, with every answer at the same time
 * (POST /learning/quiz/grade), and never sends the answer key before that.
 * So the player works like this:
 *   answering  - pick an option, "Next" locks it in; the last one sends them all
 *   grading    - waiting for the server
 *   feedback   - step through each question's result (the feedback sheet)
 *   results    - the mastery change
 * `gradeError` keeps every answer so nothing is lost if grading fails.
 */

export type QuizPhase = 'answering' | 'grading' | 'gradeError' | 'feedback' | 'results';
export type GradeFailure = 'signedOut' | 'error';

export interface QuizState {
  phase: QuizPhase;
  /** The question on screen (answering) or being reviewed (feedback). */
  index: number;
  /** The chosen option for each question, or null when not chosen yet. */
  answers: (number | null)[];
  grade?: QuizGrade;
  gradeError?: GradeFailure;
}

export type QuizAction =
  | { type: 'select'; option: number }
  | { type: 'submit' }
  | { type: 'graded'; grade: QuizGrade }
  | { type: 'gradeFailed'; reason: GradeFailure }
  | { type: 'retryGrade' }
  | { type: 'continue' }
  | { type: 'reset'; questionCount: number };

export const initialQuizState = (questionCount: number): QuizState => ({
  phase: 'answering',
  index: 0,
  answers: Array.from({ length: questionCount }, () => null),
});

const isLast = (state: QuizState) => state.index >= state.answers.length - 1;

export const quizReducer = (state: QuizState, action: QuizAction): QuizState => {
  switch (action.type) {
    case 'select':
      if (state.phase !== 'answering') {
        return state;
      }
      return { ...state, answers: state.answers.map((answer, i) => (i === state.index ? action.option : answer)) };
    case 'submit':
      if (state.phase !== 'answering' || state.answers[state.index] === null) {
        return state;
      }
      return isLast(state) ? { ...state, phase: 'grading' } : { ...state, index: state.index + 1 };
    case 'graded':
      return { ...state, phase: 'feedback', index: 0, grade: action.grade, gradeError: undefined };
    case 'gradeFailed':
      return { ...state, phase: 'gradeError', gradeError: action.reason };
    case 'retryGrade':
      return state.phase === 'gradeError' ? { ...state, phase: 'grading', gradeError: undefined } : state;
    case 'continue':
      if (state.phase !== 'feedback') {
        return state;
      }
      return isLast(state) ? { ...state, phase: 'results' } : { ...state, index: state.index + 1 };
    case 'reset':
      return initialQuizState(action.questionCount);
    default:
      return state;
  }
};

/** Keyboard: 1–4 choose an option, Enter checks or continues. Returns null for keys we ignore. */
export const keyToAction = (key: string, state: QuizState, optionCount: number): QuizAction | null => {
  if (state.phase === 'answering') {
    const option = Number(key) - 1;
    if (/^[1-9]$/.test(key) && option < optionCount) {
      return { type: 'select', option };
    }
    return key === 'Enter' && state.answers[state.index] !== null ? { type: 'submit' } : null;
  }
  if (state.phase === 'feedback' && key === 'Enter') {
    return { type: 'continue' };
  }
  return null;
};

export interface MasteryChange {
  /** Whole-number percentages, as shown on screen. */
  before: number;
  after: number;
  delta: number;
  isMastered: boolean;
}

export const masteryChange = (before: LearningMastery, after: LearningMastery): MasteryChange => {
  const from = Math.round(before.score);
  const to = Math.round(after.score);
  return { before: from, after: to, delta: to - from, isMastered: after.score >= MASTERED_AT };
};

/** The celebration rule: a burst only when mastery really rose. Never for flat or falling. */
export const shouldCelebrate = (before: LearningMastery, after: LearningMastery): boolean => after.score > before.score;

export const resultsHeadline = (conceptName: string, change: MasteryChange): string => {
  if (change.delta > 0) {
    return `${conceptName}: up ${change.delta} points.`;
  }
  if (change.delta < 0) {
    return `${conceptName}: down ${-change.delta} points.`;
  }
  return `${conceptName}: holding at ${change.after}%.`;
};

/** "Medium · picked from your 60% mastery": the difficulty chip explains itself. */
export const difficultyNote = (mastery: LearningMastery): string => {
  if (mastery.attempts === 0) {
    return 'you’re just starting this concept';
  }
  return `picked from your ${Math.round(mastery.score)}% mastery`;
};
