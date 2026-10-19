import { useCallback, useEffect, useState } from 'react';
import { SessionMode } from '../shell/types';
import { loadSessions, recordActivity, StoredSession, storageKey, withSession } from './sessionStore';

/* localStorage can throw (private mode, storage full, blocked). Never let that break the app. */
const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, sessions: StoredSession[]) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(sessions));
  } catch {
    // Sessions just won't survive a reload; the conversation on screen is unaffected.
  }
};

/**
 * The recent-sessions list for one person (keyed by email, or "guest").
 * Lives in StudentApp so the sidebar and Ask share it, and an answer that
 * arrives after you've left Ask still lands in the right conversation.
 */
export const useSessionStore = (userKey: string | undefined) => {
  const key = storageKey(userKey);
  // The list remembers whose it is, so one person's sessions are never written under another's key.
  const [store, setStore] = useState(() => ({ key, sessions: loadSessions(read(key)) }));
  if (store.key !== key) {
    // Someone signed in or out: switch lists during this render, before anything is saved.
    setStore({ key, sessions: loadSessions(read(key)) });
  }

  useEffect(() => {
    write(store.key, store.sessions);
  }, [store]);

  const setSessions = useCallback((change: (list: StoredSession[]) => StoredSession[]) => {
    setStore((current) => ({ ...current, sessions: change(current.sessions) }));
  }, []);

  const upsert = useCallback(
    (session: StoredSession) => setSessions((list) => withSession(list, session)),
    [setSessions]
  );

  /** Change one session based on its latest saved state (safe while other updates are in flight). */
  const update = useCallback(
    (id: string, change: (session: StoredSession) => StoredSession) => {
      setSessions((list) => {
        const current = list.find((item) => item.id === id);
        return current ? withSession(list, change(current)) : list;
      });
    },
    [setSessions]
  );

  const record = useCallback(
    (mode: Exclude<SessionMode, 'ask'>, conceptId: string, title: string) =>
      setSessions((list) => recordActivity(list, { mode, conceptId, title })),
    [setSessions]
  );

  /** Forget everything for this person (used on sign-out). */
  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to clear if storage is unavailable.
    }
    setSessions(() => []);
  }, [key, setSessions]);

  return { sessions: store.key === key ? store.sessions : [], upsert, update, record, clear };
};
