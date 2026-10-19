import { MasteryState, STATE_STYLE } from '../Student/learningState';

const CLASS: Record<MasteryState, string> = {
  mastered: 'state-mastered',
  inProgress: 'state-progress',
  notStarted: 'state-new',
};

/** Mastery state as colour AND words, so colour is never the only signal (WCAG 1.4.1). */
const StateChip = ({ state, className = '' }: { state: MasteryState; className?: string }) => (
  <span className={`state ${CLASS[state]} ${className}`}>{STATE_STYLE[state].label}</span>
);

export default StateChip;
