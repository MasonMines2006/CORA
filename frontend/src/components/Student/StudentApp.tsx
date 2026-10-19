import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HiOutlineChartBar } from 'react-icons/hi2';
import { useSession } from '../../context/session';
import ErrorBoundary from '../UI/ErrroBoundary';
import AskView from '../ask/AskView';
import { useSessionStore } from '../ask/useSessionStore';
import AppShell from '../shell/AppShell';
import { SessionSummary } from '../shell/types';
import PathView from '../path/PathView';
import { useDashboard } from '../path/useDashboard';
import EmptyState from '../ui-kit/EmptyState';
import ConceptHub from './ConceptHub';
import ReviewSession from './ReviewSession';
import StudentExplore from './StudentExplore';
import { StudentLocation, StudentView, parseLocation, toSearchParams } from './studentLocation';

/**
 * The student app: one URL-driven view at a time inside the shell
 * (docs/redesign/DESIGN.md section 3). Data that several views share (the
 * dashboard and the recent-sessions list) is loaded here, once.
 */
const StudentLayout = () => {
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const location = parseLocation(params);
  const { dashboard, reload: reloadDashboard } = useDashboard();
  const sessions = useSessionStore(session.user?.email);
  // A question handed to Ask from another screen; Ask sends it once, then clears it.
  const [askPrompt, setAskPrompt] = useState('');
  // The course graph's force layout is expensive, so once opened it stays mounted (hidden).
  const [hasOpenedGraph, setHasOpenedGraph] = useState(location.view === 'graph');

  const go = (next: StudentLocation) => {
    if (next.view === 'graph') {
      setHasOpenedGraph(true);
    }
    setParams(toSearchParams(next));
  };
  const goToView = (view: StudentView) => go({ view, conceptId: '' });
  const concepts = dashboard.status === 'ready' ? dashboard.data.concepts.map((item) => item.concept) : [];
  const conceptName = (id: string) => concepts.find((concept) => concept.id === id)?.name ?? id;

  // The three ways into a concept, shared by every screen.
  const modes = {
    onGuide: (conceptId: string, beat?: number) => go({ view: 'lesson', conceptId, beat }),
    onQuiz: (conceptId: string) => go({ view: 'quiz', conceptId }),
    onAsk: (prompt: string, conceptId = '') => {
      setAskPrompt(prompt);
      go({ view: 'ask', conceptId });
    },
  };

  const openSession = (item: SessionSummary) => {
    if (item.mode === 'ask') {
      go({ view: 'ask', conceptId: item.conceptId ?? '', session: item.id });
      return;
    }
    go({ view: item.mode === 'guide' ? 'lesson' : 'quiz', conceptId: item.conceptId ?? '' });
  };

  // Mastery can change in a quiz or review, so refresh the numbers when coming back.
  // The very first render is skipped: useDashboard has just loaded them.
  const isFirstView = useRef(true);
  useEffect(() => {
    if (isFirstView.current) {
      isFirstView.current = false;
      return;
    }
    if (location.view === 'path' || location.view === 'progress') {
      reloadDashboard();
    }
  }, [location.view, reloadDashboard]);

  // A new page should start at the top, not wherever the last one was scrolled to.
  useEffect(() => {
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0 });
    }
  }, [location.view, location.conceptId]);

  // Sign-out forgets this device's sessions for that person (DESIGN.md 10, Phase 2).
  const signOut = () => {
    sessions.clear();
    localStorage.removeItem('userRole');
    session.signOut();
  };

  return (
    <AppShell
      active={location.view}
      onNavigate={goToView}
      fullHeight={location.view === 'ask'}
      dueCount={dashboard.status === 'ready' ? dashboard.data.review?.due_count : undefined}
      sessions={sessions.sessions}
      activeSessionId={location.view === 'ask' ? location.session : undefined}
      onOpenSession={openSession}
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
        <PathView
          dashboard={dashboard}
          onRetry={reloadDashboard}
          userName={session.user?.name}
          onReview={() => goToView('review')}
          onGraph={() => goToView('graph')}
          {...modes}
        />
      )}

      {location.view === 'ask' && (
        <AskView
          // Not keyed on the session: starting a session must not remount the view mid-answer.
          key={`ask-${location.conceptId}`}
          session={sessions.sessions.find((item) => item.id === location.session && item.mode === 'ask')}
          concepts={concepts}
          scopeConcept={
            location.conceptId ? { id: location.conceptId, name: conceptName(location.conceptId) } : undefined
          }
          initialPrompt={askPrompt}
          onPromptConsumed={() => setAskPrompt('')}
          upsert={sessions.upsert}
          update={sessions.update}
          onSessionStarted={(id) => setParams(toSearchParams({ ...location, session: id }), { replace: true })}
          onGuide={modes.onGuide}
          onQuiz={modes.onQuiz}
          onReview={() => goToView('review')}
          onSignIn={() => session.signIn('/student?view=ask')}
        />
      )}

      {(location.view === 'lesson' || location.view === 'quiz') && location.conceptId && (
        <ConceptHub
          key={location.conceptId}
          conceptId={location.conceptId}
          mode={location.view === 'quiz' ? 'practice' : 'learn'}
          initialBeat={location.beat}
          onModeChange={(mode) => go({ view: mode === 'practice' ? 'quiz' : 'lesson', conceptId: location.conceptId })}
          onOpenConcept={(conceptId) => modes.onGuide(conceptId)}
          onAllConcepts={() => goToView('path')}
          onAsk={(prompt) => modes.onAsk(prompt, location.conceptId)}
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

      {hasOpenedGraph && (
        <div className={location.view === 'graph' ? '' : 'hidden'}>
          <StudentExplore onOpenConcept={modes.onGuide} onPracticeConcept={modes.onQuiz} />
        </div>
      )}
    </AppShell>
  );
};

const StudentApp = () => (
  <ErrorBoundary>
    <StudentLayout />
  </ErrorBoundary>
);

export default StudentApp;
