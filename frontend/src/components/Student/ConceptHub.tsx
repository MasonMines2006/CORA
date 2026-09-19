import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { HiOutlineChevronRight } from 'react-icons/hi2';
import { ConceptNeighbourhood, getConceptNeighbourhood, getLearningMastery, LearningMastery } from '../../API/Index';
import ConceptLesson from './ConceptLesson';
import ConceptNeighbourhoodGraph from './ConceptNeighbourhoodGraph';
import { AskAboutConcept, LinkedConcepts } from './ConceptHubRail';
import { HUB_MODES, HubMode, masteryDetail, provenanceLine } from './conceptHubModel';
import { STATE_STYLE, masteryPercent, masteryState } from './learningState';
import ReviewSession from './ReviewSession';
import StudentAssess from './StudentAssess';
import ConceptSources from './ConceptSources';

interface ConceptHubProps {
  conceptId: string;
  mode: HubMode;
  /** Lesson step to open on, when resuming. */
  initialBeat?: number;
  onModeChange: (mode: HubMode) => void;
  onOpenConcept: (conceptId: string) => void;
  onAllConcepts: () => void;
  onAsk: (prompt: string) => void;
}

/** How many neighbours to fetch: enough for the ring and the rail. */
const NEIGHBOUR_LIMIT = 8;

const errorMessage = (error: unknown) => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 404) {
    return 'This concept is not in the course graph. It may have been renamed when materials were re-ingested.';
  }
  return 'CORA could not load this concept. Please try again.';
};

/**
 * One concept as a page. Learn, Practice, Cards, Graph and Sources are modes on
 * it, so switching mode never loses your place — the header never moves.
 * Design: docs/artboards/source/Concept.dc.html; reasoning: docs/STUDENT_UI.md §1.
 */
const ConceptHub = ({
  conceptId,
  mode,
  initialBeat,
  onModeChange,
  onOpenConcept,
  onAllConcepts,
  onAsk,
}: ConceptHubProps) => {
  const [neighbourhood, setNeighbourhood] = useState<ConceptNeighbourhood | null>(null);
  const [mastery, setMastery] = useState<LearningMastery | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const tabRefs = useRef<Partial<Record<HubMode, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const controller = new AbortController();
    setNeighbourhood(null);
    setMastery(null);
    setError('');
    getConceptNeighbourhood(conceptId, NEIGHBOUR_LIMIT, controller.signal)
      .then(setNeighbourhood)
      .catch((requestError) => {
        if ((requestError as { name?: string }).name !== 'CanceledError') {
          setError(errorMessage(requestError));
        }
      });
    // Mastery is secondary: if it fails the header reads "not practised", which
    // is the same thing a brand-new student sees, and the page stays usable.
    getLearningMastery(conceptId, controller.signal)
      .then(setMastery)
      .catch(() => undefined);
    return () => controller.abort();
  }, [conceptId, attempt]);

  // Arrow keys move between tabs, as the WAI-ARIA tabs pattern expects.
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = HUB_MODES.findIndex((item) => item.key === mode);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) {
      return;
    }
    event.preventDefault();
    const next = HUB_MODES[(index + step + HUB_MODES.length) % HUB_MODES.length].key;
    onModeChange(next);
    tabRefs.current[next]?.focus();
  };

  if (error) {
    return (
      <div className='mx-auto max-w-xl px-6 py-16 text-center'>
        <p className='text-sm leading-relaxed text-slate-600'>{error}</p>
        <div className='mt-4 flex justify-center gap-3'>
          <button
            type='button'
            onClick={() => setAttempt((count) => count + 1)}
            className='rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700'
          >
            Try again
          </button>
          <button
            type='button'
            onClick={onAllConcepts}
            className='rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900'
          >
            All concepts
          </button>
        </div>
      </div>
    );
  }

  const concept = neighbourhood?.concept;
  const name = concept?.name ?? conceptId;
  const state = masteryState(mastery);
  const stateStyle = STATE_STYLE[state];

  return (
    <div>
      {/* ------------------------------- Header ------------------------------- */}
      <header className='border-b border-stone-200 bg-white'>
        <div className='mx-auto max-w-[1440px] px-5 pt-7 sm:px-8 lg:px-12'>
          <nav aria-label='Breadcrumb' className='flex items-center gap-1.5 text-[13px] text-slate-500'>
            <button type='button' onClick={onAllConcepts} className='hover:text-slate-900'>
              All concepts
            </button>
            <HiOutlineChevronRight className='h-3.5 w-3.5' aria-hidden='true' />
            <span className='text-slate-700'>{name}</span>
          </nav>

          <div className='mt-2 flex flex-wrap items-start justify-between gap-x-10 gap-y-4'>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-3'>
                <h1 className='font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-[34px]'>{name}</h1>
                <span
                  className='rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]'
                  style={{ backgroundColor: stateStyle.fill, color: stateStyle.text }}
                >
                  {stateStyle.label}
                </span>
              </div>
              <p className='mt-2 text-sm text-slate-500'>
                {concept ? provenanceLine(concept, neighbourhood.linked_count) : 'Reading the course graph…'}
              </p>
            </div>
            <div className='text-left sm:text-right'>
              <p className='text-[11px] font-bold uppercase tracking-[0.09em] text-slate-500'>Mastery</p>
              <p className='font-display text-3xl font-bold' style={{ color: stateStyle.color }}>
                {state === 'notStarted' ? '—' : `${masteryPercent(mastery)}%`}
              </p>
              <p className='text-sm text-slate-500'>{masteryDetail(mastery)}</p>
            </div>
          </div>

          <div role='tablist' aria-label='Study modes' className='mt-6 flex gap-0.5 overflow-x-auto'>
            {HUB_MODES.map((item) => {
              const active = item.key === mode;
              return (
                <button
                  key={item.key}
                  ref={(element) => {
                    tabRefs.current[item.key] = element;
                  }}
                  type='button'
                  role='tab'
                  id={`hub-tab-${item.key}`}
                  aria-selected={active}
                  aria-controls='hub-panel'
                  tabIndex={active ? 0 : -1}
                  onClick={() => onModeChange(item.key)}
                  onKeyDown={onTabKey}
                  className={`whitespace-nowrap rounded-t-[9px] border-b-2 px-5 py-3 text-[15px] ${
                    active
                      ? 'border-red-600 bg-[#f8f7f6] font-bold text-slate-900'
                      : 'border-transparent font-medium text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* -------------------------------- Body -------------------------------- */}
      <div className='mx-auto grid max-w-[1440px] gap-8 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-12'>
        <div id='hub-panel' role='tabpanel' aria-labelledby={`hub-tab-${mode}`} className='min-w-0'>
          {mode === 'learn' && (
            <ConceptLesson
              key={conceptId}
              conceptId={conceptId}
              initialBeat={initialBeat}
              onPractice={() => onModeChange('practice')}
              onReadSources={() => onModeChange('sources')}
              onAsk={onAsk}
            />
          )}
          {mode === 'practice' && (
            <StudentAssess key={conceptId} initialConceptId={conceptId} embedded onMasteryChange={setMastery} />
          )}
          {mode === 'cards' && (
            <ReviewSession
              key={conceptId}
              conceptId={conceptId}
              conceptName={name}
              onFindCards={() => onModeChange('learn')}
            />
          )}
          {mode === 'graph' &&
            (concept ? (
              <ConceptNeighbourhoodGraph
                concept={concept}
                mastery={mastery}
                neighbours={neighbourhood.neighbours}
                linkedCount={neighbourhood.linked_count}
                onOpenConcept={onOpenConcept}
              />
            ) : (
              <div className='h-96 animate-pulse rounded-2xl border border-stone-200 bg-white' />
            ))}
          {mode === 'sources' && <ConceptSources key={conceptId} conceptId={conceptId} conceptName={name} />}
        </div>

        <aside className='space-y-5' aria-label={`More about ${name}`}>
          <LinkedConcepts
            neighbours={neighbourhood?.neighbours ?? null}
            linkedCount={neighbourhood?.linked_count ?? 0}
            onOpenConcept={onOpenConcept}
            onShowGraph={() => onModeChange('graph')}
          />
          <AskAboutConcept conceptName={name} onAsk={onAsk} />
        </aside>
      </div>
    </div>
  );
};

export default ConceptHub;
