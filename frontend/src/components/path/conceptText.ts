import { LearningMastery } from '../../API/Index';
import { masteryPercent, masteryState } from '../Student/learningState';

/** Text colour per mastery state. -700 shades, because -600 fails contrast as small text. */
export const STATE_TEXT = {
  mastered: 'text-emerald-700',
  inProgress: 'text-amber-700',
  notStarted: 'text-slate-500',
} as const;

/** "92% · Mastered", "60% · In progress", "Not started". Always words, never colour alone. */
export const masteryLine = (mastery: LearningMastery | null | undefined): string => {
  const state = masteryState(mastery);
  if (state === 'notStarted') {
    return 'Not started';
  }
  return `${masteryPercent(mastery)}% · ${state === 'mastered' ? 'Mastered' : 'In progress'}`;
};

/** Spoken label for a path node: "Reactor period, in progress, 60 percent". */
export const nodeLabel = (name: string, mastery: LearningMastery | null | undefined, isCurrent: boolean): string => {
  const state = masteryState(mastery);
  const parts = [name];
  if (isCurrent) {
    parts.push('suggested next');
  }
  if (state === 'notStarted') {
    parts.push('not started');
  } else {
    parts.push(state === 'mastered' ? 'mastered' : 'in progress', `${masteryPercent(mastery)} percent`);
  }
  return parts.join(', ');
};
