import { useAuth0 } from '@auth0/auth0-react';
import { InteractiveNvlWrapper } from '@neo4j-nvl/react';
import { useMemo, useRef, useState } from 'react';
import NVL from '@neo4j-nvl/base';
import type { Node, Relationship } from '@neo4j-nvl/base';
import { nvlOptions } from '../../utils/Constants';

const suggestedPrompts = [
  'Show me how this knowledge graph is structured',
  'Summarize the main concepts in my data',
  'Find connections between two topics',
  'Explain the most important entities',
];

const tabs = ['Graph', 'Learn', 'Quizzes'] as const;
type TabKey = (typeof tabs)[number];

const Landing = () => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const [activeTab, setActiveTab] = useState<TabKey>('Graph');
  const [message, setMessage] = useState('');
  const nvlRef = useRef<NVL>(null);

  const handleLogin = () => {
    loginWithRedirect({
      appState: { returnTo: '/app' },
      authorizationParams: {
        redirect_uri: `${window.location.origin}/callback`,
        audience: 'https://api.cora.com',
      },
    });
  };

  const demoNodes: Node[] = useMemo(
    () => [
      { id: 'cora', caption: 'Cora', size: 38, color: '#C8102E' },
      { id: 'graph', caption: 'Knowledge Graph', size: 30, color: '#ef4444' },
      { id: 'doc', caption: 'Documents', size: 26, color: '#f87171' },
      { id: 'entity', caption: 'Entities', size: 26, color: '#fca5a5' },
      { id: 'rel', caption: 'Relationships', size: 26, color: '#fecaca' },
      { id: 'chat', caption: 'Chat', size: 26, color: '#fee2e2' },
    ],
    []
  );

  const demoRels: Relationship[] = useMemo(
    () => [
      { id: 'r1', from: 'cora', to: 'graph', caption: 'builds' },
      { id: 'r2', from: 'graph', to: 'doc', caption: 'from' },
      { id: 'r3', from: 'graph', to: 'entity', caption: 'extracts' },
      { id: 'r4', from: 'graph', to: 'rel', caption: 'links' },
      { id: 'r5', from: 'chat', to: 'graph', caption: 'queries' },
    ],
    []
  );

  const landingNvlOptions = useMemo(() => ({ ...nvlOptions, instanceId: 'landing-graph-preview' }), []);

  return (
    <div className='min-h-screen bg-white text-slate-900'>
      <header className='border-b border-slate-200 bg-white'>
        <div className='mx-auto flex max-w-6xl items-center justify-between px-6 py-4'>
          <div className='flex items-center gap-3'>
            <div className='h-9 w-9 rounded-full bg-red-600' />
            <span className='text-xl font-semibold tracking-tight text-red-600'>Cora</span>
          </div>
          <nav className='hidden items-center gap-6 text-sm text-slate-600 md:flex'>
            <span className='cursor-pointer hover:text-slate-900'>Graph</span>
            <span className='cursor-pointer hover:text-slate-900'>Learn</span>
            <span className='cursor-pointer hover:text-slate-900'>Quizzes</span>
            <span className='cursor-pointer hover:text-slate-900'>Profile</span>
          </nav>
          <button
            onClick={handleLogin}
            disabled={isLoading || isAuthenticated}
            className='rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300'
          >
            {isLoading ? 'Loading…' : isAuthenticated ? 'Signed in' : 'Sign in'}
          </button>
        </div>
      </header>

      <main className='mx-auto grid max-w-6xl gap-8 px-6 py-10 md:grid-cols-[1.1fr_1fr]'>
        <section className='space-y-6'>
          <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
            <h1 className='text-2xl font-semibold'>Ask Cora</h1>
            <p className='mt-2 text-sm text-slate-600'>
              A focused workspace to explore knowledge graphs and learn faster.
            </p>

            <div className='mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4'>
              <div className='text-xs font-medium uppercase tracking-wide text-slate-500'>Suggested prompts</div>
              <div className='mt-3 flex flex-wrap gap-2'>
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setMessage(prompt)}
                    className='rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-red-400 hover:text-red-600'
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className='mt-5 rounded-xl border border-slate-200 bg-white p-4'>
              <label className='mb-2 block text-sm font-medium text-slate-700'>Your message</label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                placeholder='Ask a question about your data…'
                className='w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:border-red-500 focus:outline-none'
              />
              <div className='mt-3 flex items-center justify-between'>
                <span className='text-xs text-slate-400'>Connect to the full app to run queries.</span>
                <button
                  className='rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700'
                  onClick={handleLogin}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className='space-y-4'>
          <div className='flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1'>
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab ? 'bg-red-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
            {activeTab === 'Graph' ? (
              <div className='h-[420px] rounded-xl bg-slate-50'>
                <InteractiveNvlWrapper
                  nodes={demoNodes}
                  rels={demoRels}
                  nvlOptions={landingNvlOptions}
                  ref={nvlRef}
                  interactionOptions={{ selectOnClick: true }}
                />
              </div>
            ) : (
              <div className='flex h-[420px] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500'>
                {activeTab === 'Learn' ? 'Learning tools will appear here.' : 'Custom quizzes will appear here.'}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className='border-t border-slate-200 bg-white'>
        <div className='mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-4 text-xs text-slate-500 md:flex-row'>
          <span>© 2026 Cora</span>
          <div className='flex items-center gap-4'>
            <a className='hover:text-slate-900' href='https://github.com/neo4j-labs/llm-graph-builder'>
              GitHub
            </a>
            <a className='hover:text-slate-900' href='https://llm-graph-builder.neo4jlabs.com/'>
              Docs
            </a>
            <a className='hover:text-slate-900' href='https://workspace-preview.neo4j.io/workspace/query'>
              Workspace
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
