import { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useSearchParams } from 'react-router-dom';
import {
  HiOutlineArrowLeft,
  HiOutlineBookOpen,
  HiOutlineChatBubbleLeftRight,
  HiOutlineHome,
  HiOutlineRectangleStack,
  HiOutlineShare,
} from 'react-icons/hi2';
import ThemeWrapper from '../../context/ThemeWrapper';
import UserCredentialsWrapper from '../../context/UserCredentials';
import { FileContextProvider } from '../../context/UsersFiles';
import { MessageContextWrapper } from '../../context/UserMessages';
import { SpotlightProvider } from '@neo4j-ndl/react';
import ErrorBoundary from '../UI/ErrroBoundary';
import ConceptHub from './ConceptHub';
import ConceptIndex from './ConceptIndex';
import { HubMode } from './conceptHubModel';
import ReviewSession from './ReviewSession';
import StudentChat from './StudentChat';
import StudentExplore from './StudentExplore';
import StudentHome from './StudentHomeArtboard';
import { StudentLocation, StudentView, parseLocation, toSearchParams } from './studentLocation';

const desktopTabs: { view: StudentView; label: string }[] = [
  { view: 'home', label: 'Home' },
  { view: 'concepts', label: 'Concepts' },
  { view: 'graph', label: 'Graph' },
  { view: 'review', label: 'Review' },
];

const mobileTabs = [
  { view: 'home' as const, label: 'Home', icon: HiOutlineHome },
  { view: 'concepts' as const, label: 'Learn', icon: HiOutlineBookOpen },
  { view: 'review' as const, label: 'Review', icon: HiOutlineRectangleStack },
  { view: 'graph' as const, label: 'Graph', icon: HiOutlineShare },
  { view: 'ask' as const, label: 'Ask', icon: HiOutlineChatBubbleLeftRight },
];

const StudentLayout = () => {
  const { isAuthenticated, loginWithRedirect, logout } = useAuth0();
  const [params, setParams] = useSearchParams();
  const location = parseLocation(params);
  // Chat keeps its conversation in component state, so once opened it stays
  // mounted (hidden) rather than being rebuilt on every visit.
  const [hasOpenedChat, setHasOpenedChat] = useState(location.view === 'ask');
  const [chatPrompt, setChatPrompt] = useState('');
  const [askedFrom, setAskedFrom] = useState<StudentLocation | null>(null);

  const go = (next: StudentLocation, options: { replace?: boolean } = {}) => {
    if (next.view === 'ask') {
      setHasOpenedChat(true);
    }
    setParams(toSearchParams(next), { replace: options.replace });
  };

  const goToView = (view: StudentView) => go({ view, conceptId: '', mode: 'learn' });

  const openConcept = (conceptId: string, mode: HubMode = 'learn', beat?: number) =>
    go({ view: 'concepts', conceptId, mode, beat });

  const ask = (prompt: string) => {
    setChatPrompt(prompt);
    setAskedFrom(location.view === 'ask' ? askedFrom : location);
    goToView('ask');
  };

  // A new page should start at the top, not wherever the last one was scrolled to.
  useEffect(() => {
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0 });
    }
  }, [location.view, location.conceptId]);

  const handleAccountAction = () => {
    if (!isAuthenticated) {
      loginWithRedirect({ appState: { returnTo: '/student' } });
      return;
    }
    localStorage.removeItem('userRole');
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const askedFromConcept = askedFrom?.view === 'concepts' && askedFrom.conceptId ? askedFrom : null;

  return (
    <div className='box-border flex min-h-screen flex-col bg-[#f8f7f6] text-slate-900'>
      <header className='sticky top-0 z-50 border-b border-stone-200 bg-white'>
        <div className='mx-auto flex h-16 max-w-[1440px] items-center gap-10 px-5 sm:px-8 lg:px-12'>
          <button type='button' onClick={() => goToView('home')} className='flex items-center gap-2.5'>
            <span className='flex h-7 w-7 items-center justify-center rounded-lg bg-red-600 font-display text-[15px] font-bold text-white'>
              C
            </span>
            <span className='font-display text-[17px] font-bold tracking-tight text-slate-900'>Cora</span>
          </button>

          <nav className='hidden flex-1 items-center gap-1 lg:flex' aria-label='Primary navigation'>
            {desktopTabs.map((tab) => {
              const active = location.view === tab.view;
              return (
                <button
                  key={tab.view}
                  type='button'
                  aria-current={active ? 'page' : undefined}
                  onClick={() => goToView(tab.view)}
                  className={`rounded-lg px-3.5 py-2 text-sm ${
                    active ? 'bg-red-50 font-semibold text-red-700' : 'font-medium text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className='ml-auto flex items-center gap-3'>
            {!isAuthenticated && (
              <span className='flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-slate-500'>
                <i className='h-1.5 w-1.5 rounded-full bg-emerald-600' />
                <span className='hidden sm:inline'>Guest session</span>
                <span className='sm:hidden'>Guest</span>
              </span>
            )}
            <button
              type='button'
              onClick={handleAccountAction}
              className='hidden rounded-full border border-stone-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-900 hover:border-stone-300 lg:block'
            >
              {isAuthenticated ? 'Sign out' : 'Sign in'}
            </button>
          </div>
        </div>
      </header>

      {/* Clear the fixed mobile tab bar so the last card is not hidden behind it. */}
      <main className='flex-1 pb-[74px] lg:pb-0'>
        {location.view === 'home' && (
          <StudentHome
            onOpenConcept={(conceptId) => openConcept(conceptId)}
            onOpenExplore={() => goToView('graph')}
            onOpenReview={() => goToView('review')}
          />
        )}

        {location.view === 'concepts' &&
          (location.conceptId ? (
            <ConceptHub
              key={location.conceptId}
              conceptId={location.conceptId}
              mode={location.mode}
              initialBeat={location.beat}
              // Switching mode replaces the history entry: Back should leave the
              // concept, not step back through every tab you clicked on it.
              onModeChange={(mode) => go({ ...location, mode, beat: undefined }, { replace: true })}
              onOpenConcept={(conceptId) => openConcept(conceptId)}
              onAllConcepts={() => goToView('concepts')}
              onAsk={ask}
            />
          ) : (
            <ConceptIndex onOpenConcept={(conceptId) => openConcept(conceptId)} />
          ))}

        {location.view === 'review' && (
          <div className='mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12'>
            <ReviewSession showRail onFindCards={() => goToView('concepts')} />
          </div>
        )}

        {hasOpenedChat && (
          <div className={location.view === 'ask' ? '' : 'hidden'}>
            {askedFromConcept && (
              <div className='mx-auto max-w-5xl px-5 pt-5 sm:px-8'>
                <button
                  type='button'
                  onClick={() => go(askedFromConcept)}
                  className='flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900'
                >
                  <HiOutlineArrowLeft className='h-4 w-4' /> Back to {askedFromConcept.conceptId}
                </button>
              </div>
            )}
            <StudentChat externalPrompt={chatPrompt} onExternalPromptConsumed={() => setChatPrompt('')} />
          </div>
        )}

        {/* The course map stays mounted: its force layout is expensive to rebuild. */}
        <div className={location.view === 'graph' ? '' : 'hidden'}>
          <StudentExplore
            onOpenConcept={(conceptId) => openConcept(conceptId)}
            onPracticeConcept={(conceptId) => openConcept(conceptId, 'practice')}
          />
        </div>
      </main>

      {/* Height and bottom padding are arbitrary values on purpose. The NDL preset
          extends Tailwind's spacing scale and its `20` key is 20px, not Tailwind's
          80px -- so `h-20` silently rendered this bar 20px tall. See CLAUDE.md. */}
      <nav
        className='fixed inset-x-0 bottom-0 z-50 grid h-[74px] grid-cols-5 border-t border-stone-200 bg-white lg:hidden'
        aria-label='Mobile navigation'
      >
        {mobileTabs.map(({ view, label, icon: Icon }) => (
          <button
            type='button'
            key={view}
            aria-label={label}
            aria-current={location.view === view ? 'page' : undefined}
            onClick={() => goToView(view)}
            className={`flex min-h-11 flex-col items-center justify-center gap-1 bg-white p-1.5 text-[11px] font-bold ${
              location.view === view ? 'text-red-600' : 'text-slate-400'
            }`}
          >
            <Icon className='h-6 w-6' />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

const StudentApp = () => (
  <ErrorBoundary>
    <ThemeWrapper>
      <UserCredentialsWrapper>
        <SpotlightProvider>
          <FileContextProvider>
            <MessageContextWrapper>
              <StudentLayout />
            </MessageContextWrapper>
          </FileContextProvider>
        </SpotlightProvider>
      </UserCredentialsWrapper>
    </ThemeWrapper>
  </ErrorBoundary>
);

export default StudentApp;
