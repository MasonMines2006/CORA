/** The three ways into a concept. Shown as ASK / GUIDE / QUIZ tags in the sidebar. */
export type SessionMode = 'ask' | 'guide' | 'quiz';

/** One line in the sidebar's "recent sessions" list. */
export interface SessionSummary {
  id: string;
  mode: SessionMode;
  title: string;
  /** Set when the session was about one concept, so reopening a lesson or quiz knows which. */
  conceptId?: string;
  /** Milliseconds since 1970, from Date.now(). */
  updatedAt: number;
}
