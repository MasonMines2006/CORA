import { ReactNode } from 'react';
import { HiOutlineArrowRightOnRectangle } from 'react-icons/hi2';
import { LearningConceptProgress } from '../../API/Index';
import { masteryPercent } from '../Student/learningState';
import { ShellAccount } from '../shell/account';
import Button from '../ui-kit/Button';
import { ProgressSummary, UnitRow } from './progressModel';

const Tile = ({ tone, label, value, caption }: { tone: string; label: string; value: ReactNode; caption: string }) => (
  <div className={`rounded-[16px] p-4 ${tone}`}>
    <p className='text-[13px] font-semibold'>{label}</p>
    <p className='tabular mt-1 font-display text-[30px] font-bold text-slate-900'>{value}</p>
    <p className='text-[12.5px] text-slate-500'>{caption}</p>
  </div>
);

/** Four real numbers. A new learner sees "–" and what starts the count, not zeros dressed up as progress. */
export const StatStrip = ({ summary }: { summary: ProgressSummary }) => {
  const scope = summary.isSample
    ? `of the ${summary.sampleSize} most-connected concepts`
    : `of ${summary.sampleSize} concepts`;
  const notYet = 'Finish your first check to start';
  return (
    <section className='mt-6 grid grid-cols-2 gap-3 md:grid-cols-4' aria-label='Summary'>
      <Tile
        tone='bg-emerald-50 text-emerald-700'
        label='Mastered'
        value={summary.hasStarted ? summary.mastered : '–'}
        caption={summary.hasStarted ? scope : notYet}
      />
      <Tile
        tone='bg-amber-50 text-amber-700'
        label='Started'
        value={summary.hasStarted ? summary.started : '–'}
        caption={summary.hasStarted ? scope : notYet}
      />
      <Tile tone='bg-red-50 text-red-700' label='Cards due' value={summary.due} caption='in Review now' />
      <Tile
        tone='border border-slate-200 text-slate-700'
        label='In the course'
        value={summary.courseConcepts}
        caption='published concepts'
      />
    </section>
  );
};

export const UnitMastery = ({ rows }: { rows: UnitRow[] }) => (
  <section className='panel p-5' aria-labelledby='unit-h'>
    <h2 id='unit-h' className='font-semibold'>
      Mastery by unit
    </h2>
    <ul className='mt-4 space-y-4 text-[14px]'>
      {rows.map((row, index) => {
        const masteredShare = (row.mastered / row.total) * 100;
        const progressShare = (row.inProgress / row.total) * 100;
        const complete = row.mastered === row.total;
        return (
          <li key={row.title}>
            <div className='flex justify-between gap-3'>
              <span className='min-w-0 truncate'>
                {index + 1} · {row.title}
              </span>
              <span className={`tabular flex-none font-semibold ${complete ? 'text-emerald-700' : 'text-slate-700'}`}>
                {row.mastered} / {row.total}
              </span>
            </div>
            <div
              className='bar mt-1.5 flex'
              role='img'
              aria-label={`${row.mastered} of ${row.total} mastered, ${row.inProgress} in progress`}
            >
              <span style={{ width: `${masteredShare}%`, background: '#059669', borderRadius: 0 }} />
              <span style={{ width: `${progressShare}%`, background: '#d97706', borderRadius: 0 }} />
            </div>
          </li>
        );
      })}
    </ul>
    <p className='mt-4 text-[12.5px] text-slate-500'>
      Green is mastered (80%+ correct). Amber is started. Mastery comes only from checks and quizzes, never from reading
      time.
    </p>
  </section>
);

export const NeedsWork = ({
  items,
  onQuiz,
}: {
  items: LearningConceptProgress[];
  onQuiz: (conceptId: string) => void;
}) => (
  <section className='panel-quiet p-5' aria-labelledby='weak-h'>
    <h2 id='weak-h' className='font-semibold'>
      Needs work
    </h2>
    {items.length === 0 ? (
      <p className='mt-2 text-[14px] text-slate-500'>
        Concepts you&apos;ve started but not mastered will show up here.
      </p>
    ) : (
      <ul className='mt-3 divide-y divide-slate-100'>
        {items.map((item) => (
          <li key={item.concept.id} className='flex items-center gap-3 py-3'>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-[14px] font-medium'>{item.concept.name}</p>
              <p className='tabular text-[12.5px] text-amber-700'>
                {masteryPercent(item.mastery)}% · {item.mastery.correct} of {item.mastery.attempts}
              </p>
            </div>
            <Button
              variant='soft'
              size='sm'
              onClick={() => onQuiz(item.concept.id)}
              aria-label={`Quiz me on ${item.concept.name}`}
            >
              Quiz
            </Button>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const AccountCard = ({ account }: { account: ShellAccount }) => (
  <section id='account' className='panel-quiet p-5' aria-labelledby='acct-h'>
    <h2 id='acct-h' className='font-semibold'>
      Account
    </h2>
    <dl className='mt-3 space-y-2 text-[14px]'>
      <div className='flex justify-between gap-3'>
        <dt className='text-slate-500'>Status</dt>
        <dd>{account.isAuthenticated ? 'Signed in' : 'Guest'}</dd>
      </div>
      {account.email && (
        <div className='flex justify-between gap-3'>
          <dt className='text-slate-500'>Email</dt>
          <dd className='truncate'>{account.email}</dd>
        </div>
      )}
    </dl>
    {!account.isAuthenticated && (
      <p className='mt-2 text-[13px] text-slate-500'>As a guest, your progress is kept for this browser only.</p>
    )}
    <div className='mt-4 flex flex-wrap gap-2'>
      {account.isAuthenticated ? (
        <Button variant='ghost' size='sm' onClick={account.onSignOut}>
          <HiOutlineArrowRightOnRectangle aria-hidden='true' />
          Sign out
        </Button>
      ) : (
        <Button size='sm' onClick={account.onSignIn}>
          Sign in
        </Button>
      )}
    </div>
  </section>
);
