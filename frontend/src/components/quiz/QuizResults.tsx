import { HiCheck, HiOutlineBookOpen, HiOutlineChatBubbleOvalLeft } from 'react-icons/hi2';
import { MASTERED_AT } from '../Student/learningState';
import { ModeActions } from '../shell/types';
import FocusLayout from '../shell/FocusLayout';
import Button from '../ui-kit/Button';
import Celebration from './Celebration';
import MasteryDelta from './MasteryDelta';
import { masteryChange, resultsHeadline, shouldCelebrate } from './quizModel';
import type { QuizOutcome } from './QuizPlayer';

interface QuizResultsProps {
  outcome: QuizOutcome;
  onClose: () => void;
  onProgress: () => void;
  onAsk: ModeActions['onAsk'];
  onGuide: ModeActions['onGuide'];
}

const minutes = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const StatTile = ({ value, label }: { value: string; label: string }) => (
  <div className='rounded-[16px] bg-red-50 px-3 py-4 text-center'>
    <p className='tabular font-display text-[24px] font-bold'>{value}</p>
    <p className='text-[12.5px] text-slate-500'>{label}</p>
  </div>
);

const Missed = ({ outcome, onAsk, onGuide }: Pick<QuizResultsProps, 'outcome' | 'onAsk' | 'onGuide'>) => {
  const { quiz, state } = outcome;
  const missed = (state.grade?.results ?? []).filter((result) => !result.is_correct);
  if (missed.length === 0) {
    return <p className='mt-8 text-[15px] text-slate-700'>You got every question right.</p>;
  }
  return (
    <section className='mt-8' aria-labelledby='missed-h'>
      <h2 id='missed-h' className='font-semibold'>
        {missed.length === 1 ? 'The one you missed' : `The ${missed.length} you missed`}
      </h2>
      <ul className='mt-3 space-y-3'>
        {missed.map((result) => {
          const index = quiz.questions.findIndex((question) => question.id === result.id);
          const question = quiz.questions[index];
          if (!question) {
            return null;
          }
          return (
            <li key={result.id} className='rounded-[16px] border border-slate-200 p-4'>
              <p className='text-[15px]'>
                Q{index + 1} · {question.question}
              </p>
              <p className='mt-2 text-[14px]'>
                <span className='font-semibold text-red-700'>You chose:</span> {question.options[result.selected_index]}
              </p>
              <p className='text-[14px]'>
                <span className='font-semibold text-emerald-700'>Answer:</span> {question.options[result.correct_index]}
              </p>
              {result.explanation && <p className='mt-2 text-[14px] text-slate-700'>{result.explanation}</p>}
              <div className='mt-3 flex flex-wrap gap-2'>
                <Button
                  variant='soft'
                  size='sm'
                  onClick={() => onAsk(`Talk me through this: ${question.question}`, quiz.concept.id)}
                >
                  <HiOutlineChatBubbleOvalLeft aria-hidden='true' />
                  Talk it through
                </Button>
                <Button variant='secondary' size='sm' onClick={() => onGuide(quiz.concept.id)}>
                  <HiOutlineBookOpen aria-hidden='true' />
                  Re-read the lesson
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/** Results: the real mastery change, and a burst only when it rose (DESIGN.md 5.6). */
const QuizResults = ({ outcome, onClose, onProgress, onAsk, onGuide }: QuizResultsProps) => {
  const { quiz, state } = outcome;
  const after = state.grade?.mastery ?? quiz.mastery;
  const change = masteryChange(quiz.mastery, after);
  const celebrate = shouldCelebrate(quiz.mastery, after);
  const correct = state.grade?.correct ?? 0;
  const total = state.grade?.total ?? quiz.questions.length;
  const footer = (
    <div className='mx-auto flex max-w-[640px] gap-3 px-4 py-4 sm:px-6'>
      <Button variant='secondary' size='lg' onClick={onProgress}>
        See progress
      </Button>
      <Button size='lg' className='flex-1' onClick={onClose}>
        Continue path
      </Button>
    </div>
  );
  return (
    <FocusLayout
      closeLabel='Close results and return to your path'
      onClose={onClose}
      width='max-w-[640px]'
      header={<p className='truncate text-[14px] font-semibold'>{quiz.concept.name} · Results</p>}
      footer={footer}
    >
      <main id='main' className='mx-auto max-w-[640px] px-4 pb-40 pt-10 sm:px-6 sm:pt-16'>
        <div className='relative text-center'>
          {celebrate && <Celebration />}
          <span
            className={`mx-auto grid h-[72px] w-[72px] place-items-center rounded-[22px] text-white ${
              celebrate ? 'bg-emerald-600 shadow-key-emerald' : 'bg-slate-900'
            }`}
            aria-hidden='true'
          >
            <HiCheck className='h-9 w-9' />
          </span>
          <h1 className='mt-6 font-display text-[34px] font-extrabold tracking-tight sm:text-[40px]'>
            {resultsHeadline(quiz.concept.name, change)}
          </h1>
          <p className='mt-2 text-[16px] text-slate-500'>
            <span className='tabular'>
              {correct} of {total}
            </span>{' '}
            correct.{' '}
            {change.isMastered ? (
              <strong className='text-slate-900'>Mastered. Expect hard questions from here.</strong>
            ) : (
              <>Mastered at {MASTERED_AT}%.</>
            )}
          </p>
        </div>
        <MasteryDelta change={change} animate={celebrate} />
        <p className='mt-3 text-[14px] text-slate-700'>
          <span className='tabular'>
            {after.correct} of {after.attempts}
          </span>{' '}
          answers right on this concept so far. Mastery comes only from checks and quizzes, never from reading time.
        </p>
        <section className='mt-4 grid grid-cols-2 gap-3' aria-label='This quiz'>
          <StatTile value={`${correct}/${total}`} label='correct' />
          <StatTile value={minutes(outcome.seconds)} label='minutes' />
        </section>
        <Missed outcome={outcome} onAsk={onAsk} onGuide={onGuide} />
      </main>
    </FocusLayout>
  );
};

export default QuizResults;
