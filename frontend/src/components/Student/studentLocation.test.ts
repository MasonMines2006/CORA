import { describe, expect, it } from 'vitest';
import { parseLocation, toSearchParams } from './studentLocation';

const parse = (query: string) => parseLocation(new URLSearchParams(query));

describe('parseLocation', () => {
  it('opens Home when the URL says nothing', () => {
    expect(parse('')).toEqual({ view: 'home', conceptId: '', mode: 'learn', beat: undefined });
  });

  it('reads a concept page in a given mode', () => {
    expect(parse('view=concepts&concept=Reactivity&mode=graph')).toEqual({
      view: 'concepts',
      conceptId: 'Reactivity',
      mode: 'graph',
      beat: undefined,
    });
  });

  it('keeps concept ids with spaces and symbols intact', () => {
    expect(parse('view=concepts&concept=1%2FM+Plot').conceptId).toBe('1/M Plot');
  });

  it('falls back to safe defaults for anything it does not recognise', () => {
    expect(parse('view=admin&mode=delete')).toEqual({ view: 'home', conceptId: '', mode: 'learn', beat: undefined });
  });

  it('accepts a lesson step only as a small non-negative whole number', () => {
    expect(parse('view=concepts&concept=Keff&beat=2').beat).toBe(2);
    expect(parse('view=concepts&concept=Keff&beat=-1').beat).toBeUndefined();
    expect(parse('view=concepts&concept=Keff&beat=two').beat).toBeUndefined();
    expect(parse('view=concepts&concept=Keff&beat=99').beat).toBeUndefined();
  });
});

describe('toSearchParams', () => {
  it('writes only what the view needs, so URLs stay short and shareable', () => {
    expect(toSearchParams({ view: 'home', conceptId: 'Keff', mode: 'cards' }).toString()).toBe('');
    expect(toSearchParams({ view: 'review', conceptId: '', mode: 'learn' }).toString()).toBe('view=review');
    expect(toSearchParams({ view: 'concepts', conceptId: '', mode: 'learn' }).toString()).toBe('view=concepts');
  });

  it('round-trips a concept page', () => {
    const location = { view: 'concepts' as const, conceptId: '1/M Plot', mode: 'sources' as const, beat: undefined };
    expect(parseLocation(toSearchParams(location))).toEqual(location);
  });

  it('leaves the default mode out of the URL', () => {
    expect(toSearchParams({ view: 'concepts', conceptId: 'Keff', mode: 'learn' }).toString()).toBe(
      'view=concepts&concept=Keff'
    );
  });
});
