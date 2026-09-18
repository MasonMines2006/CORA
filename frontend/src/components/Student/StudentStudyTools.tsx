import { useEffect, useMemo, useState } from 'react';
import { HiOutlineArrowPath, HiOutlineCheck, HiOutlineDocumentText, HiOutlineEye } from 'react-icons/hi2';
import { getLearningLesson, getLearningSources, LearningLesson, LearningSources } from '../../API/Index';

type StudyToolMode = 'cards' | 'sources';

interface StudentStudyToolsProps {
  conceptId: string;
  conceptName: string;
  mode: StudyToolMode;
}

interface ReviewCard {
  prompt: string;
  answer: string;
  source: string;
}

const buttonStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  border: 0,
  font: 'inherit',
  cursor: 'pointer',
};

const lessonCards = (lesson: LearningLesson): ReviewCard[] => [
  {
    prompt: `What is the core idea behind ${lesson.concept.name}?`,
    answer: lesson.beats.find((beat) => beat.key === 'core_idea')?.content ?? '',
    source: lesson.sources[0] ?? 'Course material',
  },
  {
    prompt: `How does ${lesson.concept.name} work?`,
    answer: lesson.beats.find((beat) => beat.key === 'how_it_works')?.content ?? '',
    source: lesson.sources[0] ?? 'Course material',
  },
  {
    prompt: `How is ${lesson.concept.name} used at PULSTAR?`,
    answer: lesson.beats.find((beat) => beat.key === 'pulstar_application')?.content ?? '',
    source:
      lesson.sources.find((source) => source.toLowerCase().includes('pulstar')) ??
      lesson.sources[0] ??
      'Course material',
  },
  {
    prompt: lesson.quick_check.question,
    answer: `${lesson.quick_check.options[lesson.quick_check.answer_index]}. ${lesson.quick_check.explanation}`,
    source: lesson.sources[0] ?? 'Course material',
  },
];

const StudentStudyTools: React.FC<StudentStudyToolsProps> = ({ conceptId, conceptName, mode }) => {
  const [lesson, setLesson] = useState<LearningLesson | null>(null);
  const [sources, setSources] = useState<LearningSources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setCardIndex(0);
    setRevealed(false);
    setCompleted(0);

    const request =
      mode === 'cards'
        ? getLearningLesson(conceptId, controller.signal).then(setLesson)
        : getLearningSources(conceptId, controller.signal).then(setSources);
    request
      .catch((requestError) => {
        if ((requestError as { name?: string }).name !== 'CanceledError') {
          setError(`CORA could not load ${mode === 'cards' ? 'review cards' : 'source passages'}. Please try again.`);
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [conceptId, mode]);

  const cards = useMemo(() => (lesson ? lessonCards(lesson).filter((card) => card.answer) : []), [lesson]);
  const currentCard = cards[cardIndex];

  const advance = (remembered: boolean) => {
    if (typeof window !== 'undefined' && currentCard) {
      const key = `cora-review:${conceptId}:${cardIndex}`;
      const nextDue = Date.now() + (remembered ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000);
      localStorage.setItem(key, String(nextDue));
    }
    setCompleted((value) => value + 1);
    setCardIndex((value) => (value + 1) % Math.max(cards.length, 1));
    setRevealed(false);
  };

  if (loading) {
    return (
      <div
        className='min-h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-50'
        aria-label={`Loading ${mode}`}
      />
    );
  }

  if (error) {
    return <div className='rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700'>{error}</div>;
  }

  if (mode === 'sources') {
    return (
      <div className='space-y-4'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-wider text-red-500'>Grounded course material</p>
          <h3 className='mt-1 text-2xl font-bold tracking-tight text-slate-900'>{conceptName} sources</h3>
          <p className='mt-2 text-sm text-slate-500'>These are the passages CORA uses for lessons and practice.</p>
        </div>
        {sources?.passages.length ? (
          sources.passages.map((passage, index) => (
            <article key={passage.id} className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
              <div className='flex items-center gap-2 text-xs font-semibold text-slate-500'>
                <HiOutlineDocumentText className='h-4 w-4 text-red-500' />
                <span>{passage.source}</span>
                <span className='text-slate-300'>·</span>
                <span>Passage {index + 1}</span>
              </div>
              <p className='mt-4 whitespace-pre-line text-sm leading-7 text-slate-700'>{passage.text}</p>
            </article>
          ))
        ) : (
          <div className='rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500'>
            No readable source passages are available for this concept yet.
          </div>
        )}
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className='rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500'>
        No review cards are available yet.
      </div>
    );
  }

  return (
    <div>
      <div className='flex items-end justify-between gap-4'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-wider text-red-500'>Active recall</p>
          <h3 className='mt-1 text-2xl font-bold tracking-tight text-slate-900'>{conceptName} review</h3>
        </div>
        <p className='text-xs font-semibold text-slate-400'>
          {cardIndex + 1} / {cards.length}
        </p>
      </div>
      <div className='mt-5 min-h-80 rounded-2xl border border-red-100 bg-white p-6 shadow-sm sm:p-8'>
        <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-400'>Prompt</p>
        <h4 className='mt-3 text-xl font-semibold leading-8 text-slate-900'>{currentCard.prompt}</h4>
        {!revealed ? (
          <button
            type='button'
            onClick={() => setRevealed(true)}
            className='mt-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white'
            style={{ ...buttonStyle, backgroundColor: '#dc2626', color: '#ffffff', padding: '0.75rem 1.5rem' }}
          >
            <HiOutlineEye className='h-4 w-4' /> Show answer
          </button>
        ) : (
          <div className='mt-7'>
            <div className='rounded-xl bg-red-50 p-5'>
              <p className='text-sm leading-7 text-slate-700'>{currentCard.answer}</p>
              <p className='mt-3 text-xs text-slate-400'>Source: {currentCard.source}</p>
            </div>
            <div className='mt-5 flex flex-col gap-3 sm:flex-row'>
              <button
                type='button'
                onClick={() => advance(false)}
                className='inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600'
                style={{
                  ...buttonStyle,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  padding: '0.625rem 1.25rem',
                }}
              >
                <HiOutlineArrowPath className='h-4 w-4' /> Review again
              </button>
              <button
                type='button'
                onClick={() => advance(true)}
                className='inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white'
                style={{ ...buttonStyle, backgroundColor: '#059669', color: '#ffffff', padding: '0.625rem 1.25rem' }}
              >
                <HiOutlineCheck className='h-4 w-4' /> Got it
              </button>
            </div>
          </div>
        )}
      </div>
      <p className='mt-3 text-xs text-slate-400'>
        {completed} reviewed this session · Ratings schedule the next review on this device.
      </p>
    </div>
  );
};

export default StudentStudyTools;
