import { useEffect, useReducer, useState } from 'react';
import { generateLearningQuiz, gradeLearningQuiz, LearningQuiz } from '../../API/Index';
import { classifyLoadError, httpStatus, LoadFailure } from '../Student/loadError';
import { initialQuizState, quizReducer } from './quizModel';

export type QuizLoad =
  | { status: 'loading' }
  | { status: 'failed'; reason: LoadFailure }
  | { status: 'ready'; quiz: LearningQuiz };

/** How many questions a quiz has (the API's default too). */
export const QUESTION_COUNT = 3;

/**
 * Generates a quiz for the concept, runs the answering state machine, and
 * grades every answer at once when the last one is in.
 */
export const useQuizSession = (conceptId: string) => {
  const [load, setLoad] = useState<QuizLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [state, dispatch] = useReducer(quizReducer, initialQuizState(0));
  const [startedAt, setStartedAt] = useState(Date.now());

  useEffect(() => {
    // Generating is a POST with no abort signal, so a late reply from an old request is ignored instead.
    let isCurrent = true;
    setLoad({ status: 'loading' });
    generateLearningQuiz(conceptId, QUESTION_COUNT)
      .then((quiz) => {
        if (isCurrent) {
          // A new quiz gets a fresh answer sheet with one slot per question.
          dispatch({ type: 'reset', questionCount: quiz.questions.length });
          setLoad({ status: 'ready', quiz });
          setStartedAt(Date.now());
        }
      })
      .catch((error) => isCurrent && setLoad({ status: 'failed', reason: classifyLoadError(error) }));
    return () => {
      isCurrent = false;
    };
  }, [conceptId, attempt]);

  const quiz = load.status === 'ready' ? load.quiz : undefined;
  useEffect(() => {
    if (state.phase !== 'grading' || !quiz) {
      return;
    }
    gradeLearningQuiz(quiz.quiz_id, state.answers as number[])
      .then((grade) => dispatch({ type: 'graded', grade }))
      .catch((error) => dispatch({ type: 'gradeFailed', reason: httpStatus(error) === 401 ? 'signedOut' : 'error' }));
  }, [state.phase, state.answers, quiz]);

  return { load, quiz, state, dispatch, startedAt, regenerate: () => setAttempt((count) => count + 1) };
};
