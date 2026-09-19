import { ReviewCard, ReviewGrade } from '../../API/Index';

/*
 * Session rules for spaced review (docs/artboards/source/Flashcards.dc.html).
 * The long-term schedule lives on the server; this file only decides what
 * happens inside one sitting.
 */

export interface ReviewSessionState {
  queue: ReviewCard[];
  /** Cards graded good or easy this session. */
  known: number;
  /** Cards graded again or hard this session. */
  shaky: number;
}

/**
 * Advance past the current card. A card graded "again" is due again in about a
 * minute, so rather than end the session on it, it goes to the back of the queue
 * and comes round once more before the student leaves.
 */
export const afterGrade = (session: ReviewSessionState, grade: ReviewGrade): ReviewSessionState => {
  const [current, ...rest] = session.queue;
  if (!current) {
    return session;
  }
  const isKnown = grade === 'good' || grade === 'easy';
  return {
    queue: grade === 'again' ? [...rest, current] : rest,
    known: session.known + (isKnown ? 1 : 0),
    shaky: session.shaky + (isKnown ? 0 : 1),
  };
};

/** Rough time per card, used only for the "about N min left" estimate. */
const SECONDS_PER_CARD = 25;

export const timeLeftLabel = (cardsLeft: number): string => {
  if (cardsLeft <= 0) {
    return 'done';
  }
  const minutes = Math.round((cardsLeft * SECONDS_PER_CARD) / 60);
  return minutes < 1 ? 'under a minute left' : `about ${minutes} min left`;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const lastSeenLabel = (lastReviewedAt: string | null, now: Date = new Date()): string => {
  if (!lastReviewedAt) {
    return 'new card';
  }
  const elapsed = now.getTime() - new Date(lastReviewedAt).getTime();
  if (elapsed < HOUR_MS) {
    return 'last seen just now';
  }
  if (elapsed < DAY_MS) {
    const hours = Math.round(elapsed / HOUR_MS);
    return `last seen ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.round(elapsed / DAY_MS);
  return `last seen ${days} day${days === 1 ? '' : 's'} ago`;
};
