import { HiCheck, HiOutlineBookOpen } from 'react-icons/hi2';
import { conceptAbbreviation, NodeState, PathConcept } from './pathModel';
import { masteryLine, nodeLabel, STATE_TEXT } from './conceptText';
import { masteryState } from '../Student/learningState';

const NODE_CLASS: Record<NodeState, string> = {
  mastered: 'node-mastered',
  inProgress: 'node-progress',
  current: 'node-current',
  notStarted: 'node-new',
};

const NodeIcon = ({ item }: { item: PathConcept }) => {
  if (item.nodeState === 'mastered') {
    return <HiCheck aria-hidden='true' />;
  }
  if (item.nodeState === 'notStarted') {
    return (
      <span className='font-code text-[13px] font-semibold' aria-hidden='true'>
        {conceptAbbreviation(item.concept.name)}
      </span>
    );
  }
  return <HiOutlineBookOpen aria-hidden='true' />;
};

interface ConceptNodeProps {
  item: PathConcept;
  isOpen: boolean;
  popoverId: string;
  onToggle: () => void;
}

/** A 64px tactile circle on the path, with the concept's name beside it (technical names need reading). */
const ConceptNode = ({ item, isOpen, popoverId, onToggle }: ConceptNodeProps) => {
  const state = masteryState(item.mastery);
  return (
    <div className='flex items-center gap-4'>
      <button
        type='button'
        className={`node ${NODE_CLASS[item.nodeState]}`}
        aria-label={nodeLabel(item.concept.name, item.mastery, item.nodeState === 'current')}
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        onClick={onToggle}
      >
        <NodeIcon item={item} />
      </button>
      {/* On wider screens the open popover repeats the name, so the label steps aside. */}
      <div className={isOpen ? 'sm:hidden' : ''} aria-hidden='true'>
        <p className='font-semibold'>{item.concept.name}</p>
        <p className={`tabular text-[13px] ${STATE_TEXT[state]}`}>{masteryLine(item.mastery)}</p>
      </div>
    </div>
  );
};

export default ConceptNode;
