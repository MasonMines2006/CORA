import { useEffect, useRef, useState } from 'react';
import { HiOutlineXMark } from 'react-icons/hi2';
import { getLearningSources, LearningSourcePassage } from '../../API/Index';
import { unitTitle } from '../path/pathModel';
import { useDialogFocus } from '../shell/useDialogFocus';
import CitationChip from '../ui-kit/CitationChip';
import Skeleton from '../ui-kit/Skeleton';

interface SourceDrawerProps {
  sources: string[];
  index: number;
  passageCount: number;
  /** When Ask is about one concept we can show that concept's published passages from this document. */
  concept?: { id: string; name: string };
  onSelect: (index: number) => void;
  onClose: () => void;
}

type PassageState = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; passages: LearningSourcePassage[] };

/** Loads the concept's passages once per concept, for the passage quote. */
const useConceptPassages = (conceptId?: string): PassageState => {
  const [state, setState] = useState<PassageState>({ status: 'idle' });
  useEffect(() => {
    if (!conceptId) {
      setState({ status: 'idle' });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    getLearningSources(conceptId, controller.signal)
      .then((data) => setState({ status: 'ready', passages: data.passages }))
      .catch(() => !controller.signal.aborted && setState({ status: 'error' }));
    return () => controller.abort();
  }, [conceptId]);
  return state;
};

const PassageQuote = ({
  state,
  source,
  concept,
}: {
  state: PassageState;
  source: string;
  concept?: SourceDrawerProps['concept'];
}) => {
  if (state.status === 'loading') {
    return <Skeleton className='mt-4 h-24 w-full' />;
  }
  const passage = state.status === 'ready' ? state.passages.find((item) => item.source === source) : undefined;
  if (passage && concept) {
    return (
      <>
        <blockquote className='passage mt-4 max-h-[260px] overflow-y-auto'>{passage.text}</blockquote>
        <p className='mt-2 text-[12.5px] text-slate-500'>
          A published passage about {concept.name} from this document.
        </p>
      </>
    );
  }
  return (
    <p className='mt-4 rounded-[12px] bg-slate-50 p-3 text-[13px] text-slate-700'>
      The exact passage text isn&apos;t available in Ask yet. The document above is published course material that CORA
      retrieved for this answer.
    </p>
  );
};

/**
 * The receipt, opened: a side panel on desktop, a bottom sheet on phones (DESIGN.md 5.4).
 * Focus moves to the close button, Escape closes, focus returns to the chip or card.
 */
const SourceDrawer = ({ sources, index, passageCount, concept, onSelect, onClose }: SourceDrawerProps) => {
  const closeButton = useRef<HTMLButtonElement>(null);
  useDialogFocus(true, onClose, closeButton);
  const passages = useConceptPassages(concept?.id);
  const source = sources[index];
  return (
    <aside
      aria-labelledby='source-h'
      className='fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-[24px] border-t border-red-100 bg-white p-5 shadow-[0_-12px_40px_-12px_rgba(15,23,42,.25)] lg:static lg:z-auto lg:max-h-none lg:w-[380px] lg:flex-none lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none'
    >
      <div className='mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 lg:hidden' aria-hidden='true' />
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className='font-code text-[12px] text-red-700'>[{index + 1}] Source</p>
          <h2 id='source-h' className='mt-1 font-display text-[19px] font-bold leading-snug'>
            {unitTitle(source)}
          </h2>
        </div>
        <button
          ref={closeButton}
          type='button'
          onClick={onClose}
          className='grid h-10 w-10 flex-none place-items-center rounded-[8px] text-slate-500 hover:bg-slate-100'
          aria-label='Close sources'
        >
          <HiOutlineXMark className='h-6 w-6' aria-hidden='true' />
        </button>
      </div>
      <dl className='mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]'>
        <dt className='text-slate-500'>File</dt>
        <dd className='break-all font-code text-[12.5px]'>{source}</dd>
        <dt className='text-slate-500'>Status</dt>
        <dd>Published course material</dd>
        <dt className='text-slate-500'>Retrieved</dt>
        <dd className='tabular'>
          {passageCount} passage{passageCount === 1 ? '' : 's'} across {sources.length} document
          {sources.length === 1 ? '' : 's'}
        </dd>
      </dl>
      <PassageQuote state={passages} source={source} concept={concept} />
      <hr className='my-5 border-slate-100' />
      <h3 className='text-[12px] font-semibold uppercase tracking-wider text-slate-500'>All sources in this answer</h3>
      <ul className='mt-2 space-y-1 text-[13.5px]'>
        {sources.map((item, itemIndex) => (
          <li
            key={item}
            className={`flex items-start gap-2 rounded-[8px] p-2 ${itemIndex === index ? 'bg-red-50' : ''}`}
          >
            <CitationChip
              label={String(itemIndex + 1)}
              description={`Source ${itemIndex + 1}: ${item}`}
              expanded={itemIndex === index}
              onClick={() => onSelect(itemIndex)}
            />
            <span className='min-w-0 break-words'>{unitTitle(item)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default SourceDrawer;
