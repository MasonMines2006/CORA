import { LearningNetworkNode, LearningNetworkRelationship } from '../../API/Index';

/*
 * Filtering and presentation rules for the course map, kept out of the component
 * so they can be tested without rendering a graph canvas.
 *
 * The design these implement is docs/artboards/source/Explore.dc.html; the
 * reasoning behind the colours is docs/STUDENT_UI.md section 4 — colour encodes
 * learning state, never decoration.
 */

/** Semantic mastery colours. These are the whole point of the palette. */
export const MASTERY_COLORS = {
  selected: '#dc2626',
  mastered: '#0f766e',
  inProgress: '#b45309',
  notStarted: '#94a3b8',
} as const;

/**
 * Entity types the extractor invents that are never teachable topics. The
 * artboard hides these by default and says so on screen, rather than dropping
 * them silently — a student who wonders where "Document" went can switch it on.
 */
export const NOISE_TYPES = ['Institution', 'Document', 'Organization', 'Person'] as const;

/** A concept is "mastered" at 80%, matching the dashboard and the lesson tabs. */
const MASTERED_AT = 80;

export type MasteryState = 'mastered' | 'inProgress' | 'notStarted';

export const masteryState = (node: LearningNetworkNode): MasteryState => {
  const { mastery } = node;
  if (!mastery || mastery.attempts === 0) {
    return 'notStarted';
  }
  return mastery.score >= MASTERED_AT ? 'mastered' : 'inProgress';
};

export const nodeColor = (node: LearningNetworkNode, isSelected: boolean): string => {
  return isSelected ? MASTERY_COLORS.selected : MASTERY_COLORS[masteryState(node)];
};

/**
 * Node radius from passage count, so the map shows at a glance which concepts
 * the course actually spends time on. Square-rooted because area, not radius,
 * is what the eye compares — a linear map makes a 42-passage concept look
 * forty times heavier than a 1-passage one.
 */
export const nodeSize = (node: LearningNetworkNode, maxChunks: number, isSelected: boolean): number => {
  const MIN = 14;
  const MAX = 46;
  const ratio = maxChunks > 0 ? Math.sqrt(node.chunk_count / maxChunks) : 0;
  return Math.round(MIN + (MAX - MIN) * ratio) + (isSelected ? 6 : 0);
};

/** Entity types present in the graph, with how many concepts carry each. */
export const typeCounts = (nodes: LearningNetworkNode[]): Array<{ type: string; count: number }> => {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    for (const label of node.labels) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
};

/** Source documents present in the graph, with how many concepts each supports. */
export const documentCounts = (nodes: LearningNetworkNode[]): Array<{ document: string; count: number }> => {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    for (const source of node.sources) {
      counts.set(source, (counts.get(source) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([document, count]) => ({ document, count }))
    .sort((a, b) => b.count - a.count || a.document.localeCompare(b.document));
};

export interface ExploreFilterState {
  query: string;
  hiddenTypes: ReadonlySet<string>;
  hiddenDocuments: ReadonlySet<string>;
  /** 'neighbourhood' narrows to the selected concept and its direct links. */
  scope: 'neighbourhood' | 'course';
  selectedNodeId: string;
}

export interface FilteredGraph {
  nodes: LearningNetworkNode[];
  relationships: LearningNetworkRelationship[];
}

/**
 * Apply every filter in one place. Relationships survive only when BOTH ends
 * do, so the map never draws an edge into a concept that is not on screen.
 */
export const applyFilters = (
  nodes: LearningNetworkNode[],
  relationships: LearningNetworkRelationship[],
  filters: ExploreFilterState
): FilteredGraph => {
  const search = filters.query.trim().toLowerCase();

  let visible = nodes.filter((node) => {
    if (node.labels.length > 0 && node.labels.every((label) => filters.hiddenTypes.has(label))) {
      return false;
    }
    if (node.sources.length > 0 && node.sources.every((source) => filters.hiddenDocuments.has(source))) {
      return false;
    }
    if (!search) {
      return true;
    }
    return [node.name, ...node.labels].some((value) => value.toLowerCase().includes(search));
  });

  // Neighbourhood scope is only meaningful once something is selected; without a
  // selection it would show an empty canvas, so it falls through to the course.
  if (filters.scope === 'neighbourhood' && filters.selectedNodeId) {
    const neighbours = new Set<string>([filters.selectedNodeId]);
    for (const relationship of relationships) {
      if (relationship.from_id === filters.selectedNodeId) {
        neighbours.add(relationship.to_id);
      }
      if (relationship.to_id === filters.selectedNodeId) {
        neighbours.add(relationship.from_id);
      }
    }
    visible = visible.filter((node) => neighbours.has(node.id));
  }

  const visibleIds = new Set(visible.map((node) => node.id));
  return {
    nodes: visible,
    relationships: relationships.filter(
      (relationship) => visibleIds.has(relationship.from_id) && visibleIds.has(relationship.to_id)
    ),
  };
};
