import { LearningConceptProgress, LearningDashboard } from '../../API/Index';
import { masteryState, MasteryState } from '../Student/learningState';

/*
 * Turns the dashboard into the learning path (DESIGN.md 5.3).
 *
 * Units: until admins can define units, a unit is "every concept whose first
 * published source is the same document" (`concept.sources[0]`), named after
 * that document. Nothing is locked; the order is only a suggestion.
 */

/** A path node's look. `current` is the one concept we suggest working on now. */
export type NodeState = MasteryState | 'current';

export type UnitStatus = 'complete' | 'current' | 'upcoming' | 'later';

export interface PathConcept extends LearningConceptProgress {
  nodeState: NodeState;
}

export interface PathUnit {
  /** The document filename the unit is built from, or null for concepts with no source. */
  source: string | null;
  title: string;
  concepts: PathConcept[];
  masteredCount: number;
  status: UnitStatus;
}

export interface LearningPath {
  units: PathUnit[];
  /** The concept the Continue card and the pulsing node point at. Empty when everything is mastered. */
  currentId: string;
}

const NO_SOURCE_TITLE = 'Other material';

/**
 * "NE235_L07_Kinetics.pdf" -> "NE235 L07 Kinetics".
 * A hyphen joining two words becomes a space; " - " between words is kept as written.
 */
export const unitTitle = (filename: string): string =>
  filename
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/_+/g, ' ')
    .replace(/(\S)-(?=\S)/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

/** Which concept to suggest now: where the learner left off, else the server's pick, else the first unmastered. */
const pickCurrentId = (dashboard: LearningDashboard): string => {
  const ids = new Set(dashboard.concepts.map((item) => item.concept.id));
  const lastLesson = dashboard.last_lesson?.concept_id;
  if (lastLesson && ids.has(lastLesson)) {
    return lastLesson;
  }
  const recommended = dashboard.recommended?.concept.id;
  if (recommended && ids.has(recommended)) {
    return recommended;
  }
  const firstOpen = dashboard.concepts.find((item) => masteryState(item.mastery) !== 'mastered');
  return firstOpen?.concept.id ?? '';
};

/** Group concepts by primary source, keeping the dashboard's ranking order. */
const groupBySource = (concepts: LearningConceptProgress[]) => {
  const groups = new Map<string | null, LearningConceptProgress[]>();
  for (const item of concepts) {
    const source = item.concept.sources[0] ?? null;
    groups.set(source, [...(groups.get(source) ?? []), item]);
  }
  // Concepts without a source go last, so real documents lead the path.
  const entries = [...groups.entries()];
  return [...entries.filter(([source]) => source !== null), ...entries.filter(([source]) => source === null)];
};

const nodeStateFor = (item: LearningConceptProgress, currentId: string): NodeState => {
  const state = masteryState(item.mastery);
  if (item.concept.id === currentId && state !== 'mastered') {
    return 'current';
  }
  return state;
};

const assignStatuses = (units: Omit<PathUnit, 'status'>[], currentId: string): PathUnit[] => {
  const currentIndex = units.findIndex((unit) => unit.concepts.some((item) => item.concept.id === currentId));
  let upcomingAssigned = false;
  return units.map((unit, index) => {
    if (unit.masteredCount === unit.concepts.length) {
      return { ...unit, status: 'complete' };
    }
    if (index === currentIndex) {
      return { ...unit, status: 'current' };
    }
    if (currentIndex !== -1 && index > currentIndex && !upcomingAssigned) {
      upcomingAssigned = true;
      return { ...unit, status: 'upcoming' };
    }
    return { ...unit, status: 'later' };
  });
};

export const buildPath = (dashboard: LearningDashboard): LearningPath => {
  const currentId = pickCurrentId(dashboard);
  const units = groupBySource(dashboard.concepts).map(([source, items]) => {
    const concepts = items.map((item) => ({ ...item, nodeState: nodeStateFor(item, currentId) }));
    return {
      source,
      title: source ? unitTitle(source) : NO_SOURCE_TITLE,
      concepts,
      masteredCount: concepts.filter((item) => masteryState(item.mastery) === 'mastered').length,
    };
  });
  return { units: assignStatuses(units, currentId), currentId };
};

/** The started-but-not-mastered concept with the lowest score: the "weak spot". */
export const weakestConcept = (concepts: LearningConceptProgress[]): LearningConceptProgress | undefined =>
  concepts
    .filter((item) => masteryState(item.mastery) === 'inProgress')
    .sort((a, b) => a.mastery.score - b.mastery.score)[0];

/** What a not-started node shows: short ids as-is ("SUR"), otherwise up to three initials. */
export const conceptAbbreviation = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length <= 4 && !trimmed.includes(' ')) {
    return trimmed;
  }
  const words = trimmed.split(/[\s-]+/).filter((word) => /^[a-z]/i.test(word));
  return words
    .slice(0, 3)
    .map((word) => word[0].toUpperCase())
    .join('');
};

/** "Evening, Jordan." for a signed-in learner; "Good evening." when we don't know their name. */
export const greetingFor = (now: Date, name?: string): string => {
  const hour = now.getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const firstName = name?.trim().split(/\s+/)[0];
  if (!firstName) {
    return `Good ${part}.`;
  }
  return `${part[0].toUpperCase()}${part.slice(1)}, ${firstName}.`;
};
