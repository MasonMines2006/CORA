import { useCallback, useEffect, useState } from 'react';
import { HiCheck } from 'react-icons/hi2';
import Button from '../ui-kit/Button';
import EmptyState from '../ui-kit/EmptyState';
import InlineError from '../ui-kit/InlineError';
import ProgressBar from '../ui-kit/ProgressBar';
import SegmentBar from '../ui-kit/SegmentBar';
import Skeleton from '../ui-kit/Skeleton';
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

/* Grade keys reuse the quiz's `.option` look; the word and the interval carry the meaning, colour only helps. */
const GRADES: ReadonlyArray<{ grade: ReviewGrade; label: string; key: string; tone: string }> = [
  { grade: 'again', label: 'Again', key: '1', tone: 'text-red-700' },
  { grade: 'hard', label: 'Hard', key: '2', tone: 'text-amber-700' },
  { grade: 'good', label: 'Good', key: '3', tone: 'text-emerald-700' },
  { grade: 'easy', label: 'Easy', key: '4', tone: 'text-slate-700' },
];

const MAX_SEGMENTS = 12;

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
    return <InlineError title={loadError} onRetry={() => setAttempt((count) => count + 1)} />;
  }

  if (!session) {
    return (
      <div className='space-y-4' aria-busy='true' aria-label='Loading review'>
        <Skeleton className='h-2 w-full' />
        <Skeleton className='h-6 w-40' />
        <Skeleton className='h-10 w-3/4' />
        <Skeleton className='h-[52px] w-48 rounded-[14px]' />
      </div>
    );
  }

  const total = graded + session.queue.length;

  if (total === 0) {
    return (
      <EmptyState
        icon={<HiCheck className='h-6 w-6' />}
        tone='emerald'
        title={conceptName ? `No cards for ${conceptName} yet` : 'All caught up'}
        actions={<Button onClick={onFindCards}>{conceptName ? 'Open the lesson' : 'Learn something new'}</Button>}
      >
        {conceptName
          ? 'Review cards are made from a concept’s lesson, so they appear once you have opened it.'
          : 'Nothing is due right now. Cards come back on the day their last grade scheduled.'}
      </EmptyState>
    );
  }

  const cardPanel = current ? (
    <div className='min-w-0 flex-1'>
      <div className='flex items-center gap-4'>
        {/* One segment per card reads well up to about a dozen; past that a plain bar is clearer. */}
        {total <= MAX_SEGMENTS ? (
          <SegmentBar count={total} current={graded} label='Review progress' className='flex-1' />
        ) : (
          <div
            className='flex-1'
            role='progressbar'
            aria-label='Review progress'
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={graded}
          >
            <ProgressBar value={(graded / total) * 100} color='#059669' />
          </div>
        )}
        <p className='tabular flex-none text-[13px] font-semibold text-slate-500'>
          {graded + 1} / {total}
        </p>
      </div>
      <p className='mt-2 text-[13px] text-slate-500'>{timeLeftLabel(session.queue.length)}</p>

      <article className='mt-6'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='rounded-[8px] bg-slate-900 px-2 py-1 font-code text-[11.5px] font-medium uppercase tracking-wide text-white'>
            {current.concept_name}
          </span>
          <span className='text-[13px] text-slate-500'>{lastSeenLabel(current.last_reviewed_at)}</span>
        </div>
        <h2 className='mt-5 font-display text-[24px] font-bold leading-[1.25] tracking-tight sm:text-[28px]'>
          {current.prompt}
        </h2>

        {revealed ? (
          <div className='enter mt-6'>
            <p className='text-[12px] font-semibold uppercase tracking-wider text-slate-500'>Answer</p>
            <p className='passage mt-2 whitespace-pre-line text-[15px]'>{current.answer}</p>
            <p className='mt-2 font-code text-[12px] text-slate-500'>{current.source}</p>
          </div>
        ) : (
          <Button size='lg' className='mt-8' onClick={() => setRevealed(true)}>
            Show answer <kbd className='kbd ml-1'>Space</kbd>
          </Button>
        )}
      </article>

      {revealed && (
        <div className='mt-8'>
          <p className='text-[14px] text-slate-700'>How well did you know it?</p>
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
                className='option flex-col items-center gap-1 text-center'
              >
                <span className={`block text-[16px] font-semibold ${item.tone}`}>{item.label}</span>
                <span className='block text-[13px] text-slate-500'>
                  {formatInterval(current.intervals[item.grade])}
                </span>
              </button>
            ))}
          </div>
          <p className='mt-3 text-[13px] text-slate-500'>
            <kbd className='kbd'>1</kbd>–<kbd className='kbd'>4</kbd> to grade
          </p>
          {gradeError && (
            <p className='error-text' role='alert'>
              {gradeError}
            </p>
          )}
        </div>
      )}
    </div>
  ) : (
    <div className='min-w-0 flex-1'>
      <EmptyState icon={<HiCheck className='h-6 w-6' />} tone='emerald' title='Session done'>
        {session.known} known, {session.shaky} shaky. Each card comes back on the day its grade scheduled.
      </EmptyState>
    </div>
  );

  if (!showRail) {
    return cardPanel;
  }

  return (
    <div className='flex flex-col gap-8 lg:flex-row lg:items-start'>
      {cardPanel}
      <aside className='w-full shrink-0 space-y-4 lg:w-[300px]' aria-label='This session'>
        <section className='panel p-5'>
          <h2 className='text-[13px] font-semibold uppercase tracking-wider text-slate-500'>This session</h2>
          <div className='mt-3 flex gap-8'>
            <div>
              <p className='tabular font-display text-[30px] font-bold text-emerald-700'>{session.known}</p>
              <p className='text-[13px] text-slate-500'>known</p>
            </div>
            <div>
              <p className='tabular font-display text-[30px] font-bold text-amber-700'>{session.shaky}</p>
              <p className='text-[13px] text-slate-500'>shaky</p>
            </div>
            <div>
              <p className='tabular font-display text-[30px] font-bold text-slate-700'>{session.queue.length}</p>
              <p className='text-[13px] text-slate-500'>left</p>
            </div>
          </div>
        </section>
        <section className='panel-quiet p-5'>
          <h2 className='text-[13px] font-semibold uppercase tracking-wider text-slate-500'>Queue</h2>
          <ol className='mt-3 space-y-1'>
            {session.queue.slice(0, 8).map((item, index) => (
              <li
                key={`${item.card_id}-${index}`}
                className={`truncate rounded-[8px] px-3 py-2 text-[13.5px] ${index === 0 ? 'bg-red-50 font-semibold text-slate-900' : 'text-slate-700'}`}
              >
                {item.concept_name} · {item.prompt}
              </li>
            ))}
          </ol>
          <p className='mt-4 border-t border-slate-100 pt-4 text-[13px] leading-relaxed text-slate-500'>
            Cards come from the same passages as your lessons, so review and study stay in sync.
          </p>
        </section>
      </aside>
    </div>
  );
};

export default ReviewSession;
