import { HiOutlineBookOpen } from 'react-icons/hi2';
import { LoadFailure } from '../Student/loadError';
import { SignedOut } from '../quiz/QuizStates';
import Button from '../ui-kit/Button';
import EmptyState from '../ui-kit/EmptyState';
import InlineError from '../ui-kit/InlineError';
import Skeleton from '../ui-kit/Skeleton';

/** Loading: heading, three lines and a formula-sized block, so nothing jumps when it lands. */
export const LessonSkeleton = () => (
  <div className='space-y-3' aria-busy='true' aria-label='Writing this lesson'>
    <Skeleton className='h-3 w-28' />
    <Skeleton className='mt-3 h-9 w-11/12' />
    <div className='space-y-2 pt-4'>
      <Skeleton className='h-4 w-full' />
      <Skeleton className='h-4 w-full' />
      <Skeleton className='h-4 w-4/5' />
    </div>
    <Skeleton className='mt-6 h-24 w-full rounded-[16px]' />
    <p className='pt-2 text-[14px] text-slate-500'>Writing this lesson from the published passages…</p>
  </div>
);

interface LessonFailedProps {
  reason: LoadFailure;
  onRetry: () => void;
  onAsk: () => void;
  onSignIn: () => void;
}

export const LessonFailed = ({ reason, onRetry, onAsk, onSignIn }: LessonFailedProps) => {
  const askInstead = (
    <Button variant='secondary' size='sm' onClick={onAsk}>
      Ask instead
    </Button>
  );
  if (reason === 'notEnoughMaterial') {
    return (
      <EmptyState
        icon={<HiOutlineBookOpen className='h-6 w-6' />}
        tone='amber'
        title='Too few published passages for a lesson'
        actions={askInstead}
      >
        CORA builds lessons only from published material, and this concept doesn&apos;t have enough yet.
      </EmptyState>
    );
  }
  if (reason === 'signedOut') {
    return <SignedOut detail='Sign in again to open this lesson.' onSignIn={onSignIn} />;
  }
  return (
    <InlineError
      title={
        reason === 'notFound' ? 'This concept is no longer in the published material' : "Couldn't build this lesson"
      }
      onRetry={reason === 'notFound' ? undefined : onRetry}
      actions={askInstead}
    />
  );
};
