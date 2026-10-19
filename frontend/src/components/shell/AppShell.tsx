import { ReactNode, useState } from 'react';
import { StudentView } from '../Student/studentLocation';
import MenuDrawer from './MenuDrawer';
import MobileTopBar from './MobileTopBar';
import Sidebar, { SidebarProps } from './Sidebar';
import TabBar from './TabBar';
import { SessionSummary } from './types';

interface AppShellProps extends SidebarProps {
  /** Ask fills the screen and handles the tab bar itself, so it gets no bottom padding. */
  fullHeight?: boolean;
  children: ReactNode;
}

/**
 * Student app chrome: a 272px sidebar on desktop (1024px and up); a top bar,
 * a bottom tab bar and a slide-in menu below that (DESIGN.md 3.2, 4.2).
 * Lessons and quizzes use FocusLayout instead, with no chrome at all.
 */
const AppShell = ({ children, fullHeight = false, ...sidebar }: AppShellProps) => {
  const [isMenuOpen, setMenuOpen] = useState(false);

  // Anything picked in the mobile menu should also close it.
  const drawerProps: SidebarProps = {
    ...sidebar,
    onNavigate: (view: StudentView) => {
      setMenuOpen(false);
      sidebar.onNavigate(view);
    },
    onOpenSession: (session: SessionSummary) => {
      setMenuOpen(false);
      sidebar.onOpenSession(session);
    },
    onNewSession: () => {
      setMenuOpen(false);
      sidebar.onNewSession();
    },
  };

  return (
    <div className='cora-root box-border flex min-h-screen bg-white text-slate-900'>
      <a className='skip-link' href='#main'>
        Skip to content
      </a>
      <aside className='sticky top-0 hidden h-screen w-[272px] flex-none border-r border-red-100 bg-white lg:block'>
        <Sidebar {...sidebar} />
      </aside>
      <div className='min-w-0 flex-1'>
        <MobileTopBar
          isMenuOpen={isMenuOpen}
          onOpenMenu={() => setMenuOpen(true)}
          onHome={() => sidebar.onNavigate('path')}
        />
        {/* pb-24 clears the fixed tab bar on phones so the last card is never hidden behind it. */}
        <main id='main' tabIndex={-1} className={`outline-none lg:pb-0 ${fullHeight ? '' : 'pb-24'}`}>
          {children}
        </main>
      </div>
      <TabBar active={sidebar.active} onNavigate={sidebar.onNavigate} dueCount={sidebar.dueCount} />
      <MenuDrawer isOpen={isMenuOpen} onClose={() => setMenuOpen(false)}>
        <Sidebar {...drawerProps} />
      </MenuDrawer>
    </div>
  );
};

export default AppShell;
