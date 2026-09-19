import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConceptNeighbourhood, getLearningMastery } from '../../API/Index';
import ConceptHub from './ConceptHub';

vi.mock('../../API/Index', () => ({
  getConceptNeighbourhood: vi.fn(),
  getLearningMastery: vi.fn(),
}));

// The mode panels have their own tests; here they only need to say which one is showing.
vi.mock('./ConceptLesson', () => ({ default: () => <div>Lesson panel</div> }));
vi.mock('./StudentAssess', () => ({ default: () => <div>Practice panel</div> }));
vi.mock('./ReviewSession', () => ({ default: () => <div>Cards panel</div> }));
vi.mock('./ConceptSources', () => ({ default: () => <div>Sources panel</div> }));

const neighbourhood = {
  concept: { id: 'Reactivity', name: 'Reactivity', chunk_count: 16, document_count: 3, connectivity: 54, sources: [] },
  linked_count: 8,
  neighbours: [
    {
      id: 'Keff',
      name: 'Keff',
      labels: ['Concept'],
      chunk_count: 9,
      relationship: 'RELATED_TO',
      direction: 'out' as const,
      shared_passages: 5,
      mastery: { concept_id: 'Keff', attempts: 5, correct: 5, score: 100, difficulty: 'hard' as const },
    },
    {
      id: 'Xenon',
      name: 'Xenon',
      labels: ['Concept'],
      chunk_count: 10,
      relationship: 'AFFECTS',
      direction: 'in' as const,
      shared_passages: 2,
      mastery: null,
    },
  ],
};

const renderHub = (overrides: Partial<Parameters<typeof ConceptHub>[0]> = {}) => {
  const props = {
    conceptId: 'Reactivity',
    mode: 'learn' as const,
    onModeChange: vi.fn(),
    onOpenConcept: vi.fn(),
    onAllConcepts: vi.fn(),
    onAsk: vi.fn(),
    ...overrides,
  };
  render(<ConceptHub {...props} />);
  return props;
};

describe('ConceptHub', () => {
  beforeEach(() => {
    vi.mocked(getConceptNeighbourhood).mockReset().mockResolvedValue(neighbourhood);
    vi.mocked(getLearningMastery)
      .mockReset()
      .mockResolvedValue({ concept_id: 'Reactivity', attempts: 5, correct: 3, score: 60, difficulty: 'medium' });
  });

  it('states the concept, its learning state and where it comes from', async () => {
    renderHub();

    expect(await screen.findByRole('heading', { level: 1, name: 'Reactivity' })).toBeInTheDocument();
    expect(await screen.findByText('60%')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('3 of 5 correct · medium')).toBeInTheDocument();
    expect(
      screen.getByText('Appears in 16 passages across 3 documents · linked to 8 other concepts')
    ).toBeInTheDocument();
  });

  it('shows the panel for the current mode and asks the parent to change it', async () => {
    const props = renderHub({ mode: 'sources' });

    expect(await screen.findByText('Sources panel')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sources' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: 'Practice' }));
    expect(props.onModeChange).toHaveBeenCalledWith('practice');
  });

  it('moves between modes with the arrow keys', async () => {
    const props = renderHub({ mode: 'learn' });

    fireEvent.keyDown(await screen.findByRole('tab', { name: 'Learn' }), { key: 'ArrowLeft' });
    expect(props.onModeChange).toHaveBeenCalledWith('sources');
  });

  it('lists linked concepts with the student’s mastery, and opens one on click', async () => {
    const props = renderHub();

    const keff = await screen.findByRole('button', { name: /Keff/ });
    expect(keff).toHaveTextContent('100%');
    expect(screen.getByRole('button', { name: /Xenon/ })).toHaveTextContent('—');

    fireEvent.click(keff);
    expect(props.onOpenConcept).toHaveBeenCalledWith('Keff');
  });

  it('scopes a typed question to the concept before handing it to Ask', async () => {
    const props = renderHub();

    fireEvent.change(await screen.findByLabelText(/ask your own question/i), {
      target: { value: 'why is it negative?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(props.onAsk).toHaveBeenCalledWith('About Reactivity: why is it negative?');
  });

  it('explains a concept that is not in the graph instead of showing an empty page', async () => {
    vi.mocked(getConceptNeighbourhood)
      .mockReset()
      .mockRejectedValue({ response: { status: 404 } });
    renderHub({ conceptId: 'Gone' });

    expect(await screen.findByText(/not in the course graph/i)).toBeInTheDocument();
  });
});
