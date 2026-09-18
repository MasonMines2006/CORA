import { HiOutlineMagnifyingGlass } from 'react-icons/hi2';
import { LearningNetworkNode } from '../../API/Index';
import { documentCounts, NOISE_TYPES, typeCounts } from './exploreModel';

/*
 * The course map's left rail: search, entity-type filters, source-document
 * filters. Implements docs/artboards/source/Explore.dc.html.
 *
 * Inline styles on <input> and <button> are not a style choice -- @neo4j-ndl/base
 * resets padding, border, background and colour on those elements from an
 * unlayered stylesheet that outranks every Tailwind utility. See CLAUDE.md.
 */

const TOKEN = {
  border: '#e7e5e4',
  text: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  red: '#dc2626',
} as const;

const searchStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  border: `1px solid ${TOKEN.border}`,
  borderRadius: '0.75rem',
  backgroundColor: '#ffffff',
  color: TOKEN.text,
  padding: '0.5rem 0.75rem 0.5rem 2.25rem',
  fontSize: '0.875rem',
  outline: 'none',
};

const rowStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  minHeight: '2rem',
  padding: '0.25rem 0',
  border: 0,
  backgroundColor: 'transparent',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
};

/** A checkbox drawn as a span, because an <input type=checkbox> is reset too. */
const Tick = ({ on }: { on: boolean }) => (
  <span
    aria-hidden='true'
    style={{
      boxSizing: 'border-box',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '15px',
      height: '15px',
      flexShrink: 0,
      borderRadius: '4px',
      border: `1px solid ${on ? TOKEN.red : '#cbd5e1'}`,
      backgroundColor: on ? TOKEN.red : '#ffffff',
      color: '#ffffff',
      fontSize: '10px',
      lineHeight: 1,
    }}
  >
    {on ? '✓' : ''}
  </span>
);

interface ExploreFiltersProps {
  nodes: LearningNetworkNode[];
  query: string;
  onQueryChange: (value: string) => void;
  hiddenTypes: ReadonlySet<string>;
  onToggleType: (type: string) => void;
  hiddenDocuments: ReadonlySet<string>;
  onToggleDocument: (document: string) => void;
}

/** Trim the ingestion filename down to something a student recognises. */
const shortDocument = (filename: string) =>
  filename
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();

const ExploreFilters: React.FC<ExploreFiltersProps> = ({
  nodes,
  query,
  onQueryChange,
  hiddenTypes,
  onToggleType,
  hiddenDocuments,
  onToggleDocument,
}) => {
  const types = typeCounts(nodes);
  const documents = documentCounts(nodes);
  const hasNoiseType = types.some((entry) => (NOISE_TYPES as readonly string[]).includes(entry.type));

  return (
    <div className='flex w-full flex-col gap-6 lg:w-[232px] lg:shrink-0'>
      <div className='relative'>
        <HiOutlineMagnifyingGlass className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
        <input
          type='search'
          aria-label='Search concepts'
          placeholder='Search concepts or types'
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          style={searchStyle}
        />
      </div>

      <div>
        <p className='mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-slate-500'>Concept type</p>
        <div className='max-h-56 overflow-y-auto pr-1'>
          {types.map(({ type, count }) => {
            const on = !hiddenTypes.has(type);
            return (
              <button
                key={type}
                type='button'
                role='checkbox'
                aria-checked={on}
                aria-label={type}
                onClick={() => onToggleType(type)}
                style={rowStyle}
              >
                <Tick on={on} />
                <span className='min-w-0 flex-1 truncate text-[13px]' style={{ color: on ? TOKEN.text : TOKEN.faint }}>
                  {type}
                </span>
                <span className='text-[11px] tabular-nums' style={{ color: TOKEN.faint }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {hasNoiseType && (
          // Stated on screen rather than filtered away silently, so a student who
          // wonders where "Document" went can switch it back on.
          <p className='mt-2 text-[11px] leading-relaxed' style={{ color: TOKEN.faint }}>
            Institution and Document are extraction noise. Off by default.
          </p>
        )}
      </div>

      <div>
        <p className='mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-slate-500'>Source document</p>
        <div className='max-h-56 overflow-y-auto pr-1'>
          {documents.map(({ document, count }) => {
            const on = !hiddenDocuments.has(document);
            return (
              <button
                key={document}
                type='button'
                role='checkbox'
                aria-checked={on}
                aria-label={shortDocument(document)}
                onClick={() => onToggleDocument(document)}
                style={rowStyle}
              >
                <Tick on={on} />
                <span
                  className='min-w-0 flex-1 truncate text-[13px]'
                  style={{ color: on ? TOKEN.text : TOKEN.faint }}
                  title={document}
                >
                  {shortDocument(document)}
                </span>
                <span className='text-[11px] tabular-nums' style={{ color: TOKEN.faint }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExploreFilters;
