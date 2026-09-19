import { LearningMastery } from '../../API/Index';

/*
 * One source of truth for "how far along is this student on this concept?"
 *
 * Before this file, three screens each had their own rule and their own colour:
 * Home and the course map drew mastered concepts teal, the Concepts tab drew them
 * a lighter emerald. docs/STUDENT_UI.md section 4 settles it — colour encodes
 * learning state, and teal is reserved for graph structure — so every screen
 * now asks this module instead.
 */

/** A concept counts as mastered at this score (percent), matching the backend's difficulty bands. */
export const MASTERED_AT = 80;

export type MasteryState = 'mastered' | 'inProgress' | 'notStarted';

interface StateStyle {
  label: string;
  /** Solid colour: bars, dots, percentages. */
  color: string;
  /** Pale fill for pills and tinted rows. */
  fill: string;
  /** Darker text colour that stays readable on `fill`. */
  text: string;
}

export const STATE_STYLE: Record<MasteryState, StateStyle> = {
  mastered: { label: 'Mastered', color: '#059669', fill: '#ecfdf5', text: '#065f46' },
  inProgress: { label: 'In progress', color: '#b45309', fill: '#fffbeb', text: '#92400e' },
  notStarted: { label: 'Not started', color: '#94a3b8', fill: '#f1f5f9', text: '#475569' },
};

/**
 * Attempts decide whether a student has started, not the score: a student who
 * answered three questions and got all of them wrong has still started.
 */
export const masteryState = (mastery: LearningMastery | null | undefined): MasteryState => {
  if (!mastery || mastery.attempts === 0) {
    return 'notStarted';
  }
  return mastery.score >= MASTERED_AT ? 'mastered' : 'inProgress';
};

/** Whole-number percent, clamped so a malformed score can never overflow its bar. */
export const masteryPercent = (mastery: LearningMastery | null | undefined): number => {
  if (!mastery) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(mastery.score)));
};

/** "67%" for a started concept, an em-dash for one the student has not touched. */
export const masteryLabel = (mastery: LearningMastery | null | undefined): string => {
  return masteryState(mastery) === 'notStarted' ? '—' : `${masteryPercent(mastery)}%`;
};
