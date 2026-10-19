import { useCallback, useEffect, useState } from 'react';
import { getLearningDashboard, LearningDashboard } from '../../API/Index';

/** Data that arrives over the network is always in exactly one of these three states. */
export type Loadable<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

/**
 * Loads GET /learning/dashboard once for the whole student app, so the Path,
 * Progress and the sidebar's "cards due" badge agree. Call `reload()` after
 * anything that changes mastery (a quiz, a review).
 */
export const useDashboard = () => {
  const [state, setState] = useState<Loadable<LearningDashboard>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getLearningDashboard(controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch(() => {
        // An abort means we left or reloaded on purpose; that is not an error to show.
        if (!controller.signal.aborted) {
          setState({ status: 'error' });
        }
      });
    return () => controller.abort();
  }, [attempt]);

  // Keep showing the old numbers while new ones load, unless there were none.
  const reload = useCallback(() => {
    setState((previous) => (previous.status === 'ready' ? previous : { status: 'loading' }));
    setAttempt((count) => count + 1);
  }, []);

  return { dashboard: state, reload };
};
