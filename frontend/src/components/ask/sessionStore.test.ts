import { describe, expect, it } from 'vitest';
import { loadSessions, MAX_SESSIONS, recordActivity, StoredSession, storageKey, withSession } from './sessionStore';

const askSession = (id: string, updatedAt: number, turns: StoredSession['turns'] = []): StoredSession => ({
  id,
  mode: 'ask',
  title: id,
  updatedAt,
  turns,
});

describe('storageKey', () => {
  it('keeps each person’s sessions apart, and guests in their own slot', () => {
    expect(storageKey('jr@university.edu')).toBe('cora.sessions.v1.jr@university.edu');
    expect(storageKey(undefined)).toBe('cora.sessions.v1.guest');
  });
});

describe('loadSessions', () => {
  it('returns nothing for missing or corrupt storage', () => {
    expect(loadSessions(null)).toEqual([]);
    expect(loadSessions('{not json')).toEqual([]);
    expect(loadSessions('{"a":1}')).toEqual([]);
  });

  it('drops entries that are not sessions', () => {
    const raw = JSON.stringify([askSession('s-1', 1), { id: 3 }, null, { ...askSession('s-2', 2), mode: 'hack' }]);
    expect(loadSessions(raw).map((session) => session.id)).toEqual(['s-1']);
  });

  it('marks an answer that was still loading when the page closed as interrupted, keeping the question', () => {
    const raw = JSON.stringify([
      askSession('s-1', 1, [
        { id: 't1', role: 'user', text: 'Why?' },
        { id: 't2', role: 'cora', question: 'Why?', reply: { kind: 'pending' } },
      ]),
    ]);
    const [session] = loadSessions(raw);
    expect(session.turns?.[1]).toEqual({
      id: 't2',
      role: 'cora',
      question: 'Why?',
      reply: { kind: 'failed', reason: 'error', message: 'This answer was interrupted.' },
    });
  });
});

describe('withSession', () => {
  it('adds a new session at the front and updates an existing one in place', () => {
    const start = [askSession('s-1', 1)];
    const added = withSession(start, askSession('s-2', 2));
    expect(added.map((session) => session.id)).toEqual(['s-2', 's-1']);
    const renamed = withSession(added, { ...askSession('s-1', 3), title: 'Renamed' });
    expect(renamed.find((session) => session.id === 's-1')?.title).toBe('Renamed');
    expect(start).toHaveLength(1); // never mutates
  });

  it('keeps only the most recent sessions', () => {
    let sessions: StoredSession[] = [];
    for (let index = 0; index < MAX_SESSIONS + 5; index += 1) {
      sessions = withSession(sessions, askSession(`s-${index}`, index));
    }
    expect(sessions).toHaveLength(MAX_SESSIONS);
    expect(sessions.some((session) => session.id === 's-0')).toBe(false);
  });
});

describe('recordActivity', () => {
  it('logs a lesson or quiz once per concept, moving it to the top when repeated', () => {
    let sessions = recordActivity([], { mode: 'guide', conceptId: 'period', title: 'Reactor period' }, 10);
    sessions = recordActivity(sessions, { mode: 'quiz', conceptId: 'period', title: 'Reactor period' }, 20);
    sessions = recordActivity(sessions, { mode: 'guide', conceptId: 'period', title: 'Reactor period' }, 30);
    expect(sessions.map((session) => [session.mode, session.updatedAt])).toEqual([
      ['guide', 30],
      ['quiz', 20],
    ]);
  });
});
