import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { storageKey } from './sessionStore';
import { useSessionStore } from './useSessionStore';

describe('useSessionStore', () => {
  beforeEach(() => window.localStorage.clear());

  it('saves sessions per person and reloads them', () => {
    const { result, unmount } = renderHook(() => useSessionStore('a@x.edu'));
    act(() => result.current.record('guide', 'period', 'Reactor period'));
    unmount();
    const again = renderHook(() => useSessionStore('a@x.edu'));
    expect(again.result.current.sessions.map((session) => session.title)).toEqual(['Reactor period']);
  });

  it('never writes one person’s sessions under another’s key when the user changes', () => {
    const { result, rerender } = renderHook(({ user }) => useSessionStore(user), { initialProps: { user: 'a@x.edu' } });
    act(() => result.current.record('quiz', 'period', 'Reactor period'));
    rerender({ user: 'b@x.edu' });
    expect(result.current.sessions).toEqual([]);
    expect(window.localStorage.getItem(storageKey('b@x.edu'))).toBe('[]');
  });

  it('clears on request (sign-out)', () => {
    const { result } = renderHook(() => useSessionStore(undefined));
    act(() => result.current.record('guide', 'period', 'Reactor period'));
    act(() => result.current.clear());
    expect(result.current.sessions).toEqual([]);
  });
});
