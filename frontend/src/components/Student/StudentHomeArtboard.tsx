import { useCallback, useEffect, useMemo, useState } from 'react';
import { HiOutlineArrowRight, HiOutlineBookOpen, HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';
import {
  ConceptSuggestion,
  getConceptSuggestions,
  getLearningDashboard,
  LearningDashboard,
  LearningMastery,
} from '../../API/Index';
import { masteryLabel, masteryPercent, masteryState, STATE_STYLE } from './learningState';

interface StudentHomeProps {
  /** `beat` resumes a lesson part-way through; omitted means "start at the top". */
  onOpenConcept: (conceptId: string, beat?: number) => void;
  onOpenExplore: () => void;
  onOpenReview: () => void;
  onAsk: (prompt: string) => void;
}

const COLORS = {
  border: '#e7e5e4',
  navy: '#0f172a',
} as const;

const buttonReset: React.CSSProperties = {
  boxSizing: 'border-box',
  border: 0,
  font: 'inherit',
  cursor: 'pointer',
};

/** The solid colour for a concept's state — emerald once mastered, never the graph's teal. */
const stateColor = (mastery: LearningMastery | null | undefined) => STATE_STYLE[masteryState(mastery)].color;

/**
 * "12 min ago" for the resume card. Rounded and coarse on purpose: this is
 * orientation, not a timestamp, and a learner does not care about seconds.
 */
const lastSeen = (isoTime: string): string => {
  const minutes = Math.round((Date.now() - new Date(isoTime).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** What the review card says, from the counts the dashboard actually reports. */
const reviewHeadline = (review: { due_count: number; new_count: number } | undefined): string => {
  if (review && review.due_count > 0) {
    return `${plural(review.due_count, 'card')} due for review`;
  }
  if (review && review.new_count > 0) {
    return `${plural(review.new_count, 'new card')} ready`;
  }
  return 'Nothing due right now';
};

const ProgressRing = ({ score, color, dark = false }: { score: number; color: string; dark?: boolean }) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <div className='relative h-[72px] w-[72px] shrink-0' aria-label={`${Math.round(score)}% mastery`}>
      <svg viewBox='0 0 72 72' className='h-full w-full -rotate-90' aria-hidden='true'>
        <circle cx='36' cy='36' r={radius} fill='none' stroke={dark ? '#1e293b' : '#f1f0ef'} strokeWidth='8' />
        <circle
          cx='36'
          cy='36'
          r={radius}
          fill='none'
          stroke={color}
          strokeWidth='8'
          strokeLinecap='round'
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className={`absolute inset-0 hidden items-center justify-center text-lg font-bold md:flex ${dark ? 'text-white' : 'text-slate-900'}`}
      >
        {Math.round(score)}%
      </span>
    </div>
  );
};

/** The four-segment bar under the resume card: how far through the lesson the learner is. */
const BeatBar = ({ beatIndex, beatCount }: { beatIndex: number; beatCount: number }) => (
  <div className='mt-3 flex gap-1.5' aria-hidden='true'>
    {Array.from({ length: beatCount }, (_, index) => (
      <span
        key={index}
        className='h-1 flex-1 rounded-full'
        style={{ backgroundColor: index <= beatIndex ? '#e52427' : '#e7e5e4' }}
      />
    ))}
  </div>
);

const StudentHome: React.FC<StudentHomeProps> = ({ onOpenConcept, onOpenExplore, onOpenReview, onAsk }) => {
  const [dashboard, setDashboard] = useState<LearningDashboard | null>(null);
  const [suggestions, setSuggestions] = useState<ConceptSuggestion[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setDashboard(await getLearningDashboard());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let live = true;
    // Suggestions are a sidebar nicety: if they fail, Home carries on without
    // them rather than showing an error for something nobody asked for.
    getConceptSuggestions(3)
      .then((items) => live && setSuggestions(items))
      .catch(() => live && setSuggestions([]));
    return () => {
      live = false;
    };
  }, []);

  const sourceCount = useMemo(
    () => new Set(dashboard?.concepts.flatMap(({ concept }) => concept.sources) ?? []).size,
    [dashboard]
  );
  const passageCount = useMemo(
    () => dashboard?.concepts.reduce((total, { concept }) => total + concept.chunk_count, 0) ?? 0,
    [dashboard]
  );

  const askCora = (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt) {
      return;
    }
    onAsk(prompt);
    setQuestion('');
  };

  if (loading) {
    return (
      <div
        className='mx-auto grid w-full max-w-[1536px] gap-10 px-5 py-9 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-12'
        aria-label='Loading progress'
      >
        <div className='space-y-6'>
          <div className='h-44 animate-pulse rounded-2xl bg-white' />
          <div className='h-24 animate-pulse rounded-2xl bg-white' />
        </div>
        <div className='hidden h-72 animate-pulse rounded-2xl bg-slate-900 lg:block' />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className='mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center'>
        <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600'>
          <HiOutlineBookOpen className='h-6 w-6' />
        </div>
        <h1 className='mt-4 text-xl font-bold text-slate-900'>We could not load your progress</h1>
        <p className='mt-2 text-sm leading-relaxed text-slate-500'>
          Your work is still saved. Check the connection and try again.
        </p>
        <button
          type='button'
          onClick={load}
          className='mt-5 rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white'
          style={{ ...buttonReset, backgroundColor: '#dc2626', color: '#ffffff', padding: '0.625rem 1.5rem' }}
        >
          Try again
        </button>
      </div>
    );
  }

  const recommendation = dashboard.recommended;
  const lastLesson = dashboard.last_lesson ?? null;
  const visibleConcepts = dashboard.concepts.slice(0, 5);

  // The resume card is whichever is true: the lesson the learner actually left
  // part-way through, or -- for someone who has not opened one -- the concept
  // the dashboard recommends starting with.
  const resumeId = lastLesson ? lastLesson.concept_id : recommendation?.concept.id;
  const resumeName = lastLesson ? lastLesson.concept_name : recommendation?.concept.name;
  const resumeMastery = dashboard.concepts.find(({ concept }) => concept.id === resumeId)?.mastery ?? null;
  const resumeIsStarted = Boolean(lastLesson) || Boolean(recommendation?.mastery.attempts);
  const resumeScore = lastLesson ? masteryPercent(resumeMastery) : masteryPercent(recommendation?.mastery);
  const resumeColor = stateColor(lastLesson ? resumeMastery : recommendation?.mastery);

  return (
    <div className='mx-auto grid w-full max-w-[1536px] gap-10 px-5 py-9 pb-28 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-12 lg:pb-12'>
      <div className='min-w-0'>
        <div className='mb-7 lg:hidden'>
          <h1 className='text-[32px] font-bold leading-tight tracking-tight text-slate-900'>Welcome to NE235</h1>
          <p className='mt-3 text-base leading-7 text-slate-500'>
            {dashboard.total_concepts} concepts pulled from your course materials. Start anywhere.
          </p>
        </div>

        <p className='mb-3 hidden text-[11px] font-bold uppercase tracking-[0.12em] text-red-600 lg:block'>
          Pick up where you left off
        </p>

        {resumeId && resumeName && (
          <section
            className='rounded-2xl border bg-slate-900 p-5 text-white lg:bg-white lg:p-6 lg:text-slate-900'
            style={{ borderColor: COLORS.border }}
          >
            <button
              type='button'
              aria-label={`${resumeIsStarted ? 'Resume' : 'Start'} ${resumeName}`}
              onClick={() => {
                // Only a real saved position gets a beat: a recommendation should
                // open at the top of the lesson, not at beat 0 of a fake one.
                if (lastLesson) {
                  onOpenConcept(resumeId, lastLesson.beat_index);
                  return;
                }
                onOpenConcept(resumeId);
              }}
              className='flex w-full items-center gap-4 text-left lg:gap-6'
              style={{
                ...buttonReset,
                width: '100%',
                textAlign: 'left',
                backgroundColor: 'transparent',
                color: 'inherit',
              }}
            >
              <div className='hidden lg:block'>
                <ProgressRing score={resumeScore} color={resumeColor} />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 lg:hidden'>Continue</p>
                <h2 className='mt-1 truncate text-2xl font-bold tracking-tight lg:mt-0'>{resumeName}</h2>
                {lastLesson ? (
                  <>
                    <p className='mt-1 truncate text-sm text-slate-400 lg:text-slate-500'>
                      Beat {lastLesson.beat_index + 1} of {lastLesson.beat_count} · last seen{' '}
                      {lastSeen(lastLesson.updated_at)}
                    </p>
                    <BeatBar beatIndex={lastLesson.beat_index} beatCount={lastLesson.beat_count} />
                  </>
                ) : (
                  <p className='mt-1 truncate text-sm text-slate-400 lg:text-slate-500'>
                    {recommendation?.concept.document_count} sources · {recommendation?.concept.chunk_count} passages
                  </p>
                )}
              </div>
              <div className='lg:hidden'>
                <ProgressRing score={resumeScore} color={resumeColor} dark />
              </div>
              <span
                className='hidden rounded-full px-6 py-3 text-sm font-bold text-white lg:inline-flex'
                style={{ backgroundColor: '#e52427' }}
              >
                {resumeIsStarted ? 'Resume lesson' : 'Start lesson'}
              </span>
            </button>
          </section>
        )}

        <section
          className='mt-6 flex items-center gap-4 rounded-2xl border bg-white p-4 sm:px-5'
          style={{ borderColor: COLORS.border }}
        >
          <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700'>
            <span className='text-xl' aria-hidden='true'>
              ↻
            </span>
          </div>
          <div className='min-w-0 flex-1'>
            <h2 className='text-base font-bold text-slate-900'>{reviewHeadline(dashboard.review)}</h2>
            <p className='hidden truncate text-sm text-slate-500 sm:block'>
              Active recall drawn from your lesson passages
            </p>
          </div>
          <button
            type='button'
            onClick={onOpenReview}
            className='min-h-11 rounded-full border px-5 text-sm font-bold text-slate-900'
            style={{
              ...buttonReset,
              border: `1px solid ${COLORS.border}`,
              backgroundColor: '#fff',
              padding: '0.625rem 1.25rem',
            }}
          >
            <span className='hidden sm:inline'>Start review</span>
            <HiOutlineArrowRight className='h-5 w-5 sm:hidden' />
          </button>
        </section>

        <section className='mt-8'>
          <div className='flex items-center justify-between gap-4'>
            <h2 className='text-[11px] font-bold uppercase tracking-[0.12em] text-red-600'>Your concepts</h2>
            <div className='hidden items-center gap-4 text-xs text-slate-500 sm:flex'>
              <span>
                <i
                  className='mr-1.5 inline-block h-2 w-2 rounded-full'
                  style={{ backgroundColor: STATE_STYLE.mastered.color }}
                />
                {STATE_STYLE.mastered.label} {dashboard.mastered_concepts}
              </span>
              <span>
                <i
                  className='mr-1.5 inline-block h-2 w-2 rounded-full'
                  style={{ backgroundColor: STATE_STYLE.inProgress.color }}
                />
                {STATE_STYLE.inProgress.label} {Math.max(0, dashboard.started_concepts - dashboard.mastered_concepts)}
              </span>
              <span>
                <i
                  className='mr-1.5 inline-block h-2 w-2 rounded-full'
                  style={{ backgroundColor: STATE_STYLE.notStarted.color }}
                />
                {STATE_STYLE.notStarted.label} {Math.max(0, dashboard.total_concepts - dashboard.started_concepts)}
              </span>
            </div>
            <span className='text-sm text-slate-500 sm:hidden'>{dashboard.total_concepts} total</span>
          </div>
          <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            {visibleConcepts.map((item) => (
              <button
                type='button'
                key={item.concept.id}
                onClick={() => onOpenConcept(item.concept.id)}
                className='rounded-2xl border bg-white p-4 text-left'
                style={{
                  ...buttonReset,
                  border: `1px solid ${COLORS.border}`,
                  backgroundColor: '#fff',
                  padding: '1rem',
                  textAlign: 'left',
                }}
              >
                <div className='flex items-center justify-between gap-3'>
                  <span className='truncate text-base font-bold text-slate-900'>{item.concept.name}</span>
                  <span className='text-sm font-bold' style={{ color: stateColor(item.mastery) }}>
                    {masteryLabel(item.mastery)}
                  </span>
                </div>
                <div className='mt-3 h-1 overflow-hidden rounded-full bg-stone-100'>
                  <div
                    className='h-full rounded-full'
                    style={{ width: `${masteryPercent(item.mastery)}%`, backgroundColor: stateColor(item.mastery) }}
                  />
                </div>
                <p className='mt-3 hidden text-xs text-slate-400 sm:block'>
                  {item.concept.document_count} sources · {item.concept.connectivity} linked concepts
                </p>
              </button>
            ))}
            <button
              type='button'
              onClick={() => recommendation && onOpenConcept(recommendation.concept.id)}
              className='hidden min-h-28 items-center justify-center rounded-2xl border border-dashed bg-transparent text-sm font-bold text-slate-500 xl:flex'
              style={{ ...buttonReset, border: '1px dashed #d6d3d1', backgroundColor: 'transparent' }}
            >
              Browse all {dashboard.total_concepts} concepts
            </button>
          </div>
        </section>
      </div>

      <aside className='hidden space-y-5 lg:block'>
        <section className='rounded-2xl p-6 text-white' style={{ backgroundColor: COLORS.navy }}>
          <p className='text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400'>Course graph</p>
          <div className='mt-4 flex items-end gap-2'>
            <strong className='text-4xl leading-none'>{dashboard.total_concepts}</strong>
            <span className='pb-1 text-sm text-slate-400'>concepts extracted</span>
          </div>
          <div className='mt-5 grid grid-cols-3 gap-3 border-t border-slate-800 pt-5'>
            <div>
              <strong className='block text-lg'>{sourceCount}</strong>
              <span className='text-xs text-slate-400'>documents</span>
            </div>
            <div>
              <strong className='block text-lg'>{passageCount}</strong>
              <span className='text-xs text-slate-400'>passages</span>
            </div>
            <div>
              <strong className='block text-lg'>NE235</strong>
              <span className='text-xs text-slate-400'>course</span>
            </div>
          </div>
          <button
            type='button'
            onClick={onOpenExplore}
            className='mt-5 w-full rounded-xl bg-slate-800 py-3 text-sm font-bold text-white'
            style={{ ...buttonReset, width: '100%', backgroundColor: '#1e293b', color: '#fff', padding: '0.75rem' }}
          >
            Open the graph
          </button>
        </section>

        {/* No suggestions means the learner has started nothing yet, or the graph
            had nothing unopened to offer. Either way, an empty panel headed
            "Suggested next" would be worse than no panel. */}
        {suggestions.length > 0 && (
          <section className='rounded-2xl border bg-white p-5' style={{ borderColor: COLORS.border }}>
            <p className='text-[11px] font-bold uppercase tracking-[0.12em] text-red-600'>Suggested next</p>
            <p className='mt-2 text-sm leading-6 text-slate-500'>
              {suggestions[0].because_of.name} links to these, and you have not opened them yet.
            </p>
            <div className='mt-4 space-y-2'>
              {suggestions.map(({ concept, reason }) => (
                <button
                  type='button'
                  key={concept.id}
                  onClick={() => onOpenConcept(concept.id)}
                  className='flex w-full items-center gap-3 rounded-xl border p-3 text-left'
                  style={{
                    ...buttonReset,
                    width: '100%',
                    border: `1px solid ${COLORS.border}`,
                    backgroundColor: '#fff',
                    padding: '0.75rem',
                    textAlign: 'left',
                  }}
                >
                  <span
                    className='h-2 w-2 shrink-0 rounded-full'
                    style={{ backgroundColor: STATE_STYLE.notStarted.color }}
                  />
                  <span className='min-w-0'>
                    <strong className='block truncate text-sm text-slate-900'>{concept.name}</strong>
                    <small className='text-slate-400'>{reason}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className='rounded-2xl border bg-white p-5' style={{ borderColor: COLORS.border }}>
          <p className='text-sm text-slate-500'>Ask CORA anything about the course material.</p>
          <form
            onSubmit={askCora}
            className='mt-3 flex items-center gap-2 rounded-full border px-4 py-2'
            style={{ borderColor: COLORS.border }}
          >
            <HiOutlineChatBubbleLeftRight className='h-5 w-5 shrink-0 text-slate-400' aria-hidden='true' />
            <input
              type='text'
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              aria-label='Ask a question'
              placeholder='Ask a question…'
              className='min-w-0 flex-1 bg-transparent py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400'
            />
            {question.trim() && (
              <button
                type='submit'
                aria-label='Send question'
                className='shrink-0 rounded-full p-1.5 text-white'
                style={{ ...buttonReset, backgroundColor: '#e52427', padding: '0.375rem' }}
              >
                <HiOutlineArrowRight className='h-4 w-4' />
              </button>
            )}
          </form>
        </section>
      </aside>
    </div>
  );
};

export default StudentHome;
