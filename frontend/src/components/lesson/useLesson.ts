import { useEffect, useState } from 'react';
import { getLearningLesson, LearningLesson, saveLessonProgress } from '../../API/Index';
import { classifyLoadError, isCanceled, LoadFailure } from '../Student/loadError';
import { clampBeat } from './lessonModel';

export type LessonLoad =
  | { status: 'loading' }
  | { status: 'failed'; reason: LoadFailure }
  | { status: 'ready'; lesson: LearningLesson };

/** Loads the four-beat lesson and remembers the step, so the Path can offer "Continue lesson". */
export const useLesson = (conceptId: string, initialBeat?: number) => {
  const [load, setLoad] = useState<LessonLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState(initialBeat ?? 0);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: 'loading' });
    getLearningLesson(conceptId, controller.signal)
      .then((lesson) => {
        setStep((current) => clampBeat(current, lesson.beats.length));
        setLoad({ status: 'ready', lesson });
      })
      .catch((error) => {
        if (!isCanceled(error) && !controller.signal.aborted) {
          setLoad({ status: 'failed', reason: classifyLoadError(error) });
        }
      });
    return () => controller.abort();
  }, [conceptId, attempt]);

  const lesson = load.status === 'ready' ? load.lesson : undefined;
  useEffect(() => {
    if (lesson) {
      // Not shown on failure on purpose: a lost position costs one click next
      // time, whereas an error banner would interrupt the lesson.
      saveLessonProgress(conceptId, step, lesson.beats.length).catch(() => undefined);
    }
  }, [conceptId, lesson, step]);

  return { load, lesson, step, setStep, retry: () => setAttempt((count) => count + 1) };
};
