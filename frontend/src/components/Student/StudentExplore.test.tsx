import { forwardRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLearningNetwork, getLearningSources, LearningNetworkNode } from '../../API/Index';
import StudentExplore from './StudentExplore';

vi.mock('../../API/Index', () => ({ getLearningNetwork: vi.fn(), getLearningSources: vi.fn() }));
vi.mock('../../services/GetFiles', () => ({
  getServerSourceNodes: vi.fn().mockResolvedValue({ data: { status: 'Success', data: [] } }),
}));
vi.mock('../../services/GraphQuery', () => ({ graphQueryAPI: vi.fn() }));
vi.mock('@neo4j-nvl/base', () => ({ default: class {} }));
// forwardRef, because StudentExplore hands this component a ref. A plain function
// component cannot take one, and React logs "Function components cannot be given
// refs" on every run -- noise from the mock, not from the component under test.
vi.mock('@neo4j-nvl/react', () => ({
  InteractiveNvlWrapper: forwardRef(
    (
      {
        nodes,
        mouseEventCallbacks,
      }: {
        nodes: Array<{ id: string; caption?: string; color?: string; size?: number }>;
        mouseEventCallbacks?: { onNodeClick?: (node: { id: string }) => void };
      },
      _ref: React.ForwardedRef<unknown>
    ) => (
      <div data-testid='graph'>
        {nodes.map((node) => (
          <button
            key={node.id}
            data-color={node.color}
            data-size={node.size}
            onClick={() => mouseEventCallbacks?.onNodeClick?.(node)}
          >
            {node.caption}
          </button>
        ))}
      </div>
    )
  ),
}));

const node = (id: string, name: string, overrides: Partial<LearningNetworkNode> = {}): LearningNetworkNode => ({
  id,
  name,
  labels: ['Concept'],
  chunk_count: 4,
  document_count: 1,
  sources: ['Theory Manual - NE235.pdf'],
  mastery: { concept_id: id, attempts: 0, correct: 0, score: 0, difficulty: 'easy' },
  ...overrides,
});

const graph = () => within(screen.getByTestId('graph'));

describe('StudentExplore', () => {
  beforeEach(() => {
    vi.mocked(getLearningSources)
      .mockReset()
      .mockResolvedValue({
        concept: node('xenon', 'Xenon'),
        passages: [{ id: 'p1', source: 'Theory Manual - NE235.pdf', text: 'Xenon is a strong neutron absorber.' }],
      } as never);
    vi.mocked(getLearningNetwork)
      .mockReset()
      .mockResolvedValue({
        nodes: [
          node('reactivity', 'Reactivity', {
            chunk_count: 16,
            document_count: 3,
            mastery: { concept_id: 'reactivity', attempts: 4, correct: 2, score: 50, difficulty: 'medium' },
          }),
          node('xenon', 'Xenon', { labels: ['Element'], sources: ['Lab#2 - Reactor Startup.pdf'] }),
          node('ncsu', 'NC State', { labels: ['Institution'], sources: ['Syllabus.pdf'] }),
        ],
        relationships: [{ id: 'r1', from_id: 'reactivity', to_id: 'xenon', type: 'AFFECTED_BY' }],
      });
  });

  it('hides extraction noise by default and says so', async () => {
    render(<StudentExplore />);
    await screen.findByText('Reactivity');

    // Institution is noise, off by default -- but stated on screen, not silently
    // dropped, so a student can switch it back on.
    expect(graph().queryByText('NC State')).not.toBeInTheDocument();
    expect(screen.getByText(/extraction noise/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Institution' }));
    expect(graph().getByText('NC State')).toBeInTheDocument();
  });

  it('colours nodes by mastery and sizes them by passage count', async () => {
    render(<StudentExplore />);
    await screen.findByText('Reactivity');

    const inProgress = graph().getByRole('button', { name: 'Reactivity' });
    const notStarted = graph().getByRole('button', { name: 'Xenon' });

    expect(inProgress.getAttribute('data-color')).toBe('#b45309');
    expect(notStarted.getAttribute('data-color')).toBe('#94a3b8');
    // 16 passages against 4 -- the busier concept draws larger.
    expect(Number(inProgress.getAttribute('data-size'))).toBeGreaterThan(Number(notStarted.getAttribute('data-size')));
  });

  it('states that the view is a filtered subset', async () => {
    render(<StudentExplore />);
    // Two of three concepts survive the default noise filter.
    expect(await screen.findByText('Showing 2 of 3 concepts')).toBeInTheDocument();
  });

  it('filters by source document', async () => {
    render(<StudentExplore />);
    await screen.findByText('Reactivity');

    fireEvent.click(screen.getByRole('checkbox', { name: /theory manual/i }));

    // Reactivity came only from that document; Xenon came from another and stays.
    expect(graph().queryByText('Reactivity')).not.toBeInTheDocument();
    expect(graph().getByText('Xenon')).toBeInTheDocument();
  });

  it('inspects a selected concept and offers the two modes', async () => {
    const onOpenConcept = vi.fn();
    const onPracticeConcept = vi.fn();
    render(<StudentExplore onOpenConcept={onOpenConcept} onPracticeConcept={onPracticeConcept} />);
    await screen.findByText('Reactivity');

    fireEvent.click(graph().getByRole('button', { name: 'Reactivity' }));

    expect(screen.getByText(/16 passages · 3 documents/)).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('2 of 4 correct')).toBeInTheDocument();
    expect(screen.getByText('AFFECTED BY')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Learn this' }));
    expect(onOpenConcept).toHaveBeenCalledWith('reactivity');

    fireEvent.click(screen.getByRole('button', { name: 'Practice' }));
    expect(onPracticeConcept).toHaveBeenCalledWith('reactivity');
  });

  it('narrows to a concept and its direct links in neighbourhood scope', async () => {
    render(<StudentExplore />);
    await screen.findByText('Reactivity');

    fireEvent.click(graph().getByRole('button', { name: 'Xenon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Neighbourhood' }));

    expect(graph().getByText('Xenon')).toBeInTheDocument();
    expect(graph().getByText('Reactivity')).toBeInTheDocument();
  });

  it('reports a failed load instead of showing a demo graph', async () => {
    vi.mocked(getLearningNetwork).mockRejectedValueOnce(new Error('offline'));
    render(<StudentExplore />);

    expect((await screen.findAllByText(/could not be loaded/i)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('graph')).not.toBeInTheDocument();
  });
});
