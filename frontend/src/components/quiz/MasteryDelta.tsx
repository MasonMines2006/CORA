import { CSSProperties } from 'react';
import { MASTERED_AT } from '../Student/learningState';
import { MasteryChange } from './quizModel';

/**
 * The mastery bar on Results: the old value in amber, the new one in emerald
 * growing from old to new (only when it rose), and a marker at 80% = mastered.
 */
const MasteryDelta = ({ change, animate }: { change: MasteryChange; animate: boolean }) => {
  const rose = change.delta > 0;
  // `.grow` scales the new bar from the old width up to its own (see the keyframes in index.css).
  const growStyle = {
    width: `${change.after}%`,
    '--from': change.after ? change.before / change.after : 0,
  } as CSSProperties;
  return (
    <section className='mt-8 rounded-[20px] border-2 border-red-100 p-5 sm:p-6' aria-labelledby='mastery-h'>
      <div className='flex items-baseline justify-between gap-3'>
        <h2 id='mastery-h' className='font-semibold'>
          Mastery
        </h2>
        <p className='tabular font-display text-[28px] font-bold'>
          {change.delta !== 0 && (
            <span className='mr-2 text-[18px] font-semibold text-slate-500 line-through decoration-2'>
              {change.before}%
            </span>
          )}
          <span className={change.isMastered ? 'text-emerald-700' : 'text-amber-700'}>{change.after}%</span>
        </p>
      </div>
      <div
        className='relative mt-3 h-3 overflow-hidden rounded-full bg-slate-100'
        role='img'
        aria-label={`Mastery went from ${change.before} percent to ${change.after} percent. Mastered starts at ${MASTERED_AT} percent.`}
      >
        {rose ? (
          <>
            <span
              className='absolute inset-y-0 left-0 rounded-full bg-amber-600'
              style={{ width: `${change.before}%` }}
            />
            <span
              className={`absolute inset-y-0 left-0 rounded-full bg-emerald-600 ${animate ? 'grow' : ''}`}
              style={growStyle}
            />
          </>
        ) : (
          <span className='absolute inset-y-0 left-0 rounded-full bg-amber-600' style={{ width: `${change.after}%` }} />
        )}
        <span className='absolute inset-y-[-2px] w-[2px] bg-slate-900' style={{ left: `${MASTERED_AT}%` }} />
      </div>
      <div className='mt-2 flex justify-between text-[12.5px] text-slate-500'>
        <span>0%</span>
        <span>Mastered at {MASTERED_AT}%</span>
      </div>
    </section>
  );
};

export default MasteryDelta;
