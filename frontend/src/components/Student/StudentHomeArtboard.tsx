import { useCallback, useEffect, useMemo, useState } from 'react';
import { HiOutlineArrowRight, HiOutlineBookOpen, HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';
import { getLearningDashboard, LearningConceptProgress, LearningDashboard } from '../../API/Index';

interface StudentHomeProps {
  onOpenConcept: (conceptId: string) => void;
  onOpenExplore: () => void;
  onOpenReview: () => void;
}

const COLORS = {
  border: '#e7e5e4',
  amber: '#b45309',
  amberBright: '#f59e0b',
  teal: '#0f766e',
  navy: '#0f172a',
} as const;

const buttonReset: React.CSSProperties = {
  boxSizing: 'border-box',
  border: 0,
  font: 'inherit',
  cursor: 'pointer',
};

const progressColor = (score: number) => {
  if (score >= 80) {
    return COLORS.teal;
  }
  if (score > 0) {
    return COLORS.amber;
  }
  return '#cbd5e1';
};

const masteryLabel = (item: LearningConceptProgress) =>
  (item.mastery.attempts ? `${Math.round(item.mastery.score)}%` : '—');

const ProgressRing = ({ score, dark = false }: { score: number; dark?: boolean }) => {
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
          stroke={dark ? COLORS.amberBright : COLORS.amber}
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

const StudentHome: React.FC<StudentHomeProps> = ({ onOpenConcept, onOpenExplore, onOpenReview }) => {
  const [dashboard, setDashboard] = useState<LearningDashboard | null>(null);
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

  const sourceCount = useMemo(
    () => new Set(dashboard?.concepts.flatMap(({ concept }) => concept.sources) ?? []).size,
    [dashboard]
  );
  const passageCount = useMemo(
    () => dashboard?.concepts.reduce((total, { concept }) => total + concept.chunk_count, 0) ?? 0,
    [dashboard]
  );

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
  const visibleConcepts = dashboard.concepts.slice(0, 5);
  const suggestions = dashboard.concepts.filter(({ concept }) => concept.id !== recommendation?.concept.id).slice(0, 3);
  // `mastery.attempts` is how the rest of this file decides "has this been started",
  // so the continue card uses the same test rather than inferring it from a score.
  const hasStartedRecommendation = Boolean(recommendation?.mastery.attempts);

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

        {recommendation && (
          <section
            className='rounded-2xl border bg-slate-900 p-5 text-white lg:bg-white lg:p-6 lg:text-slate-900'
            style={{ borderColor: COLORS.border }}
          >
            <button
              type='button'
              aria-label={`${hasStartedRecommendation ? 'Resume' : 'Start'} ${recommendation.concept.name}`}
              onClick={() => onOpenConcept(recommendation.concept.id)}
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
                <ProgressRing score={recommendation.mastery.score} />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 lg:hidden'>Continue</p>
                <h2 className='mt-1 truncate text-2xl font-bold tracking-tight lg:mt-0'>
                  {recommendation.concept.name}
                </h2>
                {/* The artboard shows "Step 3 of 4" and a 4-beat progress bar, but nothing
                    persists a learner's lesson position yet, so both were hardcoded -- every
                    guest was told 3 of 4 beats were done next to a 0% ring. Show only what the
                    dashboard actually knows until the backend reports lesson position. */}
                <p className='mt-1 truncate text-sm text-slate-400 lg:text-slate-500'>
                  {hasStartedRecommendation
                    ? `${recommendation.mastery.correct} of ${recommendation.mastery.attempts} correct · ${recommendation.mastery.difficulty}`
                    : `${recommendation.concept.document_count} sources · ${recommendation.concept.chunk_count} passages`}
                </p>
              </div>
              <div className='lg:hidden'>
                <ProgressRing score={recommendation.mastery.score} dark />
              </div>
              <span
                className='hidden rounded-full px-6 py-3 text-sm font-bold text-white lg:inline-flex'
                style={{ backgroundColor: '#e52427' }}
              >
                {hasStartedRecommendation ? 'Resume lesson' : 'Start lesson'}
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
            {/* The artboard reads "7 cards due for review", but no spaced-repetition
                schedule exists yet, so there is no real due count. The previous code
                invented one with Math.max(1, ...) and told every guest a card was due
                before they had studied anything. Restore a count once review intervals
                are persisted per card. */}
            <h2 className='text-base font-bold text-slate-900'>Review what you have studied</h2>
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
                <i className='mr-1.5 inline-block h-2 w-2 rounded-full bg-teal-600' />
                Mastered {dashboard.mastered_concepts}
              </span>
              <span>
                <i className='mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-700' />
                In progress {Math.max(0, dashboard.started_concepts - dashboard.mastered_concepts)}
              </span>
              <span>
                <i className='mr-1.5 inline-block h-2 w-2 rounded-full bg-slate-300' />
                Not started {Math.max(0, dashboard.total_concepts - dashboard.started_concepts)}
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
                  <span className='text-sm font-bold' style={{ color: progressColor(item.mastery.score) }}>
                    {masteryLabel(item)}
                  </span>
                </div>
                <div className='mt-3 h-1 overflow-hidden rounded-full bg-stone-100'>
                  <div
                    className='h-full rounded-full'
                    style={{ width: `${item.mastery.score}%`, backgroundColor: progressColor(item.mastery.score) }}
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

        <section className='rounded-2xl border bg-white p-5' style={{ borderColor: COLORS.border }}>
          <p className='text-[11px] font-bold uppercase tracking-[0.12em] text-red-600'>Suggested next</p>
          <p className='mt-2 text-sm leading-6 text-slate-500'>Graph-connected ideas that are ready for you.</p>
          <div className='mt-4 space-y-2'>
            {suggestions.map(({ concept }) => (
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
                <span className='h-2 w-2 shrink-0 rounded-full bg-teal-600' />
                <span className='min-w-0'>
                  <strong className='block truncate text-sm text-slate-900'>{concept.name}</strong>
                  <small className='text-slate-400'>{concept.connectivity} graph connections</small>
                </span>
              </button>
            ))}
          </div>
          <div className='mt-5 border-t pt-5' style={{ borderColor: '#f1f0ef' }}>
            <p className='text-sm text-slate-500'>Ask CORA anything about the course material.</p>
            <div
              className='mt-3 flex items-center gap-2 rounded-full border px-4 py-3 text-sm text-slate-400'
              style={{ borderColor: COLORS.border }}
            >
              <HiOutlineChatBubbleLeftRight className='h-5 w-5' /> Ask a question…
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
};

export default StudentHome;
