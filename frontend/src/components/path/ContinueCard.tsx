import { HiOutlineBolt, HiOutlineChatBubbleOvalLeft } from 'react-icons/hi2';
import { LearningConceptProgress, LearningLastLesson } from '../../API/Index';
import { masteryLabel, masteryPercent, masteryState } from '../Student/learningState';
import { ModeActions } from '../shell/types';
import Button from '../ui-kit/Button';
import MasteryRing from '../ui-kit/MasteryRing';
import SegmentBar from '../ui-kit/SegmentBar';

interface ContinueCardProps extends ModeActions {
  /** The suggested concept, with mastery when the dashboard has it. */
  conceptId: string;
  conceptName: string;
  item?: LearningConceptProgress;
  /** Set when the learner has a lesson in progress for this concept. */
  lastLesson?: LearningLastLesson | null;
  /** Why the server suggests this concept, e.g. "Builds on Reactivity". */
  reason?: string;
}

/** "Pick up where you left off" with one big action, plus the other two ways in (DESIGN.md 5.3). */
const ContinueCard = ({ conceptId, conceptName, item, lastLesson, reason, onGuide, onAsk, onQuiz }: ContinueCardProps) => {
  const isResume = Boolean(lastLesson && lastLesson.concept_id === conceptId && lastLesson.beat_count > 0);
  const step = isResume && lastLesson ? Math.min(lastLesson.beat_index, lastLesson.beat_count - 1) : 0;
  const state = masteryState(item?.mastery);
  return (
    <section aria-labelledby='continue-h' className='mt-6 overflow-hidden rounded-[20px] border-2 border-red-100 bg-white'>
      <div className='flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6'>
        <div className='flex min-w-0 flex-1 items-center gap-4 sm:gap-5'>
          <MasteryRing percent={masteryPercent(item?.mastery)} state={state} label={masteryLabel(item?.mastery)} />
          <div className='min-w-0 flex-1'>
            <p className='eyebrow'>{isResume ? 'Pick up where you left off' : 'Suggested next'}</p>
            <h2 id='continue-h' className='mt-1 font-display text-[22px] font-bold tracking-tight sm:text-[24px]'>
              {conceptName}
            </h2>
            {isResume && lastLesson ? (
              <>
                <p className='mt-1 text-[14px] text-slate-500'>
                  Step <span className='tabular'>{step + 1}</span> of <span className='tabular'>{lastLesson.beat_count}</span>
                </p>
                <SegmentBar count={lastLesson.beat_count} current={step} className='mt-3 max-w-[220px]' />
              </>
            ) : (
              reason && <p className='mt-1 text-[14px] text-slate-500'>{reason}</p>
            )}
          </div>
        </div>
        <Button size='lg' className='w-full sm:w-auto' onClick={() => onGuide(conceptId, isResume ? step : undefined)}>
          {isResume ? 'Continue lesson' : 'Start lesson'}
        </Button>
      </div>
      <div className='flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-red-100 bg-red-50 px-5 py-3 text-[14px] sm:px-6'>
        <span className='text-slate-500'>Or learn it another way:</span>
        <button
          type='button'
          onClick={() => onAsk(`Explain ${conceptName} using the course material.`, conceptId)}
          className='inline-flex min-h-[32px] items-center gap-1.5 font-semibold text-red-700 hover:underline'
        >
          <HiOutlineChatBubbleOvalLeft className='h-4 w-4' aria-hidden='true' />
          Ask about {conceptName}
        </button>
        <button
          type='button'
          onClick={() => onQuiz(conceptId)}
          className='inline-flex min-h-[32px] items-center gap-1.5 font-semibold text-red-700 hover:underline'
        >
          <HiOutlineBolt className='h-4 w-4' aria-hidden='true' />
          Quiz me on it
        </button>
      </div>
    </section>
  );
};

export default ContinueCard;
