import { FormEvent, KeyboardEvent, useState } from 'react';
import { HiOutlineArrowUp, HiOutlineBolt, HiOutlineBookOpen, HiOutlineChatBubbleOvalLeft } from 'react-icons/hi2';
import Button from '../ui-kit/Button';

export type ComposerMode = 'ask' | 'guide' | 'quiz';

const MODES: { mode: ComposerMode; label: string; short: string; icon: typeof HiOutlineBolt }[] = [
  { mode: 'ask', label: 'Ask', short: 'Ask', icon: HiOutlineChatBubbleOvalLeft },
  { mode: 'guide', label: 'Guide me', short: 'Guide', icon: HiOutlineBookOpen },
  { mode: 'quiz', label: 'Quiz me', short: 'Quiz', icon: HiOutlineBolt },
];

const PLACEHOLDER: Record<ComposerMode, string> = {
  ask: 'Ask about the published course material…',
  guide: 'Name a concept and CORA will walk you through it step by step',
  quiz: 'Name a concept and get questions at your level',
};

interface ComposerProps {
  onSubmit: (text: string, mode: ComposerMode) => void;
  disabled?: boolean;
}

/** The message box with the Ask / Guide me / Quiz me switch (DESIGN.md 5.4). */
const Composer = ({ onSubmit, disabled = false }: ComposerProps) => {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<ComposerMode>('ask');

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!text.trim() || disabled) {
      return;
    }
    onSubmit(text.trim(), mode);
    setText('');
  };

  // Enter sends; Shift+Enter makes a new line, as in most chat apps.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      submit(event);
    }
  };

  return (
    <div className='flex-none bg-white px-4 pb-4 pt-2 sm:px-6'>
      <form className='composer mx-auto max-w-[720px] p-2' onSubmit={submit}>
        <label htmlFor='composer-input' className='sr-only'>
          Message CORA
        </label>
        <textarea
          id='composer-input'
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          className='block w-full px-2 py-1.5 text-[15.5px] placeholder:text-slate-500'
          placeholder={PLACEHOLDER[mode]}
        />
        <div className='mt-1 flex items-center gap-2'>
          <div className='mode' role='group' aria-label='How CORA should respond'>
            {MODES.map(({ mode: option, label, short, icon: Icon }) => (
              <button key={option} type='button' aria-pressed={mode === option} onClick={() => setMode(option)}>
                <Icon aria-hidden='true' />
                <span className='sm:hidden'>{short}</span>
                <span className='hidden sm:inline'>{label}</span>
              </button>
            ))}
          </div>
          <span className='flex-1' />
          <Button
            type='submit'
            className='h-10 min-h-10 w-10 px-0'
            aria-label='Send'
            disabled={disabled || !text.trim()}
          >
            <HiOutlineArrowUp aria-hidden='true' />
          </Button>
        </div>
      </form>
      <p className='mx-auto mt-2 max-w-[720px] text-center text-[12px] text-slate-500'>
        CORA answers only from published course material and cites it. It is a study aid: your facility&apos;s
        procedures and qualified instructors are the authority.
      </p>
    </div>
  );
};

export default Composer;
