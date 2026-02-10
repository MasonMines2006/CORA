import { Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ChatOnlyComponent from './components/ChatBot/ChatOnlyComponent';
import { AuthenticationGuard } from './components/Auth/Auth';
import Home from './Home';
import { SKIP_AUTH } from './utils/Constants.ts';

const RoleRoutedHome = () => {
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Poll for role changes
    const checkRole = () => {
      const currentRole = localStorage.getItem('userRole');
      if (currentRole) {
        setRole(currentRole);
        setIsLoading(false);
      }
    };

    // Check immediately
    checkRole();

    // Set up polling interval (check every 200ms for up to 5 seconds)
    const pollInterval = setInterval(checkRole, 200);
    const timeoutId = setTimeout(() => {
      clearInterval(pollInterval);
      setIsLoading(false);
      // Default to student if no role after timeout
      if (!localStorage.getItem('userRole')) {
        setRole('student');
      }
    }, 5000);

    // Listen for storage changes
    const handler = (event: StorageEvent) => {
      if (event.key === 'userRole') {
        setRole(event.newValue);
        setIsLoading(false);
      }
    };
    window.addEventListener('storage', handler);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeoutId);
      window.removeEventListener('storage', handler);
    };
  }, []);

  if (isLoading) {
    return <div className='p-6'>Loading your workspace…</div>;
  }

  if (role === 'student') {
    return <ChatOnlyComponent />;
  }

  // admins, TAs, test_full, fallback → full app
  return <Home />;
};

const App = () => {
  return (
    <Routes>
      <Route path='/' element={SKIP_AUTH ? <Home /> : <AuthenticationGuard component={RoleRoutedHome} />}></Route>
      <Route
        path='/callback'
        element={SKIP_AUTH ? <Home /> : <AuthenticationGuard component={RoleRoutedHome} />}
      ></Route>
      <Route path='/readonly' element={<Home />}></Route>
      <Route path='/chat-only' element={<ChatOnlyComponent />}></Route>
    </Routes>
  );
};
export default App;
