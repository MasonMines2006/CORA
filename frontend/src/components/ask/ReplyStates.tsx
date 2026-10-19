import { HiOutlineArrowPath, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { ChatFailure } from './askModel';
import Badge from '../ui-kit/Badge';
import Button from '../ui-kit/Button';

interface FailedReplyProps {
  reason: ChatFailure;
  message: string;
  onRetry: () => void;
  onReview: () => void;
  onSignIn: () => void;
}

/** What to show when no answer came back (states.html #4 and #7, plus guest AI being off). */
export const FailedReply = ({ reason, message, onRetry, onReview, onSignIn }: FailedReplyProps) => {
  if (reason === 'rateLimited') {
    return (
      <div className='rounded-[12px] bg-amber-50 p-4' role='alert'>
        <p className='font-semibold text-amber-700'>You&apos;ve reached this hour&apos;s question limit</p>
        <p className='mt-1 text-[14px] text-slate-700'>{message} Lessons, quizzes and review cards still work.</p>
        <Button variant='secondary' size='sm' className='mt-3' onClick={onReview}>
          Review cards while you wait
        </Button>
      </div>
    );
  }
  if (reason === 'guestUnavailable') {
    return (
      <div className='rounded-[12px] border border-slate-200 p-4' role='alert'>
        <p className='font-semibold'>Ask isn&apos;t available to guests right now</p>
        <p className='mt-1 text-[14px] text-slate-700'>{message}</p>
        <Button size='sm' className='mt-3' onClick={onSignIn}>
          Sign in
        </Button>
      </div>
    );
  }
  return (
    <div className='rounded-[12px] border border-red-200 bg-red-50 p-4' role='alert'>
      <p className='flex items-center gap-2 text-[14px] font-semibold text-red-700'>
        <HiOutlineExclamationTriangle className='h-5 w-5' aria-hidden='true' />
        {message}
      </p>
      <Button size='sm' className='mt-3' onClick={onRetry}>
        <HiOutlineArrowPath aria-hidden='true' />
        Try again
      </Button>
    </div>
  );
};

interface NotInMaterialProps {
  text: string;
  suggestions: string[];
  onAsk: (question: string) => void;
}

/** "Not in the published material" is a first-class answer, never a guess (states.html #3). */
export const NotInMaterial = ({ text, suggestions, onAsk }: NotInMaterialProps) => (
  <div>
    <Badge tone='review'>No published source</Badge>
    <p className='mt-2 text-[15px] leading-relaxed text-slate-700'>{text}</p>
    <p className='mt-1 text-[14px] text-slate-500'>
      CORA only answers from your course&apos;s published material, so it won&apos;t guess.
    </p>
    {suggestions.length > 0 && (
      <div className='mt-3 flex flex-wrap gap-2'>
        {suggestions.map((question) => (
          <Button key={question} variant='secondary' size='sm' onClick={() => onAsk(question)}>
            {question}
          </Button>
        ))}
      </div>
    )}
  </div>
);
