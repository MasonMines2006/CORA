import { FormEvent, useState } from 'react';
import { HiOutlineArrowRight, HiOutlineArrowUp, HiOutlineRectangleStack } from 'react-icons/hi2';
import { LearningConceptProgress } from '../../API/Index';
import { masteryPercent } from '../Student/learningState';
import { ModeActions } from '../shell/types';
import Button from '../ui-kit/Button';
import ProgressBar from '../ui-kit/ProgressBar';

interface TodayRailProps {
  dueCount: number;
  weakSpot?: LearningConceptProgress;
  onReview: () => void;
  onQuiz: ModeActions['onQuiz'];
  onAsk: ModeActions['onAsk'];
}

const DueCardsCard = ({ dueCount, onReview }: { dueCount: number; onReview: () => void }) => (
  <section className='panel p-5' aria-labelledby='due-h'>
    <div className='flex items-center gap-3'>
      <span className='grid h-10 w-10 place-items-center rounded-[12px] bg-red-50 text-red-600' aria-hidden='true'>
        <HiOutlineRectangleStack className='h-5 w-5' />
      </span>
      <div>
        <h2 id='due-h' className='font-semibold'>
          {dueCount > 0 ? (
            <>
              <span className='tabular'>{dueCount}</span> card{dueCount === 1 ? '' : 's'} due
            </>
          ) : (
            'No cards due'
          )}
        </h2>
        <p className='text-[13px] text-slate-500'>
          {dueCount > 0 ? 'Short reviews keep what you learned.' : 'Missed questions come back here.'}
        </p>
      </div>
    </div>
    {dueCount > 0 && (
      <Button variant='secondary' block className='mt-4' onClick={onReview}>
        Review now
      </Button>
    )}
  </section>
);

const WeakSpotCard = ({ item, onQuiz }: { item: LearningConceptProgress; onQuiz: ModeActions['onQuiz'] }) => (
  <section className='panel-quiet p-5' aria-labelledby='weak-h'>
    <h2 id='weak-h' className='text-[13px] font-semibold uppercase tracking-wider text-slate-500'>
      Weak spot
    </h2>
    <p className='mt-2 font-semibold'>{item.concept.name}</p>
    <p className='tabular text-[13.5px] text-slate-500'>
      {masteryPercent(item.mastery)}% · {item.mastery.correct} of {item.mastery.attempts} right so far
    </p>
    <ProgressBar value={masteryPercent(item.mastery)} color='#d97706' className='mt-3' />
    <button
      type='button'
      onClick={() => onQuiz(item.concept.id)}
      className='mt-3 inline-flex min-h-[32px] items-center gap-1 text-[14px] font-semibold text-red-700 hover:underline'
    >
      Quiz me on it <HiOutlineArrowRight className='h-4 w-4' aria-hidden='true' />
    </button>
  </section>
);

const QuickAsk = ({ onAsk }: { onAsk: ModeActions['onAsk'] }) => {
  const [question, setQuestion] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (question.trim()) {
      onAsk(question.trim());
    }
  };
  return (
    <form className='composer flex items-center gap-2 p-2 pl-4' onSubmit={submit}>
      <label htmlFor='quick-ask' className='sr-only'>
        Ask CORA
      </label>
      <input
        id='quick-ask'
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        className='min-w-0 flex-1 text-[14px] placeholder:text-slate-500'
        placeholder='Ask about the course material…'
      />
      <Button type='submit' size='sm' className='px-2.5' aria-label='Ask'>
        <HiOutlineArrowUp aria-hidden='true' />
      </Button>
    </form>
  );
};

/**
 * The "Today" rail at 1280px and up. The daily goal and streak tiles from the
 * prototype are left out until there is real activity data to show (DESIGN.md 10, cut item 6).
 */
const TodayRail = ({ dueCount, weakSpot, onReview, onQuiz, onAsk }: TodayRailProps) => (
  <aside className='hidden w-[300px] flex-none space-y-4 xl:block' aria-label='Today'>
    <DueCardsCard dueCount={dueCount} onReview={onReview} />
    {weakSpot && <WeakSpotCard item={weakSpot} onQuiz={onQuiz} />}
    <QuickAsk onAsk={onAsk} />
  </aside>
);

export default TodayRail;
