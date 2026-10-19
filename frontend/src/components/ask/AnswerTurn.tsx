import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { HiOutlineClipboard, HiOutlineClipboardDocumentCheck } from 'react-icons/hi2';
import Badge from '../ui-kit/Badge';
import CoraMark from '../ui-kit/CoraMark';
import Skeleton from '../ui-kit/Skeleton';
import { ModeActions } from '../shell/types';
import ModeHandoff from './ModeHandoff';
import { FailedReply, NotInMaterial } from './ReplyStates';
import SourceCards from './SourceCards';
import { CoraReply } from './sessionStore';
import { useReveal } from './useReveal';

export interface AnswerTurnProps {
  reply: CoraReply;
  /** True only for an answer that just arrived; restored answers appear at once. */
  animate: boolean;
  /** The concept to hand off to, when we know it. */
  concept?: { id: string; name: string };
  openSourceIndex?: number;
  onOpenSource: (index: number) => void;
  suggestions: string[];
  onAsk: (question: string) => void;
  onRetry: () => void;
  onReview: () => void;
  onSignIn: () => void;
  onGuide: ModeActions['onGuide'];
  onQuiz: ModeActions['onQuiz'];
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };
  return (
    <button
      type='button'
      onClick={copy}
      className='grid h-9 w-9 place-items-center rounded-[8px] text-slate-500 hover:bg-slate-100'
      aria-label={copied ? 'Answer copied' : 'Copy answer'}
    >
      {copied ? (
        <HiOutlineClipboardDocumentCheck className='h-[18px] w-[18px]' />
      ) : (
        <HiOutlineClipboard className='h-[18px] w-[18px]' />
      )}
    </button>
  );
};

const GroundedAnswer = (props: AnswerTurnProps & { reply: Extract<CoraReply, { kind: 'answer' }> }) => {
  const { reply } = props;
  const { visibleText, isDone } = useReveal(reply.text, props.animate);
  const passages = reply.passageCount || reply.sources.length;
  return (
    <>
      <div className='mb-2 flex flex-wrap items-center gap-2 text-[12.5px]'>
        <Badge tone='live'>
          Grounded in {passages} published passage{passages === 1 ? '' : 's'}
        </Badge>
        <span className='font-code text-slate-500'>Ask mode</span>
      </div>
      {/* The animated text is hidden from screen readers; the live region below announces the full answer once. */}
      <div className={`prose-cora ${isDone ? '' : 'caret'}`} aria-hidden={!isDone}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{visibleText}</ReactMarkdown>
      </div>
      {isDone && (
        <div className='enter'>
          <SourceCards sources={reply.sources} openIndex={props.openSourceIndex} onOpen={props.onOpenSource} />
          <div className='mt-3 flex items-center gap-1'>
            <CopyButton text={reply.text} />
          </div>
          {props.concept && <ModeHandoff concept={props.concept} onGuide={props.onGuide} onQuiz={props.onQuiz} />}
        </div>
      )}
    </>
  );
};

const ReplyBody = (props: AnswerTurnProps) => {
  const { reply } = props;
  switch (reply.kind) {
    case 'pending':
      return (
        <div className='space-y-2 pt-1' aria-label='CORA is answering'>
          <Skeleton className='h-4 w-11/12' />
          <Skeleton className='h-4 w-4/5' />
          <Skeleton className='h-4 w-2/3' />
        </div>
      );
    case 'answer':
      return <GroundedAnswer {...props} reply={reply} />;
    case 'notInMaterial':
      return <NotInMaterial text={reply.text} suggestions={props.suggestions} onAsk={props.onAsk} />;
    case 'error':
      return <FailedReply reason='error' message={reply.message} {...props} />;
    default:
      return <FailedReply reason={reply.reason} message={reply.message} {...props} />;
  }
};

/** CORA's side of the conversation: unboxed, with the red "C" tile and the receipts. */
const AnswerTurn = (props: AnswerTurnProps) => {
  // Announce the answer once, when it has fully arrived (DESIGN.md 8: not per token).
  const [announcement, setAnnouncement] = useState('');
  const { reply } = props;
  useEffect(() => {
    if (reply.kind === 'answer' || reply.kind === 'notInMaterial') {
      setAnnouncement(reply.text);
    }
  }, [reply]);
  return (
    <article className='mt-8 flex gap-3 sm:gap-4' aria-label="CORA's answer">
      <span className='mt-0.5'>
        <CoraMark />
      </span>
      <div className='min-w-0 flex-1'>
        <ReplyBody {...props} />
        <div className='sr-only' aria-live='polite'>
          {props.animate ? announcement : ''}
        </div>
      </div>
    </article>
  );
};

export default AnswerTurn;
