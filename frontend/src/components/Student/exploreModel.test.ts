import { describe, expect, it } from 'vitest';
import { LearningNetworkNode, LearningNetworkRelationship } from '../../API/Index';
import {
  applyFilters,
  documentCounts,
  MASTERY_COLORS,
  masteryState,
  nodeColor,
  nodeSize,
  typeCounts,
} from './exploreModel';

const node = (id: string, overrides: Partial<LearningNetworkNode> = {}): LearningNetworkNode => ({
  id,
  name: id,
  labels: ['Concept'],
  chunk_count: 4,
  document_count: 1,
  sources: ['NE235.pdf'],
  mastery: { concept_id: id, attempts: 0, correct: 0, score: 0, difficulty: 'easy' },
  ...overrides,
});

const rel = (id: string, from: string, to: string): LearningNetworkRelationship => ({
  id,
  from_id: from,
  to_id: to,
  type: 'RELATED_TO',
});

const filters = (overrides: Partial<Parameters<typeof applyFilters>[2]> = {}) => ({
  query: '',
  hiddenTypes: new Set<string>(),
  hiddenDocuments: new Set<string>(),
  scope: 'course' as const,
  selectedNodeId: '',
  ...overrides,
});

describe('mastery colouring', () => {
  it('reads state from attempts and score, not from entity type', () => {
    expect(masteryState(node('a'))).toBe('notStarted');
    expect(
      masteryState(
        node('b', { mastery: { concept_id: 'b', attempts: 4, correct: 2, score: 50, difficulty: 'medium' } })
      )
    ).toBe('inProgress');
    expect(
      masteryState(node('c', { mastery: { concept_id: 'c', attempts: 5, correct: 5, score: 100, difficulty: 'hard' } }))
    ).toBe('mastered');
  });

  it('treats a missing mastery row as not started', () => {
    // Guests save nothing, so a null row is the normal path for them.
    expect(masteryState(node('a', { mastery: null }))).toBe('notStarted');
  });

  it('gives selection priority over state', () => {
    const mastered = node('a', {
      mastery: { concept_id: 'a', attempts: 5, correct: 5, score: 100, difficulty: 'hard' },
    });
    expect(nodeColor(mastered, false)).toBe(MASTERY_COLORS.mastered);
    expect(nodeColor(mastered, true)).toBe(MASTERY_COLORS.selected);
  });
});

describe('node sizing', () => {
  it('scales with passage count', () => {
    const small = nodeSize(node('a', { chunk_count: 1 }), 42, false);
    const large = nodeSize(node('b', { chunk_count: 42 }), 42, false);
    expect(large).toBeGreaterThan(small);
  });

  it('keeps the busiest concept from swamping the canvas', () => {
    const one = nodeSize(node('a', { chunk_count: 1 }), 16, false);
    const sixteen = nodeSize(node('c', { chunk_count: 16 }), 16, false);
    // Sizing by area, not radius: a 16x passage count reads as roughly 2x the
    // width. Scaling the radius linearly would make it 16x and the map unusable.
    expect(sixteen).toBeGreaterThan(one);
    expect(sixteen / one).toBeLessThan(3);
  });

  it('survives an empty graph without dividing by zero', () => {
    expect(Number.isFinite(nodeSize(node('a', { chunk_count: 0 }), 0, false))).toBe(true);
  });
});

describe('filter counts', () => {
  it('counts concepts per entity type, most common first', () => {
    const counts = typeCounts([
      node('a', { labels: ['Concept', 'Component'] }),
      node('b', { labels: ['Concept'] }),
      node('c', { labels: ['Document'] }),
    ]);
    expect(counts[0]).toEqual({ type: 'Concept', count: 2 });
    expect(counts.find((entry) => entry.type === 'Document')?.count).toBe(1);
  });

  it('counts concepts per source document', () => {
    const counts = documentCounts([
      node('a', { sources: ['Theory.pdf', 'Lab2.pdf'] }),
      node('b', { sources: ['Theory.pdf'] }),
    ]);
    expect(counts[0]).toEqual({ document: 'Theory.pdf', count: 2 });
  });
});

describe('applyFilters', () => {
  const nodes = [
    node('reactivity', { labels: ['Concept'], sources: ['Theory.pdf'] }),
    node('keff', { labels: ['Concept'], sources: ['Theory.pdf'] }),
    node('ncsu', { labels: ['Institution'], sources: ['Syllabus.pdf'] }),
  ];
  const relationships = [rel('r1', 'reactivity', 'keff'), rel('r2', 'reactivity', 'ncsu')];

  it('hides nodes whose every type is switched off', () => {
    const result = applyFilters(nodes, relationships, filters({ hiddenTypes: new Set(['Institution']) }));
    expect(result.nodes.map((n) => n.id)).toEqual(['reactivity', 'keff']);
  });

  it('keeps a node when only some of its types are hidden', () => {
    const multi = [node('pump', { labels: ['Component', 'Document'] })];
    const result = applyFilters(multi, [], filters({ hiddenTypes: new Set(['Document']) }));
    expect(result.nodes).toHaveLength(1);
  });

  it('drops edges whose other end was filtered out', () => {
    // An edge into a hidden concept would draw a line to nowhere.
    const result = applyFilters(nodes, relationships, filters({ hiddenTypes: new Set(['Institution']) }));
    expect(result.relationships.map((r) => r.id)).toEqual(['r1']);
  });

  it('hides nodes whose every source document is switched off', () => {
    const result = applyFilters(nodes, relationships, filters({ hiddenDocuments: new Set(['Syllabus.pdf']) }));
    expect(result.nodes.map((n) => n.id)).toEqual(['reactivity', 'keff']);
  });

  it('searches names and types together', () => {
    expect(applyFilters(nodes, relationships, filters({ query: 'keff' })).nodes).toHaveLength(1);
    expect(applyFilters(nodes, relationships, filters({ query: 'institution' })).nodes).toHaveLength(1);
  });

  it('narrows to the selected concept and its direct links in neighbourhood scope', () => {
    const result = applyFilters(nodes, relationships, filters({ scope: 'neighbourhood', selectedNodeId: 'keff' }));
    expect(result.nodes.map((n) => n.id).sort()).toEqual(['keff', 'reactivity']);
  });

  it('falls back to the whole course when neighbourhood has no selection', () => {
    // Otherwise switching scope before picking a node blanks the canvas.
    const result = applyFilters(nodes, relationships, filters({ scope: 'neighbourhood' }));
    expect(result.nodes).toHaveLength(3);
  });
});
