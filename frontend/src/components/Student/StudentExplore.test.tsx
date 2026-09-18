import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLearningNetwork } from '../../API/Index';
import StudentExplore from './StudentExplore';

vi.mock('../../API/Index', () => ({ getLearningNetwork: vi.fn() }));
vi.mock('../../services/GetFiles', () => ({
  getServerSourceNodes: vi.fn().mockResolvedValue({ data: { status: 'Success', data: [] } }),
}));
vi.mock('../../services/GraphQuery', () => ({ graphQueryAPI: vi.fn() }));
vi.mock('@neo4j-nvl/base', () => ({ default: class {} }));
vi.mock('@neo4j-nvl/react', () => ({
  InteractiveNvlWrapper: ({
    nodes,
    mouseEventCallbacks,
  }: {
    nodes: Array<{ id: string; caption?: string }>;
    mouseEventCallbacks?: { onNodeClick?: (node: { id: string }) => void };
  }) => (
    <div>
      {nodes.map((node) => (
        <button key={node.id} onClick={() => mouseEventCallbacks?.onNodeClick?.(node)}>
          {node.caption}
        </button>
      ))}
    </div>
  ),
}));

describe('StudentExplore', () => {
  beforeEach(() => {
    vi.mocked(getLearningNetwork).mockResolvedValue({
      nodes: [
        { id: 'reactivity', name: 'Reactivity', labels: ['Concept'] },
        { id: 'xenon', name: 'Xenon', labels: ['Element'] },
      ],
      relationships: [{ id: 'r1', from_id: 'reactivity', to_id: 'xenon', type: 'AFFECTS' }],
    });
  });

  it('filters the course map and explains a selected node', async () => {
    render(<StudentExplore />);

    expect(await screen.findByText('Reactivity')).toBeInTheDocument();
    expect(screen.getByText('Xenon')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: /search concepts/i }), { target: { value: 'xen' } });
    expect(screen.queryByText('Reactivity')).not.toBeInTheDocument();
    expect(screen.getByText('Xenon')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xenon' }));
    expect(screen.getByText('Element')).toBeInTheDocument();
    expect(screen.getByText(/1 connection/i)).toBeInTheDocument();
  });
});
