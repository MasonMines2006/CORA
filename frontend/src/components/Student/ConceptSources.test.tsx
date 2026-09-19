import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLearningSources } from '../../API/Index';
import ConceptSources from './ConceptSources';

vi.mock('../../API/Index', () => ({ getLearningSources: vi.fn() }));

const concept = {
  id: 'Reactivity',
  name: 'Reactivity',
  chunk_count: 3,
  document_count: 2,
  connectivity: 30,
  sources: [],
};

describe('ConceptSources', () => {
  beforeEach(() => {
    vi.mocked(getLearningSources)
      .mockReset()
      .mockResolvedValue({
        concept,
        passages: [
          {
            id: 'r:0',
            source: 'Lab#2 - Reactor Startup Lab.pdf',
            text: 'SUB-CRITICALITY – neutron population is decreasing.',
          },
          { id: 'r:1', source: 'Theory Manual - NE235.pdf', text: 'A critical reactor has a reactivity of zero.' },
          {
            id: 'r:2',
            source: 'Theory Manual - NE235.pdf',
            text: 'Reactivity is the fractional change per generation.',
          },
        ],
      });
  });

  it('shows the real passage text, grouped under the document it came from', async () => {
    render(<ConceptSources conceptId='Reactivity' conceptName='Reactivity' />);

    const manual = (await screen.findByRole('heading', { name: 'Theory Manual - NE235.pdf' })).closest('article');
    expect(manual).not.toBeNull();
    expect(within(manual as HTMLElement).getByText('A critical reactor has a reactivity of zero.')).toBeInTheDocument();
    expect(within(manual as HTMLElement).getByText('· 2 passages')).toBeInTheDocument();
  });

  it('lists the document with the most passages first', async () => {
    render(<ConceptSources conceptId='Reactivity' conceptName='Reactivity' />);

    const headings = await screen.findAllByRole('heading', { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Theory Manual - NE235.pdf',
      'Lab#2 - Reactor Startup Lab.pdf',
    ]);
  });

  it('says so when the request fails instead of showing an empty page', async () => {
    vi.mocked(getLearningSources).mockReset().mockRejectedValue(new Error('503'));
    render(<ConceptSources conceptId='Reactivity' conceptName='Reactivity' />);

    expect(await screen.findByText(/could not load the source passages/i)).toBeInTheDocument();
  });
});
