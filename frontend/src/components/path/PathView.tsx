import { useState } from 'react';
import { HiOutlineMap, HiOutlineShare } from 'react-icons/hi2';
import { LearningDashboard } from '../../API/Index';
import { ModeActions } from '../shell/types';
import EmptyState from '../ui-kit/EmptyState';
import InlineError from '../ui-kit/InlineError';
import Skeleton from '../ui-kit/Skeleton';
import ContinueCard from './ContinueCard';
import { buildPath, greetingFor, weakestConcept } from './pathModel';
import TodayRail from './TodayRail';
import UnitBand from './UnitBand';
import { Loadable } from './useDashboard';

interface PathViewProps extends ModeActions {
  dashboard: Loadable<LearningDashboard>;
  onRetry: () => void;
  userName?: string;
  onReview: () => void;
  onGraph: () => void;
}

/** Loading keeps the final layout's shape: continue card, then nodes (states.html #2). */
const PathSkeleton = () => (
  <div className='mt-6 space-y-4' aria-busy='true' aria-label='Loading your path'>
    <Skeleton className='h-[124px] w-full rounded-[20px]' />
    {[0, 56, 96].map((offset) => (
      <div key={offset} className='flex items-center gap-4' style={{ marginLeft: offset }}>
        <Skeleton className='h-16 w-16 rounded-full' />
        <div className='flex-1 space-y-2'>
          <Skeleton className='h-4 w-1/2' />
          <Skeleton className='h-3 w-1/4' />
        </div>
      </div>
    ))}
  </div>
);

const EmptyPath = () => (
  <div className='mt-6'>
    <EmptyState icon={<HiOutlineMap className='h-6 w-6' />} title='Your path is being built' boxed>
      <p>Your instructor hasn&apos;t published course material yet. Concepts appear here as soon as they do.</p>
      <p className='mt-3 text-[13px] text-slate-500'>
        Admin or TA?{' '}
        <a href='/admin' className='font-semibold text-red-700 underline'>
          Publish your first document
        </a>
      </p>
    </EmptyState>
  </div>
);

const PathBody = ({ data, ...props }: PathViewProps & { data: LearningDashboard }) => {
  const [openId, setOpenId] = useState('');
  const path = buildPath(data);
  if (path.units.length === 0) {
    return <EmptyPath />;
  }
  const currentItem = data.concepts.find((item) => item.concept.id === path.currentId);
  const lastLesson = data.last_lesson;
  // Resume wins even when that concept isn't in the dashboard's top concepts.
  const continueId = lastLesson?.concept_id || path.currentId;
  const continueName = lastLesson?.concept_name || currentItem?.concept.name || '';
  const continueItem = data.concepts.find((item) => item.concept.id === continueId);
  const isSample = data.course.concepts > data.concepts.length;
  return (
    <>
      {continueId && (
        <ContinueCard
          conceptId={continueId}
          conceptName={continueName}
          item={continueItem}
          lastLesson={lastLesson}
          reason={data.recommended?.concept.id === continueId ? data.recommended.reason : undefined}
          {...props}
        />
      )}
      {path.units.map((unit, index) => (
        <UnitBand key={unit.source ?? 'none'} unit={unit} number={index + 1} openId={openId} onOpenChange={setOpenId} {...props} />
      ))}
      {isSample && (
        <p className='mt-6 text-[13px] text-slate-500'>
          Showing the <span className='tabular'>{data.concepts.length}</span> most-connected of{' '}
          <span className='tabular'>{data.course.concepts}</span> published concepts.{' '}
          <button type='button' onClick={props.onGraph} className='font-semibold text-teal-700 hover:underline'>
            See them all in the course graph
          </button>
        </p>
      )}
    </>
  );
};

/** Home: "what do I do next?" and where you are in the course (DESIGN.md 5.3). */
const PathView = (props: PathViewProps) => {
  const { dashboard } = props;
  const data = dashboard.status === 'ready' ? dashboard.data : null;
  return (
    <div className='mx-auto flex max-w-[1120px] gap-10 px-4 pb-10 pt-6 sm:px-8 lg:pt-10'>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            {data && (
              <p className='text-[14px] text-slate-500'>
                <span className='tabular'>{data.course.documents}</span> published document
                {data.course.documents === 1 ? '' : 's'} · <span className='tabular'>{data.course.concepts}</span> concepts
              </p>
            )}
            <h1 className='mt-1 font-display text-[30px] font-bold leading-tight tracking-tight sm:text-[36px]'>
              {greetingFor(new Date(), props.userName)}
            </h1>
          </div>
          <button
            type='button'
            onClick={props.onGraph}
            className='hidden min-h-[44px] items-center gap-2 text-[14px] font-semibold text-teal-700 hover:underline sm:inline-flex'
          >
            <HiOutlineShare className='h-[18px] w-[18px]' aria-hidden='true' />
            See it as a graph
          </button>
        </div>
        {dashboard.status === 'loading' && <PathSkeleton />}
        {dashboard.status === 'error' && (
          <div className='mt-6'>
            <InlineError title="Couldn't load your path" onRetry={props.onRetry}>
              Your progress is safe. This is a problem reaching CORA, not with your account.
            </InlineError>
          </div>
        )}
        {data && <PathBody data={data} {...props} />}
      </div>
      {data && data.concepts.length > 0 && (
        <TodayRail
          dueCount={data.review?.due_count ?? 0}
          weakSpot={weakestConcept(data.concepts)}
          onReview={props.onReview}
          onQuiz={props.onQuiz}
          onAsk={props.onAsk}
        />
      )}
    </div>
  );
};

export default PathView;
