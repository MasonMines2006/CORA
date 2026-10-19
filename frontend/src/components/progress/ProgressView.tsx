import { HiOutlineCog6Tooth } from 'react-icons/hi2';
import { LearningDashboard } from '../../API/Index';
import { initialsFor, ShellAccount } from '../shell/account';
import { Loadable } from '../path/useDashboard';
import InlineError from '../ui-kit/InlineError';
import Skeleton from '../ui-kit/Skeleton';
import { AccountCard, NeedsWork, StatStrip, UnitMastery } from './ProgressSections';
import { summarise, unitMastery } from './progressModel';

interface ProgressViewProps {
  dashboard: Loadable<LearningDashboard>;
  onRetry: () => void;
  account: ShellAccount;
  onQuiz: (conceptId: string) => void;
}

const ProgressSkeleton = () => (
  <div className='mt-6 space-y-6' aria-busy='true' aria-label='Loading your progress'>
    <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
      {[0, 1, 2, 3].map((key) => (
        <Skeleton key={key} className='h-[108px] rounded-[16px]' />
      ))}
    </div>
    <Skeleton className='h-64 w-full rounded-[16px]' />
  </div>
);

/** Progress and profile (DESIGN.md 5.8), built only from what the dashboard really knows. */
const ProgressView = ({ dashboard, onRetry, account, onQuiz }: ProgressViewProps) => {
  const name = account.isAuthenticated ? account.name || account.email || 'Signed in' : 'Guest';
  return (
    <div className='mx-auto max-w-[1040px] px-4 pb-10 pt-6 sm:px-8 lg:pt-10'>
      <div className='flex flex-wrap items-center gap-4'>
        <span
          className='grid h-16 w-16 place-items-center rounded-[16px] bg-slate-900 font-display text-[22px] font-bold text-white'
          aria-hidden='true'
        >
          {account.isAuthenticated ? initialsFor(account.name, account.email) : 'G'}
        </span>
        <div className='min-w-0 flex-1'>
          <h1 className='truncate font-display text-[28px] font-bold tracking-tight'>{name}</h1>
          <p className='truncate text-[14px] text-slate-500'>{account.email ?? 'Not signed in'}</p>
        </div>
        <a href='#account' className='btn btn-secondary btn-sm'>
          <HiOutlineCog6Tooth aria-hidden='true' />
          Account
        </a>
      </div>
      {dashboard.status === 'loading' && <ProgressSkeleton />}
      {dashboard.status === 'error' && (
        <div className='mt-6'>
          <InlineError title="Couldn't load your progress" onRetry={onRetry}>
            Your progress is saved; this is a problem reaching CORA.
          </InlineError>
        </div>
      )}
      {dashboard.status === 'ready' && <ProgressBody data={dashboard.data} account={account} onQuiz={onQuiz} />}
    </div>
  );
};

const ProgressBody = ({
  data,
  account,
  onQuiz,
}: {
  data: LearningDashboard;
  account: ShellAccount;
  onQuiz: (id: string) => void;
}) => {
  const summary = summarise(data);
  const units = unitMastery(data);
  return (
    <>
      <StatStrip summary={summary} />
      <div className='mt-6 grid gap-6 lg:grid-cols-[1fr_340px]'>
        <div className='space-y-6'>
          {units.length > 0 ? (
            <UnitMastery rows={units} />
          ) : (
            <p className='panel p-5 text-[14px] text-slate-500'>
              Units appear once your instructor publishes material.
            </p>
          )}
        </div>
        <div className='space-y-6'>
          <NeedsWork items={summary.needsWork} onQuiz={onQuiz} />
          <AccountCard account={account} />
        </div>
      </div>
    </>
  );
};

export default ProgressView;
