import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLearningLesson, getLearningSources } from '../../API/Index';
import StudentStudyTools from './StudentStudyTools';

vi.mock('../../API/Index', () => ({
  getLearningLesson: vi.fn(),
  getLearningSources: vi.fn(),
}));

const concept = {
  id: 'reactivity',
  name: 'Reactivity',
  chunk_count: 9,
  document_count: 2,
  connectivity: 30,
  sources: ['Theory.pdf'],
};

describe('StudentStudyTools', () => {
  beforeEach(() => {
    vi.mocked(getLearningSources)
      .mockReset()
      .mockResolvedValue({
        concept,
        passages: [{ id: 'reactivity:0', source: 'Theory.pdf', text: 'Reactivity changes the neutron population.' }],
      });
    vi.mocked(getLearningLesson)
      .mockReset()
      .mockResolvedValue({
        concept,
        beats: [
          { key: 'core_idea', title: 'Core idea', content: 'Reactivity measures departure from criticality.' },
          { key: 'how_it_works', title: 'How it works', content: 'Positive reactivity raises neutron population.' },
          {
            key: 'pulstar_application',
            title: 'PULSTAR application',
            content: 'Operators control reactivity with rods.',
          },
          { key: 'quick_check', title: 'Quick check', content: 'Check your understanding.' },
        ],
        quick_check: {
          question: 'What does positive reactivity do?',
          options: ['Raises neutron population', 'Stops all fission'],
          answer_index: 0,
          explanation: 'It increases the neutron population over time.',
        },
        sources: ['Theory.pdf'],
        cached: true,
      });
  });

  it('shows the actual course passage and its document', async () => {
    render(<StudentStudyTools conceptId='reactivity' conceptName='Reactivity' mode='sources' />);

    expect(await screen.findByText('Theory.pdf')).toBeInTheDocument();
    expect(screen.getByText('Reactivity changes the neutron population.')).toBeInTheDocument();
  });

  it('turns grounded lesson content into a review deck', async () => {
    render(<StudentStudyTools conceptId='reactivity' conceptName='Reactivity' mode='cards' />);

    expect(await screen.findByText('What is the core idea behind Reactivity?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    expect(screen.getByText('Reactivity measures departure from criticality.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.getByText('How does Reactivity work?')).toBeInTheDocument();
  });
});
