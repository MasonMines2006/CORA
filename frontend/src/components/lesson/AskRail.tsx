import { FormEvent, useState } from 'react';
import { HiOutlineArrowUp, HiOutlineChatBubbleOvalLeft } from 'react-icons/hi2';
import Button from '../ui-kit/Button';

interface AskRailProps {
  conceptName: string;
  questions: string[];
  onAsk: (question: string) => void;
}

/** "Ask about this step" beside the lesson at 1280px and up. Opens Ask about this concept. */
const AskRail = ({ conceptName, questions, onAsk }: AskRailProps) => {
  const [text, setText] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim()) {
      onAsk(text.trim());
    }
  };
  return (
    <aside
      className='sticky top-16 hidden h-[calc(100vh-64px)] w-[320px] flex-none flex-col border-l border-red-100 py-8 pl-6 xl:flex'
      aria-labelledby='ask-rail-h'
    >
      <h2 id='ask-rail-h' className='flex items-center gap-2 font-semibold'>
        <HiOutlineChatBubbleOvalLeft className='h-5 w-5 text-red-600' aria-hidden='true' />
        Ask about this step
      </h2>
      <p className='mt-1 text-[13.5px] text-slate-500'>Answers come only from the published course material.</p>
      <div className='mt-4 space-y-2'>
        {questions.map((question) => (
          <button
            key={question}
            type='button'
            onClick={() => onAsk(question)}
            className='block w-full rounded-[12px] border border-slate-200 px-3 py-2.5 text-left text-[14px] hover:border-red-200 hover:bg-red-50'
          >
            {question}
          </button>
        ))}
      </div>
      <form className='composer mt-auto flex items-end gap-2 p-2 pl-3' onSubmit={submit}>
        <label htmlFor='rail-ask' className='sr-only'>
          Ask about {conceptName}
        </label>
        <textarea
          id='rail-ask'
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className='min-w-0 flex-1 py-1.5 text-[14px] placeholder:text-slate-500'
          placeholder={`Ask anything about ${conceptName}…`}
        />
        <Button type='submit' size='sm' className='px-2.5' aria-label='Send'>
          <HiOutlineArrowUp aria-hidden='true' />
        </Button>
      </form>
    </aside>
  );
};

export default AskRail;
