import { CSSProperties } from 'react';
import { ModeActions } from '../shell/types';
import ConceptNode from './ConceptNode';
import ConceptPopover from './ConceptPopover';
import { PathConcept } from './pathModel';

/* The zig-zag, in px: 0, 56, 96, 56, 0, 56, ... (DESIGN.md 5.3). */
const OFFSETS = [0, 56, 96, 56];

interface NodeListProps extends ModeActions {
  label: string;
  concepts: PathConcept[];
  /** Only one popover is open on the whole path; PathView owns which. */
  openId: string;
  onOpenChange: (conceptId: string) => void;
}

/** A unit's concepts as path nodes. Clicking a node opens its three-modes popover. */
const NodeList = ({ label, concepts, openId, onOpenChange, ...modes }: NodeListProps) => (
  <ol className='relative mt-6 space-y-5 pb-2' aria-label={label}>
    {concepts.map((item, index) => {
      const isOpen = item.concept.id === openId;
      const popoverId = `popover-${index}-${label.replace(/\W+/g, '-')}`;
      // `--o` is read by `.path-offset` in index.css; React needs the cast for custom properties.
      const style = { '--o': `${OFFSETS[index % OFFSETS.length]}px` } as CSSProperties;
      return (
        <li key={item.concept.id} className='path-offset flex flex-col gap-3 sm:flex-row sm:items-start' style={style}>
          <ConceptNode
            item={item}
            isOpen={isOpen}
            popoverId={popoverId}
            onToggle={() => onOpenChange(isOpen ? '' : item.concept.id)}
          />
          {isOpen && <ConceptPopover id={popoverId} item={item} onClose={() => onOpenChange('')} {...modes} />}
        </li>
      );
    })}
  </ol>
);

export default NodeList;
