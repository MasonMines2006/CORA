import { ReactNode } from 'react';

type Tone = 'red' | 'amber' | 'emerald' | 'slate';

const ICON_TILE: Record<Tone, string> = {
  red: 'bg-white text-red-600',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  slate: 'bg-slate-100 text-slate-700',
};

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  /** Buttons for the next useful action. The states rule: never a dead end. */
  actions?: ReactNode;
  tone?: Tone;
  /** A dashed red-50 box (used on the Path); otherwise plain and centred. */
  boxed?: boolean;
}

/** "Nothing here yet" that says what happened and what to do next (DESIGN.md 5.10). */
const EmptyState = ({ icon, title, children, actions, tone = 'red', boxed = false }: EmptyStateProps) => (
  <div
    className={`px-6 py-8 text-center ${boxed ? 'rounded-[16px] border-2 border-dashed border-red-200 bg-red-50' : ''}`}
  >
    {/* rounded-[16px], not rounded-2xl: the NDL preset makes rounded-2xl 14px. */}
    <span className={`mx-auto grid h-12 w-12 place-items-center rounded-[16px] ${ICON_TILE[tone]}`} aria-hidden='true'>
      {icon}
    </span>
    <h2 className='mt-3 font-display text-[20px] font-bold'>{title}</h2>
    {children && <div className='mx-auto mt-1 max-w-[380px] text-[14px] text-slate-700'>{children}</div>}
    {actions && <div className='mt-4 flex flex-wrap justify-center gap-2'>{actions}</div>}
  </div>
);

export default EmptyState;
