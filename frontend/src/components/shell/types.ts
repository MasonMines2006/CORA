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

/**
 * The three ways into a concept (DESIGN.md principle 2). Every screen that
 * shows a concept offers all three, and switching mode keeps the concept.
 */
export interface ModeActions {
  /** Guide me: open the step-by-step lesson, optionally at a step. */
  onGuide: (conceptId: string, beat?: number) => void;
  /** Ask: open Ask with a starter question, scoped to the concept when given. */
  onAsk: (prompt: string, conceptId?: string) => void;
  /** Quiz me: generate questions at the learner's level. */
  onQuiz: (conceptId: string) => void;
}
