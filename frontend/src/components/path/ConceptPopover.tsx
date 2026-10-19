import { useRef } from 'react';
import { HiOutlineBolt, HiOutlineBookOpen, HiOutlineChatBubbleOvalLeft } from 'react-icons/hi2';
import { LearningConceptProgress } from '../../API/Index';
import { masteryState } from '../Student/learningState';
import { ModeActions } from '../shell/types';
import { useDialogFocus } from '../shell/useDialogFocus';
import Button from '../ui-kit/Button';
import { masteryLine, STATE_TEXT } from './conceptText';

interface ConceptPopoverProps extends ModeActions {
  id: string;
  item: LearningConceptProgress;
  onClose: () => void;
}

/** One concept, three ways in: the popover a path node opens (DESIGN.md 5.3). */
const ConceptPopover = ({ id, item, onClose, onGuide, onAsk, onQuiz }: ConceptPopoverProps) => {
  const firstButton = useRef<HTMLButtonElement>(null);
  useDialogFocus(true, onClose, firstButton);
  const { concept, mastery } = item;
  const state = masteryState(mastery);
  const difficulty = state === 'notStarted' ? 'easy questions first' : `${mastery.difficulty} questions next`;

  // Stack the icon over the label. Utilities beat `.btn` because `.btn` sits in @layer components.
  const modeButton = 'flex-col gap-1 py-2.5';
  return (
    <div
      id={id}
      role='group'
      aria-label={`${concept.name}: choose how to learn it`}
      className='enter w-full max-w-[340px] rounded-[16px] border-2 border-red-100 bg-white p-4 shadow-float'
    >
      <p className='font-display text-[17px] font-bold'>{concept.name}</p>
      <p className={`text-[13px] ${STATE_TEXT[state]}`}>
        <span className='tabular'>{masteryLine(mastery)}</span> · {difficulty}
      </p>
      <div className='mt-3 grid grid-cols-3 gap-2'>
        <Button ref={firstButton} size='sm' className={modeButton} onClick={() => onGuide(concept.id)}>
          <HiOutlineBookOpen aria-hidden='true' />
          Guide me
        </Button>
        <Button
          variant='secondary'
          size='sm'
          className={modeButton}
          onClick={() => onAsk(`Explain ${concept.name} using the course material.`, concept.id)}
        >
          <HiOutlineChatBubbleOvalLeft aria-hidden='true' />
          Ask
        </Button>
        <Button variant='secondary' size='sm' className={modeButton} onClick={() => onQuiz(concept.id)}>
          <HiOutlineBolt aria-hidden='true' />
          Quiz me
        </Button>
      </div>
      <p className='mt-3 text-[12.5px] text-slate-500'>
        Built from <span className='tabular'>{concept.chunk_count}</span> published passage
        {concept.chunk_count === 1 ? '' : 's'} in <span className='tabular'>{concept.document_count}</span> document
        {concept.document_count === 1 ? '' : 's'}
      </p>
    </div>
  );
};

export default ConceptPopover;
