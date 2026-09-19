import { FormEvent, useState } from 'react';
import { HiOutlinePaperAirplane } from 'react-icons/hi2';
import { ConceptNeighbour } from '../../API/Index';
import { scopedPrompt, suggestedQuestions } from './conceptHubModel';
import { STATE_STYLE, masteryLabel, masteryState } from './learningState';

const LINKED_SHOWN = 5;

interface LinkedConceptsProps {
  neighbours: ConceptNeighbour[] | null;
  linkedCount: number;
  onOpenConcept: (conceptId: string) => void;
  onShowGraph: () => void;
}

/** The graph doing real work: what this concept connects to, and how far along you are on each. */
export const LinkedConcepts = ({ neighbours, linkedCount, onOpenConcept, onShowGraph }: LinkedConceptsProps) => (
  <section className='rounded-2xl border border-stone-200 bg-white p-5'>
    <h2 className='text-[11px] font-bold uppercase tracking-[0.09em] text-teal-700'>Linked concepts</h2>
    {neighbours === null && <div className='mt-3 h-40 animate-pulse rounded-xl bg-stone-100' />}
    {neighbours?.length === 0 && <p className='mt-3 text-sm text-slate-500'>No links to other concepts yet.</p>}
    {neighbours && neighbours.length > 0 && (
      <ul className='mt-3 space-y-1.5'>
        {neighbours.slice(0, LINKED_SHOWN).map((neighbour) => {
          const state = masteryState(neighbour.mastery);
          return (
            <li key={neighbour.id}>
              <button
                type='button'
                onClick={() => onOpenConcept(neighbour.id)}
                className='flex w-full items-center gap-3 rounded-xl bg-stone-50 px-3.5 py-2.5 text-left hover:bg-stone-100'
              >
                <span className='min-w-0 flex-1 truncate text-sm font-semibold text-slate-900'>{neighbour.name}</span>
                <span
                  className='shrink-0 text-sm font-bold'
                  style={{ color: state === 'notStarted' ? STATE_STYLE.notStarted.color : STATE_STYLE[state].color }}
                >
                  {masteryLabel(neighbour.mastery)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    )}
    {neighbours && linkedCount > Math.min(neighbours.length, LINKED_SHOWN) && (
      <button
        type='button'
        onClick={onShowGraph}
        className='mt-3 text-sm font-semibold text-teal-700 hover:text-teal-900'
      >
        See all {linkedCount} in the graph →
      </button>
    )}
  </section>
);

interface AskAboutConceptProps {
  conceptName: string;
  onAsk: (prompt: string) => void;
}

/** Chat as a per-concept affordance rather than a separate destination. */
export const AskAboutConcept = ({ conceptName, onAsk }: AskAboutConceptProps) => {
  const [question, setQuestion] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (question.trim()) {
      onAsk(scopedPrompt(conceptName, question));
    }
  };

  return (
    <section className='rounded-2xl border border-stone-200 bg-white p-5'>
      <h2 className='text-[11px] font-bold uppercase tracking-[0.09em] text-red-600'>Ask about this</h2>
      <p className='mt-2 text-sm leading-relaxed text-slate-500'>
        CORA answers from the course passages and shows where each answer came from.
      </p>
      <div className='mt-3 space-y-2'>
        {suggestedQuestions(conceptName).map((suggestion) => (
          <button
            key={suggestion}
            type='button'
            onClick={() => onAsk(suggestion)}
            className='w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-left text-sm text-slate-700 hover:border-stone-300'
          >
            {suggestion}
          </button>
        ))}
      </div>
      <form
        onSubmit={submit}
        className='mt-3 flex items-center gap-2 rounded-full border border-stone-200 py-1 pl-4 pr-1'
      >
        <label htmlFor='ask-about-concept' className='sr-only'>
          Ask your own question about {conceptName}
        </label>
        <input
          id='ask-about-concept'
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder='Ask your own question…'
          className='min-w-0 flex-1 bg-transparent py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400'
        />
        <button
          type='submit'
          aria-label='Ask'
          disabled={!question.trim()}
          className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-40'
        >
          <HiOutlinePaperAirplane className='h-4 w-4' />
        </button>
      </form>
    </section>
  );
};
