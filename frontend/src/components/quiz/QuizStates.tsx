import { HiOutlineBolt, HiOutlineLockClosed } from 'react-icons/hi2';
import { LoadFailure } from '../Student/loadError';
import Button from '../ui-kit/Button';
import EmptyState from '../ui-kit/EmptyState';
import InlineError from '../ui-kit/InlineError';
import Skeleton from '../ui-kit/Skeleton';

/** Generating: the question and four options, as skeletons, so nothing jumps. */
export const QuizSkeleton = () => (
  <div className='space-y-3' aria-busy='true' aria-label='Writing your questions'>
    <Skeleton className='h-6 w-40' />
    <Skeleton className='mt-5 h-8 w-11/12' />
    <Skeleton className='h-8 w-3/4' />
    <div className='mt-7 space-y-3'>
      {[0, 1, 2, 3].map((key) => (
        <Skeleton key={key} className='h-[58px] w-full rounded-[14px]' />
      ))}
    </div>
    <p className='pt-2 text-[14px] text-slate-500'>Writing questions at your level from the published passages…</p>
  </div>
);

/** "You were signed out": answers so far are kept in memory (states.html #6). */
export const SignedOut = ({ detail, onSignIn }: { detail: string; onSignIn: () => void }) => (
  <div className='flex items-start gap-3 rounded-[12px] border border-slate-200 p-4' role='alert'>
    <span
      className='grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-slate-100 text-slate-700'
      aria-hidden='true'
    >
      <HiOutlineLockClosed className='h-5 w-5' />
    </span>
    <div>
      <h2 className='font-semibold'>You were signed out</h2>
      <p className='mt-1 text-[14px] text-slate-700'>{detail}</p>
      <Button size='sm' className='mt-3' onClick={onSignIn}>
        Sign in
      </Button>
    </div>
  </div>
);

interface LoadFailedProps {
  reason: LoadFailure;
  onRetry: () => void;
  onGuide: () => void;
  onAsk: () => void;
  onSignIn: () => void;
}

/** Couldn't make a quiz: say why and offer the other two ways in (states.html #5). */
export const QuizLoadFailed = ({ reason, onRetry, onGuide, onAsk, onSignIn }: LoadFailedProps) => {
  const otherModes = (
    <>
      <Button variant='secondary' size='sm' onClick={onGuide}>
        Guide me instead
      </Button>
      <Button variant='secondary' size='sm' onClick={onAsk}>
        Ask instead
      </Button>
    </>
  );
  if (reason === 'notEnoughMaterial') {
    return (
      <EmptyState
        icon={<HiOutlineBolt className='h-6 w-6' />}
        tone='amber'
        title='Not enough material for a quiz yet'
        actions={otherModes}
      >
        This concept doesn&apos;t have enough usable published passages for CORA to write fair questions.
      </EmptyState>
    );
  }
  if (reason === 'signedOut') {
    return <SignedOut detail='Sign in again to take this quiz.' onSignIn={onSignIn} />;
  }
  const title =
    reason === 'notFound' ? 'This concept is no longer in the published material' : "Couldn't write this quiz";
  return (
    <InlineError title={title} onRetry={reason === 'notFound' ? undefined : onRetry} actions={otherModes}>
      Nothing was saved or graded.
    </InlineError>
  );
};
