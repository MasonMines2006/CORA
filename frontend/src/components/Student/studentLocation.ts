import { HubMode, isHubMode } from './conceptHubModel';

/*
 * Where the student is in the app, kept in the URL query string
 * (/student?view=concepts&concept=Reactivity&mode=graph).
 *
 * Tabs used to live only in React state, so a refresh dropped you on Home and
 * the back button left the app. The query string fixes both and makes any
 * concept page linkable, without turning tabs into routes — routes would
 * unmount Chat and lose the conversation, which is why the app avoided them.
 */

export type StudentView = 'home' | 'concepts' | 'graph' | 'review' | 'ask';

const VIEWS: readonly StudentView[] = ['home', 'concepts', 'graph', 'review', 'ask'];

export interface StudentLocation {
  view: StudentView;
  /** Empty on the concept list; set on a concept page. */
  conceptId: string;
  mode: HubMode;
  /** Lesson step to resume at. Only meaningful on a concept page in Learn mode. */
  beat?: number;
}

/** Lessons have four steps; anything outside a small range is a bad link, not a position. */
const MAX_BEAT = 9;

const isView = (value: string | null): value is StudentView => VIEWS.includes(value as StudentView);

const parseBeat = (value: string | null): number | undefined => {
  if (value === null || !/^\d+$/.test(value)) {
    return undefined;
  }
  const beat = Number(value);
  return beat <= MAX_BEAT ? beat : undefined;
};

/** The URL is user input: anything unrecognised falls back to a safe default. */
export const parseLocation = (params: URLSearchParams): StudentLocation => {
  const view = params.get('view');
  const mode = params.get('mode');
  return {
    view: isView(view) ? view : 'home',
    conceptId: params.get('concept') ?? '',
    mode: isHubMode(mode) ? mode : 'learn',
    beat: parseBeat(params.get('beat')),
  };
};

export const toSearchParams = (location: StudentLocation): URLSearchParams => {
  const params = new URLSearchParams();
  if (location.view === 'home') {
    return params;
  }
  params.set('view', location.view);
  if (location.view === 'concepts' && location.conceptId) {
    params.set('concept', location.conceptId);
    if (location.mode !== 'learn') {
      params.set('mode', location.mode);
    }
    if (location.beat !== undefined) {
      params.set('beat', String(location.beat));
    }
  }
  return params;
};
