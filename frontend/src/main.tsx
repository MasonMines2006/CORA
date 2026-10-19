import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import SessionProvider from './components/Auth/SessionProvider.tsx';
import App from './App.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    {/* Who is signed in, for every screen (see src/context/session.ts). */}
    <SessionProvider>
      <App />
    </SessionProvider>
  </BrowserRouter>
);
