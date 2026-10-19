import { describe, expect, it } from 'vitest';
import { classifyChatError, matchConcept, parseChatResponse, titleFrom } from './askModel';

const success = (message: string, sources: string[], chunks = 0, error?: string) => ({
  status: 'Success',
  data: {
    message,
    info: {
      sources,
      nodedetails: { chunkdetails: Array.from({ length: chunks }, (_, index) => ({ id: `c${index}`, score: 0.9 })) },
      ...(error ? { error } : {}),
    },
  },
});

describe('parseChatResponse', () => {
  it('reads a grounded answer with its sources and passage count', () => {
    expect(parseChatResponse(success('Decay heat is…', ['NE235_L11.pdf', 'RTM.pdf'], 3))).toEqual({
      kind: 'answer',
      text: 'Decay heat is…',
      sources: ['NE235_L11.pdf', 'RTM.pdf'],
      passageCount: 3,
    });
  });

  it('treats an answer with no published source as "not in the material"', () => {
    expect(parseChatResponse(success("I couldn't find any relevant documents.", [])).kind).toBe('notInMaterial');
  });

  it('treats a server-side failure as an error, even inside a "Success" envelope', () => {
    expect(parseChatResponse({ status: 'Failed', message: 'Unable to get chat response' })).toEqual({
      kind: 'error',
      message: 'Unable to get chat response',
    });
    expect(parseChatResponse(success('Something went wrong', [], 0, 'RuntimeError')).kind).toBe('error');
  });

  it('never trusts a malformed body', () => {
    expect(parseChatResponse(undefined).kind).toBe('error');
    expect(parseChatResponse({ status: 'Success', data: { info: {} } }).kind).toBe('error');
  });

  it('counts each source once, ignoring blanks', () => {
    const result = parseChatResponse(success('ok', ['A.pdf', 'A.pdf', '', 'B.pdf'], 1));
    expect(result.kind === 'answer' && result.sources).toEqual(['A.pdf', 'B.pdf']);
  });
});

describe('classifyChatError', () => {
  it('spots the hourly limit and keeps the server’s wording', () => {
    const error = { response: { status: 429, data: { detail: 'Guest Chat is limited to 10 questions per hour.' } } };
    expect(classifyChatError(error)).toEqual({
      reason: 'rateLimited',
      message: 'Guest Chat is limited to 10 questions per hour.',
    });
  });

  it('spots guest AI being switched off', () => {
    const error = { response: { status: 503, data: { message: 'Guest AI features are not available right now.' } } };
    expect(classifyChatError(error)).toEqual({
      reason: 'guestUnavailable',
      message: 'Guest AI features are not available right now.',
    });
  });

  it('calls anything else a plain error', () => {
    expect(classifyChatError(new Error('Network Error')).reason).toBe('error');
  });
});

describe('matchConcept', () => {
  const concepts = [
    { id: 'period', name: 'Reactor period' },
    { id: 'reactor', name: 'Reactor' },
    { id: 'xe', name: 'Xenon-135' },
  ];

  it('finds the longest concept name mentioned, ignoring case', () => {
    expect(matchConcept('Why is the REACTOR PERIOD negative?', concepts)?.id).toBe('period');
    expect(matchConcept('what does a reactor do', concepts)?.id).toBe('reactor');
    expect(matchConcept('xenon-135 after a trip', concepts)?.id).toBe('xe');
  });

  it('matches whole words only', () => {
    expect(matchConcept('reactors in general', concepts)).toBeUndefined();
  });

  it('returns nothing when no concept is named', () => {
    expect(matchConcept('hello', concepts)).toBeUndefined();
  });
});

describe('titleFrom', () => {
  it('uses the question, trimmed to a sidebar-friendly length', () => {
    expect(titleFrom('  Why does decay heat matter?  ')).toBe('Why does decay heat matter?');
    expect(titleFrom('a'.repeat(80))).toHaveLength(60);
  });
});
