import { groupSessions } from './sessionGroups';
import { SessionMode, SessionSummary } from './types';

/* Mode tag colours. Text shades are -700 so they pass contrast on white. */
const MODE_TAG: Record<SessionMode, { label: string; className: string }> = {
  ask: { label: 'Ask', className: 'text-red-700' },
  guide: { label: 'Guide', className: 'text-amber-700' },
  quiz: { label: 'Quiz', className: 'text-teal-700' },
};

interface SessionListProps {
  sessions: SessionSummary[];
  activeId?: string;
  onOpen: (session: SessionSummary) => void;
}

/** Recent sessions of every mode, grouped Today / Yesterday / This week / Earlier. */
const SessionList = ({ sessions, activeId, onOpen }: SessionListProps) => {
  const groups = groupSessions(sessions);
  if (groups.length === 0) {
    return <p className='px-3 pt-4 text-[13px] text-slate-500'>Your Ask, Guide and Quiz sessions will show up here.</p>;
  }
  return (
    <>
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className='px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500'>
            {group.label}
          </h3>
          <ul>
            {group.items.map((session) => (
              <li key={session.id}>
                <button
                  type='button'
                  onClick={() => onOpen(session)}
                  aria-current={session.id === activeId ? 'true' : undefined}
                  className={`flex min-h-[36px] w-full items-center gap-2 rounded-[8px] px-3 text-left text-[13.5px] ${
                    session.id === activeId ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-11 flex-none font-code text-[10.5px] font-medium uppercase ${MODE_TAG[session.mode].className}`}
                  >
                    {MODE_TAG[session.mode].label}
                  </span>
                  <span className='truncate'>{session.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
};

export default SessionList;
