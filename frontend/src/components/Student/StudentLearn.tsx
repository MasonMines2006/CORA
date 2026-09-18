import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCheckCircle,
  HiOutlineMagnifyingGlass,
} from 'react-icons/hi2';
import {
  getLearningConcepts,
  getLearningLesson,
  getLearningMastery,
  LearningConcept,
  LearningLesson,
  LearningMastery,
} from '../../API/Index';

interface StudentLearnProps {
  onNavigateToChat?: (prompt?: string) => void;
  initialConceptId?: string;
}

/*
 * ---------------------------------------------------------------------------
 * Why this file uses inline styles for borders, shadows and button chrome
 * ---------------------------------------------------------------------------
 * `@neo4j-ndl/base/lib/neo4j-ds-styles.css` is imported globally (via Home.tsx)
 * as a plain, UNLAYERED stylesheet. Tailwind v4 puts all of its utilities inside
 * the `utilities` cascade layer, and unlayered CSS beats layered CSS no matter
 * how specific the layered selector is. Measured in the running app:
 *
 *   - `*{border-width:0}`  -> the `border` utility is dead on EVERY element,
 *                             divs included. Borders must be set inline.
 *   - no `shadow-*` utility is generated at all under this Tailwind/NDL preset
 *                          -> `shadow-sm`/`shadow-lg` are dead. Set boxShadow inline.
 *   - on <button> and <input>: `padding:0`, `background-color:transparent`,
 *     `color:inherit`, `font-size:100%`, `font-weight:inherit` are all reset,
 *     so `p-*`, `bg-*`, `text-*` and `font-*` silently do nothing there.
 *
 * The workaround used throughout this file: a <button> is only a bare, unstyled
 * hit area (BARE_BUTTON), and an inner <div> carries the visuals. Tailwind works
 * normally on that div — including `hover:` variants — which is why the rows and
 * cards below can have real hover states.
 *
 * Only colors listed in tailwind.config.js are generated (red, slate, emerald,
 * white, black, gray). Amber is NOT, so the "in progress" mastery color is inline.
 */

/** Design tokens repeated in inline styles. Keep in sync with CLAUDE.md. */
const TOKEN = {
  red600: '#dc2626',
  red700: '#b91c1c',
  red200: '#fecaca',
  red100: '#fee2e2',
  red50: '#fef2f2',
  slate900: '#0f172a',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  emerald: '#10b981',
  amber: '#b45309',
  notStarted: '#cbd5e1',
} as const;

const hairline = (color: string): React.CSSProperties => ({
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: color,
});

/** White card surface: border + soft shadow, both of which Tailwind cannot do here. */
const CARD_SURFACE: React.CSSProperties = {
  boxSizing: 'border-box',
  ...hairline(TOKEN.red100),
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
};

/** Tinted rail surface: border only, no shadow. */
const RAIL_SURFACE: React.CSSProperties = {
  boxSizing: 'border-box',
  ...hairline(TOKEN.red100),
};

/** A <button> stripped back to a plain hit area. All visuals go on an inner <div>. */
const bareButtonStyle = (disabled = false): React.CSSProperties => ({
  boxSizing: 'border-box',
  display: 'block',
  width: '100%',
  padding: 0,
  margin: 0,
  background: 'none',
  borderWidth: 0,
  textAlign: 'left',
  color: 'inherit',
  font: 'inherit',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
});

/** Inline chrome for the filter box — <input> has the same preflight problem as <button>. */
const SEARCH_INPUT_STYLE: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  padding: '0.5rem 0.75rem 0.5rem 2.25rem',
  borderRadius: '0.75rem',
  backgroundColor: '#ffffff',
  color: TOKEN.slate900,
  fontSize: '0.875rem',
  lineHeight: '1.25rem',
  outline: 'none',
  ...hairline(TOKEN.slate200),
};

/** Quick-check answer options. Same pattern (and colors) as StudentAssess. */
const OPTION_BASE_STYLE: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  padding: '0.75rem',
  borderWidth: '1px',
  borderStyle: 'solid',
  cursor: 'pointer',
};

type OptionState = { correctOption?: boolean | null; wrongSelection?: boolean | null; selected: boolean };

const optionStateStyle = ({ correctOption, wrongSelection, selected }: OptionState): React.CSSProperties => {
  if (correctOption) {
    return { borderColor: '#6ee7b7', backgroundColor: '#ecfdf5', color: '#065f46' };
  }
  if (wrongSelection) {
    return { borderColor: '#fca5a5', backgroundColor: TOKEN.red50, color: TOKEN.red700 };
  }
  if (selected) {
    return { borderColor: '#fca5a5', backgroundColor: TOKEN.red50, color: TOKEN.slate900 };
  }
  return { borderColor: TOKEN.slate200, backgroundColor: '#ffffff', color: '#475569' };
};

const errorMessage = (error: unknown) => {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail ?? 'CORA could not load this lesson. Please try again.';
};

const isCanceled = (error: unknown) => (error as { name?: string })?.name === 'CanceledError';

/** Student-facing metadata. `document_count` is the honest "sources" number; chunks are "passages". */
const conceptMeta = (concept: LearningConcept) => {
  const sources = `${concept.document_count} source${concept.document_count === 1 ? '' : 's'}`;
  const passages = `${concept.chunk_count} passage${concept.chunk_count === 1 ? '' : 's'}`;
  return `${sources} · ${passages}`;
};

type MasteryTone = { label: string; color: string; percent: number; started: boolean };

const masteryTone = (mastery?: LearningMastery): MasteryTone => {
  const percent = Math.max(0, Math.min(100, Math.round(mastery?.score ?? 0)));
  const started = Boolean(mastery && mastery.attempts > 0);
  if (!started) {
    return { label: 'Not started', color: TOKEN.notStarted, percent: 0, started: false };
  }
  if (percent >= 80) {
    return { label: 'Mastered', color: TOKEN.emerald, percent, started: true };
  }
  return { label: 'In progress', color: TOKEN.amber, percent, started: true };
};

/** Thin mastery bar. Colors are inline because amber is not in the generated palette. */
const MasteryBar = ({ tone }: { tone: MasteryTone }) => (
  <div
    className='mt-2 h-1 w-full overflow-hidden rounded-full'
    style={{ backgroundColor: TOKEN.slate100 }}
    role='presentation'
  >
    <div
      className='h-full rounded-full'
      style={{ width: `${tone.started ? Math.max(tone.percent, 4) : 0}%`, backgroundColor: tone.color }}
    />
  </div>
);

const STARTER_CARD_COUNT = 6;

const StudentLearn: React.FC<StudentLearnProps> = ({ onNavigateToChat, initialConceptId }) => {
  const [concepts, setConcepts] = useState<LearningConcept[]>([]);
  const [masteryByConcept, setMasteryByConcept] = useState<Record<string, LearningMastery>>({});
  const [filter, setFilter] = useState('');
  const [selectedConceptId, setSelectedConceptId] = useState('');
  const [lesson, setLesson] = useState<LearningLesson | null>(null);
  const [step, setStep] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [loadingConcepts, setLoadingConcepts] = useState(true);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [conceptsError, setConceptsError] = useState('');
  const [lessonError, setLessonError] = useState('');
  const lessonPaneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      try {
        const items = await getLearningConcepts(controller.signal);
        if (cancelled) {
          return;
        }
        setConcepts(items);
        setSelectedConceptId((current) => current || initialConceptId || items[0]?.id || '');
        setLoadingConcepts(false);

        // Progress is supplementary: the list renders immediately and the bars
        // fill in when these resolve. A failed row simply shows "Not started".
        const settled = await Promise.allSettled(items.map((item) => getLearningMastery(item.id, controller.signal)));
        if (cancelled) {
          return;
        }
        setMasteryByConcept(
          settled.reduce<Record<string, LearningMastery>>((accumulator, result, index) => {
            if (result.status !== 'fulfilled') {
              return accumulator;
            }
            return { ...accumulator, [items[index].id]: result.value };
          }, {})
        );
      } catch (requestError) {
        if (cancelled || isCanceled(requestError)) {
          return;
        }
        setConceptsError(errorMessage(requestError));
        setLoadingConcepts(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const filteredConcepts = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return concepts;
    }
    return concepts.filter(
      (concept) =>
        concept.name.toLowerCase().includes(query) ||
        concept.sources.some((source) => source.toLowerCase().includes(query))
    );
  }, [concepts, filter]);

  const startedCount = useMemo(
    () => concepts.filter((concept) => masteryByConcept[concept.id]?.attempts).length,
    [concepts, masteryByConcept]
  );

  const selectConcept = (conceptId: string) => {
    setSelectedConceptId(conceptId);
    setLesson(null);
    setLessonError('');
  };

  const loadLesson = async (conceptId: string) => {
    if (!conceptId) {
      return;
    }
    setSelectedConceptId(conceptId);
    setLoadingLesson(true);
    setLessonError('');
    setLesson(null);
    setStep(0);
    setSelectedAnswer(null);
    setAnswerRevealed(false);
    // On phones the rail sits above the lesson, so bring the lesson into view.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      lessonPaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    try {
      setLesson(await getLearningLesson(conceptId));
    } catch (requestError) {
      setLessonError(errorMessage(requestError));
    } finally {
      setLoadingLesson(false);
    }
  };

  const currentBeat = lesson?.beats[step];
  const isQuickCheck = currentBeat?.key === 'quick_check';
  const isCorrect = selectedAnswer === lesson?.quick_check.answer_index;
  const showPicker = !lesson && !loadingLesson && !lessonError;
  const starterConcepts = concepts.slice(0, STARTER_CARD_COUNT);

  return (
    <div className='box-border mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8'>
      <div className='grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]'>
        {/* ------------------------------ Left rail ------------------------------ */}
        <aside
          className='box-border rounded-2xl bg-red-50 p-4 lg:sticky lg:top-6'
          style={RAIL_SURFACE}
          aria-label='Course concepts'
        >
          <div className='flex items-baseline justify-between gap-2'>
            <p className='text-[11px] font-semibold uppercase tracking-wider text-red-500'>Course concepts</p>
            {concepts.length > 0 && (
              <p className='text-[11px] text-slate-400'>
                {startedCount} of {concepts.length} started
              </p>
            )}
          </div>

          <div className='relative mt-3'>
            <HiOutlineMagnifyingGlass className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
            <input
              type='search'
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder='Filter concepts'
              aria-label='Filter concepts by name or source'
              style={SEARCH_INPUT_STYLE}
            />
          </div>

          <div className='mt-3 max-h-80 space-y-1.5 overflow-y-auto pr-1 lg:max-h-[52vh]'>
            {loadingConcepts && <p className='px-1 py-2 text-sm text-slate-500'>Reading the knowledge graph…</p>}

            {!loadingConcepts && conceptsError && (
              <p
                className='rounded-xl bg-white p-3 text-sm leading-relaxed text-slate-600'
                style={hairline(TOKEN.red200)}
              >
                {conceptsError}
              </p>
            )}

            {!loadingConcepts && !conceptsError && concepts.length === 0 && (
              <p
                className='rounded-xl bg-white p-3 text-sm leading-relaxed text-slate-500'
                style={hairline(TOKEN.red100)}
              >
                No course concepts are available yet. Finish graph ingestion, then refresh this page.
              </p>
            )}

            {!loadingConcepts && concepts.length > 0 && filteredConcepts.length === 0 && (
              <p className='px-1 py-2 text-sm text-slate-500'>No concept matches “{filter.trim()}”.</p>
            )}

            {filteredConcepts.map((concept) => {
              const tone = masteryTone(masteryByConcept[concept.id]);
              const isSelected = selectedConceptId === concept.id;
              return (
                <button
                  key={concept.id}
                  type='button'
                  aria-pressed={isSelected}
                  onClick={() => selectConcept(concept.id)}
                  style={bareButtonStyle()}
                >
                  <div
                    className={`rounded-xl px-3 py-2.5 transition-colors ${
                      isSelected ? 'bg-white' : 'hover:bg-white/70'
                    }`}
                    style={isSelected ? { ...hairline(TOKEN.red200) } : { ...hairline('transparent') }}
                  >
                    <div className='flex items-baseline justify-between gap-2'>
                      <span className={`text-sm font-semibold ${isSelected ? 'text-red-700' : 'text-slate-700'}`}>
                        {concept.name}
                      </span>
                      {tone.started && (
                        <span className='shrink-0 text-[11px] font-semibold' style={{ color: tone.color }}>
                          {tone.percent}%
                        </span>
                      )}
                    </div>
                    <MasteryBar tone={tone} />
                    <span className='mt-1.5 block text-[11px] text-slate-400'>{conceptMeta(concept)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type='button'
            onClick={() => loadLesson(selectedConceptId)}
            disabled={!selectedConceptId || loadingLesson}
            style={bareButtonStyle(!selectedConceptId || loadingLesson)}
            className='mt-4'
          >
            <div
              className='rounded-full bg-red-600 px-5 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-red-700'
              style={{ boxShadow: '0 8px 16px -6px rgba(220, 38, 38, 0.45)' }}
            >
              {loadingLesson ? 'Building lesson…' : 'Start guided lesson'}
            </div>
          </button>
        </aside>

        {/* ------------------------------ Right pane ----------------------------- */}
        <section className='box-border min-w-0' ref={lessonPaneRef}>
          {showPicker && (
            <div className='box-border rounded-2xl bg-white p-5 sm:p-7' style={CARD_SURFACE}>
              <p className='text-xs font-semibold uppercase tracking-wider text-red-500'>Start here</p>
              <h3 className='mt-2 text-2xl font-bold tracking-tight text-slate-900'>Pick a concept</h3>
              <p className='mt-2 text-sm leading-relaxed text-slate-500'>
                Choose any concept from the list, or open one of the most connected ideas in your course graph.
              </p>

              {loadingConcepts && (
                <div className='mt-6 grid gap-3 sm:grid-cols-2'>
                  {[0, 1, 2, 3].map((placeholder) => (
                    <div key={placeholder} className='h-24 animate-pulse rounded-xl bg-red-50' />
                  ))}
                </div>
              )}

              {!loadingConcepts && starterConcepts.length > 0 && (
                <div className='mt-6 grid gap-3 sm:grid-cols-2'>
                  {starterConcepts.map((concept) => {
                    const tone = masteryTone(masteryByConcept[concept.id]);
                    return (
                      <button
                        key={concept.id}
                        type='button'
                        onClick={() => loadLesson(concept.id)}
                        style={bareButtonStyle()}
                      >
                        <div
                          className='h-full rounded-xl bg-white p-4 transition-colors hover:bg-red-50'
                          style={hairline(TOKEN.red100)}
                        >
                          <div className='flex items-baseline justify-between gap-2'>
                            <span className='text-sm font-semibold text-slate-900'>{concept.name}</span>
                            <span className='shrink-0 text-[11px] font-semibold' style={{ color: tone.color }}>
                              {tone.started ? `${tone.percent}%` : 'New'}
                            </span>
                          </div>
                          <MasteryBar tone={tone} />
                          <span className='mt-1.5 block text-[11px] text-slate-400'>{conceptMeta(concept)}</span>
                          <span className='mt-3 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-red-600'>
                            Start lesson <HiOutlineArrowRight className='h-3 w-3' />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {loadingLesson && (
            <div className='box-border min-h-80 animate-pulse rounded-2xl bg-white p-6' style={CARD_SURFACE}>
              <div className='h-3 w-28 rounded bg-red-100' />
              <div className='mt-5 h-7 w-2/3 rounded bg-slate-100' />
              <div className='mt-6 space-y-3'>
                <div className='h-3 rounded bg-slate-100' />
                <div className='h-3 rounded bg-slate-100' />
                <div className='h-3 w-4/5 rounded bg-slate-100' />
              </div>
            </div>
          )}

          {lessonError && (
            <div
              className='box-border rounded-2xl bg-red-50 p-6'
              style={{ boxSizing: 'border-box', ...hairline(TOKEN.red200) }}
            >
              <h3 className='font-semibold text-slate-900'>Lesson unavailable</h3>
              <p className='mt-2 text-sm leading-relaxed text-slate-600'>{lessonError}</p>
              <button
                type='button'
                onClick={() => loadLesson(selectedConceptId)}
                style={{ ...bareButtonStyle(), width: 'auto' }}
                className='mt-4'
              >
                <span className='text-sm font-semibold text-red-600 hover:text-red-700'>Try again</span>
              </button>
            </div>
          )}

          {lesson && currentBeat && (
            <div className='box-border rounded-2xl bg-white p-5 sm:p-7' style={CARD_SURFACE}>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='min-w-0'>
                  <p className='text-[11px] font-semibold uppercase tracking-wider text-red-500'>
                    Step {step + 1} of {lesson.beats.length}
                  </p>
                  <h3 className='mt-1 text-2xl font-bold tracking-tight text-slate-900'>{currentBeat.title}</h3>
                </div>
                <div className='flex shrink-0 items-center gap-3'>
                  <span
                    className='rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-600'
                    style={hairline(TOKEN.red200)}
                  >
                    {lesson.concept.name}
                  </span>
                  <button
                    type='button'
                    onClick={() => {
                      setLesson(null);
                      setLessonError('');
                    }}
                    style={{ ...bareButtonStyle(), width: 'auto' }}
                  >
                    <span className='text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600'>
                      Close
                    </span>
                  </button>
                </div>
              </div>

              <div className='mt-5 flex gap-2' aria-label='Lesson progress'>
                {lesson.beats.map((beat, index) => (
                  <div
                    key={beat.key}
                    className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-red-600' : 'bg-red-100'}`}
                  />
                ))}
              </div>

              {!isQuickCheck && (
                <p className='mt-7 whitespace-pre-line text-base leading-7 text-slate-600'>{currentBeat.content}</p>
              )}

              {isQuickCheck && (
                <div className='mt-7'>
                  <p className='text-base font-semibold leading-6 text-slate-900'>{lesson.quick_check.question}</p>
                  <div className='mt-4 space-y-2'>
                    {lesson.quick_check.options.map((option, index) => {
                      const correctOption = answerRevealed && index === lesson.quick_check.answer_index;
                      const wrongSelection = answerRevealed && selectedAnswer === index && !correctOption;
                      return (
                        <button
                          key={option}
                          type='button'
                          disabled={answerRevealed}
                          onClick={() => setSelectedAnswer(index)}
                          style={{
                            ...OPTION_BASE_STYLE,
                            ...optionStateStyle({ correctOption, wrongSelection, selected: selectedAnswer === index }),
                          }}
                          className='w-full rounded-xl text-left text-sm transition-colors'
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {!answerRevealed ? (
                    <button
                      type='button'
                      disabled={selectedAnswer === null}
                      onClick={() => setAnswerRevealed(true)}
                      style={{ ...bareButtonStyle(selectedAnswer === null), width: 'auto' }}
                      className='mt-4'
                    >
                      <div className='rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700'>
                        Check answer
                      </div>
                    </button>
                  ) : (
                    <div className={`mt-4 rounded-xl p-4 ${isCorrect ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <p className='flex items-center gap-2 text-sm font-semibold text-slate-900'>
                        <HiOutlineCheckCircle
                          className={`h-5 w-5 ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`}
                        />
                        {isCorrect ? 'Correct' : 'Review the explanation'}
                      </p>
                      <p className='mt-2 text-sm leading-relaxed text-slate-600'>{lesson.quick_check.explanation}</p>
                    </div>
                  )}
                </div>
              )}

              <div
                className='mt-8 flex flex-wrap items-center justify-between gap-3 pt-5'
                style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: TOKEN.slate100 }}
              >
                <button
                  type='button'
                  onClick={() => setStep((current) => Math.max(0, current - 1))}
                  disabled={step === 0}
                  style={{ ...bareButtonStyle(step === 0), width: 'auto' }}
                >
                  <div
                    className='flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-red-600'
                    style={hairline(TOKEN.red200)}
                  >
                    <HiOutlineArrowLeft className='h-4 w-4' /> Previous
                  </div>
                </button>
                {step < lesson.beats.length - 1 ? (
                  <button
                    type='button'
                    onClick={() => setStep((current) => Math.min(lesson.beats.length - 1, current + 1))}
                    style={{ ...bareButtonStyle(), width: 'auto' }}
                  >
                    <div className='flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700'>
                      Next <HiOutlineArrowRight className='h-4 w-4' />
                    </div>
                  </button>
                ) : (
                  onNavigateToChat && (
                    <button
                      type='button'
                      onClick={() => onNavigateToChat(`Help me explore ${lesson.concept.name} more deeply.`)}
                      style={{ ...bareButtonStyle(), width: 'auto' }}
                    >
                      <div className='flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700'>
                        Ask a follow-up <HiOutlineChatBubbleLeftRight className='h-4 w-4' />
                      </div>
                    </button>
                  )
                )}
              </div>

              {lesson.sources.length > 0 && (
                <p className='mt-5 text-xs leading-relaxed text-slate-400'>Sources: {lesson.sources.join(', ')}</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default StudentLearn;
