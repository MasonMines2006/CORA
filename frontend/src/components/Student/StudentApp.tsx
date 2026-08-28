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

type Tab = 'chat' | 'explore' | 'learn';

const tabs: { key: Tab; label: string }[] = [
  { key: 'chat', label: 'Chat' },
  { key: 'explore', label: 'Explore' },
  { key: 'learn', label: 'Learn' },
];

const StudentLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [chatPrompt, setChatPrompt] = useState('');
  const { logout } = useAuth0();

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  return (
    <div className='flex min-h-screen flex-col bg-white text-slate-900'>
      <header className='sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-lg'>
        <div className='mx-auto flex max-w-5xl items-center justify-between px-6 py-3'>
          <div className='flex items-center gap-3'>
            <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-red-600'>
              <span className='text-sm font-semibold text-white'>C</span>
            </div>
            <span className='text-lg font-semibold tracking-tight text-slate-900'>Cora</span>
          </div>

          <nav className='flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1'>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            onClick={handleLogout}
            className='rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900'
          >
            Sign out
          </button>
        </div>
      </header>

      <main className='flex-1'>
        <div className={activeTab === 'chat' ? '' : 'hidden'}>
          <StudentChat externalPrompt={chatPrompt} onExternalPromptConsumed={() => setChatPrompt('')} />
        </div>
        <div className={activeTab === 'explore' ? '' : 'hidden'}>
          <StudentExplore />
        </div>
        {activeTab === 'learn' && (
          <StudentLearn
            onNavigateToChat={(prompt) => {
              if (prompt) {
                setChatPrompt(prompt);
              }
              setActiveTab('chat');
            }}
          />
        )}
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
