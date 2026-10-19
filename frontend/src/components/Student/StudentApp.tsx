import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HiOutlineChartBar } from 'react-icons/hi2';
import { useSession } from '../../context/session';
import ErrorBoundary from '../UI/ErrroBoundary';
import AskView from '../ask/AskView';
import { useSessionStore } from '../ask/useSessionStore';
import AppShell from '../shell/AppShell';
import { ShellAccount } from '../shell/account';
import { SessionSummary } from '../shell/types';
import PathView from '../path/PathView';
import ProgressView from '../progress/ProgressView';
import { useDashboard } from '../path/useDashboard';
import Button from '../ui-kit/Button';
import EmptyState from '../ui-kit/EmptyState';
import LessonPlayer from '../lesson/LessonPlayer';
import QuizPlayer, { QuizOutcome } from '../quiz/QuizPlayer';
import QuizResults from '../quiz/QuizResults';
import ReviewSession from './ReviewSession';
import StudentExplore from './StudentExplore';
import { isFocusView, StudentLocation, StudentView, parseLocation, toSearchParams } from './studentLocation';

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
  // Where the X in a lesson or quiz goes back to: the screen you opened it from.
  const [returnTo, setReturnTo] = useState<StudentLocation | null>(null);
  // The finished quiz, for the Results screen. Kept in memory only; a refresh shows a fallback.
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);

  const go = (next: StudentLocation, options: { replace?: boolean } = {}) => {
    if (next.view === 'graph') {
      setHasOpenedGraph(true);
    }
    if (isFocusView(next.view) && !isFocusView(location.view)) {
      setReturnTo(location);
    }
    setParams(toSearchParams(next), { replace: options.replace });
  };
  const leaveFocus = () => go(returnTo ?? { view: 'path', conceptId: '' });
  const signInHere = () => session.signIn(`/student?${params.toString()}`);
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

  const account: ShellAccount = {
    isAuthenticated: session.isAuthenticated,
    name: session.user?.name,
    email: session.user?.email,
    onSignIn: () => session.signIn('/student'),
    onSignOut: signOut,
  };

  // A lesson or quiz link with no concept has nothing to show, so it falls back to the Path.
  const needsConcept = location.view === 'lesson' || location.view === 'quiz';
  const shellView: StudentView = needsConcept && !location.conceptId ? 'path' : location.view;

  // Lessons, quizzes and results take the whole screen (FocusLayout), outside the shell.
  if (location.view === 'lesson' && location.conceptId) {
    return (
      <LessonPlayer
        key={location.conceptId}
        conceptId={location.conceptId}
        initialBeat={location.beat}
        onClose={leaveFocus}
        onAsk={modes.onAsk}
        onQuiz={(conceptId) => go({ view: 'quiz', conceptId }, { replace: true })}
        onLoaded={(name) => sessions.record('guide', location.conceptId, name)}
        onSignIn={signInHere}
      />
    );
  }
  if (location.view === 'quiz' && location.conceptId) {
    return (
      <QuizPlayer
        key={location.conceptId}
        conceptId={location.conceptId}
        onClose={leaveFocus}
        onAsk={modes.onAsk}
        onGuide={(conceptId) => go({ view: 'lesson', conceptId }, { replace: true })}
        onLoaded={(name) => sessions.record('quiz', location.conceptId, name)}
        onFinished={(finished) => {
          setOutcome(finished);
          // No dashboard reload here: going on to the Path or Progress reloads it.
          // Replace, so Back from Results doesn't land on a quiz that is already graded.
          go({ view: 'results', conceptId: location.conceptId }, { replace: true });
        }}
        onSignIn={signInHere}
      />
    );
  }
  if (location.view === 'results' && outcome) {
    return (
      <QuizResults
        outcome={outcome}
        onClose={() => goToView('path')}
        onProgress={() => goToView('progress')}
        onAsk={modes.onAsk}
        onGuide={modes.onGuide}
      />
    );
  }

  return (
    <AppShell
      active={shellView}
      onNavigate={goToView}
      fullHeight={location.view === 'ask'}
      dueCount={dashboard.status === 'ready' ? dashboard.data.review?.due_count : undefined}
      sessions={sessions.sessions}
      activeSessionId={location.view === 'ask' ? location.session : undefined}
      onOpenSession={openSession}
      onNewSession={() => goToView('ask')}
      account={account}
    >
      {shellView === 'path' && (
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

      {location.view === 'review' && (
        <div className='mx-auto max-w-[1120px] px-4 pb-10 pt-6 sm:px-8 lg:pt-10'>
          <h1 className='mb-6 font-display text-[30px] font-bold tracking-tight sm:text-[36px]'>Review</h1>
          <ReviewSession showRail onFindCards={() => goToView('path')} />
        </div>
      )}

      {location.view === 'results' && (
        <EmptyState
          icon={<HiOutlineChartBar className='h-6 w-6' />}
          title='These results are no longer on screen'
          actions={<Button onClick={() => goToView('progress')}>See progress</Button>}
        >
          Results are shown once, right after a quiz. Your mastery was saved and is on the Progress page.
        </EmptyState>
      )}

      {location.view === 'progress' && (
        <ProgressView dashboard={dashboard} onRetry={reloadDashboard} account={account} onQuiz={modes.onQuiz} />
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
