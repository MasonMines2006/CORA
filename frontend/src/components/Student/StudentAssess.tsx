import { useEffect, useState } from 'react';
import {
  HiOutlineAcademicCap,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineChartBar,
  HiOutlineXCircle,
} from 'react-icons/hi2';
import {
  generateLearningQuiz,
  getLearningConcepts,
  getLearningMastery,
  gradeLearningQuiz,
  LearningConcept,
  LearningMastery,
  LearningQuiz,
  QuizGrade,
} from '../../API/Index';

const errorMessage = (error: unknown) => {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail ?? 'CORA could not prepare this assessment. Please try again.';
};

const emptyMastery = (conceptId = ''): LearningMastery => ({
  concept_id: conceptId,
  attempts: 0,
  correct: 0,
  score: 0,
  difficulty: 'easy',
});

/**
 * Quiz options are styled inline rather than with Tailwind classes.
 *
 * @neo4j-ndl/base ships its own Tailwind preflight as plain, unlayered CSS, which
 * resets padding, border-width, background-color and color on every <button>.
 * Unlayered CSS outranks Tailwind's layered utilities no matter how specific the
 * class is, so `p-3`, `border`, `bg-emerald-50` and friends silently do nothing
 * here and the options render as bare, unclickable-looking text. Inline styles are
 * the one thing that reliably wins, so the option box lives here instead.
 *
 * Colors are the CORA design tokens: red-600/red-50 for the active choice,
 * emerald for a correct answer, slate for untouched options.
 */
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
    return { borderColor: '#fca5a5', backgroundColor: '#fef2f2', color: '#b91c1c' };
  }
  if (selected) {
    return { borderColor: '#fca5a5', backgroundColor: '#fef2f2', color: '#0f172a' };
  }
  return { borderColor: '#e2e8f0', backgroundColor: '#ffffff', color: '#475569' };
};

interface StudentAssessProps {
  initialConceptId?: string;
  embedded?: boolean;
}

const StudentAssess: React.FC<StudentAssessProps> = ({ initialConceptId, embedded = false }) => {
  const [concepts, setConcepts] = useState<LearningConcept[]>([]);
  const [conceptId, setConceptId] = useState('');
  const [mastery, setMastery] = useState<LearningMastery>(emptyMastery());
  const [quiz, setQuiz] = useState<LearningQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [grade, setGrade] = useState<QuizGrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getLearningConcepts(controller.signal)
      .then((items) => {
        setConcepts(items);
        setConceptId(initialConceptId || items[0]?.id || '');
      })
      .catch((requestError) => {
        if ((requestError as { name?: string }).name !== 'CanceledError') {
          setError(errorMessage(requestError));
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!conceptId) {
      setMastery(emptyMastery());
      return;
    }
    const controller = new AbortController();
    getLearningMastery(conceptId, controller.signal)
      .then(setMastery)
      .catch(() => setMastery(emptyMastery(conceptId)));
    return () => controller.abort();
  }, [conceptId]);

  const startQuiz = async () => {
    if (!conceptId) {
      return;
    }
    setWorking(true);
    setError('');
    setQuiz(null);
    setGrade(null);
    setAnswers({});
    try {
      const nextQuiz = await generateLearningQuiz(conceptId);
      setQuiz(nextQuiz);
      setMastery(nextQuiz.mastery);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorking(false);
    }
  };

  const submitQuiz = async () => {
    if (!quiz || quiz.questions.some((question) => answers[question.id] === undefined)) {
      return;
    }
    setWorking(true);
    setError('');
    try {
      const result = await gradeLearningQuiz(
        quiz.quiz_id,
        quiz.questions.map((question) => answers[question.id])
      );
      setGrade(result);
      setMastery(result.mastery);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorking(false);
    }
  };

  const allAnswered = Boolean(quiz && quiz.questions.every((question) => answers[question.id] !== undefined));

  return (
    <div className='box-border mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8'>
      {!embedded && (
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-wider text-red-500'>Personalized assessment</p>
            <h2 className='mt-1 text-2xl font-bold tracking-tight text-slate-900'>Practice at your level</h2>
            <p className='mt-2 max-w-xl text-sm leading-relaxed text-slate-500'>
              CORA adjusts question difficulty from your visible mastery score and grades every answer
              deterministically.
            </p>
          </div>
          <div className='box-border flex min-w-48 items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4'>
            <HiOutlineChartBar className='h-6 w-6 text-red-600' />
            <div>
              <p className='text-[11px] font-semibold uppercase tracking-wider text-red-500'>Mastery</p>
              <p className='text-lg font-bold text-slate-900'>{mastery.score}%</p>
              <p className='text-xs capitalize text-slate-500'>{mastery.difficulty} difficulty</p>
            </div>
          </div>
        </div>
      )}

      <section
        className={`box-border rounded-2xl border border-red-100 bg-white p-5 shadow-sm sm:p-6 ${embedded ? '' : 'mt-6'}`}
      >
        {!embedded && (
          <label
            htmlFor='assessment-concept'
            className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'
          >
            Concept
          </label>
        )}
        <div className='mt-2 flex flex-col gap-3 sm:flex-row'>
          {!embedded && (
            <select
              id='assessment-concept'
              value={conceptId}
              disabled={loading || working || Boolean(quiz && !grade)}
              onChange={(event) => {
                setConceptId(event.target.value);
                setQuiz(null);
                setGrade(null);
                setAnswers({});
                setError('');
              }}
              className='box-border min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-red-300'
            >
              {concepts.map((concept) => (
                <option key={concept.id} value={concept.id}>
                  {concept.name}
                </option>
              ))}
            </select>
          )}
          <button
            type='button'
            onClick={startQuiz}
            disabled={!conceptId || working}
            className='flex items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {grade ? <HiOutlineArrowPath className='h-4 w-4' /> : <HiOutlineAcademicCap className='h-4 w-4' />}
            {working ? 'Preparing…' : grade ? 'Practice again' : 'Generate quiz'}
          </button>
        </div>

        {!loading && concepts.length === 0 && (
          <p className='mt-4 rounded-xl bg-red-50 p-4 text-sm text-slate-600'>
            No completed graph concepts are available yet. Finish ingestion, then refresh this page.
          </p>
        )}
        {error && <p className='mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>{error}</p>}
      </section>

      {quiz && (
        <div className='mt-6 space-y-4'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <h3 className='text-lg font-bold text-slate-900'>{quiz.concept.name}</h3>
            <span className='rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-600'>
              {quiz.difficulty} · {quiz.questions.length} questions
            </span>
          </div>

          {quiz.questions.map((question, questionIndex) => {
            const result = grade?.results.find((item) => item.id === question.id);
            return (
              <article
                key={question.id}
                className='box-border rounded-2xl border border-red-100 bg-white p-5 shadow-sm sm:p-6'
              >
                <p className='text-[11px] font-semibold uppercase tracking-wider text-red-500'>
                  Question {questionIndex + 1}
                </p>
                <h4 className='mt-2 text-base font-semibold leading-6 text-slate-900'>{question.question}</h4>
                <div className='mt-4 space-y-2'>
                  {question.options.map((option, optionIndex) => {
                    const correctOption = result && optionIndex === result.correct_index;
                    const wrongSelection = result && optionIndex === result.selected_index && !result.is_correct;
                    const selected = answers[question.id] === optionIndex;
                    return (
                      <button
                        key={option}
                        type='button'
                        disabled={Boolean(grade)}
                        onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                        style={{
                          ...OPTION_BASE_STYLE,
                          ...optionStateStyle({ correctOption, wrongSelection, selected }),
                        }}
                        className='w-full rounded-xl text-left text-sm transition-colors'
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                {result && (
                  <div className={`mt-4 rounded-xl p-4 ${result.is_correct ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <p className='flex items-center gap-2 text-sm font-semibold text-slate-900'>
                      {result.is_correct ? (
                        <HiOutlineCheckCircle className='h-5 w-5 text-emerald-600' />
                      ) : (
                        <HiOutlineXCircle className='h-5 w-5 text-red-600' />
                      )}
                      {result.is_correct ? 'Correct' : 'Not quite'}
                    </p>
                    <p className='mt-2 text-sm leading-relaxed text-slate-600'>{result.explanation}</p>
                  </div>
                )}
              </article>
            );
          })}

          {!grade ? (
            <button
              type='button'
              onClick={submitQuiz}
              disabled={!allAnswered || working}
              className='w-full rounded-full bg-red-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-red-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'
            >
              {working ? 'Grading…' : 'Submit answers'}
            </button>
          ) : (
            <div className='box-border rounded-2xl border border-red-200 bg-red-50 p-5'>
              <p className='text-xs font-semibold uppercase tracking-wider text-red-500'>Assessment complete</p>
              <p className='mt-1 text-2xl font-bold text-slate-900'>
                {grade.correct} of {grade.total} correct
              </p>
              <p className='mt-2 text-sm text-slate-600'>Your mastery is now {grade.mastery.score}%.</p>
            </div>
          )}

          {quiz.sources.length > 0 && (
            <p className='text-xs leading-relaxed text-slate-400'>Sources: {quiz.sources.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentAssess;
