import { ReactNode } from 'react';
import { HiOutlineXMark } from 'react-icons/hi2';

interface FocusLayoutProps {
  /** Spoken name of the X button, e.g. "Leave lesson and return to your path". */
  closeLabel: string;
  onClose: () => void;
  /** The header's middle: title, step count, progress bar. */
  header: ReactNode;
  /** Optional header actions on the right, e.g. "Switch to Ask". */
  headerEnd?: ReactNode;
  /** The sticky bottom action bar (Back / Continue, Check, ...). */
  footer?: ReactNode;
  /** Classes for the footer wrapper; the quiz recolours it as the feedback sheet. */
  footerClassName?: string;
  /** Max width of header and footer content, e.g. 'max-w-[760px]'. */
  width?: string;
  skipLabel?: string;
  children: ReactNode;
}

/**
 * Chrome-less layout for lessons, quizzes and results (DESIGN.md 5.5, 5.6):
 * no sidebar, no tab bar, just an X that returns you to where you came from.
 */
const FocusLayout = ({
  closeLabel,
  onClose,
  header,
  headerEnd,
  footer,
  footerClassName = 'border-slate-100 bg-white',
  width = 'max-w-[1240px]',
  skipLabel = 'Skip to content',
  children,
}: FocusLayoutProps) => (
  <div className='cora-root box-border min-h-screen bg-white text-slate-900'>
    <a className='skip-link' href='#main'>
      {skipLabel}
    </a>
    <header className='sticky top-0 z-30 border-b border-red-100 bg-white/95 backdrop-blur'>
      <div className={`mx-auto flex h-16 items-center gap-4 px-4 sm:px-6 ${width}`}>
        <button
          type='button'
          onClick={onClose}
          className='grid h-11 w-11 flex-none place-items-center rounded-[12px] text-slate-500 hover:bg-slate-50'
          aria-label={closeLabel}
        >
          <HiOutlineXMark className='h-6 w-6' aria-hidden='true' />
        </button>
        <div className='min-w-0 flex-1'>{header}</div>
        {headerEnd}
      </div>
    </header>
    {children}
    {footer && (
      <div className={`fixed inset-x-0 bottom-0 z-30 border-t-2 pb-[env(safe-area-inset-bottom)] ${footerClassName}`}>
        {footer}
      </div>
    )}
  </div>
);

export default FocusLayout;
