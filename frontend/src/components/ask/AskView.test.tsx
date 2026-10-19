import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatBotAPI } from '../../services/QnaAPI';
import AskView, { AskViewProps } from './AskView';
import { useSessionStore } from './useSessionStore';

vi.mock('../../services/QnaAPI', () => ({ chatBotAPI: vi.fn() }));
vi.mock('../../API/Index', () => ({
  getLearningSources: vi.fn().mockResolvedValue({ concept: {}, passages: [] }),
}));

const concept = (id: string, name: string) => ({
  id,
  name,
  chunk_count: 4,
  document_count: 1,
  connectivity: 1,
  sources: ['NE235_L07.pdf'],
});
const concepts = [concept('period', 'Reactor period'), concept('decay', 'Decay heat')];

// The real return type is an AxiosResponse; tests only need `data`, hence the cast at the end.
const reply = (message: string, sources: string[], chunks = 2) =>
  ({
    response: {
      data: {
        status: 'Success',
        data: {
          message,
          info: {
            sources,
            nodedetails: { chunkdetails: Array.from({ length: chunks }, () => ({ id: 'c', score: 1 })) },
          },
        },
      },
    },
    timeTaken: 10,
  }) as unknown as Awaited<ReturnType<typeof chatBotAPI>>;

const httpError = (status: number, data: object) => Object.assign(new Error('HTTP'), { response: { status, data } });

const Harness = (props: Partial<AskViewProps>) => {
  const store = useSessionStore('test@university.edu');
  const [sessionId, setSessionId] = useState<string>();
  return (
    <AskView
      session={store.sessions.find((session) => session.id === sessionId)}
      concepts={concepts}
      onPromptConsumed={vi.fn()}
      upsert={store.upsert}
      update={store.update}
      onSessionStarted={setSessionId}
      onGuide={vi.fn()}
      onQuiz={vi.fn()}
      onReview={vi.fn()}
      onSignIn={vi.fn()}
      {...props}
    />
  );
};

const askQuestion = (text: string) => {
  fireEvent.change(screen.getByLabelText('Message CORA'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
};

describe('AskView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(chatBotAPI).mockReset();
  });

  it('starts with questions drawn from published concepts', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Explain Reactor period in plain terms' })).toBeInTheDocument();
  });

  it('answers with its receipts: a grounded badge, source cards and a drawer', async () => {
    vi.mocked(chatBotAPI).mockResolvedValue(
      reply('Decay heat keeps going after a scram.', ['NE235_L11_Decay.pdf', 'RTM.pdf'])
    );
    render(<Harness />);
    askQuestion('Why does decay heat matter?');

    expect(screen.getByText('Why does decay heat matter?', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Why does decay heat matter?' })).toBeInTheDocument();
    expect(await screen.findByText('Grounded in 2 published passages')).toBeInTheDocument();
    expect(chatBotAPI).toHaveBeenCalledWith(
      'Why does decay heat matter?',
      expect.stringMatching(/^s-/),
      '',
      'vector',
      []
    );

    const cards = screen.getByRole('list', { name: 'Sources for this answer' });
    fireEvent.click(within(cards).getByRole('button', { name: /NE235 L11 Decay/ }));
    const drawer = screen.getByRole('complementary', { name: 'NE235 L11 Decay' });
    expect(within(drawer).getByText('NE235_L11_Decay.pdf')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Close sources' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('hands off to Quiz me on the concept the question was about', async () => {
    vi.mocked(chatBotAPI).mockResolvedValue(reply('It is set by the delayed neutrons.', ['RTM.pdf']));
    const onQuiz = vi.fn();
    render(<Harness onQuiz={onQuiz} />);
    askQuestion('What sets the reactor period?');
    expect(await screen.findByText('Keep going on')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quiz me on it' }));
    expect(onQuiz).toHaveBeenCalledWith('period');
  });

  it('says plainly when the published material does not cover the question', async () => {
    vi.mocked(chatBotAPI).mockResolvedValue(reply("I couldn't find any relevant documents.", [], 0));
    render(<Harness />);
    askQuestion('What is the Mode 3 shutdown margin?');
    expect(await screen.findByText('No published source')).toBeInTheDocument();
    expect(screen.queryByText(/Grounded in/)).not.toBeInTheDocument();
  });

  it('shows the hourly limit and suggests review cards instead', async () => {
    vi.mocked(chatBotAPI).mockRejectedValue(
      httpError(429, { detail: 'Guest Chat is limited to 10 questions per hour.' })
    );
    const onReview = vi.fn();
    render(<Harness onReview={onReview} />);
    askQuestion('Another question');
    expect(await screen.findByText(/limited to 10 questions per hour/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review cards while you wait' }));
    expect(onReview).toHaveBeenCalled();
  });

  it('offers Sign in when guest AI is switched off', async () => {
    vi.mocked(chatBotAPI).mockRejectedValue(
      httpError(503, { message: 'Guest AI features are not available right now.' })
    );
    const onSignIn = vi.fn();
    render(<Harness onSignIn={onSignIn} />);
    askQuestion('Hello?');
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('keeps the question after a failure and retries it in place', async () => {
    vi.mocked(chatBotAPI)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce(reply('Here it is.', ['RTM.pdf']));
    render(<Harness />);
    askQuestion('Explain prompt criticality');
    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Here it is.')).toBeInTheDocument();
    expect(screen.getAllByText('Explain prompt criticality', { selector: 'p' })).toHaveLength(1);
  });

  it('sends Quiz me and Guide me straight to the named concept, and says when none matches', () => {
    const onQuiz = vi.fn();
    const onGuide = vi.fn();
    render(<Harness onQuiz={onQuiz} onGuide={onGuide} />);

    fireEvent.click(screen.getByRole('button', { name: /quiz/i, pressed: false }));
    askQuestion('decay heat please');
    expect(onQuiz).toHaveBeenCalledWith('decay');

    fireEvent.click(screen.getByRole('button', { name: /guide/i, pressed: false }));
    askQuestion('something unknown');
    expect(onGuide).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('No published concept matched');
    expect(chatBotAPI).not.toHaveBeenCalled();
  });

  it('sends a question handed over from another screen exactly once', async () => {
    vi.mocked(chatBotAPI).mockResolvedValue(reply('Answer.', ['RTM.pdf']));
    const onPromptConsumed = vi.fn();
    render(
      <Harness initialPrompt='Explain Decay heat using the course material.' onPromptConsumed={onPromptConsumed} />
    );
    await waitFor(() => expect(chatBotAPI).toHaveBeenCalledTimes(1));
    expect(onPromptConsumed).toHaveBeenCalled();
  });
});
