import { MasteryState } from '../Student/learningState';

/* Ring colours per state. Text uses the -700 shades because -600 is too light for small text. */
const RING: Record<MasteryState, { stroke: string; text: string }> = {
  mastered: { stroke: '#059669', text: 'text-emerald-700' },
  inProgress: { stroke: '#b45309', text: 'text-amber-700' },
  notStarted: { stroke: '#cbd5e1', text: 'text-slate-500' },
};

interface MasteryRingProps {
  percent: number;
  state: MasteryState;
  /** Outer size in px. */
  size?: number;
  label: string;
}

/** A circular mastery meter. `label` is the visible number ("60%" or "—"). */
const MasteryRing = ({ percent, state, size = 76, label }: MasteryRingProps) => {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  // strokeDasharray "<drawn> <gap>": draw `percent` of the circle, leave the rest empty.
  const drawn = (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  return (
    <div className='relative grid flex-none place-items-center' style={{ width: size, height: size }}>
      <svg viewBox='0 0 76 76' className='absolute inset-0' aria-hidden='true'>
        <circle cx='38' cy='38' r={radius} fill='none' stroke='#f1f5f9' strokeWidth='8' />
        {drawn > 0 && (
          <circle
            cx='38'
            cy='38'
            r={radius}
            fill='none'
            stroke={RING[state].stroke}
            strokeWidth='8'
            strokeLinecap='round'
            strokeDasharray={`${drawn} ${circumference}`}
            transform='rotate(-90 38 38)'
          />
        )}
      </svg>
      <span className={`tabular font-display text-[17px] font-bold sm:text-[19px] ${RING[state].text}`}>{label}</span>
    </div>
  );
};

export default MasteryRing;
