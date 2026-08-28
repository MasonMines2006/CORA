import { useEffect, useMemo, useRef, useState } from 'react';
import { InteractiveNvlWrapper } from '@neo4j-nvl/react';
import NVL from '@neo4j-nvl/base';
import type { Node, Relationship } from '@neo4j-nvl/base';
import { nvlOptions, landingDemoNodes, landingDemoRels } from '../../utils/Constants';
import {
  HiOutlineMagnifyingGlassPlus,
  HiOutlineMagnifyingGlassMinus,
  HiOutlineArrowsPointingOut,
} from 'react-icons/hi2';
import { graphQueryAPI } from '../../services/GraphQuery';
import { ExtendedNode, ExtendedRelationship } from '../../types';

const StudentExplore: React.FC = () => {
  const nvlRef = useRef<NVL>(null);
  const graphOptions = useMemo(() => ({ ...nvlOptions, instanceId: 'student-graph-explore' }), []);
  const [nodes, setNodes] = useState<Node[]>(landingDemoNodes);
  const [rels, setRels] = useState<Relationship[]>(landingDemoRels);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    graphQueryAPI('entities', undefined, controller.signal)
      .then((res) => {
        const data = res.data?.data;
        if (data?.nodes?.length) {
          const fetchedNodes: Node[] = data.nodes.map((n: ExtendedNode) => ({
            id: n.element_id,
            caption: n.properties?.name ?? n.properties?.fileName ?? n.element_id,
            size: 24,
            color: '#ef4444',
          }));
          const fetchedRels: Relationship[] = (data.relationships ?? []).map((r: ExtendedRelationship) => ({
            id: r.element_id,
            from: r.start_node_element_id,
            to: r.end_node_element_id,
            caption: r.type,
          }));
          setNodes(fetchedNodes);
          setRels(fetchedRels);
        }
      })
      .catch(() => setError('Could not load graph data.'))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const handleZoomIn = () => nvlRef.current?.setZoom(nvlRef.current.getScale() * 1.3);
  const handleZoomOut = () => nvlRef.current?.setZoom(nvlRef.current.getScale() * 0.7);
  const handleFit = () => nvlRef.current?.fit(nodes.map((n) => n.id));

  return (
    <div className='mx-auto max-w-5xl space-y-6 px-6 py-6'>
      <div className='overflow-hidden rounded-2xl border border-slate-200 bg-white'>
        <div className='flex items-center justify-between border-b border-slate-100 px-5 py-3'>
          <div>
            <h2 className='text-sm font-semibold text-slate-900'>Knowledge Graph</h2>
            <p className='text-xs text-slate-500'>
              {loading ? 'Loading graph data…' : error ? error : `${nodes.length} nodes · ${rels.length} relationships`}
            </p>
          </div>
          <div className='flex items-center gap-1'>
            <button
              onClick={handleZoomIn}
              className='rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600'
              title='Zoom in'
            >
              <HiOutlineMagnifyingGlassPlus className='h-4 w-4' />
            </button>
            <button
              onClick={handleZoomOut}
              className='rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600'
              title='Zoom out'
            >
              <HiOutlineMagnifyingGlassMinus className='h-4 w-4' />
            </button>
            <button
              onClick={handleFit}
              className='rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600'
              title='Fit to view'
            >
              <HiOutlineArrowsPointingOut className='h-4 w-4' />
            </button>
          </div>
        </div>
        <div className='h-[500px] bg-gradient-to-b from-white to-slate-50/50'>
          <InteractiveNvlWrapper
            nodes={nodes}
            rels={rels}
            nvlOptions={graphOptions}
            ref={nvlRef}
            interactionOptions={{ selectOnClick: true }}
          />
        </div>
      </div>
    </div>
  );
};

export default StudentExplore;
