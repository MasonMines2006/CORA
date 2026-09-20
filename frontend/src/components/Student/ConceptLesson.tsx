import { useEffect, useState } from 'react';
import { HiOutlineArrowLeft, HiOutlineArrowRight, HiOutlineCheckCircle } from 'react-icons/hi2';
import { getLearningLesson, LearningLesson, saveLessonProgress } from '../../API/Index';

interface ConceptLessonProps {
  conceptId: string;
  /** Beat to open on, e.g. when resuming from Home. */
  initialBeat?: number;
  onPractice: () => void;
  onReadSources: () => void;
  onAsk: (prompt: string) => void;
}

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
  'CORA could not load this lesson. Please try again.';

const isCanceled = (error: unknown) => (error as { name?: string })?.name === 'CanceledError';

/** Answer option colours: neutral, selected, correct, wrong. */
const optionClass = (state: 'idle' | 'selected' | 'correct' | 'wrong') =>
  ({
    idle: 'border-stone-200 bg-white text-slate-600 hover:border-stone-300',
    selected: 'border-red-300 bg-red-50 text-slate-900',
    correct: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    wrong: 'border-red-300 bg-red-50 text-red-700',
  })[state];

/**
 * The four-beat guided lesson: core idea → how it works → an example →
 * quick check. Opens straight into the lesson — the concept page already told the
 * student what they picked, so there is no "Start" step in between.
 */
const ConceptLesson = ({ conceptId, initialBeat = 0, onPractice, onReadSources, onAsk }: ConceptLessonProps) => {
  const [lesson, setLesson] = useState<LearningLesson | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState(initialBeat);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLesson(null);
    setError('');
    getLearningLesson(conceptId, controller.signal)
      .then((result) => {
        setLesson(result);
        // A saved position can outlive a lesson that was rebuilt shorter; clamp it.
        setStep((current) => Math.min(current, result.beats.length - 1));
      })
      .catch((requestError) => {
        if (!isCanceled(requestError)) {
          setError(errorMessage(requestError));
        }
      });
    return () => controller.abort();
  }, [conceptId, attempt]);

  // Remember the position so Home can offer "Pick up where you left off".
  useEffect(() => {
    if (!lesson) {
      return;
    }
    // Deliberately not surfaced: a lost position costs the student a click on
    // their next visit, whereas an error banner here would interrupt the lesson.
    saveLessonProgress(conceptId, step, lesson.beats.length).catch(() => undefined);
  }, [conceptId, lesson, step]);

  if (error) {
    return (
      <div className='rounded-2xl border border-red-200 bg-red-50 p-6'>
        <h3 className='font-semibold text-slate-900'>Lesson unavailable</h3>
        <p className='mt-2 text-sm leading-relaxed text-slate-600'>{error}</p>
        <button
          type='button'
          onClick={() => setAttempt((current) => current + 1)}
          className='mt-4 text-sm font-semibold text-red-600 hover:text-red-700'
        >
          Try again
        </button>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div
        className='min-h-80 animate-pulse rounded-2xl border border-stone-200 bg-white p-8'
        aria-label='Loading lesson'
      >
        <div className='h-3 w-28 rounded bg-red-100' />
        <div className='mt-5 h-7 w-2/3 rounded bg-stone-100' />
        <div className='mt-6 space-y-3'>
          <div className='h-3 rounded bg-stone-100' />
          <div className='h-3 rounded bg-stone-100' />
          <div className='h-3 w-4/5 rounded bg-stone-100' />
        </div>
        <p className='mt-6 text-sm text-slate-500'>Writing this lesson from the course passages…</p>
      </div>
    );
  }

  const beat = lesson.beats[step];
  const lastStep = lesson.beats.length - 1;
  const isQuickCheck = beat.key === 'quick_check';
  const check = lesson.quick_check;
  const isCorrect = selectedAnswer === check.answer_index;

  const goTo = (next: number) => {
    setStep(Math.max(0, Math.min(lastStep, next)));
  };

  const optionState = (index: number) => {
    if (answerRevealed && index === check.answer_index) {
      return 'correct';
    }
    if (answerRevealed && index === selectedAnswer) {
      return 'wrong';
    }
    return index === selectedAnswer ? 'selected' : 'idle';
  };

  return (
    <article className='flex min-h-[28rem] flex-col rounded-2xl border border-stone-200 bg-white p-6 sm:p-10'>
      <div className='flex items-center gap-4'>
        <p className='shrink-0 text-[11px] font-bold uppercase tracking-[0.09em] text-red-600'>
          Step {step + 1} of {lesson.beats.length}
        </p>
        <div className='flex flex-1 gap-2' aria-hidden='true'>
          {lesson.beats.map((item, index) => (
            <div
              key={item.key}
              className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-red-600' : 'bg-stone-200'}`}
            />
          ))}
        </div>
      </div>

      <h2 className='mt-5 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]'>
        {beat.title}
      </h2>

      {!isQuickCheck && <p className='mt-5 whitespace-pre-line text-base leading-8 text-slate-600'>{beat.content}</p>}

      {isQuickCheck && (
        <div className='mt-5'>
          <p className='text-base font-semibold leading-7 text-slate-900'>{check.question}</p>
          <div className='mt-4 space-y-2'>
            {check.options.map((option, index) => (
              <button
                key={option}
                type='button'
                disabled={answerRevealed}
                onClick={() => setSelectedAnswer(index)}
                aria-pressed={selectedAnswer === index}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${optionClass(optionState(index))}`}
              >
                {option}
              </button>
            ))}
          </div>
          {!answerRevealed ? (
            <button
              type='button'
              disabled={selectedAnswer === null}
              onClick={() => setAnswerRevealed(true)}
              className='mt-4 rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50'
            >
              Check answer
            </button>
          ) : (
            <div className={`mt-4 rounded-xl p-4 ${isCorrect ? 'bg-emerald-50' : 'bg-red-50'}`} role='status'>
              <p className='flex items-center gap-2 text-sm font-semibold text-slate-900'>
                <HiOutlineCheckCircle className={`h-5 w-5 ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`} />
                {isCorrect ? 'Correct' : 'Not quite — here is why'}
              </p>
              <p className='mt-2 text-sm leading-relaxed text-slate-600'>{check.explanation}</p>
            </div>
          )}
        </div>
      )}

      {lesson.sources.length > 0 && (
        <div className='mt-7 rounded-xl bg-teal-50 px-5 py-4'>
          <p className='text-[11px] font-bold uppercase tracking-[0.09em] text-teal-700'>Written from</p>
          <p className='mt-1.5 text-sm leading-relaxed text-teal-900'>{lesson.sources.join(' · ')}</p>
          <button
            type='button'
            onClick={onReadSources}
            className='mt-2 text-sm font-semibold text-teal-700 hover:text-teal-900'
          >
            Read the passages →
          </button>
        </div>
      )}

      <div className='mt-auto flex flex-wrap items-center gap-3 border-t border-stone-100 pt-6'>
        <button
          type='button'
          onClick={() => goTo(step - 1)}
          disabled={step === 0}
          className='flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-40'
        >
          <HiOutlineArrowLeft className='h-4 w-4' /> Previous
        </button>
        <div className='flex-1' />
        {step < lastStep && !isQuickCheck && (
          <button
            type='button'
            onClick={() => goTo(lastStep)}
            className='rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:border-stone-300'
          >
            Skip to quick check
          </button>
        )}
        {step < lastStep ? (
          <button
            type='button'
            onClick={() => goTo(step + 1)}
            className='flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700'
          >
            Next <HiOutlineArrowRight className='h-4 w-4' />
          </button>
        ) : (
          <>
            <button
              type='button'
              onClick={() => onAsk(`Help me go deeper on ${lesson.concept.name}.`)}
              className='rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:border-stone-300'
            >
              Ask a follow-up
            </button>
            <button
              type='button'
              onClick={onPractice}
              className='flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700'
            >
              Practice this concept <HiOutlineArrowRight className='h-4 w-4' />
            </button>
          </>
        )}
      </div>
    </article>
  );
};

export default ConceptLesson;
