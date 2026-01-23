import { Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ChatOnlyComponent from './components/ChatBot/ChatOnlyComponent';
import { AuthenticationGuard } from './components/Auth/Auth';
import Home from './Home';
import { SKIP_AUTH } from './utils/Constants.ts';

const RoleRoutedHome = () => {
  const [role, setRole] = useState<string | null>(localStorage.getItem('userRole'));

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === 'userRole') {
        setRole(event.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    if (!role) {
      const timeout = setTimeout(() => setRole(localStorage.getItem('userRole')), 200);
      return () => clearTimeout(timeout);
    }
  }, [role]);

  if (!role) {
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
      <Route path='/readonly' element={<Home />}></Route>
      <Route path='/chat-only' element={<ChatOnlyComponent />}></Route>
    </Routes>
  );
};
export default App;
