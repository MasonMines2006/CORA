import { useCallback, useEffect, useState } from 'react';
import {
  HiOutlineArrowRight,
  HiOutlineBookOpen,
  HiOutlineCheckBadge,
  HiOutlineMap,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import { getLearningDashboard, LearningDashboard } from '../../API/Index';

interface StudentHomeProps {
  onOpenConcept: (conceptId: string) => void;
  onOpenExplore: () => void;
}

const buttonReset: React.CSSProperties = {
  boxSizing: 'border-box',
  border: 0,
  font: 'inherit',
  cursor: 'pointer',
};

const progressColor = (score: number) => {
  if (score >= 80) {
    return '#059669';
  }
  if (score > 0) {
    return '#b45309';
  }
  return '#cbd5e1';
};

const StudentHome: React.FC<StudentHomeProps> = ({ onOpenConcept, onOpenExplore }) => {
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
    load();
  }, [load]);

  if (loading) {
    return (
      <div className='box-border mx-auto w-full max-w-5xl px-4 py-8 sm:px-6' aria-label='Loading progress'>
        <div className='h-8 w-56 animate-pulse rounded-lg bg-slate-100' />
        <div className='mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-slate-100' />
        <div className='mt-8 grid gap-4 sm:grid-cols-3'>
          {[0, 1, 2].map((item) => (
            <div key={item} className='h-28 animate-pulse rounded-2xl bg-red-50' />
          ))}
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className='box-border mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center'>
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
  const visibleConcepts = dashboard.concepts.slice(0, 8);
  const completion = dashboard.total_concepts
    ? Math.round((dashboard.mastered_concepts / dashboard.total_concepts) * 100)
    : 0;

  return (
    <div className='box-border mx-auto w-full max-w-5xl px-4 py-7 pb-24 sm:px-6 sm:py-10 sm:pb-10'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-wider text-red-500'>NE235 learning workspace</p>
          <h1 className='mt-1 text-3xl font-bold tracking-tight text-slate-900'>Pick up where you left off</h1>
          <p className='mt-2 max-w-xl text-sm leading-relaxed text-slate-500'>
            Learn from the course graph, check your understanding, and follow the concepts that connect the material.
          </p>
        </div>
        <button
          type='button'
          onClick={onOpenExplore}
          className='mt-3 inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 sm:mt-0'
          style={{
            ...buttonReset,
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            color: '#475569',
            padding: '0.5rem 1rem',
          }}
        >
          <HiOutlineMap className='h-4 w-4' /> Explore course map
        </button>
      </div>

      <section className='mt-7 grid gap-3 sm:grid-cols-3' aria-label='Course progress'>
        <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
          <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-400'>Overall mastery</p>
          <p className='mt-2 text-3xl font-bold text-slate-900'>{Math.round(dashboard.average_mastery)}%</p>
          <div className='mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100'>
            <div className='h-full rounded-full bg-red-600' style={{ width: `${dashboard.average_mastery}%` }} />
          </div>
        </div>
        <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
          <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-400'>Course progress</p>
          <p className='mt-2 text-3xl font-bold text-slate-900'>{completion}%</p>
          <p className='mt-3 text-sm text-slate-500'>{dashboard.mastered_concepts} mastered</p>
        </div>
        <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
          <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-400'>Concepts explored</p>
          <p className='mt-2 text-3xl font-bold text-slate-900'>{dashboard.started_concepts}</p>
          <p className='mt-3 text-sm text-slate-500'>of {dashboard.total_concepts} course concepts</p>
        </div>
      </section>

      {recommendation && (
        <section className='mt-6 overflow-hidden rounded-2xl border border-red-200 bg-red-50'>
          <div className='grid gap-6 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7'>
            <div>
              <p className='flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-red-600'>
                <HiOutlineSparkles className='h-4 w-4' /> {recommendation.reason}
              </p>
              <h2 className='mt-2 text-2xl font-bold tracking-tight text-slate-900'>{recommendation.concept.name}</h2>
              <p className='mt-2 text-sm leading-relaxed text-slate-600'>
                {recommendation.concept.document_count} sources · {recommendation.concept.chunk_count} grounded passages
                · {Math.round(recommendation.mastery.score)}% mastery
              </p>
            </div>
            <button
              type='button'
              aria-label={`Continue ${recommendation.concept.name}`}
              onClick={() => onOpenConcept(recommendation.concept.id)}
              className='inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-200'
              style={{ ...buttonReset, backgroundColor: '#dc2626', color: '#ffffff', padding: '0.75rem 1.5rem' }}
            >
              Continue learning <HiOutlineArrowRight className='h-4 w-4' />
            </button>
          </div>
        </section>
      )}

      <section className='mt-8'>
        <div className='flex items-end justify-between gap-4'>
          <div>
            <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-400'>Knowledge map</p>
            <h2 className='mt-1 text-xl font-bold text-slate-900'>Course concepts</h2>
          </div>
          <p className='text-xs text-slate-400'>Ordered by graph importance</p>
        </div>
        {visibleConcepts.length ? (
          <div className='mt-4 grid gap-3 sm:grid-cols-2'>
            {visibleConcepts.map(({ concept, mastery }) => (
              <button
                type='button'
                key={concept.id}
                onClick={() => onOpenConcept(concept.id)}
                className='group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-red-200 hover:shadow-md'
                style={{
                  ...buttonReset,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  padding: '1rem',
                  textAlign: 'left',
                }}
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-semibold text-slate-900'>{concept.name}</p>
                    <p className='mt-1 text-xs text-slate-400'>
                      {concept.document_count} sources · {concept.connectivity} connections
                    </p>
                  </div>
                  {mastery.score >= 80 ? (
                    <HiOutlineCheckBadge className='h-5 w-5 shrink-0 text-emerald-600' />
                  ) : (
                    <span className='shrink-0 text-xs font-semibold' style={{ color: progressColor(mastery.score) }}>
                      {mastery.attempts ? `${Math.round(mastery.score)}%` : 'New'}
                    </span>
                  )}
                </div>
                <div className='mt-3 h-1 overflow-hidden rounded-full bg-slate-100'>
                  <div
                    className='h-full rounded-full'
                    style={{ width: `${mastery.score}%`, backgroundColor: progressColor(mastery.score) }}
                  />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className='mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500'>
            Course concepts will appear here after the source graph is ready.
          </div>
        )}
      </section>
    </div>
  );
};

export default StudentHome;
