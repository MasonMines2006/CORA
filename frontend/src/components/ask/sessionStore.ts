import { SessionMode, SessionSummary } from '../shell/types';
import { ChatFailure, ChatResult } from './askModel';

/*
 * Recent sessions, kept in the browser (DESIGN.md 10, Phase 2: server
 * persistence comes after Friday). Ask sessions keep their conversation;
 * Guide and Quiz entries only remember which concept you worked on.
 *
 * localStorage is user-controlled text, so everything read back is checked.
 */

export type CoraReply = ChatResult | { kind: 'pending' } | { kind: 'failed'; reason: ChatFailure; message: string };

export type AskTurn =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'cora'; question: string; reply: CoraReply };

export interface StoredSession extends SessionSummary {
  /** Only Ask sessions have turns. */
  turns?: AskTurn[];
}

export const MAX_SESSIONS = 40;
const MODES: SessionMode[] = ['ask', 'guide', 'quiz'];

export const storageKey = (userKey: string | undefined) => `cora.sessions.v1.${userKey || 'guest'}`;

const isSession = (value: unknown): value is StoredSession => {
  const item = value as StoredSession;
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.updatedAt === 'number' &&
    MODES.includes(item.mode) &&
    (item.turns === undefined || Array.isArray(item.turns))
  );
};

/** A reply still "pending" after a reload will never arrive; say so instead of spinning forever. */
const settleTurn = (turn: AskTurn): AskTurn => {
  if (turn.role === 'cora' && turn.reply.kind === 'pending') {
    return { ...turn, reply: { kind: 'failed', reason: 'error', message: 'This answer was interrupted.' } };
  }
  return turn;
};

export const loadSessions = (raw: string | null): StoredSession[] => {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isSession).map((session) => ({ ...session, turns: session.turns?.map(settleTurn) }));
  } catch {
    return [];
  }
};

/** Insert or replace by id; newest first; capped. Returns a new array. */
export const withSession = (sessions: StoredSession[], session: StoredSession): StoredSession[] => {
  const others = sessions.filter((item) => item.id !== session.id);
  return [session, ...others].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS);
};

/** Log that a lesson or quiz was opened. One entry per mode + concept. */
export const recordActivity = (
  sessions: StoredSession[],
  activity: { mode: Exclude<SessionMode, 'ask'>; conceptId: string; title: string },
  now = Date.now()
): StoredSession[] => {
  const existing = sessions.find((item) => item.mode === activity.mode && item.conceptId === activity.conceptId);
  const id = existing?.id ?? `${activity.mode}-${activity.conceptId}`;
  return withSession(sessions, { id, ...activity, updatedAt: now });
};

/** Ids are short, URL-safe and ours: "s-" + time + random, all base 36. */
export const newSessionId = () => `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
