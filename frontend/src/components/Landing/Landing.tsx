import { useAuth0 } from '@auth0/auth0-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InteractiveNvlWrapper } from '@neo4j-nvl/react';
import NVL from '@neo4j-nvl/base';
import type { Node, Relationship } from '@neo4j-nvl/base';
import { nvlOptions, landingDemoNodes, landingDemoRels, SKIP_AUTH } from '../../utils/Constants';
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineShare,
  HiOutlineAcademicCap,
  HiOutlineMagnifyingGlassPlus,
  HiOutlineMagnifyingGlassMinus,
  HiOutlineArrowsPointingOut,
} from 'react-icons/hi2';
import coraImage from '../../assets/images/cora-image.png';
import GraphViewButton from '../Graph/GraphViewButton';
import type { ExtendedNode, ExtendedRelationship } from '../../types';

const features = [
  {
    icon: HiOutlineChatBubbleLeftRight,
    title: 'Ask with context',
    description:
      'Every answer connects back to verified sources in the knowledge graph. No hallucinations, just traceable facts.',
  },
  {
    icon: HiOutlineShare,
    title: 'See relationships',
    description: 'Explore how reactor components, safety systems, and concepts relate to each other visually.',
  },
  {
    icon: HiOutlineAcademicCap,
    title: 'Learn faster',
    description: 'Guided study paths help you build understanding step-by-step, from fundamentals to advanced topics.',
  },
];

const stats = [
  { value: '1,240+', label: 'Nodes' },
  { value: '4,980+', label: 'Relationships' },
  { value: '100%', label: 'Source-linked' },
];

const demoGraphNodes = [
  { element_id: 'cora', labels: ['System'], properties: { id: 'cora', name: 'Cora' } },
  { element_id: 'graph', labels: ['Concept'], properties: { id: 'graph', name: 'Knowledge Graph' } },
  { element_id: 'doc', labels: ['Document'], properties: { id: 'doc', fileName: 'Documents' } },
  { element_id: 'entity', labels: ['Entity'], properties: { id: 'entity', name: 'Entities' } },
  { element_id: 'rel', labels: ['Relationship'], properties: { id: 'rel', name: 'Relationships' } },
  { element_id: 'chat', labels: ['Interface'], properties: { id: 'chat', name: 'Chat' } },
];

const demoGraphRels = [
  { element_id: 'r1', start_node_element_id: 'cora', end_node_element_id: 'graph', type: 'builds' },
  { element_id: 'r2', start_node_element_id: 'graph', end_node_element_id: 'doc', type: 'from' },
  { element_id: 'r3', start_node_element_id: 'graph', end_node_element_id: 'entity', type: 'extracts' },
  { element_id: 'r4', start_node_element_id: 'graph', end_node_element_id: 'rel', type: 'links' },
  { element_id: 'r5', start_node_element_id: 'chat', end_node_element_id: 'graph', type: 'queries' },
];

const Landing = () => {
  const auth0 = useAuth0();
  const isAuthenticated = SKIP_AUTH ? false : auth0.isAuthenticated;
  const isLoading = SKIP_AUTH ? false : auth0.isLoading;
  const navigate = useNavigate();
  const nvlRef = useRef<NVL>(null);
  const graphOptions = useMemo(() => ({ ...nvlOptions, instanceId: 'landing-graph-preview' }), []);
  const [selected, setSelected] = useState<
    | {
        type: 'node' | 'relationship';
        id: string;
      }
    | undefined
  >(undefined);

  const handleZoomIn = () => nvlRef.current?.setZoom(nvlRef.current.getScale() * 1.25);
  const handleZoomOut = () => nvlRef.current?.setZoom(nvlRef.current.getScale() * 0.8);
  const handleFit = () => nvlRef.current?.fit(landingDemoNodes.map((n) => n.id));

  const mouseEventCallbacks = useMemo(
    () => ({
      onNodeClick: (clickedNode: Node) => {
        if (selected?.id !== clickedNode.id || selected?.type !== 'node') {
          setSelected({ type: 'node', id: clickedNode.id });
        }
      },
      onRelationshipClick: (clickedRelationship: Relationship) => {
        if (selected?.id !== clickedRelationship.id || selected?.type !== 'relationship') {
          setSelected({ type: 'relationship', id: clickedRelationship.id });
        }
      },
      onCanvasClick: () => {
        if (selected) {
          setSelected(undefined);
        }
      },
      onPan: true,
      onZoom: true,
      onDrag: true,
    }),
    [selected]
  );

  const handleLogin = () => {
    if (SKIP_AUTH) {
      navigate('/student');
      return;
    }
    auth0.loginWithRedirect({
      appState: { returnTo: '/app' },
      authorizationParams: {
        redirect_uri: `${window.location.origin}/callback`,
        audience: 'https://api.cora.com',
      },
    });
  };

  return (
    <div style={{ boxSizing: 'border-box' }} className='min-h-screen text-slate-900'>
      {/* Header */}
      <header className='sticky top-0 z-50 border-b border-red-100 bg-white/90 backdrop-blur-lg'>
        <div className='mx-auto flex max-w-5xl items-center justify-between px-6 py-4'>
          <div className='flex items-center gap-3'>
            <div className='flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm shadow-red-200'>
              <img src={coraImage} alt='Cora' className='h-full w-full object-cover object-center' />
            </div>
            <div>
              <span className='text-lg font-semibold tracking-tight text-red-600'>Cora</span>
              <p className='text-[11px] leading-none text-slate-400'>PULSTAR Assistant</p>
            </div>
          </div>
          <button
            onClick={handleLogin}
            disabled={isLoading || isAuthenticated}
            className='rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-red-200 transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {isLoading ? 'Loading...' : isAuthenticated ? 'Signed in' : 'Sign in'}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className='relative overflow-hidden bg-red-50'>
        <div className='absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-red-100 blur-3xl' />
        <div className='absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-red-100 blur-3xl' />
        <div className='relative mx-auto max-w-5xl px-6 pb-24 pt-28 text-center'>
          <div className='inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-600 shadow-sm'>
            <span className='h-1.5 w-1.5 rounded-full bg-red-500' />
            PULSTAR Learning Assistant
          </div>
          <h1 className='mt-7 mb-3 text-5xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-6xl'>
            Learn with your
            <br />
            <a
              href='#graph-preview'
              className='inline-flex items-center text-red-600 transition hover:text-red-700 focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-red-400'
            >
              knowledge graph
            </a>
          </h1>
          <p className='mt-5 text-lg leading-relaxed text-slate-500'>
            A student-first chat workspace backed by a live knowledge graph. Ask questions, trace sources, and build
            real understanding.
          </p>
          <div className='mt-9 flex items-center justify-center gap-4'>
            <button
              onClick={handleLogin}
              disabled={isLoading || isAuthenticated}
              className='rounded-full bg-red-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-red-300 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50'
            >
              Get started
            </button>
            <a
              href='#features'
              className='rounded-full border border-red-200 bg-white px-6 py-3 text-sm font-medium text-red-600 shadow-sm transition-all hover:border-red-300 hover:shadow-md'
            >
              Learn more
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id='features' className='bg-white'>
        <div className='mx-auto max-w-5xl px-6 py-20'>
          <div className='mb-10 text-center'>
            <p className='text-xs font-semibold uppercase tracking-wider text-red-500'>Why Cora</p>
            <h2 className='mt-2 text-2xl font-bold tracking-tight text-slate-900 md:mb-2'>
              Everything you need to study smarter
            </h2>
          </div>
          <div className='grid gap-6 md:grid-cols-3'>
            {features.map((feature) => (
              <div
                key={feature.title}
                className='group space-y-3 rounded-2xl border border-red-100 bg-white p-6 shadow-sm transition-all hover:border-red-200 hover:shadow-md'
              >
                <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 transition-colors group-hover:bg-red-100'>
                  <feature.icon className='h-5 w-5' />
                </div>
                <h3 className='text-base font-semibold text-slate-900'>{feature.title}</h3>
                <p className='text-sm leading-relaxed text-slate-500'>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className='bg-red-50'>
        <div className='mx-auto max-w-5xl px-6 py-16'>
          <div className='rounded-2xl border border-red-100 bg-white px-8 py-10 shadow-sm'>
            <div className='flex items-center justify-center gap-12 md:gap-20'>
              {stats.map((stat, i) => (
                <div key={stat.label} className='flex items-center gap-12 md:gap-20'>
                  <div className='text-center'>
                    <div className='text-3xl font-bold text-red-600'>{stat.value}</div>
                    <div className='mt-1 text-xs font-medium uppercase tracking-wider text-slate-400'>{stat.label}</div>
                  </div>
                  {i < stats.length - 1 && <div className='hidden h-10 w-px bg-red-200 md:block' />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Graph Preview */}
      <section id='graph-preview' className='bg-white'>
        <div className='mx-auto max-w-5xl px-6 py-20'>
          <div className='mb-10 text-center'>
            <p className='text-xs font-semibold uppercase tracking-wider text-red-500'>Live Preview</p>
            <h2 className='mt-2 text-2xl font-bold tracking-tight text-slate-900'>Explore the knowledge graph</h2>
            <p className='mt-5 text-lg leading-relaxed text-slate-500'>
              See how Cora connects documents, entities, and relationships into an interactive graph.
            </p>
          </div>
          <div className='overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-red-100 px-5 py-3'>
              <span className='text-xs font-medium text-slate-500'>Graph preview</span>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-xs font-medium text-red-500'>Live relationships</span>
                <GraphViewButton
                  nodeValues={demoGraphNodes as unknown as ExtendedNode[]}
                  relationshipValues={demoGraphRels as unknown as ExtendedRelationship[]}
                  label='Open full graph'
                  viewType='chatInfoView'
                  fill='outlined'
                />
                <div className='flex items-center gap-1 rounded-full border border-red-100 bg-white px-2 py-1'>
                  <button
                    onClick={handleZoomIn}
                    className='rounded-md p-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600'
                    title='Zoom in'
                  >
                    <HiOutlineMagnifyingGlassPlus className='h-4 w-4' />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className='rounded-md p-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600'
                    title='Zoom out'
                  >
                    <HiOutlineMagnifyingGlassMinus className='h-4 w-4' />
                  </button>
                  <button
                    onClick={handleFit}
                    className='rounded-md p-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600'
                    title='Fit to view'
                  >
                    <HiOutlineArrowsPointingOut className='h-4 w-4' />
                  </button>
                </div>
              </div>
            </div>
            <div className='h-[420px] bg-red-50/50'>
              <InteractiveNvlWrapper
                nodes={landingDemoNodes}
                rels={landingDemoRels}
                nvlOptions={graphOptions}
                ref={nvlRef}
                mouseEventCallbacks={{ ...mouseEventCallbacks }}
                interactionOptions={{ selectOnClick: true }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className='relative overflow-hidden bg-red-50'>
        <div className='absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-red-100 blur-3xl' />
        <div className='absolute -left-20 top-0 h-64 w-64 rounded-full bg-red-100 blur-3xl' />
        <div className='relative mx-auto max-w-5xl px-6 py-24 text-center'>
          <h2 className='text-3xl font-bold tracking-tight text-slate-900'>Ready to start learning?</h2>
          <p className='mt-3 text-slate-500'>Sign in to access the chat, explore the graph, and begin guided study.</p>
          <button
            onClick={handleLogin}
            disabled={isLoading || isAuthenticated}
            className='mt-8 rounded-full bg-red-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-red-300 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50'
          >
            Get started
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className='border-t border-red-100 bg-white'>
        <div className='mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-slate-400 md:flex-row'>
          <span>&copy; 2026 Cora. Built for student learning.</span>
          <div className='flex items-center gap-4'>
            <a className='transition-colors hover:text-red-600' href='https://github.com/neo4j-labs/llm-graph-builder'>
              GitHub
            </a>
            <a className='transition-colors hover:text-red-600' href='https://llm-graph-builder.neo4jlabs.com/'>
              Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
