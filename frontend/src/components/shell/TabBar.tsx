import { StudentView } from '../Student/studentLocation';
import { STUDENT_NAV } from './navItems';

interface TabBarProps {
  active: StudentView;
  onNavigate: (view: StudentView) => void;
  dueCount?: number;
}

/*
 * Bottom tab bar on phones and tablets. Height is `h-16` (64px), which is safe:
 * only the `-20` spacing key is broken by the NDL preset (20px, not 80px).
 * The bottom padding keeps it above the iPhone home indicator.
 */
const TabBar = ({ active, onNavigate, dueCount = 0 }: TabBarProps) => (
  <nav
    aria-label='Primary'
    className='fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-red-100 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden'
  >
    {STUDENT_NAV.map(({ view, label, icon: Icon }) => {
      const isActive = view === active;
      return (
        <button
          key={view}
          type='button'
          onClick={() => onNavigate(view)}
          aria-current={isActive ? 'page' : undefined}
          className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11.5px] font-semibold ${
            isActive ? 'text-red-700' : 'text-slate-500'
          }`}
        >
          <Icon className='h-6 w-6' aria-hidden='true' />
          <span>{label}</span>
          {view === 'review' && dueCount > 0 && (
            <span className='tabular absolute right-[calc(50%-22px)] top-2 rounded-[6px] bg-red-600 px-1 text-[10px] font-bold text-white'>
              {dueCount}
              <span className='sr-only'> due</span>
            </span>
          )}
        </button>
      );
    })}
  </nav>
);

export default TabBar;
