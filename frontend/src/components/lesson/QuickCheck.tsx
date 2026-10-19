import { useState } from 'react';
import { QuickCheck as QuickCheckData } from '../../API/Index';
import OptionKey, { OptionLook } from '../quiz/OptionKey';
import Button from '../ui-kit/Button';

/**
 * "Before you continue": a predict-then-reveal question inside the lesson.
 * It is a learning prompt, not a test, so it does not change mastery.
 */
const QuickCheck = ({ check }: { check: QuickCheckData }) => {
  const [choice, setChoice] = useState<number | null>(null);
  const [isRevealed, setRevealed] = useState(false);
  const isCorrect = choice === check.answer_index;
  const lookFor = (index: number): OptionLook => {
    if (!isRevealed) {
      return 'idle';
    }
    if (index === check.answer_index) {
      return 'correct';
    }
    return index === choice ? 'wrong' : 'idle';
  };
  return (
    <section className='mt-6 rounded-[16px] border-2 border-amber-300 bg-amber-50 p-5' aria-labelledby='check-h'>
      <p id='check-h' className='text-[13px] font-semibold uppercase tracking-wider text-amber-700'>
        Before you continue
      </p>
      <p id='check-q' className='mt-1 font-semibold'>
        {check.question}
      </p>
      <div className='mt-3 space-y-2' role='radiogroup' aria-labelledby='check-q'>
        {check.options.map((option, index) => (
          <OptionKey
            key={option}
            index={index}
            text={option}
            isSelected={choice === index}
            look={lookFor(index)}
            disabled={isRevealed}
            onSelect={() => setChoice(index)}
          />
        ))}
      </div>
      {isRevealed ? (
        <p className='mt-3 text-[14.5px] text-slate-700' aria-live='polite'>
          <strong className={isCorrect ? 'text-emerald-700' : 'text-red-700'}>
            {isCorrect ? 'Correct.' : 'Not quite.'}
          </strong>{' '}
          {check.explanation}
        </p>
      ) : (
        <Button
          variant='secondary'
          size='sm'
          className='mt-3'
          disabled={choice === null}
          onClick={() => setRevealed(true)}
        >
          Check
        </Button>
      )}
    </section>
  );
};

export default QuickCheck;
