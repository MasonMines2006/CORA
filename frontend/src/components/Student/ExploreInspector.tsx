import { useEffect, useState } from 'react';
import { getLearningSources, LearningNetworkNode, LearningNetworkRelationship } from '../../API/Index';
import { MASTERY_COLORS, masteryState } from './exploreModel';

/*
 * The course map's right rail: what the selected concept is, how well the
 * learner knows it, what it connects to, and one passage it was built from.
 * Implements the inspector in docs/artboards/source/Explore.dc.html.
 */

const TOKEN = {
  border: '#e7e5e4',
  text: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  red: '#dc2626',
  teal: '#0f766e',
} as const;

const STATE_LABEL = {
  mastered: 'Mastered',
  inProgress: 'In progress',
  notStarted: 'Not started',
} as const;

const primaryButton: React.CSSProperties = {
  boxSizing: 'border-box',
  flex: 1,
  border: 0,
  borderRadius: '999px',
  backgroundColor: TOKEN.red,
  color: '#ffffff',
  padding: '0.5rem 0.75rem',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  minHeight: '2.25rem',
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  border: `1px solid ${TOKEN.border}`,
  backgroundColor: '#ffffff',
  color: TOKEN.text,
};

interface ExploreInspectorProps {
  node?: LearningNetworkNode;
  relationships: LearningNetworkRelationship[];
  allNodes: LearningNetworkNode[];
  onSelectNode: (id: string) => void;
  onLearn?: (conceptId: string) => void;
  onPractice?: (conceptId: string) => void;
}

const ExploreInspector: React.FC<ExploreInspectorProps> = ({
  node,
  relationships,
  allNodes,
  onSelectNode,
  onLearn,
  onPractice,
}) => {
  const [passage, setPassage] = useState<{ text: string; source: string } | null>(null);

  // The top passage is what makes a node inspectable rather than decorative: it
  // shows the actual course text the concept was extracted from.
  useEffect(() => {
    setPassage(null);
    if (!node) {
      return;
    }
    const controller = new AbortController();
    getLearningSources(node.id, controller.signal)
      .then((sources) => {
        const [first] = sources.passages;
        if (first) {
          setPassage({ text: first.text, source: first.source });
        }
      })
      .catch(() => {
        // The rest of the inspector is still useful without a quote, and the
        // passage viewer reports its own errors when opened properly.
      });
    return () => controller.abort();
  }, [node]);

  if (!node) {
    return (
      <aside
        className='flex min-h-56 w-full flex-col items-center justify-center rounded-2xl bg-white p-5 text-center lg:min-h-full lg:w-[300px] lg:shrink-0'
        style={{ border: `1px solid ${TOKEN.border}` }}
      >
        <span className='h-3 w-3 rounded-full' style={{ backgroundColor: TOKEN.teal }} />
        <p className='mt-4 text-sm font-bold' style={{ color: TOKEN.text }}>
          Select a concept
        </p>
        <p className='mt-2 text-xs leading-relaxed' style={{ color: TOKEN.faint }}>
          Its type and direct relationships will appear here.
        </p>
      </aside>
    );
  }

  const state = masteryState(node);
  const { mastery } = node;
  const connections = relationships.filter(
    (relationship) => relationship.from_id === node.id || relationship.to_id === node.id
  );

  return (
    <aside
      className='flex w-full flex-col gap-4 rounded-2xl bg-white p-5 lg:w-[300px] lg:shrink-0'
      style={{ border: `1px solid ${TOKEN.border}` }}
    >
      <div>
        <p className='text-[11px] font-bold uppercase tracking-[0.09em]' style={{ color: TOKEN.red }}>
          Selected concept
        </p>
        <h2 className='mt-2 text-xl font-bold tracking-tight' style={{ color: TOKEN.text }}>
          {node.name}
        </h2>
        <p className='mt-1 text-xs' style={{ color: TOKEN.muted }}>
          {node.labels[0] ?? 'Concept'} · {node.chunk_count} passage{node.chunk_count === 1 ? '' : 's'} ·{' '}
          {node.document_count} document{node.document_count === 1 ? '' : 's'}
        </p>
      </div>

      <div className='flex gap-2'>
        <button type='button' style={primaryButton} onClick={() => onLearn?.(node.id)}>
          Learn this
        </button>
        <button type='button' style={secondaryButton} onClick={() => onPractice?.(node.id)}>
          Practice
        </button>
      </div>

      <div className='rounded-xl p-3' style={{ border: `1px solid ${TOKEN.border}` }}>
        <p className='text-[11px] font-bold uppercase tracking-[0.09em]' style={{ color: TOKEN.faint }}>
          Your mastery
        </p>
        <div className='mt-1 flex items-baseline gap-2'>
          <span className='text-2xl font-bold' style={{ color: MASTERY_COLORS[state] }}>
            {mastery && mastery.attempts > 0 ? `${Math.round(mastery.score)}%` : '—'}
          </span>
          <span className='text-xs' style={{ color: TOKEN.muted }}>
            {STATE_LABEL[state]}
          </span>
        </div>
        {mastery && mastery.attempts > 0 && (
          <p className='mt-1 text-xs' style={{ color: TOKEN.muted }}>
            {mastery.correct} of {mastery.attempts} correct
          </p>
        )}
      </div>

      <div>
        <p className='mb-2 text-[11px] font-bold uppercase tracking-[0.09em]' style={{ color: TOKEN.faint }}>
          Relationships
        </p>
        {connections.length === 0 && (
          <p className='text-xs' style={{ color: TOKEN.faint }}>
            No direct links in the current view.
          </p>
        )}
        <div className='flex flex-col gap-1.5'>
          {connections.slice(0, 8).map((relationship) => {
            const otherId = relationship.from_id === node.id ? relationship.to_id : relationship.from_id;
            const other = allNodes.find((candidate) => candidate.id === otherId);
            return (
              <button
                key={relationship.id}
                type='button'
                onClick={() => onSelectNode(otherId)}
                style={{
                  boxSizing: 'border-box',
                  width: '100%',
                  border: `1px solid ${TOKEN.border}`,
                  borderRadius: '0.6rem',
                  backgroundColor: '#ffffff',
                  padding: '0.5rem 0.625rem',
                  textAlign: 'left',
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <span className='block text-[10px] font-bold uppercase tracking-[0.08em]' style={{ color: TOKEN.teal }}>
                  {relationship.type.replace(/_/g, ' ')}
                </span>
                <span className='mt-0.5 block truncate text-[13px] font-semibold' style={{ color: TOKEN.text }}>
                  {other?.name ?? otherId}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {passage && (
        <div>
          <p className='mb-2 text-[11px] font-bold uppercase tracking-[0.09em]' style={{ color: TOKEN.faint }}>
            Top passage
          </p>
          <blockquote
            className='rounded-xl p-3 text-[12.5px] leading-relaxed'
            style={{ border: `1px solid ${TOKEN.border}`, color: TOKEN.muted, margin: 0 }}
          >
            “{passage.text.slice(0, 220)}
            {passage.text.length > 220 ? '…' : ''}”
            <span className='mt-2 block text-[11px]' style={{ color: TOKEN.faint }}>
              {passage.source}
            </span>
          </blockquote>
        </div>
      )}
    </aside>
  );
};

export default ExploreInspector;
