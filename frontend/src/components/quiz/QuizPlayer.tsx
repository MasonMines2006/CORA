import { useEffect } from 'react';
import { LearningQuiz } from '../../API/Index';
import { ModeActions } from '../shell/types';
import FocusLayout from '../shell/FocusLayout';
import Button from '../ui-kit/Button';
import InlineError from '../ui-kit/InlineError';
import SegmentBar from '../ui-kit/SegmentBar';
import FeedbackSheet from './FeedbackSheet';
import OptionKey, { OptionLook } from './OptionKey';
import { difficultyNote, keyToAction, QuizState } from './quizModel';
import { QuizLoadFailed, QuizSkeleton, SignedOut } from './QuizStates';
import { useQuizSession } from './useQuizSession';

/** Everything the results screen needs, handed over when the last feedback is read. */
export interface QuizOutcome {
  quiz: LearningQuiz;
  state: QuizState;
  seconds: number;
}

interface QuizPlayerProps {
  conceptId: string;
  onClose: () => void;
  onAsk: ModeActions['onAsk'];
  onGuide: ModeActions['onGuide'];
  onLoaded: (conceptName: string) => void;
  onFinished: (outcome: QuizOutcome) => void;
  onSignIn: () => void;
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

const CAPITALISED = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

/** Adaptive quiz in focus mode (DESIGN.md 5.6). Keyboard: 1–4 choose, Enter checks or continues. */
const QuizPlayer = ({ conceptId, onClose, onAsk, onGuide, onLoaded, onFinished, onSignIn }: QuizPlayerProps) => {
  const { load, quiz, state, dispatch, startedAt, regenerate } = useQuizSession(conceptId);
  const question = quiz?.questions[state.index];

  useEffect(() => {
    if (quiz) {
      onLoaded(quiz.concept.name);
    }
    // Report once per quiz, not on every render.
    // `onLoaded` is left out on purpose: a new function each render would log the activity again and again.
  }, [quiz?.quiz_id]);

  useEffect(() => {
    if (state.phase === 'results' && quiz) {
      onFinished({ quiz, state, seconds: Math.round((Date.now() - startedAt) / 1000) });
    }
  }, [state.phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!question || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const action = keyToAction(event.key, state, question.options.length);
      if (action) {
        event.preventDefault();
        dispatch(action);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [question, state, dispatch]);

  const result = state.grade?.results.find((item) => item.id === question?.id);
  const isFeedback = state.phase === 'feedback' && result !== undefined;
  const lookFor = (index: number): OptionLook => {
    if (!isFeedback || !result) {
      return 'idle';
    }
    if (index === result.correct_index) {
      return 'correct';
    }
    return index === result.selected_index ? 'wrong' : 'idle';
  };
  const selected = state.answers[state.index];
  const isLastQuestion = state.index === state.answers.length - 1;
  const askAbout = (text: string) => onAsk(text, conceptId);

  const footer = quiz && question && (
    <div className='mx-auto max-w-[760px] px-4 py-4 sm:px-6'>
      {isFeedback && result && (
        <FeedbackSheet
          isCorrect={result.is_correct}
          correctText={question.options[result.correct_index] ?? ''}
          explanation={result.explanation}
          onAskWhy={() =>
            askAbout(`Why is “${question.options[result.correct_index]}” the answer to: ${question.question}`)
          }
        />
      )}
      <div className='flex items-center gap-3'>
        {state.phase === 'answering' && (
          <Button variant='ghost' size='lg' onClick={() => askAbout(`Help me understand: ${question.question}`)}>
            I don&apos;t know yet
          </Button>
        )}
        <span className='flex-1' />
        {isFeedback ? (
          <Button
            variant={result?.is_correct ? 'success' : 'primary'}
            size='lg'
            className='min-w-[160px] sm:min-w-[200px]'
            onClick={() => dispatch({ type: 'continue' })}
            autoFocus
          >
            Continue
          </Button>
        ) : (
          <Button
            size='lg'
            className='min-w-[160px] sm:min-w-[200px]'
            disabled={selected === null || state.phase !== 'answering'}
            onClick={() => dispatch({ type: 'submit' })}
          >
            {state.phase === 'grading' ? 'Checking…' : isLastQuestion ? 'Check answers' : 'Next question'}
          </Button>
        )}
      </div>
    </div>
  );

  // The footer becomes the feedback sheet: emerald when right, red-50 when not.
  let footerColour = 'border-slate-100 bg-white';
  if (isFeedback) {
    footerColour = result?.is_correct ? 'border-emerald-300 bg-emerald-50' : 'border-red-200 bg-red-50';
  }

  return (
    <FocusLayout
      closeLabel='End quiz and return to your path'
      onClose={onClose}
      width='max-w-[760px]'
      skipLabel='Skip to question'
      header={
        quiz ? (
          <div className='flex items-center gap-4'>
            <SegmentBar count={quiz.questions.length} current={state.index} label='Quiz progress' className='flex-1' />
            <p className='tabular flex-none text-[13px] font-semibold text-slate-500'>
              {state.index + 1} / {quiz.questions.length}
            </p>
          </div>
        ) : (
          <p className='text-[14px] font-semibold'>Quiz</p>
        )
      }
      footer={footer}
      footerClassName={footerColour}
    >
      <main id='main' className='mx-auto max-w-[760px] px-4 pb-64 pt-8 sm:px-6 sm:pt-12'>
        {load.status === 'loading' && <QuizSkeleton />}
        {load.status === 'failed' && (
          <QuizLoadFailed
            reason={load.reason}
            onRetry={regenerate}
            onGuide={() => onGuide(conceptId)}
            onAsk={() => askAbout('Help me understand this concept using the course material.')}
            onSignIn={onSignIn}
          />
        )}
        {quiz && question && (
          <>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='rounded-[8px] bg-slate-900 px-2 py-1 font-code text-[11.5px] font-medium uppercase tracking-wide text-white'>
                {quiz.concept.name}
              </span>
              <span className='inline-flex items-center gap-1.5 rounded-[8px] border border-amber-300 bg-amber-50 px-2 py-1 text-[12.5px] font-semibold text-amber-700'>
                {CAPITALISED[quiz.difficulty]} <span className='font-normal'>· {difficultyNote(quiz.mastery)}</span>
              </span>
            </div>
            <h1
              id='question'
              className='mt-5 font-display text-[24px] font-bold leading-[1.25] tracking-tight sm:text-[28px]'
            >
              {question.question}
            </h1>
            <div className='mt-7 space-y-3' role='radiogroup' aria-labelledby='question'>
              {question.options.map((option, index) => (
                <OptionKey
                  key={`${question.id}-${index}`}
                  index={index}
                  text={option}
                  isSelected={selected === index}
                  look={lookFor(index)}
                  disabled={state.phase !== 'answering'}
                  onSelect={() => dispatch({ type: 'select', option: index })}
                />
              ))}
            </div>
            <p className='mt-5 text-[13px] text-slate-500'>
              Written from <span className='tabular'>{quiz.sources.length}</span> published document
              {quiz.sources.length === 1 ? '' : 's'} · <kbd className='kbd'>1</kbd>–
              <kbd className='kbd'>{question.options.length}</kbd> to choose, <kbd className='kbd'>Enter</kbd> to{' '}
              {isFeedback ? 'continue' : 'go on'}
            </p>
            {state.phase === 'answering' && state.index === 0 && (
              <p className='mt-2 text-[13px] text-slate-500'>You&apos;ll see how you did after the last question.</p>
            )}
            {state.phase === 'gradeError' && (
              <div className='mt-6'>
                {state.gradeError === 'signedOut' ? (
                  <SignedOut
                    detail='Your answers are still on this page, but they could not be checked. Signing in starts a new quiz.'
                    onSignIn={onSignIn}
                  />
                ) : (
                  <InlineError title="Couldn't check your answers" onRetry={() => dispatch({ type: 'retryGrade' })}>
                    Your answers are kept. Nothing was graded yet.
                  </InlineError>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </FocusLayout>
  );
};

export default QuizPlayer;
