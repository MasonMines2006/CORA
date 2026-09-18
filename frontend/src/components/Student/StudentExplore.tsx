import { useEffect, useMemo, useRef, useState } from 'react';
import { InteractiveNvlWrapper } from '@neo4j-nvl/react';
import NVL from '@neo4j-nvl/base';
import type { Node, Relationship } from '@neo4j-nvl/base';
import {
  HiOutlineArrowsPointingOut,
  HiOutlineMagnifyingGlassMinus,
  HiOutlineMagnifyingGlassPlus,
} from 'react-icons/hi2';
import { getLearningNetwork, LearningNetworkNode, LearningNetworkRelationship } from '../../API/Index';
import { nvlOptions } from '../../utils/Constants';
import ExploreFilters from './ExploreFilters';
import ExploreInspector from './ExploreInspector';
import { applyFilters, MASTERY_COLORS, NOISE_TYPES, nodeColor, nodeSize } from './exploreModel';

/*
 * The course map. Filtering and colour rules live in exploreModel.ts so they can
 * be tested without a graph canvas; this file owns data loading, state and layout.
 * Design: docs/artboards/source/Explore.dc.html.
 */

type ExploreStatus = 'loading' | 'ready' | 'empty' | 'error';

const TOKEN = { border: '#e7e5e4', text: '#0f172a', muted: '#64748b', faint: '#94a3b8' } as const;

const iconButtonStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  border: 0,
  borderRadius: '0.5rem',
  padding: '0.4rem',
  backgroundColor: 'transparent',
  color: TOKEN.muted,
  cursor: 'pointer',
};

const scopeButtonStyle = (active: boolean): React.CSSProperties => ({
  boxSizing: 'border-box',
  border: 0,
  borderRadius: '999px',
  padding: '0.3rem 0.75rem',
  backgroundColor: active ? '#ffffff' : 'transparent',
  color: active ? TOKEN.text : TOKEN.muted,
  font: 'inherit',
  fontSize: '12px',
  fontWeight: active ? 700 : 500,
  cursor: 'pointer',
  boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
});

const LEGEND = [
  { label: 'This concept', color: MASTERY_COLORS.selected },
  { label: 'Mastered', color: MASTERY_COLORS.mastered },
  { label: 'In progress', color: MASTERY_COLORS.inProgress },
  { label: 'Not started', color: MASTERY_COLORS.notStarted },
] as const;

interface StudentExploreProps {
  onOpenConcept?: (conceptId: string) => void;
  onPracticeConcept?: (conceptId: string) => void;
}

const StudentExplore: React.FC<StudentExploreProps> = ({ onOpenConcept, onPracticeConcept }) => {
  const nvlRef = useRef<NVL>(null);
  const graphOptions = useMemo(() => ({ ...nvlOptions, instanceId: 'student-course-map', disableTelemetry: true }), []);

  const [nodes, setNodes] = useState<LearningNetworkNode[]>([]);
  const [relationships, setRelationships] = useState<LearningNetworkRelationship[]>([]);
  const [status, setStatus] = useState<ExploreStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const [query, setQuery] = useState('');
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<string>>(new Set(NOISE_TYPES));
  const [hiddenDocuments, setHiddenDocuments] = useState<ReadonlySet<string>>(new Set());
  const [scope, setScope] = useState<'neighbourhood' | 'course'>('course');
  const [selectedNodeId, setSelectedNodeId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getLearningNetwork(controller.signal)
      .then((network) => {
        setNodes(network.nodes);
        setRelationships(network.relationships);
        setStatus(network.nodes.length ? 'ready' : 'empty');
      })
      .catch((error) => {
        if ((error as { name?: string }).name === 'CanceledError') {
          return;
        }
        // Never fall back to a demo graph here. A broken fetch that renders fake
        // data looks exactly like a working tab -- docs/STUDENT_UI.md section 3.3.
        setErrorMessage('The course map could not be loaded. Please try again.');
        setStatus('error');
      });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(
    () => applyFilters(nodes, relationships, { query, hiddenTypes, hiddenDocuments, scope, selectedNodeId }),
    [nodes, relationships, query, hiddenTypes, hiddenDocuments, scope, selectedNodeId]
  );

  const maxChunks = useMemo(() => Math.max(0, ...nodes.map((node) => node.chunk_count)), [nodes]);

  // Memoised because NVL treats a new array identity as an entirely new graph and
  // restarts its force layout from a contracted blob. Rebuilding these on every
  // render collapsed the map on any interaction.
  const graphNodes: Node[] = useMemo(
    () =>
      filtered.nodes.map((node) => ({
        id: node.id,
        caption: node.name,
        size: nodeSize(node, maxChunks, node.id === selectedNodeId),
        color: nodeColor(node, node.id === selectedNodeId),
      })),
    [filtered.nodes, maxChunks, selectedNodeId]
  );

  const graphRelationships: Relationship[] = useMemo(
    () =>
      filtered.relationships.map((relationship) => ({
        id: relationship.id,
        from: relationship.from_id,
        to: relationship.to_id,
        caption: relationship.type.replace(/_/g, ' ').toLowerCase(),
        color: '#d6d3d1',
      })),
    [filtered.relationships]
  );

  // Fit once the first layout exists, otherwise the map opens zoomed into the
  // middle of the graph with nodes clipped off every edge.
  //
  // The visible ids are read through a ref rather than listed as a dependency on
  // purpose. `filtered.nodes` is a new array on every render, so depending on it
  // refits the viewport every time a node is selected -- the map visibly jumps
  // out from under the click. Refit when the SIZE of the visible set or the scope
  // changes; that covers every case where the old viewport is wrong.
  const visibleIdsRef = useRef<string[]>([]);
  visibleIdsRef.current = filtered.nodes.map((node) => node.id);
  const nodeCount = graphNodes.length;
  useEffect(() => {
    if (status !== 'ready' || nodeCount === 0) {
      return;
    }
    // Fit twice. NVL's force layout starts contracted and spreads over roughly a
    // second, so a single early fit frames a blob that then grows off-screen.
    // The first pass gets a usable view immediately, the second corrects it once
    // the layout has settled.
    const timers = [
      window.setTimeout(() => nvlRef.current?.fit(visibleIdsRef.current), 400),
      window.setTimeout(() => nvlRef.current?.fit(visibleIdsRef.current), 1800),
    ];
    return () => timers.forEach(window.clearTimeout);
    // selectedNodeId is here because selecting recolours the node array, which
    // NVL reads as a new graph and re-lays-out -- without a refit the map would
    // collapse on click.
  }, [status, nodeCount, scope, selectedNodeId]);

  const toggle = (value: string, current: ReadonlySet<string>): ReadonlySet<string> => {
    const next = new Set(current);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  return (
    <div className='box-border mx-auto w-full max-w-[1536px] px-5 py-8 sm:px-8 lg:px-12'>
      <div>
        <p className='text-[11px] font-bold uppercase tracking-[0.09em] text-red-600'>Course knowledge map</p>
        <h1 className='mt-1 text-2xl font-bold tracking-tight' style={{ color: TOKEN.text }}>
          See how the material connects
        </h1>
        <p className='mt-2 text-sm' style={{ color: TOKEN.muted }}>
          Filter the map, then select a concept to inspect its role in the course.
        </p>
      </div>

      <div className='mt-6 flex flex-col gap-6 lg:flex-row'>
        <ExploreFilters
          nodes={nodes}
          query={query}
          onQueryChange={setQuery}
          hiddenTypes={hiddenTypes}
          onToggleType={(type) => setHiddenTypes((current) => toggle(type, current))}
          hiddenDocuments={hiddenDocuments}
          onToggleDocument={(document) => setHiddenDocuments((current) => toggle(document, current))}
        />

        <section
          className='min-w-0 flex-1 overflow-hidden rounded-2xl bg-white'
          style={{ border: `1px solid ${TOKEN.border}` }}
        >
          <div
            className='flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-3'
            style={{ borderBottom: `1px solid ${TOKEN.border}` }}
          >
            {/* The count states that this is a filtered subset, so the map never
                implies you are looking at the whole graph. */}
            <p className='text-xs' style={{ color: TOKEN.muted }}>
              {status === 'ready' && `Showing ${filtered.nodes.length} of ${nodes.length} concepts`}
              {status === 'loading' && 'Loading course relationships…'}
              {status === 'empty' && 'No concepts are available yet.'}
              {status === 'error' && errorMessage}
            </p>

            <div className='flex items-center gap-2'>
              <div
                className='flex items-center gap-1 rounded-full p-0.5'
                style={{ backgroundColor: '#f1f0ef' }}
                role='group'
                aria-label='Map scope'
              >
                <button
                  type='button'
                  style={scopeButtonStyle(scope === 'neighbourhood')}
                  onClick={() => setScope('neighbourhood')}
                >
                  Neighbourhood
                </button>
                <button type='button' style={scopeButtonStyle(scope === 'course')} onClick={() => setScope('course')}>
                  Whole course
                </button>
              </div>
              <button
                type='button'
                title='Zoom in'
                aria-label='Zoom in'
                disabled={status !== 'ready'}
                style={iconButtonStyle}
                onClick={() => nvlRef.current?.setZoom(nvlRef.current.getScale() * 1.3)}
              >
                <HiOutlineMagnifyingGlassPlus className='h-4 w-4' />
              </button>
              <button
                type='button'
                title='Zoom out'
                aria-label='Zoom out'
                disabled={status !== 'ready'}
                style={iconButtonStyle}
                onClick={() => nvlRef.current?.setZoom(nvlRef.current.getScale() * 0.75)}
              >
                <HiOutlineMagnifyingGlassMinus className='h-4 w-4' />
              </button>
              <button
                type='button'
                title='Fit to view'
                aria-label='Fit to view'
                disabled={status !== 'ready'}
                style={iconButtonStyle}
                onClick={() => nvlRef.current?.fit(visibleIdsRef.current)}
              >
                <HiOutlineArrowsPointingOut className='h-4 w-4' />
              </button>
            </div>
          </div>

          <div className='h-[58vh] min-h-[420px]' style={{ backgroundColor: '#f8f7f6' }}>
            {status === 'ready' && graphNodes.length > 0 ? (
              <InteractiveNvlWrapper
                nodes={graphNodes}
                rels={graphRelationships}
                nvlOptions={graphOptions}
                ref={nvlRef}
                mouseEventCallbacks={{ onNodeClick: (node) => setSelectedNodeId(String(node.id)) }}
              />
            ) : (
              <div
                className='flex h-full items-center justify-center px-6 text-center text-sm'
                style={{ color: TOKEN.muted }}
              >
                {status === 'loading' && 'Building the concept map…'}
                {status === 'empty' && 'Course concepts will appear here after graph ingestion.'}
                {status === 'error' && errorMessage}
                {status === 'ready' && graphNodes.length === 0 && 'No concepts match the current filters.'}
              </div>
            )}
          </div>

          <div
            className='flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3'
            style={{ borderTop: `1px solid ${TOKEN.border}` }}
          >
            {LEGEND.map((entry) => (
              <span key={entry.label} className='flex items-center gap-1.5 text-[11px]' style={{ color: TOKEN.muted }}>
                <span className='h-2 w-2 rounded-full' style={{ backgroundColor: entry.color }} />
                {entry.label}
              </span>
            ))}
            <span className='text-[11px]' style={{ color: TOKEN.faint }}>
              node size = passage count
            </span>
          </div>
        </section>

        <ExploreInspector
          node={selectedNode}
          relationships={relationships}
          allNodes={nodes}
          onSelectNode={setSelectedNodeId}
          onLearn={onOpenConcept}
          onPractice={onPracticeConcept}
        />
      </div>
    </div>
  );
};

export default StudentExplore;
