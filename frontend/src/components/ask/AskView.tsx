import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HiOutlineDocumentText } from 'react-icons/hi2';
import { LearningConcept } from '../../API/Index';
import { buildSuggestedPrompts } from '../Student/suggestedPrompts';
import { ModeActions } from '../shell/types';
import Button from '../ui-kit/Button';
import AnswerTurn from './AnswerTurn';
import { matchConcept } from './askModel';
import Composer, { ComposerMode } from './Composer';
import { StoredSession } from './sessionStore';
import SourceDrawer from './SourceDrawer';
import { useAskRequest } from './useAskRequest';

export interface AskViewProps {
  session?: StoredSession;
  /** Published concepts, for suggestions and for spotting what a question is about. */
  concepts: LearningConcept[];
  /** Set when Ask was opened from a concept ("Ask about reactor period"). */
  scopeConcept?: { id: string; name: string };
  /** A question handed over from another screen, sent once. */
  initialPrompt?: string;
  onPromptConsumed: () => void;
  upsert: (session: StoredSession) => void;
  update: (id: string, change: (session: StoredSession) => StoredSession) => void;
  /** Show this session in the URL (and the sidebar). */
  onSessionStarted: (sessionId: string) => void;
  onGuide: ModeActions['onGuide'];
  onQuiz: ModeActions['onQuiz'];
  onReview: () => void;
  onSignIn: () => void;
}

/** Starter questions for a session about one concept. The topic is the concept's real name. */
const scopedPrompts = (name: string) => [
  `Explain ${name} in plain terms`,
  `What should I understand about ${name}?`,
  `Where does ${name} show up in practice?`,
];

/** The learner's own turn: a slate bubble on the right. */
const UserBubble = ({ text }: { text: string }) => (
  <div className='mt-8 flex justify-end first:mt-0'>
    <p className='max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-[6px] bg-slate-100 px-4 py-3 text-[15.5px] leading-relaxed'>
      {text}
    </p>
  </div>
);

const EmptySession = ({ prompts, scope, onAsk }: { prompts: string[]; scope?: string; onAsk: (q: string) => void }) => (
  <div className='pt-12 text-center'>
    <h2 className='font-display text-[26px] font-bold tracking-tight'>
      {scope ? `What do you want to know about ${scope}?` : 'What would you like to learn?'}
    </h2>
    <p className='mt-2 text-[15px] text-slate-500'>Answers come only from published course material, with sources.</p>
    {prompts.length > 0 && (
      <div className='mt-6 flex flex-wrap justify-center gap-2'>
        {prompts.map((prompt) => (
          <Button key={prompt} variant='secondary' size='sm' onClick={() => onAsk(prompt)}>
            {prompt}
          </Button>
        ))}
      </div>
    )}
  </div>
);

/** Ask: freeform questions that stay grounded and traceable (DESIGN.md 5.4). */
const AskView = (props: AskViewProps) => {
  const { session, concepts, scopeConcept, upsert, update } = props;
  const store = useMemo(() => ({ upsert, update }), [upsert, update]);
  const [arrived, setArrived] = useState<Set<string>>(new Set());
  const markArrived = useCallback((id: string) => setArrived((ids) => new Set(ids).add(id)), []);
  const { send, retry } = useAskRequest(store, markArrived);
  const [drawer, setDrawer] = useState<{ turnId: string; index: number } | null>(null);
  const [modeHint, setModeHint] = useState('');
  const threadEnd = useRef<HTMLDivElement>(null);

  // Switching to another session closes the drawer and any hint from the last one.
  const sessionId = session?.id;
  useEffect(() => {
    setDrawer(null);
    setModeHint('');
  }, [sessionId]);

  const turns = session?.turns ?? [];
  const scopeName = scopeConcept?.name;
  const prompts = useMemo(
    () => (scopeName ? scopedPrompts(scopeName) : buildSuggestedPrompts(concepts).slice(0, 3)),
    [concepts, scopeName]
  );

  const ask = useCallback(
    (question: string) => {
      const sessionId = send(question, session, scopeConcept?.id);
      if (!session) {
        props.onSessionStarted(sessionId);
      }
    },
    [send, session, scopeConcept, props]
  );

  // A question handed over from the Path, a lesson or a quiz is sent once.
  const { initialPrompt, onPromptConsumed } = props;
  useEffect(() => {
    if (initialPrompt) {
      onPromptConsumed();
      ask(initialPrompt);
    }
    // Only a new hand-over should send. `ask` and `onPromptConsumed` are left out on purpose:
    // they change on every render, and re-running would send the same question again.
  }, [initialPrompt]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView?.({ block: 'end' });
  }, [turns.length]);

  const conceptFor = (text: string) => scopeConcept ?? matchConcept(text, concepts);

  const onComposerSubmit = (text: string, mode: ComposerMode) => {
    setModeHint('');
    if (mode === 'ask') {
      ask(text);
      return;
    }
    // "Quiz me on xenon" names a concept; "quiz me on this" inside a concept's session means that concept.
    const concept = matchConcept(text, concepts) ?? scopeConcept;
    if (!concept) {
      const examples = concepts
        .slice(0, 3)
        .map((item) => item.name)
        .join(', ');
      setModeHint(`No published concept matched “${text}”.${examples ? ` Try one of: ${examples}.` : ''}`);
      return;
    }
    (mode === 'guide' ? props.onGuide : props.onQuiz)(concept.id);
  };

  const latestAnswer = [...turns].reverse().find((turn) => turn.role === 'cora' && turn.reply.kind === 'answer');
  const drawerTurn = turns.find((turn) => turn.id === drawer?.turnId);
  const drawerReply = drawerTurn?.role === 'cora' && drawerTurn.reply.kind === 'answer' ? drawerTurn.reply : undefined;

  return (
    <div className='flex h-[calc(100dvh-120px)] lg:h-screen'>
      <div className='flex min-w-0 flex-1 flex-col'>
        <div className='flex h-14 flex-none items-center gap-3 border-b border-slate-100 px-4 sm:px-6'>
          <h1 className='min-w-0 flex-1 truncate text-[15px] font-semibold'>{session?.title ?? 'New session'}</h1>
          <span className='hidden text-[13px] text-slate-500 sm:inline'>Searching all published material</span>
          {latestAnswer && latestAnswer.role === 'cora' && latestAnswer.reply.kind === 'answer' && (
            <Button
              variant='soft'
              size='sm'
              aria-expanded={drawer !== null}
              onClick={() => setDrawer(drawer ? null : { turnId: latestAnswer.id, index: 0 })}
            >
              <HiOutlineDocumentText aria-hidden='true' />
              Sources <span className='tabular'>{latestAnswer.reply.sources.length}</span>
            </Button>
          )}
        </div>
        <div className='scroll-thin min-h-0 flex-1 overflow-y-auto'>
          <div className='mx-auto max-w-[720px] px-4 pb-10 pt-8 sm:px-6'>
            {turns.length === 0 && <EmptySession prompts={prompts} scope={scopeName} onAsk={ask} />}
            {turns.map((turn) => {
              if (turn.role === 'user') {
                return <UserBubble key={turn.id} text={turn.text} />;
              }
              return (
                <AnswerTurn
                  key={turn.id}
                  reply={turn.reply}
                  animate={arrived.has(turn.id)}
                  concept={conceptFor(turn.question)}
                  openSourceIndex={drawer?.turnId === turn.id ? drawer.index : undefined}
                  onOpenSource={(index) => setDrawer({ turnId: turn.id, index })}
                  suggestions={prompts}
                  onAsk={ask}
                  onRetry={() => session && retry(session.id, turn.id, turn.question)}
                  onReview={props.onReview}
                  onSignIn={props.onSignIn}
                  onGuide={props.onGuide}
                  onQuiz={props.onQuiz}
                />
              );
            })}
            <div ref={threadEnd} />
          </div>
        </div>
        {modeHint && (
          <p className='mx-auto w-full max-w-[720px] px-6 text-[13.5px] text-amber-700' role='status'>
            {modeHint}
          </p>
        )}
        <Composer onSubmit={onComposerSubmit} />
      </div>
      {drawer && drawerReply && (
        <SourceDrawer
          sources={drawerReply.sources}
          index={drawer.index}
          passageCount={drawerReply.passageCount}
          concept={
            scopeConcept ?? (drawerTurn?.role === 'cora' ? matchConcept(drawerTurn.question, concepts) : undefined)
          }
          onSelect={(index) => setDrawer({ ...drawer, index })}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
};

export default AskView;
