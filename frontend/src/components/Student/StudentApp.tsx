import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HiOutlineChartBar } from 'react-icons/hi2';
import ThemeWrapper from '../../context/ThemeWrapper';
import UserCredentialsWrapper from '../../context/UserCredentials';
import { FileContextProvider } from '../../context/UsersFiles';
import { MessageContextWrapper } from '../../context/UserMessages';
import { useSession } from '../../context/session';
import { SpotlightProvider } from '@neo4j-ndl/react';
import ErrorBoundary from '../UI/ErrroBoundary';
import AppShell from '../shell/AppShell';
import EmptyState from '../ui-kit/EmptyState';
import ConceptHub from './ConceptHub';
import ReviewSession from './ReviewSession';
import StudentChat from './StudentChat';
import StudentExplore from './StudentExplore';
import StudentHome from './StudentHomeArtboard';
import { StudentLocation, StudentView, parseLocation, toSearchParams } from './studentLocation';

const StudentLayout = () => {
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const location = parseLocation(params);
  // Ask keeps its conversation in component state, so once opened it stays
  // mounted (hidden) rather than being rebuilt on every visit.
  const [hasOpenedChat, setHasOpenedChat] = useState(location.view === 'ask');
  const [chatPrompt, setChatPrompt] = useState('');

  const go = (next: StudentLocation, options: { replace?: boolean } = {}) => {
    if (next.view === 'ask') {
      setHasOpenedChat(true);
    }
    setParams(toSearchParams(next), { replace: options.replace });
  };

  const goToView = (view: StudentView) => go({ view, conceptId: '' });
  const openLesson = (conceptId: string, beat?: number) => go({ view: 'lesson', conceptId, beat });

  const ask = (prompt: string) => {
    setChatPrompt(prompt);
    goToView('ask');
  };

  // A new page should start at the top, not wherever the last one was scrolled to.
  useEffect(() => {
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0 });
    }
  }, [location.view, location.conceptId]);

  const signOut = () => {
    localStorage.removeItem('userRole');
    session.signOut();
  };

  return (
    <AppShell
      active={location.view}
      onNavigate={goToView}
      sessions={[]}
      onOpenSession={() => goToView('ask')}
      onNewSession={() => goToView('ask')}
      account={{
        isAuthenticated: session.isAuthenticated,
        name: session.user?.name,
        email: session.user?.email,
        onSignIn: () => session.signIn('/student'),
        onSignOut: signOut,
      }}
    >
      {location.view === 'path' && (
        <StudentHome
          onOpenConcept={openLesson}
          onOpenExplore={() => goToView('graph')}
          onOpenReview={() => goToView('review')}
          onAsk={ask}
        />
      )}

      {(location.view === 'lesson' || location.view === 'quiz') && location.conceptId && (
        <ConceptHub
          key={location.conceptId}
          conceptId={location.conceptId}
          mode={location.view === 'quiz' ? 'practice' : 'learn'}
          initialBeat={location.beat}
          onModeChange={(mode) => go({ view: mode === 'practice' ? 'quiz' : 'lesson', conceptId: location.conceptId })}
          onOpenConcept={(conceptId) => openLesson(conceptId)}
          onAllConcepts={() => goToView('path')}
          onAsk={ask}
        />
      )}

      {location.view === 'review' && (
        <div className='mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12'>
          <ReviewSession showRail onFindCards={() => goToView('path')} />
        </div>
      )}

      {location.view === 'progress' && (
        <EmptyState icon={<HiOutlineChartBar className='h-6 w-6' />} title='Progress is on its way'>
          Your mastery by unit and the concepts that need work will show here.
        </EmptyState>
      )}

      {hasOpenedChat && (
        <div className={location.view === 'ask' ? '' : 'hidden'}>
          <StudentChat externalPrompt={chatPrompt} onExternalPromptConsumed={() => setChatPrompt('')} />
        </div>
      )}

      {/* The course map stays mounted: its force layout is expensive to rebuild. */}
      <div className={location.view === 'graph' ? '' : 'hidden'}>
        <StudentExplore
          onOpenConcept={(conceptId) => openLesson(conceptId)}
          onPracticeConcept={(conceptId) => go({ view: 'quiz', conceptId })}
        />
      </div>
    </AppShell>
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
