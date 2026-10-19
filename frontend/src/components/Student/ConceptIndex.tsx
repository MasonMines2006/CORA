import { useEffect, useMemo, useState } from 'react';
import { HiOutlineMagnifyingGlass } from 'react-icons/hi2';
import { getLearningDashboard, LearningConceptProgress } from '../../API/Index';
import { MasteryState, STATE_STYLE, masteryLabel, masteryPercent, masteryState } from './learningState';

interface ConceptIndexProps {
  onOpenConcept: (conceptId: string) => void;
}

const STATES: MasteryState[] = ['mastered', 'inProgress', 'notStarted'];

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
  'CORA could not load the course concepts. Please try again.';

/**
 * The line under the heading. The list is the dashboard's top concepts, so when
 * the course has more, say so instead of implying the list is everything.
 */
const describeList = (listed: number, total: number) =>
  (total > listed
    ? `Showing the ${listed} most-connected of ${total.toLocaleString('en-US')} concepts. Open one to learn, practise or review it.`
    : `${listed} concepts from your course materials. Open one to learn, practise or review it.`);

/**
 * Every concept the course offers, with where the student stands on each.
 * The entry point to the concept pages; the list comes from the same dashboard
 * request as Home, so the two can never disagree about how many concepts exist.
 */
const ConceptIndex = ({ onOpenConcept }: ConceptIndexProps) => {
  const [items, setItems] = useState<LearningConceptProgress[] | null>(null);
  // How many concepts the whole course has. `items` is only the top of that list.
  const [courseTotal, setCourseTotal] = useState(0);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<MasteryState | 'all'>('all');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    getLearningDashboard(controller.signal)
      .then((dashboard) => {
        setItems(dashboard.concepts);
        setCourseTotal(dashboard.total_concepts);
      })
      .catch((requestError) => {
        if ((requestError as { name?: string }).name !== 'CanceledError') {
          setError(errorMessage(requestError));
        }
      });
    return () => controller.abort();
  }, [attempt]);

  const counts = useMemo(() => {
    const tally: Record<MasteryState, number> = { mastered: 0, inProgress: 0, notStarted: 0 };
    for (const item of items ?? []) {
      tally[masteryState(item.mastery)] += 1;
    }
    return tally;
  }, [items]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (items ?? []).filter(
      (item) =>
        (stateFilter === 'all' || masteryState(item.mastery) === stateFilter) &&
        (!needle || item.concept.name.toLowerCase().includes(needle))
    );
  }, [items, query, stateFilter]);

  return (
    <div className='mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12'>
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div>
          <h1 className='font-display text-3xl font-bold tracking-tight text-slate-900'>Concepts</h1>
          <p className='mt-1 text-sm text-slate-500'>{items ? describeList(items.length, courseTotal) : ' '}</p>
        </div>
        <label className='flex w-full items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2.5 sm:w-72'>
          <HiOutlineMagnifyingGlass className='h-4 w-4 shrink-0 text-slate-400' aria-hidden='true' />
          <span className='sr-only'>Search concepts</span>
          <input
            type='search'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Search concepts'
            className='min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400'
          />
        </label>
      </div>

      <div className='mt-5 flex flex-wrap gap-2' role='group' aria-label='Filter by progress'>
        {(['all', ...STATES] as const).map((key) => {
          const active = stateFilter === key;
          const label = key === 'all' ? 'All' : STATE_STYLE[key].label;
          const count = key === 'all' ? (items?.length ?? 0) : counts[key];
          return (
            <button
              key={key}
              type='button'
              aria-pressed={active}
              onClick={() => setStateFilter(key)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                active
                  ? 'border-slate-900 bg-slate-900 font-semibold text-white'
                  : 'border-stone-200 bg-white text-slate-600'
              }`}
            >
              {key !== 'all' && (
                <i
                  className='h-2 w-2 rounded-full'
                  style={{ backgroundColor: STATE_STYLE[key].color }}
                  aria-hidden='true'
                />
              )}
              {label} <span className={active ? 'text-slate-300' : 'text-slate-400'}>{count}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className='mt-8 rounded-2xl border border-red-200 bg-red-50 p-6'>
          <p className='text-sm text-slate-700'>{error}</p>
          <button
            type='button'
            onClick={() => setAttempt((count) => count + 1)}
            className='mt-3 text-sm font-semibold text-red-600 hover:text-red-700'
          >
            Try again
          </button>
        </div>
      )}

      {!items && !error && (
        <div className='mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 9 }, (_, index) => (
            <div key={index} className='h-28 animate-pulse rounded-2xl border border-stone-200 bg-white' />
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <p className='mt-8 rounded-2xl border border-stone-200 bg-white p-6 text-sm text-slate-500'>
          No concepts yet. They appear once course materials have been ingested into the graph.
        </p>
      )}

      {items && items.length > 0 && visible.length === 0 && (
        <p className='mt-8 text-sm text-slate-500'>No concept matches that search and filter.</p>
      )}

      <ul className='mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {visible.map(({ concept, mastery }) => {
          const state = masteryState(mastery);
          const style = STATE_STYLE[state];
          return (
            <li key={concept.id}>
              <button
                type='button'
                onClick={() => onOpenConcept(concept.id)}
                className='h-full w-full rounded-2xl border border-stone-200 bg-white p-5 text-left transition-colors hover:border-stone-300'
              >
                <span className='flex items-baseline justify-between gap-3'>
                  <span className='truncate text-[15px] font-semibold text-slate-900'>{concept.name}</span>
                  <span className='shrink-0 font-display text-lg font-bold' style={{ color: style.color }}>
                    {masteryLabel(mastery)}
                  </span>
                </span>
                <span className='mt-3 block h-1 overflow-hidden rounded-full bg-stone-100' aria-hidden='true'>
                  <span
                    className='block h-full rounded-full'
                    style={{ width: `${masteryPercent(mastery)}%`, backgroundColor: style.color }}
                  />
                </span>
                <span className='mt-3 block text-xs text-slate-500'>
                  {concept.document_count} source{concept.document_count === 1 ? '' : 's'} · {concept.chunk_count}{' '}
                  passage
                  {concept.chunk_count === 1 ? '' : 's'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ConceptIndex;
