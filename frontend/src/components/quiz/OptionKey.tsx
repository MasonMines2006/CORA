export type OptionLook = 'idle' | 'correct' | 'wrong';

interface OptionKeyProps {
  index: number;
  text: string;
  isSelected: boolean;
  look: OptionLook;
  disabled: boolean;
  onSelect: () => void;
}

const LETTERS = 'ABCDEFGHI';

/**
 * One answer "key": letter tile + text, styled by `.option` in index.css.
 * It is a radio in a radiogroup, so screen readers say "B, −80 seconds, radio, checked".
 * Correct / wrong are shown with the letter tile fill AND the words in the
 * feedback sheet, never colour alone.
 */
const OptionKey = ({ index, text, isSelected, look, disabled, onSelect }: OptionKeyProps) => (
  <button
    type='button'
    role='radio'
    aria-checked={isSelected}
    disabled={disabled}
    onClick={onSelect}
    className={`option ${look === 'correct' ? 'is-correct' : ''} ${look === 'wrong' ? 'is-wrong' : ''}`}
  >
    <span className='letter' aria-hidden='true'>
      {LETTERS[index]}
    </span>
    <span>{text}</span>
    {look === 'correct' && <span className='sr-only'> (correct answer)</span>}
    {look === 'wrong' && <span className='sr-only'> (your answer, incorrect)</span>}
  </button>
);

export default OptionKey;
