import { useNavigate } from 'react-router-dom';
import { useSession } from '../../context/session';
import { SKIP_AUTH } from '../../utils/Constants';
import Button from '../ui-kit/Button';
import CoraMark from '../ui-kit/CoraMark';
import { CtaStrip, Hero, ModesDemo, ReceiptsBand } from './LandingSections';

/**
 * The public page (DESIGN.md 5.1): explain CORA to a student in ten seconds
 * and get them signed in. Sign-in itself belongs to the session seam
 * (context/session.ts); this page never talks to the auth provider directly.
 */
const Landing = () => {
  const session = useSession();
  const navigate = useNavigate();
  const isSignedIn = !SKIP_AUTH && session.isAuthenticated;

  // With VITE_SKIP_AUTH there is no sign-in at all, so "Sign in" just opens the app.
  const signIn = () => (SKIP_AUTH ? navigate('/student') : session.signIn('/student'));
  const openApp = () => navigate('/student');

  const primary = isSignedIn ? (
    <Button size='lg' onClick={openApp}>
      Open CORA
    </Button>
  ) : (
    <Button size='lg' onClick={signIn} disabled={session.isLoading && !SKIP_AUTH}>
      Sign in
    </Button>
  );
  const secondary = isSignedIn ? null : (
    <Button variant='secondary' size='lg' onClick={openApp}>
      Look around as a guest
    </Button>
  );

  return (
    <div className='cora-root min-h-screen bg-white text-slate-900'>
      <a className='skip-link' href='#main'>
        Skip to content
      </a>
      <header className='sticky top-0 z-30 border-b border-red-100 bg-white/95 backdrop-blur'>
        <div className='mx-auto flex h-16 max-w-[1160px] items-center gap-6 px-4 sm:px-6'>
          <a href='/' className='flex items-center gap-2.5' aria-label='CORA home'>
            <CoraMark />
            <span className='font-display text-[19px] font-bold tracking-tight'>cora</span>
          </a>
          <nav className='hidden gap-6 text-[14px] text-slate-700 md:flex' aria-label='Page sections'>
            <a href='#modes' className='hover:text-red-700'>
              How it teaches
            </a>
            <a href='#sources' className='hover:text-red-700'>
              Sources
            </a>
          </nav>
          <span className='flex-1' />
          {isSignedIn ? (
            <Button size='sm' onClick={openApp}>
              Open CORA
            </Button>
          ) : (
            <Button variant='ghost' size='sm' onClick={signIn}>
              Sign in
            </Button>
          )}
        </div>
      </header>
      <main id='main'>
        <Hero actions={{ primary, secondary }} />
        <ModesDemo />
        <ReceiptsBand />
        <CtaStrip action={primary} />
      </main>
      <footer className='border-t border-red-100 bg-white'>
        <div className='mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-[13px] text-slate-500 sm:px-6'>
          <p>CORA, the Cognitive Operator Reactor Assistant</p>
          <p>A study aid. Facility procedures and qualified instructors are the authority.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
