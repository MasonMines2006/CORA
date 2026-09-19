import { LearningConcept, LearningMastery } from '../../API/Index';

/*
 * Presentation rules for the concept hub (docs/artboards/source/Concept.dc.html),
 * kept out of the components so they can be tested without rendering anything.
 */

export type HubMode = 'learn' | 'practice' | 'cards' | 'graph' | 'sources';

export const HUB_MODES: ReadonlyArray<{ key: HubMode; label: string }> = [
  { key: 'learn', label: 'Learn' },
  { key: 'practice', label: 'Practice' },
  { key: 'cards', label: 'Cards' },
  { key: 'graph', label: 'Graph' },
  { key: 'sources', label: 'Sources' },
];

/** The mode arrives from the URL, so treat it as untrusted until it matches a real one. */
export const isHubMode = (value: string | null | undefined): value is HubMode =>
  HUB_MODES.some((mode) => mode.key === value);

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * "Appears in 16 passages across 3 documents · linked to 8 other concepts".
 * The graph is stated as a fact about the concept, not as decoration.
 * `linkedCount` is null until the neighbourhood has loaded.
 */
export const provenanceLine = (concept: LearningConcept, linkedCount: number | null): string => {
  const joiner = concept.document_count === 1 ? 'in' : 'across';
  const appears = `Appears in ${plural(concept.chunk_count, 'passage')} ${joiner} ${plural(concept.document_count, 'document')}`;
  if (linkedCount === null) {
    return appears;
  }
  return `${appears} · linked to ${plural(linkedCount, 'other concept')}`;
};

/** "3 of 5 correct · medium" — the difficulty the next quiz will pick is visible before you start. */
export const masteryDetail = (mastery: LearningMastery | null | undefined): string => {
  if (!mastery || mastery.attempts === 0) {
    return 'Not practised yet';
  }
  return `${mastery.correct} of ${mastery.attempts} correct · ${mastery.difficulty}`;
};

export interface Point {
  x: number;
  y: number;
}

/** Evenly spaced points on a circle, first one at twelve o'clock, going clockwise. */
export const radialLayout = (count: number, circle: { cx: number; cy: number; radius: number }): Point[] =>
  Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    return {
      x: circle.cx + circle.radius * Math.cos(angle),
      y: circle.cy + circle.radius * Math.sin(angle),
    };
  });

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;

/**
 * How long until a card comes back, printed under each review button.
 * Showing the interval is what makes spaced repetition legible instead of magic.
 */
export const formatInterval = (seconds: number): string => {
  if (seconds <= MINUTE) {
    return '< 1 min';
  }
  if (seconds < HOUR) {
    return plural(Math.round(seconds / MINUTE), 'min').replace('mins', 'min');
  }
  if (seconds < DAY) {
    return plural(Math.round(seconds / HOUR), 'hour');
  }
  if (seconds < MONTH) {
    return plural(Math.round(seconds / DAY), 'day');
  }
  const months = Math.round((seconds / MONTH) * 10) / 10;
  return `${months} month${months === 1 ? '' : 's'}`;
};

/**
 * A question typed on a concept page is about that concept even when it does not
 * say so ("why is it negative?"). Name the concept for Chat's retrieval unless the
 * student already did.
 */
export const scopedPrompt = (conceptName: string, question: string): string => {
  const trimmed = question.trim();
  if (trimmed.toLowerCase().includes(conceptName.toLowerCase())) {
    return trimmed;
  }
  return `About ${conceptName}: ${trimmed}`;
};

/** Two starter questions for the "Ask about this" rail. */
export const suggestedQuestions = (conceptName: string): string[] => [
  `Explain ${conceptName} in plain terms, with one example from the course.`,
  `How does ${conceptName} come up when operating the PULSTAR reactor?`,
];
