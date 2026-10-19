import { unitTitle } from '../path/pathModel';

interface SourceCardsProps {
  sources: string[];
  /** Index of the source open in the drawer, if any. */
  openIndex?: number;
  onOpen: (index: number) => void;
}

/** "Every answer has a receipt": one card per published document the answer drew on. */
const SourceCards = ({ sources, openIndex, onOpen }: SourceCardsProps) => (
  <ul className='mt-4 grid gap-2 sm:grid-cols-3' aria-label='Sources for this answer'>
    {sources.map((source, index) => {
      const isOpen = index === openIndex;
      return (
        <li key={source}>
          <button
            type='button'
            onClick={() => onOpen(index)}
            aria-expanded={isOpen}
            className={`h-full w-full rounded-[12px] p-3 text-left ${
              isOpen ? 'border-2 border-red-600 bg-red-50' : 'border border-slate-200 hover:border-red-200'
            }`}
          >
            <span className='font-code text-[11px] text-red-700'>[{index + 1}] Source</span>
            <span className='mt-1 block text-[13px] font-medium leading-snug'>{unitTitle(source)}</span>
            <span className='block truncate font-code text-[11.5px] text-slate-500'>{source}</span>
          </button>
        </li>
      );
    })}
  </ul>
);

export default SourceCards;
