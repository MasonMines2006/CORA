import { afterEach, describe, expect, it } from 'vitest';
import { clearStoredSession, readStoredSession, writeStoredSession } from './tokenStore';

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

describe('tokenStore', () => {
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('keeps a normal session only for this browser tab session', () => {
    writeStoredSession({ token: 't1', expires_at: inOneHour() }, false);

    expect(window.sessionStorage.length).toBe(1);
    expect(window.localStorage.length).toBe(0);
    expect(readStoredSession()?.token).toBe('t1');
  });

  it('remembers a "keep me signed in" session across browser restarts', () => {
    writeStoredSession({ token: 't2', expires_at: inOneHour() }, true);

    expect(window.localStorage.length).toBe(1);
    expect(readStoredSession()?.token).toBe('t2');
  });

  it('ignores and removes an expired session', () => {
    writeStoredSession({ token: 'old', expires_at: new Date(Date.now() - 1000).toISOString() }, true);

    expect(readStoredSession()).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it('ignores garbage left in storage', () => {
    window.localStorage.setItem('cora.session', '{not json');

    expect(readStoredSession()).toBeNull();
  });

  it('clear removes the session from both places', () => {
    writeStoredSession({ token: 'a', expires_at: inOneHour() }, true);
    writeStoredSession({ token: 'b', expires_at: inOneHour() }, false);

    clearStoredSession();

    expect(readStoredSession()).toBeNull();
  });
});
