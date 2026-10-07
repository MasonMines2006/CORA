import { describe, expect, it } from 'vitest';
import { LearningConcept } from '../../API/Index';
import { buildSuggestedPrompts, MAX_SUGGESTED_PROMPTS } from './suggestedPrompts';

const concept = (name: string): LearningConcept => ({
  id: name.toLowerCase(),
  name,
  chunk_count: 3,
  document_count: 1,
  connectivity: 5,
  sources: ['Notes.pdf'],
});

describe('buildSuggestedPrompts', () => {
  it('returns no suggestions when the material has no concepts yet', () => {
    expect(buildSuggestedPrompts([])).toEqual([]);
  });

  it('names only concepts that came from the material', () => {
    const prompts = buildSuggestedPrompts([concept('Photosynthesis'), concept('Chlorophyll')]);

    expect(prompts).toEqual([
      'Explain Photosynthesis in plain terms',
      'How does Photosynthesis relate to Chlorophyll?',
    ]);
  });

  it('caps the number of suggestions and skips duplicate or blank names', () => {
    const prompts = buildSuggestedPrompts(['Alpha', 'Alpha', ' ', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map(concept));

    expect(prompts).toHaveLength(MAX_SUGGESTED_PROMPTS);
    expect(prompts.join(' ')).not.toContain('Epsilon');
  });
});
