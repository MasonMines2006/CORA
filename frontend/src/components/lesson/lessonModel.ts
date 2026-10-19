import { LessonBeat } from '../../API/Index';

/** The four beats of a lesson (backend/src/learning/models.py, LessonBeat). */
const LABELS: Record<LessonBeat['key'], string> = {
  core_idea: 'The core idea',
  how_it_works: 'How it works',
  application: 'Apply it',
  quick_check: 'Quick check',
};

export const beatLabel = (key: LessonBeat['key']): string => LABELS[key] ?? 'Step';

/** A saved step can outlive a lesson that was rebuilt shorter, or arrive from a bad link. */
export const clampBeat = (beat: number | undefined, count: number): number =>
  Math.max(0, Math.min(beat ?? 0, count - 1));

/**
 * Suggested questions for the "Ask about this step" rail. Only the sentence
 * shapes are written here; the topic is the concept's real name.
 */
export const stepQuestions = (conceptName: string, beatTitle: string): string[] => [
  `Explain “${beatTitle}” for ${conceptName} another way`,
  `What is the most common mistake about ${conceptName}?`,
  `Give me an example of ${conceptName} from the course material`,
];
