import { useEffect, useMemo, useRef, useState } from 'react';
import { InteractiveNvlWrapper } from '@neo4j-nvl/react';
import NVL from '@neo4j-nvl/base';
import type { Node, Relationship } from '@neo4j-nvl/base';
import {
  HiOutlineArrowsPointingOut,
  HiOutlineMagnifyingGlass,
  HiOutlineMagnifyingGlassMinus,
  HiOutlineMagnifyingGlassPlus,
} from 'react-icons/hi2';
import { getLearningNetwork, LearningNetworkNode, LearningNetworkRelationship } from '../../API/Index';
import { nvlOptions } from '../../utils/Constants';

type ExploreStatus = 'loading' | 'ready' | 'empty' | 'error';

const iconButtonStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  padding: '0.5rem',
  backgroundColor: 'transparent',
  color: '#64748b',
  cursor: 'pointer',
};

const searchStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  border: '1px solid #e2e8f0',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  padding: '0.625rem 0.75rem 0.625rem 2.5rem',
  fontSize: '0.875rem',
  outline: 'none',
};

const nodeColor = (node: LearningNetworkNode, selected: boolean) => {
  if (selected) {
    return '#dc2626';
  }
  if (node.labels.some((label) => /component|system|equipment/i.test(label))) {
    return '#0f766e';
  }
  if (node.labels.some((label) => /element|material|substance/i.test(label))) {
    return '#b45309';
  }
  return '#475569';
};

const StudentExplore: React.FC = () => {
  const nvlRef = useRef<NVL>(null);
  const graphOptions = useMemo(() => ({ ...nvlOptions, instanceId: 'student-course-map', disableTelemetry: true }), []);
  const [nodes, setNodes] = useState<LearningNetworkNode[]>([]);
  const [relationships, setRelationships] = useState<LearningNetworkRelationship[]>([]);
  const [status, setStatus] = useState<ExploreStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [query, setQuery] = useState('');
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
        setErrorMessage('The course map could not be loaded. Please try again.');
        setStatus('error');
      });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visibleNodes = normalized
      ? nodes.filter((node) => [node.name, ...node.labels].some((value) => value.toLowerCase().includes(normalized)))
      : nodes;
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const visibleRelationships = relationships.filter(
      (relationship) => visibleIds.has(relationship.from_id) && visibleIds.has(relationship.to_id)
    );
    return { nodes: visibleNodes, relationships: visibleRelationships };
  }, [nodes, query, relationships]);

  const graphNodes: Node[] = filtered.nodes.map((node) => ({
    id: node.id,
    caption: node.name,
    size: selectedNodeId === node.id ? 34 : 24,
    color: nodeColor(node, selectedNodeId === node.id),
  }));
  const graphRelationships: Relationship[] = filtered.relationships.map((relationship) => ({
    id: relationship.id,
    from: relationship.from_id,
    to: relationship.to_id,
    caption: relationship.type.replace(/_/g, ' ').toLowerCase(),
    color: '#cbd5e1',
  }));
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedConnections = relationships.filter(
    (relationship) => relationship.from_id === selectedNodeId || relationship.to_id === selectedNodeId
  );

  const handleFit = () => nvlRef.current?.fit(graphNodes.map((node) => node.id));

  return (
    <div className='box-border mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-8'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-wider text-red-500'>Course knowledge map</p>
          <h1 className='mt-1 text-2xl font-bold tracking-tight text-slate-900'>See how the material connects</h1>
          <p className='mt-2 text-sm text-slate-500'>
            Search a concept, then select a node to inspect its role in the course.
          </p>
        </div>
        <div className='relative w-full sm:max-w-xs'>
          <HiOutlineMagnifyingGlass className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
          <input
            type='search'
            aria-label='Search concepts'
            placeholder='Search concepts or types'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className='rounded-xl'
            style={searchStyle}
          />
        </div>
      </div>

      <div className='mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]'>
        <section className='overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'>
          <div className='flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3'>
            <p className='text-xs text-slate-500'>
              {status === 'ready' && `${filtered.nodes.length} concepts · ${filtered.relationships.length} connections`}
              {status === 'loading' && 'Loading course relationships…'}
              {status === 'empty' && 'No concepts are available yet.'}
              {status === 'error' && errorMessage}
            </p>
            <div className='flex items-center gap-1'>
              <button
                type='button'
                title='Zoom in'
                disabled={status !== 'ready'}
                style={iconButtonStyle}
                onClick={() => nvlRef.current?.setZoom(nvlRef.current.getScale() * 1.3)}
              >
                <HiOutlineMagnifyingGlassPlus className='h-4 w-4' />
              </button>
              <button
                type='button'
                title='Zoom out'
                disabled={status !== 'ready'}
                style={iconButtonStyle}
                onClick={() => nvlRef.current?.setZoom(nvlRef.current.getScale() * 0.75)}
              >
                <HiOutlineMagnifyingGlassMinus className='h-4 w-4' />
              </button>
              <button
                type='button'
                title='Fit to view'
                disabled={status !== 'ready'}
                style={iconButtonStyle}
                onClick={handleFit}
              >
                <HiOutlineArrowsPointingOut className='h-4 w-4' />
              </button>
            </div>
          </div>
          <div className='h-[58vh] min-h-[420px] bg-slate-50'>
            {status === 'ready' && graphNodes.length > 0 ? (
              <InteractiveNvlWrapper
                nodes={graphNodes}
                rels={graphRelationships}
                nvlOptions={graphOptions}
                ref={nvlRef}
                mouseEventCallbacks={{ onNodeClick: (node) => setSelectedNodeId(String(node.id)) }}
              />
            ) : (
              <div className='flex h-full items-center justify-center px-6 text-center text-sm text-slate-500'>
                {status === 'loading' && 'Building the concept map…'}
                {status === 'empty' && 'Course concepts will appear here after graph ingestion.'}
                {status === 'error' && errorMessage}
                {status === 'ready' && graphNodes.length === 0 && `No concepts match “${query.trim()}”.`}
              </div>
            )}
          </div>
        </section>

        <aside className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:min-h-[420px]'>
          {selectedNode ? (
            <>
              <p className='text-[11px] font-semibold uppercase tracking-wider text-red-500'>Selected concept</p>
              <h2 className='mt-2 text-xl font-bold text-slate-900'>{selectedNode.name}</h2>
              <div className='mt-3 flex flex-wrap gap-2'>
                {selectedNode.labels.length ? (
                  selectedNode.labels.map((label) => (
                    <span
                      key={label}
                      className='rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600'
                    >
                      {label}
                    </span>
                  ))
                ) : (
                  <span className='text-xs text-slate-400'>Course concept</span>
                )}
              </div>
              <p className='mt-5 text-sm font-semibold text-slate-700'>
                {selectedConnections.length} connection{selectedConnections.length === 1 ? '' : 's'}
              </p>
              <div className='mt-3 space-y-2'>
                {selectedConnections.slice(0, 8).map((relationship) => {
                  const otherId = relationship.from_id === selectedNode.id ? relationship.to_id : relationship.from_id;
                  const other = nodes.find((node) => node.id === otherId);
                  return (
                    <button
                      type='button'
                      key={relationship.id}
                      onClick={() => setSelectedNodeId(otherId)}
                      className='block w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-left'
                      style={{
                        boxSizing: 'border-box',
                        border: '1px solid #f1f5f9',
                        backgroundColor: '#f8fafc',
                        padding: '0.75rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span className='block text-sm font-semibold text-slate-700'>{other?.name ?? otherId}</span>
                      <span className='mt-1 block text-[11px] uppercase tracking-wider text-slate-400'>
                        {relationship.type.replace(/_/g, ' ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className='flex min-h-56 flex-col items-center justify-center text-center lg:min-h-full'>
              <div className='h-3 w-3 rounded-full bg-teal-700' />
              <p className='mt-4 text-sm font-semibold text-slate-700'>Select a concept</p>
              <p className='mt-2 text-xs leading-relaxed text-slate-400'>
                Its type and direct relationships will appear here.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default StudentExplore;
