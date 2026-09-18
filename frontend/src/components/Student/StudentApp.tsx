import { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import {
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
import StudentChat from './StudentChat';
import StudentExplore from './StudentExplore';
import StudentLearn from './StudentLearn';
import StudentHome from './StudentHomeArtboard';
import StudentReview from './StudentReview';

type Tab = 'home' | 'learn' | 'explore' | 'review' | 'chat';

const desktopTabs: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'learn', label: 'Concepts' },
  { key: 'explore', label: 'Graph' },
  { key: 'review', label: 'Review' },
];

const mobileTabs = [
  { key: 'home' as const, label: 'Home', icon: HiOutlineHome },
  { key: 'learn' as const, label: 'Learn', icon: HiOutlineBookOpen },
  { key: 'review' as const, label: 'Review', icon: HiOutlineRectangleStack },
  { key: 'explore' as const, label: 'Graph', icon: HiOutlineShare },
  { key: 'chat' as const, label: 'Ask', icon: HiOutlineChatBubbleLeftRight },
];

const StudentLayout: React.FC = () => {
  const { isAuthenticated, loginWithRedirect, logout } = useAuth0();
  // Guests arrive through the public QR code, so start them in the mode that
  // works without an authenticated Chat connection.
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [hasOpenedChat, setHasOpenedChat] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');
  const [selectedConceptId, setSelectedConceptId] = useState('');

  const handleAccountAction = () => {
    if (!isAuthenticated) {
      loginWithRedirect({ appState: { returnTo: '/student' } });
      return;
    }
    localStorage.removeItem('userRole');
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const selectTab = (tab: Tab) => {
    if (tab === 'chat') {
      setHasOpenedChat(true);
    }
    setActiveTab(tab);
  };

  return (
    <div className='box-border flex min-h-screen flex-col bg-stone-50 text-slate-900'>
      <header className='sticky top-0 z-50 border-b border-stone-200 bg-white'>
        <div className='box-border mx-auto flex h-16 max-w-[1536px] items-center justify-between px-5 sm:px-8 lg:px-12'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-red-600'>
              <span className='text-lg font-bold text-white'>C</span>
            </div>
            <span className='text-2xl font-bold tracking-tight text-slate-900'>Cora</span>
          </div>

          <nav className='hidden items-center gap-1 lg:flex' aria-label='Primary navigation'>
            {desktopTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => selectTab(tab.key)}
                className={`min-h-11 whitespace-nowrap rounded-xl px-5 text-sm font-bold transition-colors ${
                  activeTab === tab.key ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:text-slate-900'
                }`}
                style={{
                  border: 0,
                  backgroundColor: activeTab === tab.key ? '#fef2f2' : 'transparent',
                  padding: '0.7rem 1.25rem',
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className='flex items-center gap-3'>
            {!isAuthenticated && (
              <span className='flex items-center gap-2 rounded-full border border-stone-200 px-3 py-2 text-sm font-semibold text-slate-500'>
                <i className='h-2 w-2 rounded-full bg-emerald-600' />
                <span className='hidden sm:inline'>Guest session</span>
                <span className='sm:hidden'>Guest</span>
              </span>
            )}
            <button
              onClick={handleAccountAction}
              className='hidden rounded-full border border-stone-200 px-5 py-2 text-sm font-bold text-slate-900 lg:block'
              style={{ border: '1px solid #e7e5e4', backgroundColor: '#fff', padding: '0.55rem 1.25rem' }}
            >
              {isAuthenticated ? 'Sign out' : 'Sign in'}
            </button>
          </div>
        </div>
      </header>

      {/* Clear the fixed mobile tab bar so the last card is not hidden behind it. */}
      <main className='flex-1 pb-[74px] lg:pb-0'>
        {activeTab === 'home' && (
          <StudentHome
            onOpenConcept={(conceptId) => {
              setSelectedConceptId(conceptId);
              setActiveTab('learn');
            }}
            onOpenExplore={() => setActiveTab('explore')}
            onOpenReview={() => setActiveTab('review')}
          />
        )}
        {hasOpenedChat && (
          <div className={activeTab === 'chat' ? '' : 'hidden'}>
            <StudentChat externalPrompt={chatPrompt} onExternalPromptConsumed={() => setChatPrompt('')} />
          </div>
        )}
        <div className={activeTab === 'explore' ? '' : 'hidden'}>
          <StudentExplore />
        </div>
        {activeTab === 'learn' && (
          <StudentLearn
            key={selectedConceptId || 'study'}
            initialConceptId={selectedConceptId}
            onNavigateToChat={(prompt) => {
              if (prompt) {
                setChatPrompt(prompt);
              }
              setHasOpenedChat(true);
              setActiveTab('chat');
            }}
          />
        )}
        {activeTab === 'review' && <StudentReview conceptId={selectedConceptId || undefined} />}
      </main>

      {/* Height and bottom padding are arbitrary values on purpose. The NDL preset
          extends Tailwind's spacing scale and its `20` key is 20px, not Tailwind's
          80px -- so `h-20` silently rendered this bar 20px tall, clipping every
          label, and `pb-20` would clear only 20px of it. 74px matches the artboard
          (docs/artboards/png/MobileHome.png). See CLAUDE.md, "Tailwind Configuration". */}
      <nav
        className='fixed inset-x-0 bottom-0 z-50 grid h-[74px] grid-cols-5 border-t border-stone-200 bg-white lg:hidden'
        aria-label='Mobile navigation'
      >
        {mobileTabs.map(({ key, label, icon: Icon }) => (
          <button
            type='button'
            key={key}
            aria-label={label}
            onClick={() => selectTab(key)}
            className={`flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-bold ${activeTab === key ? 'text-red-600' : 'text-slate-400'}`}
            style={{ border: 0, backgroundColor: '#fff', padding: '0.4rem' }}
          >
            <Icon className='h-6 w-6' />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

const StudentApp: React.FC = () => {
  return (
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
};

export default StudentApp;
