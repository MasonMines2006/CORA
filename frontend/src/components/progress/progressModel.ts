import { LearningConceptProgress, LearningDashboard } from '../../API/Index';
import { masteryState } from '../Student/learningState';
import { buildPath } from '../path/pathModel';

/*
 * Numbers for the Progress page (DESIGN.md 5.8), all from GET /learning/dashboard.
 * The dashboard's concept list is the course's most-connected concepts, not all
 * of them, so the page says so instead of presenting sample counts as totals.
 * Streak, checks this week and the activity heatmap need data the API doesn't
 * have yet, so they are not shown at all.
 */

const NEEDS_WORK_LIMIT = 5;

export interface ProgressSummary {
  mastered: number;
  started: number;
  due: number;
  hasStarted: boolean;
  /** How many concepts the counts cover, and how many the course has. */
  sampleSize: number;
  courseConcepts: number;
  isSample: boolean;
  needsWork: LearningConceptProgress[];
}

export const summarise = (dashboard: LearningDashboard): ProgressSummary => {
  const started = dashboard.concepts.filter((item) => masteryState(item.mastery) !== 'notStarted');
  return {
    mastered: started.filter((item) => masteryState(item.mastery) === 'mastered').length,
    started: started.length,
    due: dashboard.review?.due_count ?? 0,
    hasStarted: started.length > 0,
    sampleSize: dashboard.concepts.length,
    courseConcepts: dashboard.course.concepts,
    isSample: dashboard.course.concepts > dashboard.concepts.length,
    needsWork: started
      .filter((item) => masteryState(item.mastery) === 'inProgress')
      .sort((a, b) => a.mastery.score - b.mastery.score)
      .slice(0, NEEDS_WORK_LIMIT),
  };
};

export interface UnitRow {
  title: string;
  total: number;
  mastered: number;
  inProgress: number;
}

/** Mastery by unit, using the same units as the Path (one per primary source document). */
export const unitMastery = (dashboard: LearningDashboard): UnitRow[] =>
  buildPath(dashboard).units.map((unit) => ({
    title: unit.title,
    total: unit.concepts.length,
    mastered: unit.masteredCount,
    inProgress: unit.concepts.filter((item) => masteryState(item.mastery) === 'inProgress').length,
  }));
