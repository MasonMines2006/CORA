import { HiOutlineBolt, HiOutlineBookOpen } from 'react-icons/hi2';
import { ModeActions } from '../shell/types';
import Button from '../ui-kit/Button';

interface ModeHandoffProps {
  concept: { id: string; name: string };
  onGuide: ModeActions['onGuide'];
  onQuiz: ModeActions['onQuiz'];
}

/** After an answer: keep going on the same concept another way (DESIGN.md principle 2). */
const ModeHandoff = ({ concept, onGuide, onQuiz }: ModeHandoffProps) => (
  <div className='mt-5 rounded-[16px] border border-red-100 bg-red-50 p-4'>
    <p className='text-[13.5px] font-semibold'>
      Keep going on <span className='text-red-700'>{concept.name}</span>
    </p>
    <div className='mt-3 flex flex-wrap gap-2'>
      <Button variant='secondary' size='sm' onClick={() => onQuiz(concept.id)}>
        <HiOutlineBolt aria-hidden='true' />
        Quiz me on it
      </Button>
      <Button variant='secondary' size='sm' onClick={() => onGuide(concept.id)}>
        <HiOutlineBookOpen aria-hidden='true' />
        Guide me through it
      </Button>
    </div>
  </div>
);

export default ModeHandoff;
