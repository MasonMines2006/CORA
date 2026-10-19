import { ReactNode } from 'react';
import { HiOutlineArrowPath, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import Button from './Button';

interface InlineErrorProps {
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
  /** Extra actions, e.g. "Ask instead". */
  actions?: ReactNode;
}

/** An error that keeps the page usable: says what failed and offers Retry (DESIGN.md 5.10). */
const InlineError = ({ title, children, onRetry, actions }: InlineErrorProps) => (
  <div className='rounded-[12px] border border-red-200 bg-red-50 p-4' role='alert'>
    <p className='flex items-center gap-2 text-[14px] font-semibold text-red-700'>
      <HiOutlineExclamationTriangle className='h-5 w-5 flex-none' aria-hidden='true' />
      {title}
    </p>
    {children && <div className='mt-1 text-[14px] text-slate-700'>{children}</div>}
    {(onRetry || actions) && (
      <div className='mt-3 flex flex-wrap gap-2'>
        {onRetry && (
          <Button size='sm' onClick={onRetry}>
            <HiOutlineArrowPath aria-hidden='true' />
            Try again
          </Button>
        )}
        {actions}
      </div>
    )}
  </div>
);

export default InlineError;
