import { LearningConcept } from '../../API/Index';

/** How many suggestion chips the empty chat shows at most. */
export const MAX_SUGGESTED_PROMPTS = 4;

/**
 * Turns the concepts extracted from the course material into starter questions
 * for the empty chat screen.
 *
 * Only the sentence shapes live in code; every topic comes from the concept list
 * the backend returns (already ranked most-connected first). That keeps chat
 * suggestions in step with whatever material is loaded, instead of naming one
 * course's subject matter in the UI. With no concepts, there are no suggestions.
 */
export const buildSuggestedPrompts = (concepts: LearningConcept[]): string[] => {
  const names = Array.from(new Set(concepts.map((concept) => concept.name.trim()).filter(Boolean)));
  if (names.length === 0) {
    return [];
  }

  const [first, second, third, fourth] = names;
  const candidates = [
    `Explain ${first} in plain terms`,
    second ? `How does ${first} relate to ${second}?` : undefined,
    third ? `What should I understand about ${third}?` : undefined,
    fourth ? `Summarize what the material says about ${fourth}` : undefined,
  ];
  return candidates.filter((prompt): prompt is string => Boolean(prompt)).slice(0, MAX_SUGGESTED_PROMPTS);
};
