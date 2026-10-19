import { HiOutlineArrowRightOnRectangle, HiOutlinePlus, HiOutlineShare } from 'react-icons/hi2';
import { StudentView } from '../Student/studentLocation';
import Button from '../ui-kit/Button';
import CoraMark from '../ui-kit/CoraMark';
import { initialsFor, ShellAccount } from './account';
import { STUDENT_NAV } from './navItems';
import SessionList from './SessionList';
import { SessionSummary } from './types';

export interface SidebarProps {
  active: StudentView;
  onNavigate: (view: StudentView) => void;
  /** Review cards due now; shown as a red count on Review. Hidden when unknown or zero. */
  dueCount?: number;
  sessions: SessionSummary[];
  activeSessionId?: string;
  onOpenSession: (session: SessionSummary) => void;
  onNewSession: () => void;
  account: ShellAccount;
}

const Logo = ({ onClick }: { onClick: () => void }) => (
  <button type='button' onClick={onClick} className='flex items-center gap-2.5' aria-label='CORA home: your path'>
    <CoraMark />
    <span className='font-display text-[19px] font-bold tracking-tight text-slate-900'>cora</span>
  </button>
);

const AccountCard = ({ account }: { account: ShellAccount }) => (
  <div className='flex items-center gap-3 px-2 py-2'>
    <span className='grid h-9 w-9 flex-none place-items-center rounded-full bg-slate-100 text-[12px] font-bold text-slate-700'>
      {account.isAuthenticated ? initialsFor(account.name, account.email) : 'G'}
    </span>
    <span className='min-w-0 flex-1'>
      <span className='block truncate text-[13px] font-semibold'>
        {account.isAuthenticated ? account.name || account.email || 'Signed in' : 'Guest'}
      </span>
      {!account.isAuthenticated && <span className='block text-[12px] text-slate-500'>Progress stays on this device</span>}
    </span>
    {account.isAuthenticated ? (
      <Button variant='ghost' size='sm' onClick={account.onSignOut} aria-label='Sign out'>
        <HiOutlineArrowRightOnRectangle aria-hidden='true' />
      </Button>
    ) : (
      <Button variant='secondary' size='sm' onClick={account.onSignIn}>
        Sign in
      </Button>
    )}
  </div>
);

/** The student sidebar (desktop) and the content of the mobile menu drawer. */
const Sidebar = (props: SidebarProps) => {
  const { active, onNavigate, dueCount = 0 } = props;
  return (
    <div className='flex h-full flex-col'>
      <div className='flex h-16 flex-none items-center px-5'>
        <Logo onClick={() => onNavigate('path')} />
      </div>
      <div className='px-3'>
        <Button variant='secondary' block className='justify-start' onClick={props.onNewSession}>
          <HiOutlinePlus aria-hidden='true' />
          New session
        </Button>
      </div>
      <nav aria-label='Primary' className='mt-3 space-y-0.5 px-3'>
        {STUDENT_NAV.map(({ view, label, icon: Icon }) => {
          const isActive = view === active;
          return (
            <button
              key={view}
              type='button'
              onClick={() => onNavigate(view)}
              aria-current={isActive ? 'page' : undefined}
              className={`group flex min-h-[44px] w-full items-center gap-3 rounded-[12px] px-3 text-left text-[15px] font-medium ${
                isActive ? 'bg-red-50 text-red-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-red-600' : 'text-slate-500'}`} aria-hidden='true' />
              <span className='flex-1'>{label}</span>
              {view === 'review' && dueCount > 0 && (
                <span className='tabular rounded-[6px] bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white'>
                  {dueCount}
                  <span className='sr-only'> due</span>
                </span>
              )}
            </button>
          );
        })}
        <button
          type='button'
          onClick={() => onNavigate('graph')}
          aria-current={active === 'graph' ? 'page' : undefined}
          className={`flex min-h-[40px] w-full items-center gap-3 rounded-[12px] px-3 text-left text-[13.5px] ${
            active === 'graph' ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <HiOutlineShare className='h-[18px] w-[18px]' aria-hidden='true' />
          Course graph
        </button>
      </nav>
      <div className='scroll-thin mt-2 min-h-0 flex-1 overflow-y-auto border-t border-red-100 px-2 pb-3'>
        <h2 className='sr-only'>Recent sessions</h2>
        <SessionList sessions={props.sessions} activeId={props.activeSessionId} onOpen={props.onOpenSession} />
      </div>
      <div className='flex-none border-t border-red-100 p-3'>
        <AccountCard account={props.account} />
      </div>
    </div>
  );
};

export default Sidebar;
