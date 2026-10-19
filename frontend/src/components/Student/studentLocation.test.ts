import { describe, expect, it } from 'vitest';
import { isFocusView, parseLocation, toSearchParams } from './studentLocation';

const parse = (query: string) => parseLocation(new URLSearchParams(query));

describe('parseLocation', () => {
  it('opens the Path when the URL says nothing', () => {
    expect(parse('')).toEqual({ view: 'path', conceptId: '', beat: undefined, session: undefined });
  });

  it('reads every view in the redesign', () => {
    for (const view of ['path', 'ask', 'lesson', 'quiz', 'results', 'review', 'progress', 'graph']) {
      expect(parse(`view=${view}`).view).toBe(view);
    }
  });

  it('reads a lesson for a concept, at a step', () => {
    expect(parse('view=lesson&concept=Reactivity&beat=2')).toEqual({
      view: 'lesson',
      conceptId: 'Reactivity',
      beat: 2,
      session: undefined,
    });
  });

  it('keeps concept ids with spaces and symbols intact', () => {
    expect(parse('view=quiz&concept=1%2FM+Plot').conceptId).toBe('1/M Plot');
  });

  it('falls back to safe defaults for anything it does not recognise', () => {
    expect(parse('view=admin&mode=delete')).toEqual({
      view: 'path',
      conceptId: '',
      beat: undefined,
      session: undefined,
    });
  });

  it('accepts a lesson step only as a small non-negative whole number', () => {
    expect(parse('view=lesson&concept=Keff&beat=2').beat).toBe(2);
    expect(parse('view=lesson&concept=Keff&beat=-1').beat).toBeUndefined();
    expect(parse('view=lesson&concept=Keff&beat=two').beat).toBeUndefined();
    expect(parse('view=lesson&concept=Keff&beat=99').beat).toBeUndefined();
  });

  it('accepts a session id only when it looks like one of ours', () => {
    expect(parse('view=ask&session=s-1a2b3c').session).toBe('s-1a2b3c');
    expect(parse('view=ask&session=<script>').session).toBeUndefined();
    expect(parse(`view=ask&session=${'a'.repeat(80)}`).session).toBeUndefined();
  });

  describe('links from before the redesign still land somewhere sensible', () => {
    it('sends old Home links to the Path', () => {
      expect(parse('view=home').view).toBe('path');
    });

    it('sends an old concept page to that concept’s lesson, keeping the step', () => {
      expect(parse('view=concepts&concept=Keff&beat=1')).toMatchObject({ view: 'lesson', conceptId: 'Keff', beat: 1 });
    });

    it('sends an old Practice tab to the quiz for that concept', () => {
      expect(parse('view=concepts&concept=Keff&mode=practice')).toMatchObject({ view: 'quiz', conceptId: 'Keff' });
    });

    it('sends the old concept list to the Path', () => {
      expect(parse('view=concepts').view).toBe('path');
    });
  });
});

describe('toSearchParams', () => {
  it('writes only what the view needs, so URLs stay short and shareable', () => {
    expect(toSearchParams({ view: 'path', conceptId: 'Keff' }).toString()).toBe('');
    expect(toSearchParams({ view: 'review', conceptId: '' }).toString()).toBe('view=review');
    expect(toSearchParams({ view: 'progress', conceptId: '', beat: 2 }).toString()).toBe('view=progress');
  });

  it('round-trips a lesson at a step', () => {
    const location = { view: 'lesson' as const, conceptId: '1/M Plot', beat: 3, session: undefined };
    expect(parseLocation(toSearchParams(location))).toEqual(location);
  });

  it('keeps the concept for the modes that work on one', () => {
    expect(toSearchParams({ view: 'quiz', conceptId: 'Keff' }).toString()).toBe('view=quiz&concept=Keff');
    expect(toSearchParams({ view: 'ask', conceptId: 'Keff' }).toString()).toBe('view=ask&concept=Keff');
  });

  it('writes the step only for lessons and the session only for Ask', () => {
    expect(toSearchParams({ view: 'quiz', conceptId: 'Keff', beat: 2, session: 's-1' }).toString()).toBe(
      'view=quiz&concept=Keff'
    );
    expect(toSearchParams({ view: 'ask', conceptId: '', session: 's-1' }).toString()).toBe('view=ask&session=s-1');
  });
});

describe('isFocusView', () => {
  it('hides the app chrome only for lessons, quizzes and results', () => {
    expect(isFocusView('lesson') && isFocusView('quiz') && isFocusView('results')).toBe(true);
    expect(['path', 'ask', 'review', 'progress', 'graph'].some((view) => isFocusView(view as 'path'))).toBe(false);
  });
});
