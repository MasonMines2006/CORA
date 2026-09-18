import { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import ThemeWrapper from '../../context/ThemeWrapper';
import UserCredentialsWrapper from '../../context/UserCredentials';
import { FileContextProvider } from '../../context/UsersFiles';
import { MessageContextWrapper } from '../../context/UserMessages';
import { SpotlightProvider } from '@neo4j-ndl/react';
import ErrorBoundary from '../UI/ErrroBoundary';
import StudentChat from './StudentChat';
import StudentExplore from './StudentExplore';
import StudentLearn from './StudentLearn';
import StudentAssess from './StudentAssess';
import StudentHome from './StudentHome';

type Tab = 'home' | 'learn' | 'assess' | 'explore' | 'chat';

const tabs: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'learn', label: 'Study' },
  { key: 'assess', label: 'Practice' },
  { key: 'explore', label: 'Graph' },
  { key: 'chat', label: 'Chat' },
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
    <div className='box-border flex min-h-screen flex-col bg-white text-slate-900'>
      <header className='sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-lg'>
        <div className='box-border mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6'>
          <div className='flex items-center gap-3'>
            <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-red-600'>
              <span className='text-sm font-semibold text-white'>C</span>
            </div>
            <span className='text-lg font-semibold tracking-tight text-slate-900'>Cora</span>
          </div>

          <nav
            className='order-3 flex w-full items-center gap-1 overflow-x-auto rounded-full border border-slate-200 bg-slate-50 p-1 sm:order-none sm:w-auto'
            aria-label='Student modes'
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => selectTab(tab.key)}
                className={`flex-1 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                  activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            onClick={handleAccountAction}
            className='rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900'
          >
            {isAuthenticated ? 'Sign out' : 'Sign in'}
          </button>
        </div>
      </header>

      <main className='flex-1'>
        {activeTab === 'home' && (
          <StudentHome
            onOpenConcept={(conceptId) => {
              setSelectedConceptId(conceptId);
              setActiveTab('learn');
            }}
            onOpenExplore={() => setActiveTab('explore')}
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
        {activeTab === 'assess' && <StudentAssess />}
      </main>
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
