import { useCallback, useEffect, useState } from 'react';
import { HiOutlineCheck } from 'react-icons/hi2';
import { getReviewQueue, gradeReviewCard, ReviewCard, ReviewGrade } from '../../API/Index';
import { formatInterval } from './conceptHubModel';
import { afterGrade, lastSeenLabel, ReviewSessionState, timeLeftLabel } from './reviewModel';

interface ReviewSessionProps {
  /** Limit the session to one concept (the concept page's Cards mode). Omit for everything due. */
  conceptId?: string;
  conceptName?: string;
  /** The full Review page shows its own session rail; inside a concept page the page has the rail. */
  showRail?: boolean;
  /** Where to send a student who has no cards yet. */
  onFindCards: () => void;
}

const GRADES: ReadonlyArray<{ grade: ReviewGrade; label: string; className: string; key: string }> = [
  { grade: 'again', label: 'Again', key: '1', className: 'border-red-200 bg-red-50 text-red-700 hover:border-red-300' },
  {
    grade: 'hard',
    label: 'Hard',
    key: '2',
    className: 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300',
  },
  {
    grade: 'good',
    label: 'Good',
    key: '3',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300',
  },
  {
    grade: 'easy',
    label: 'Easy',
    key: '4',
    className: 'border-stone-200 bg-white text-slate-700 hover:border-stone-300',
  },
];

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? fallback;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

/**
 * Spaced review: reveal, then grade. Every grade button prints the interval it
 * will schedule, so the scheduling is legible instead of magic. Keyboard: Space
 * reveals, 1–4 grade.
 */
const ReviewSession = ({ conceptId, conceptName, showRail = false, onFindCards }: ReviewSessionProps) => {
  const [session, setSession] = useState<ReviewSessionState | null>(null);
  const [graded, setGraded] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [grading, setGrading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [gradeError, setGradeError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setSession(null);
    setLoadError('');
    getReviewQueue(conceptId, controller.signal)
      .then((queue) => {
        setSession({ queue: queue.cards, known: 0, shaky: 0 });
        setGraded(0);
        setRevealed(false);
      })
      .catch((requestError) => {
        if ((requestError as { name?: string }).name !== 'CanceledError') {
          setLoadError(errorMessage(requestError, 'CORA could not load your review cards. Please try again.'));
        }
      });
    return () => controller.abort();
  }, [conceptId, attempt]);

  const current: ReviewCard | undefined = session?.queue[0];

  const grade = useCallback(
    async (choice: ReviewGrade) => {
      if (!current || !session || grading) {
        return;
      }
      setGrading(true);
      setGradeError('');
      try {
        await gradeReviewCard(current.card_id, choice);
        setSession(afterGrade(session, choice));
        setGraded((count) => count + 1);
        setRevealed(false);
      } catch (requestError) {
        // Keep the card on screen: the grade was not saved, so moving on would lose it.
        setGradeError(errorMessage(requestError, 'That grade was not saved. Try again.'));
      } finally {
        setGrading(false);
      }
    },
    [current, session, grading]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!current || isTyping(event.target)) {
        return;
      }
      if (!revealed && event.key === ' ') {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      const match = revealed ? GRADES.find((item) => item.key === event.key) : undefined;
      if (match) {
        void grade(match.grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, revealed, grade]);

  if (loadError) {
    return (
      <div className='rounded-2xl border border-red-200 bg-red-50 p-6'>
        <p className='text-sm text-slate-700'>{loadError}</p>
        <button
          type='button'
          onClick={() => setAttempt((count) => count + 1)}
          className='mt-3 text-sm font-semibold text-red-600 hover:text-red-700'
        >
          Try again
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className='h-96 animate-pulse rounded-2xl border border-stone-200 bg-white' aria-label='Loading review' />
    );
  }

  const total = graded + session.queue.length;

  if (total === 0) {
    return (
      <div className='rounded-2xl border border-stone-200 bg-white p-8 text-center sm:p-12'>
        <h2 className='font-display text-xl font-bold text-slate-900'>
          {conceptName ? `No cards for ${conceptName} yet` : 'Nothing to review yet'}
        </h2>
        <p className='mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500'>
          Review cards are made from a concept’s lesson, so they appear once you have opened it.
        </p>
        <button
          type='button'
          onClick={onFindCards}
          className='mt-5 rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700'
        >
          {conceptName ? 'Open the lesson' : 'Choose a concept'}
        </button>
      </div>
    );
  }

  const progress = Math.round((graded / total) * 100);

  const cardPanel = current ? (
    <div className='min-w-0 flex-1'>
      <div className='flex items-center gap-4'>
        <p className='shrink-0 text-[11px] font-bold uppercase tracking-[0.09em] text-teal-700'>
          Card {graded + 1} of {total}
        </p>
        <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200'>
          <div className='h-full rounded-full bg-teal-700 transition-all' style={{ width: `${progress}%` }} />
        </div>
        <p className='shrink-0 text-sm text-slate-500'>{timeLeftLabel(session.queue.length)}</p>
      </div>

      <article className='mt-8 rounded-2xl border border-stone-200 bg-white p-6 sm:p-10'>
        <div className='flex flex-wrap items-center gap-3'>
          <span className='rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-red-700'>
            {current.concept_name}
          </span>
          <span className='text-sm text-slate-500'>{lastSeenLabel(current.last_reviewed_at)}</span>
        </div>
        <h2 className='mt-5 font-display text-2xl font-bold leading-snug tracking-tight text-slate-900'>
          {current.prompt}
        </h2>

        {revealed ? (
          <div className='mt-6 border-t border-dashed border-stone-300 pt-6'>
            <p className='text-[11px] font-bold uppercase tracking-[0.09em] text-slate-500'>Answer</p>
            <p className='mt-2 whitespace-pre-line text-base leading-7 text-slate-700'>{current.answer}</p>
            <p className='mt-4 text-sm text-slate-500'>{current.source}</p>
          </div>
        ) : (
          <button
            type='button'
            onClick={() => setRevealed(true)}
            className='mt-8 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700'
          >
            Show answer <span className='ml-1 text-slate-400'>(space)</span>
          </button>
        )}
      </article>

      {revealed && (
        <div className='mt-6 text-center'>
          <p className='text-sm text-slate-600'>How well did you know it?</p>
          <div className='mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4'>
            {GRADES.map((item) => (
              <button
                key={item.grade}
                type='button'
                disabled={grading}
                onClick={() => {
                  // grade() reports its own failure on screen, so nothing is thrown here.
                  grade(item.grade);
                }}
                className={`rounded-xl border px-4 py-3 disabled:opacity-60 ${item.className}`}
              >
                <span className='block text-base font-semibold'>{item.label}</span>
                <span className='block text-sm'>{formatInterval(current.intervals[item.grade])}</span>
              </button>
            ))}
          </div>
          {gradeError && (
            <p className='mt-3 text-sm text-red-700' role='alert'>
              {gradeError}
            </p>
          )}
        </div>
      )}
    </div>
  ) : (
    <div className='min-w-0 flex-1 rounded-2xl border border-stone-200 bg-white p-8 text-center sm:p-12'>
      <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600'>
        <HiOutlineCheck className='h-6 w-6' />
      </div>
      <h2 className='mt-4 font-display text-xl font-bold text-slate-900'>Session done</h2>
      <p className='mt-2 text-sm text-slate-500'>
        {session.known} known, {session.shaky} shaky. Each card comes back on the day its grade scheduled.
      </p>
    </div>
  );

  if (!showRail) {
    return cardPanel;
  }

  return (
    <div className='flex flex-col gap-8 lg:flex-row lg:items-start'>
      {cardPanel}
      <aside className='w-full shrink-0 space-y-5 lg:w-[300px]'>
        <section className='rounded-2xl border border-stone-200 bg-white p-6'>
          <p className='text-[11px] font-bold uppercase tracking-[0.09em] text-red-600'>This session</p>
          <div className='mt-3 flex gap-8'>
            <div>
              <p className='font-display text-3xl font-bold text-emerald-600'>{session.known}</p>
              <p className='text-sm text-slate-500'>known</p>
            </div>
            <div>
              <p className='font-display text-3xl font-bold text-amber-700'>{session.shaky}</p>
              <p className='text-sm text-slate-500'>shaky</p>
            </div>
            <div>
              <p className='font-display text-3xl font-bold text-slate-400'>{session.queue.length}</p>
              <p className='text-sm text-slate-500'>left</p>
            </div>
          </div>
        </section>
        <section className='rounded-2xl border border-stone-200 bg-white p-6'>
          <p className='text-[11px] font-bold uppercase tracking-[0.09em] text-slate-500'>Queue</p>
          <ol className='mt-3 space-y-1.5'>
            {session.queue.slice(0, 8).map((item, index) => (
              <li
                key={`${item.card_id}-${index}`}
                className={`truncate rounded-lg px-3 py-2 text-sm ${index === 0 ? 'bg-red-50 font-semibold text-slate-900' : 'text-slate-600'}`}
              >
                {item.concept_name} — {item.prompt}
              </li>
            ))}
          </ol>
          <p className='mt-4 border-t border-stone-100 pt-4 text-sm leading-relaxed text-slate-500'>
            Cards come from the same passages as your lessons, so review and study stay in sync.
          </p>
        </section>
      </aside>
    </div>
  );
};

export default ReviewSession;
