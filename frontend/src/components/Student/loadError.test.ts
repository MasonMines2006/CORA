import { describe, expect, it } from 'vitest';
import { classifyLoadError, isCanceled } from './loadError';

const withStatus = (status: number) => ({ response: { status } });

describe('classifyLoadError', () => {
  it('names the states the lesson and quiz screens show', () => {
    expect(classifyLoadError(withStatus(409))).toBe('notEnoughMaterial');
    expect(classifyLoadError(withStatus(404))).toBe('notFound');
    expect(classifyLoadError(withStatus(401))).toBe('signedOut');
    expect(classifyLoadError(withStatus(503))).toBe('error');
    expect(classifyLoadError(new Error('Network Error'))).toBe('error');
  });

  it('recognises a cancelled request', () => {
    expect(isCanceled({ name: 'CanceledError' })).toBe(true);
    expect(isCanceled(new Error('x'))).toBe(false);
  });
});
