import { HiCheck, HiOutlineArrowRight, HiXMark } from 'react-icons/hi2';

interface FeedbackSheetProps {
  isCorrect: boolean;
  correctText: string;
  explanation: string;
  onAskWhy: () => void;
}

/**
 * The quiz footer after checking: emerald when right, red-50 when not, always
 * with an icon and words (DESIGN.md 5.6). The parent recolours the footer bar.
 */
const FeedbackSheet = ({ isCorrect, correctText, explanation, onAskWhy }: FeedbackSheetProps) => (
  <div className='enter flex gap-3 pb-4' aria-live='polite'>
    <span
      className={`grid h-10 w-10 flex-none place-items-center rounded-full text-white ${
        isCorrect ? 'bg-emerald-600' : 'bg-red-600'
      }`}
      aria-hidden='true'
    >
      {isCorrect ? <HiCheck className='h-6 w-6' /> : <HiXMark className='h-6 w-6' />}
    </span>
    <div className='min-w-0'>
      <p className={`font-display text-[20px] font-bold ${isCorrect ? 'text-emerald-800' : 'text-red-700'}`}>
        {isCorrect ? 'Correct.' : `Not quite. It is “${correctText}”.`}
      </p>
      {explanation && <p className='mt-1 text-[14.5px] leading-relaxed text-slate-700'>{explanation}</p>}
      <button
        type='button'
        onClick={onAskWhy}
        className={`mt-2 inline-flex min-h-[32px] items-center gap-1 text-[14px] font-semibold hover:underline ${
          isCorrect ? 'text-emerald-800' : 'text-red-700'
        }`}
      >
        Ask why <HiOutlineArrowRight className='h-4 w-4' aria-hidden='true' />
      </button>
    </div>
  </div>
);

export default FeedbackSheet;
