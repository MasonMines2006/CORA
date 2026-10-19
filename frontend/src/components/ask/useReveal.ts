import { useEffect, useState } from 'react';

/** Longest a reveal may take, so long answers don't keep you waiting. */
const MAX_REVEAL_MS = 1600;
/** Roughly how long each character takes to appear. */
const MS_PER_CHAR = 8;

/** True when the person asked for less motion, or when we can't tell (tests, very old browsers). */
const prefersInstant = () =>
  typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Reveals a finished answer a few characters at a time (DESIGN.md 5.4: the
 * backend returns the whole answer, so the "stream" happens here).
 *
 * The count is worked out from the clock on every tick rather than adding a
 * fixed amount. Browsers slow timers right down in background tabs, and the
 * old requestAnimationFrame version stopped completely there (see CLAUDE.md),
 * leaving an empty bubble. This one simply catches up on the next tick.
 */
export const useReveal = (text: string, animate: boolean) => {
  const [shown, setShown] = useState(animate && !prefersInstant() ? 0 : text.length);

  useEffect(() => {
    if (!animate || prefersInstant()) {
      setShown(text.length);
      return undefined;
    }
    const duration = Math.min(MAX_REVEAL_MS, text.length * MS_PER_CHAR);
    const started = Date.now();
    const timer = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - started) / duration);
      setShown(Math.round(progress * text.length));
      if (progress >= 1) {
        window.clearInterval(timer);
      }
    }, 30);
    return () => window.clearInterval(timer);
  }, [text, animate]);

  return { visibleText: text.slice(0, shown), isDone: shown >= text.length };
};
