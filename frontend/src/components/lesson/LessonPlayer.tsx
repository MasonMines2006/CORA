import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { HiOutlineArrowLeft, HiOutlineChatBubbleOvalLeft } from 'react-icons/hi2';
import { ModeActions } from '../shell/types';
import FocusLayout from '../shell/FocusLayout';
import Button from '../ui-kit/Button';
import SegmentBar from '../ui-kit/SegmentBar';
import AskRail from './AskRail';
import { beatLabel, stepQuestions } from './lessonModel';
import { LessonFailed, LessonSkeleton } from './LessonStates';
import QuickCheck from './QuickCheck';
import { useLesson } from './useLesson';

interface LessonPlayerProps {
  conceptId: string;
  initialBeat?: number;
  onClose: () => void;
  onAsk: ModeActions['onAsk'];
  onQuiz: ModeActions['onQuiz'];
  onLoaded: (conceptName: string) => void;
  onSignIn: () => void;
}

/** Guided learning in focus mode: one concept, four short steps (DESIGN.md 5.5). */
const LessonPlayer = ({ conceptId, initialBeat, onClose, onAsk, onQuiz, onLoaded, onSignIn }: LessonPlayerProps) => {
  const { load, lesson, step, setStep, retry } = useLesson(conceptId, initialBeat);
  const askAbout = (question: string) => onAsk(question, conceptId);
  const conceptName = lesson?.concept.name ?? '';

  useEffect(() => {
    if (conceptName) {
      onLoaded(conceptName);
    }
    // Report once per concept. `onLoaded` is a new function every render, so it is left out on purpose.
  }, [conceptName]);

  // Each step starts at the top of the page.
  useEffect(() => {
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0 });
    }
  }, [step]);

  const beat = lesson?.beats[step];
  const lastStep = lesson ? lesson.beats.length - 1 : 0;
  const footer = lesson && (
    <div className='mx-auto flex max-w-[680px] items-center gap-3 px-4 py-4 xl:max-w-[1240px] xl:px-6'>
      <Button variant='secondary' size='lg' disabled={step === 0} onClick={() => setStep(step - 1)} aria-label='Back'>
        <HiOutlineArrowLeft aria-hidden='true' />
        <span className='hidden sm:inline'>Back</span>
      </Button>
      <Button
        variant='ghost'
        size='lg'
        className='xl:hidden'
        onClick={() => askAbout(`Help me with ${conceptName}.`)}
        aria-label='Ask about this step'
      >
        <HiOutlineChatBubbleOvalLeft aria-hidden='true' />
        <span className='hidden sm:inline'>Ask</span>
      </Button>
      <span className='flex-1' />
      {step < lastStep ? (
        <Button size='lg' className='min-w-[160px] sm:min-w-[220px]' onClick={() => setStep(step + 1)}>
          Continue
        </Button>
      ) : (
        <Button size='lg' className='min-w-[160px] sm:min-w-[220px]' onClick={() => onQuiz(conceptId)}>
          Quiz me on it
        </Button>
      )}
    </div>
  );

  return (
    <FocusLayout
      closeLabel='Leave lesson and return to your path'
      onClose={onClose}
      skipLabel='Skip to lesson'
      header={
        lesson ? (
          <>
            <div className='flex items-center justify-between gap-3'>
              <p className='truncate text-[14px] font-semibold'>
                {conceptName} <span className='font-normal text-slate-500'>· Guided</span>
              </p>
              <p className='tabular flex-none text-[13px] text-slate-500'>
                Step {step + 1} of {lesson.beats.length}
              </p>
            </div>
            <SegmentBar count={lesson.beats.length} current={step} label='Lesson progress' className='mt-2' />
          </>
        ) : (
          <p className='text-[14px] font-semibold'>Guided lesson</p>
        )
      }
      headerEnd={
        lesson && (
          <Button
            variant='secondary'
            size='sm'
            className='hidden md:inline-flex'
            onClick={() => askAbout(`Explain ${conceptName} using the course material.`)}
          >
            <HiOutlineChatBubbleOvalLeft aria-hidden='true' />
            Switch to Ask
          </Button>
        )
      }
      footer={footer}
    >
      <div className='mx-auto flex max-w-[1240px] gap-10 px-4 sm:px-6'>
        <main id='main' className='mx-auto w-full max-w-[680px] pb-40 pt-8 sm:pt-12'>
          {load.status === 'loading' && <LessonSkeleton />}
          {load.status === 'failed' && (
            <LessonFailed
              reason={load.reason}
              onRetry={retry}
              onAsk={() => askAbout('Help me understand this concept using the course material.')}
              onSignIn={onSignIn}
            />
          )}
          {lesson && beat && (
            <article key={beat.key} className='enter'>
              <p className='eyebrow'>
                Step {step + 1} · {beatLabel(beat.key)}
              </p>
              <h1 className='mt-2 font-display text-[30px] font-bold leading-[1.12] tracking-tight sm:text-[38px]'>
                {beat.title}
              </h1>
              {beat.key === 'quick_check' ? (
                <QuickCheck check={lesson.quick_check} />
              ) : (
                <div className='prose-cora mt-6'>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{beat.content}</ReactMarkdown>
                </div>
              )}
              {lesson.sources.length > 0 && (
                <figure className='mt-8'>
                  <figcaption className='text-[12px] font-semibold uppercase tracking-wider text-slate-500'>
                    Written from
                  </figcaption>
                  <ul className='mt-2 flex flex-wrap gap-2'>
                    {lesson.sources.map((source) => (
                      <li
                        key={source}
                        className='rounded-[8px] border border-red-100 bg-red-50 px-2 py-1 font-code text-[12px] text-red-700'
                      >
                        {source}
                      </li>
                    ))}
                  </ul>
                </figure>
              )}
            </article>
          )}
        </main>
        {lesson && beat && (
          <AskRail conceptName={conceptName} questions={stepQuestions(conceptName, beat.title)} onAsk={askAbout} />
        )}
      </div>
    </FocusLayout>
  );
};

export default LessonPlayer;
