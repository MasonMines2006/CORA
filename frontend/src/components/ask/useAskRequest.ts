import { useCallback } from 'react';
import { chatBotAPI } from '../../services/QnaAPI';
import { chatModeLables } from '../../utils/Constants';
import { classifyChatError, parseChatResponse, titleFrom } from './askModel';
import { AskTurn, CoraReply, newSessionId, StoredSession } from './sessionStore';

interface Store {
  upsert: (session: StoredSession) => void;
  update: (id: string, change: (session: StoredSession) => StoredSession) => void;
}

const turnId = () => `t-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const setReply = (turns: AskTurn[] = [], coraId: string, reply: CoraReply): AskTurn[] =>
  turns.map((turn) => (turn.id === coraId && turn.role === 'cora' ? { ...turn, reply } : turn));

/**
 * Sending a question: write it into the session first (so it shows at once and
 * survives leaving the page), then ask the existing /chat_bot endpoint and
 * write the reply into the same turn. Learners always get the server's
 * published-only vector mode; the server also picks the model.
 */
export const useAskRequest = (store: Store, onArrived: (coraTurnId: string) => void) => {
  const request = useCallback(
    (sessionId: string, coraId: string, question: string) => {
      chatBotAPI(question, sessionId, '', chatModeLables.vector, [])
        .then(({ response }) => parseChatResponse(response.data))
        .catch((error: unknown): CoraReply => ({ kind: 'failed', ...classifyChatError(error) }))
        .then((reply) => {
          store.update(sessionId, (session) => ({ ...session, turns: setReply(session.turns, coraId, reply) }));
          onArrived(coraId);
        });
    },
    [store, onArrived]
  );

  /** Ask a new question. Creates the session if there isn't one yet; returns its id. */
  const send = useCallback(
    (question: string, session: StoredSession | undefined, conceptId?: string): string => {
      const sessionId = session?.id ?? newSessionId();
      if (!session) {
        store.upsert({
          id: sessionId,
          mode: 'ask',
          title: titleFrom(question),
          conceptId,
          updatedAt: Date.now(),
          turns: [],
        });
      }
      const coraId = turnId();
      const newTurns: AskTurn[] = [
        { id: turnId(), role: 'user', text: question },
        { id: coraId, role: 'cora', question, reply: { kind: 'pending' } },
      ];
      store.update(sessionId, (current) => ({
        ...current,
        updatedAt: Date.now(),
        turns: [...(current.turns ?? []), ...newTurns],
      }));
      request(sessionId, coraId, question);
      return sessionId;
    },
    [store, request]
  );

  /** Try a failed reply again, in place. Any partial work (the question) is kept. */
  const retry = useCallback(
    (sessionId: string, coraId: string, question: string) => {
      store.update(sessionId, (session) => ({
        ...session,
        turns: setReply(session.turns, coraId, { kind: 'pending' }),
      }));
      request(sessionId, coraId, question);
    },
    [store, request]
  );

  return { send, retry };
};
